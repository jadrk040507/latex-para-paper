import type { PaperPort } from './types';
import { createSession } from './session';

/** Installs only local input listeners; does not store or transmit equation text. */
export function startController(doc: Document, port: PaperPort) {
  const session = createSession(port);
  let composing = false, compositionCommit = false, mutating = false, disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expansions = 0;
  const clear = () => { clearTimeout(timer); timer = undefined; };
  const cancel = () => { clear(); session.cancel(); };
  const context = (event: InputEvent) => ({ kind: event.inputType, composing: composing || compositionCommit || event.isComposing });
  const flush = () => {
    clear();
    if (disposed) return;
    const before = port.read();
    mutating = true;
    try {
      session.flush();
      const after = port.read();
      if (before && after && after.text !== before.text) expansions++;
    } finally { mutating = false; }
  };
  const before = (event: Event) => {
    if (mutating || disposed) return;
    clear();
    if (!event.isTrusted || event.target !== doc.activeElement) { cancel(); return; }
    session.beforeInput(context(event as InputEvent));
  };
  const input = (event: Event) => {
    if (mutating || disposed) return;
    if (!event.isTrusted || event.target !== doc.activeElement) { cancel(); return; }
    // Update field positions synchronously so rapid edits cannot drop earlier work.
    session.onInput(context(event as InputEvent));
    clear();
    // Only the native expansion is deferred to avoid recursive execCommand calls.
    timer = setTimeout(flush, 0);
  };
  const keydown = (event: Event) => {
    const key = event as KeyboardEvent;
    if (!key.isTrusted || disposed) return;
    if (key.isComposing || key.keyCode === 229) { cancel(); return; }
    if (!composing) compositionCommit = false;
    if (key.ctrlKey || key.metaKey || key.altKey) { cancel(); return; }
    flush(); // Apply a queued expansion before the next key changes text or focus.
    mutating = true;
    try {
      const handled = key.key === 'Tab' ? session.onTab(key.shiftKey) : session.onKey(key.shiftKey && key.key==='Enter' ? 'Shift+Enter' : key.key);
      if (handled) { key.preventDefault(); key.stopImmediatePropagation(); }
      else if (['Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key.key)) cancel();
    } finally { mutating = false; }
  };
  const compositionStart = () => { composing = true; compositionCommit = true; cancel(); };
  const compositionEnd = () => { composing = false; compositionCommit = true; cancel(); };
  const listeners: [string, EventListener][] = [
    ['beforeinput', before], ['input', input], ['keydown', keydown],
    ['compositionstart', compositionStart], ['compositionend', compositionEnd],
    ['focusout', cancel], ['pointerdown', cancel],
  ];
  for (const [name, callback] of listeners) doc.addEventListener(name, callback, true);
  return {
    status: () => ({ enabled: !disposed, expansions }),
    dispose() {
      if (disposed) return;
      disposed = true; cancel(); session.dispose();
      for (const [name, callback] of listeners) doc.removeEventListener(name, callback, true);
    },
  };
}
