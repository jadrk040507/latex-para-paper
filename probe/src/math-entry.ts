/** Native Paper math entry from its main rich-text editor; no HTML/model writes. */
export type Entry = {
  trigger: 'mk' | 'dm';
  editor: HTMLElement;
  line: HTMLElement;
  source: string;
  prefix: string;
  range: Range;
  caret: Range;
};
const excluded = 'input,textarea,pre,code,[contenteditable="false"],[role="dialog"],form';
export function readEntry(doc: Document): Entry | null {
  if (doc.location.origin !== 'https://www.dropbox.com') return null;
  const selection = doc.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount !== 1) return null;
  const caret = selection.getRangeAt(0);
  const node = caret.startContainer;
  const element = node.nodeType === 1 ? node as Element : node.parentElement;
  if (!element || element.closest(excluded)) return null;
  const line = element.closest<HTMLElement>('.ace-line');
  const editor = line?.closest<HTMLElement>('.ace-editor.zoneId-0[contenteditable="true"]');
  if (!line || !editor || doc.activeElement !== editor || line.closest('h1,[role="heading"]')) return null;
  const prefixRange = doc.createRange();
  prefixRange.selectNodeContents(line);
  try { prefixRange.setEnd(caret.startContainer, caret.startOffset); } catch { return null; }
  const prefix = prefixRange.toString();
  const match = /(?:^|\s)(mk|dm)$/.exec(prefix);
  if (!match) return null;
  const trigger = match[1] as 'mk' | 'dm';
  const suffixRange = doc.createRange();
  suffixRange.selectNodeContents(line);
  suffixRange.setStart(caret.endContainer, caret.endOffset);
  // Display entry is intentionally restricted to the end of a paragraph.
  if (trigger === 'dm' && suffixRange.toString().trim()) return null;
  const from = prefix.length - 2;
  const walker = doc.createTreeWalker(line, 4 /* SHOW_TEXT */);
  let position = 0;
  let start: Node | null = null;
  let offset = 0;
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const length = text.textContent?.length ?? 0;
    if (from < position + length) { start = text; offset = from - position; break; }
    position += length;
  }
  if (!start || start.parentElement?.closest(excluded)) return null;
  const range = caret.cloneRange();
  range.setStart(start, offset);
  if (range.toString() !== trigger || range.cloneContents().querySelector(excluded)) return null;
  return { trigger, editor, line, prefix, source: line.textContent ?? '', range, caret: caret.cloneRange() };
}
export function replaceEntry(doc: Document, entry: Entry): boolean {
  const current = readEntry(doc);
  if (!current || typeof doc.execCommand !== 'function' || current.editor !== entry.editor ||
      current.line !== entry.line || current.source !== entry.source || current.prefix !== entry.prefix ||
      current.trigger !== entry.trigger || current.caret.startContainer !== entry.caret.startContainer ||
      current.caret.startOffset !== entry.caret.startOffset) return false;
  const selection = doc.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(current.range);
  // A single native insertion preserves undo. Paper must still recognize its own
  // $$ entry; success here means command acceptance, not a saved equation.
  const insert = entry.trigger === 'dm' && entry.prefix.slice(0, -2).trim() ? '\n$$' : '$$';
  let accepted = false;
  try { accepted = doc.execCommand('insertText', false, insert); } catch { /* Do not fall back to DOM writes. */ }
  if (!accepted && current.line.isConnected && current.line.textContent === entry.source) {
    selection.removeAllRanges(); selection.addRange(entry.caret);
  }
  return accepted;
}

export function startMathEntry(doc: Document) {
  let disposed = false, composing = false, compositionCommit = false, mutating = false;
  let before: { line: Element; prefix: string; source: string; key: string } | null = null;
  let queued: Entry | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observer: MutationObserver | undefined;
  let confirmation: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let outcome = 'idle';
  let lastTrigger: 'mk' | 'dm' | null = null;
  let lastStage = 'idle';
  let attemptedTrigger: 'mk' | 'dm' | null = null;
  const clear = () => { queued = null; before = null; clearTimeout(timer); timer = undefined; };
  const finishObservation = () => { observer?.disconnect(); observer = undefined; clearTimeout(confirmation); };
  function confirm() {
    const input = doc.activeElement as HTMLInputElement | null;
    if (!input?.matches('input.inline-latex-input') || !input.closest('.inline-latex')) return false;
    outcome = 'native-equation-opened'; finishObservation(); return true;
  }
  function flush() {
    const entry = queued; clear();
    if (!entry || disposed) return;
    finishObservation(); attempts++; attemptedTrigger = entry.trigger; lastStage = 'native-command';
    mutating = true;
    try {
      if (!replaceEntry(doc, entry)) { outcome = 'native-command-rejected'; return; }
      outcome = 'awaiting-native-equation';
      if (confirm()) return;
      const Observer = doc.defaultView?.MutationObserver;
      if (Observer) {
        observer = new Observer(() => { confirm(); });
        observer.observe(entry.editor, { childList: true, subtree: true });
      }
      confirmation = setTimeout(() => {
        if (!confirm()) { outcome = 'entry-text-only'; finishObservation(); }
      }, 500);
    } finally { mutating = false; }
  }
  const onBefore = (event: Event) => {
    if (disposed || mutating) return;
    clear();
    const input = event as InputEvent;
    if (input.isTrusted && lastStage === 'keydown') lastStage = 'beforeinput';
    if (!input.isTrusted || input.inputType !== 'insertText' || composing || compositionCommit || input.isComposing ||
        !['k', 'm'].includes(input.data ?? '')) return;
    const selection = doc.getSelection();
    if (!selection?.isCollapsed || !selection.rangeCount) return;
    const caret = selection.getRangeAt(0);
    const element = caret.startContainer.nodeType === 1 ? caret.startContainer as Element : caret.startContainer.parentElement;
    const line = element?.closest('.ace-line');
    if (!line || element?.closest(excluded) || doc.activeElement !== line.closest('.ace-editor.zoneId-0[contenteditable="true"]')) return;
    const prefix = doc.createRange(); prefix.selectNodeContents(line); prefix.setEnd(caret.startContainer, caret.startOffset);
    if (lastStage === 'beforeinput') lastStage = 'beforeinput-accepted';
    before = { line, prefix: prefix.toString(), source: line.textContent ?? '', key: input.data! };
  };
  const onInput = (event: Event) => {
    if (disposed || mutating) return;
    const old = before; before = null;
    const input = event as InputEvent;
    if (!old || !input.isTrusted || composing || compositionCommit || input.isComposing || input.inputType !== 'insertText' || input.data !== old.key) return;
    if (lastTrigger) lastStage = 'input-paired';
    const entry = readEntry(doc);
    if (!entry && lastTrigger) lastStage = 'entry-not-eligible';
    if (!entry || entry.line !== old.line || entry.prefix !== old.prefix + old.key ||
        entry.source !== old.source.slice(0, old.prefix.length) + old.key + old.source.slice(old.prefix.length)) return;
    lastTrigger = entry.trigger; lastStage = 'queued';
    queued = entry; timer = setTimeout(flush, 0);
  };
  const onKey = (event: Event) => {
    const key = event as KeyboardEvent;
    if (disposed || !key.isTrusted || mutating) return;
    if (key.ctrlKey || key.altKey || key.metaKey || key.isComposing || key.keyCode === 229) { clear(); return; }
    if (!composing) compositionCommit = false;
    flush();
    // Record only recognized shortcut names, never surrounding document text.
    if (!composing && (key.key === 'm' || key.key === 'k')) {
      const selection = doc.getSelection();
      if (!selection?.isCollapsed || !selection.rangeCount) return;
      const caret = selection.getRangeAt(0);
      const element = caret.startContainer.nodeType === 1 ? caret.startContainer as Element : caret.startContainer.parentElement;
      const line = element?.closest('.ace-line');
      if (!line || element?.closest(excluded)) return;
      const prefix = doc.createRange(); prefix.selectNodeContents(line);
      prefix.setEnd(caret.startContainer, caret.startOffset);
      const match = /(?:^|\s)(mk|dm)$/.exec(prefix.toString() + key.key);
      if (match) { lastTrigger = match[1] as 'mk' | 'dm'; lastStage = 'keydown'; }
    }
  };
  const startComposition = () => { composing = true; compositionCommit = true; clear(); };
  const endComposition = () => { composing = false; compositionCommit = true; clear(); };
  const listeners: [string, EventListener][] = [
    ['beforeinput', onBefore], ['input', onInput], ['keydown', onKey],
    ['compositionstart', startComposition], ['compositionend', endComposition], ['focusout', clear], ['pointerdown', clear],
  ];
  // Capture at Window before Paper's Document capture listeners. If Paper
  // stops propagation there, a Document listener can miss native input.
  const eventRoot: Document | Window = doc.defaultView ?? doc;
  for (const [name, callback] of listeners) eventRoot.addEventListener(name, callback, true);
  return {
    status: () => ({ enabled: !disposed, attempts, outcome, attemptedTrigger, lastTrigger, lastStage }),
    dispose() {
      disposed = true; clear(); finishObservation();
      for (const [name, callback] of listeners) eventRoot.removeEventListener(name, callback, true);
    },
  };
}
