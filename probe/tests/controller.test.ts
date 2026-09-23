import { JSDOM } from 'jsdom';
import { expect, test, vi } from 'vitest';
import { startController } from '../src/controller';
import type { PaperPort } from '../src/types';

test('ignores script-generated input events rather than treating them as user edits', () => {
  const dom = new JSDOM('<input>');
  const apply = vi.fn(() => true);
  const read = vi.fn(() => ({ editorId: 'one', revision: 0, text: '//', selection: { from: 2, to: 2 } }));
  const port: PaperPort = { apply, read, select: () => true, dispose() {} };
  const controller = startController(dom.window.document, port);
  const element = dom.window.document.querySelector('input')!;
  for (const type of ['beforeinput', 'input']) element.dispatchEvent(new dom.window.InputEvent(type, { bubbles: true, inputType: 'insertText' }));
  expect(apply).not.toHaveBeenCalled(); expect(controller.status()).toEqual({ enabled: true, expansions: 0 });
  controller.dispose();
});

// The event bus models trusted browser callbacks without falsifying DOM isTrusted.
// The Firefox smoke test separately checks real native event generation.
function trustedHarness() {
  const target = {};
  const handlers = new Map<string, EventListener>();
  const doc = {
    activeElement: target,
    addEventListener: (name: string, handler: EventListener) => handlers.set(name, handler),
    removeEventListener: (name: string) => handlers.delete(name),
  } as unknown as Document;
  let state = { editorId: 'one', revision: 0, text: '', selection: { from: 0, to: 0 } };
  const port: PaperPort = {
    read: () => structuredClone(state),
    apply(edit) {
      state.text = state.text.slice(0, edit.replace.from) + edit.insert + state.text.slice(edit.replace.to);
      state.selection = { ...edit.fields[0] }; state.revision++; return true;
    },
    select(_snapshot, range) { state.selection = { ...range }; return true; },
    dispose() {},
  };
  const controller = startController(doc, port);
  function emit(name: string, more = {}) {
    let prevented = false;
    handlers.get(name)?.({ isTrusted: true, target, inputType: 'insertText', isComposing: false,
      preventDefault() { prevented = true; }, stopImmediatePropagation() {}, ...more } as unknown as Event);
    return prevented;
  }
  function type(text: string) {
    emit('keydown', { key: text }); emit('beforeinput');
    const pos = state.selection.from;
    state.text = state.text.slice(0, pos) + text + state.text.slice(state.selection.to);
    state.selection = { from: pos + text.length, to: pos + text.length }; state.revision++;
    emit('input');
  }
  return { controller, type, emit, read: () => state };
}

test('keeps Tab navigation when two field edits arrive before timers run', () => {
  vi.useFakeTimers();
  const h = trustedHarness();
  try {
    h.type('/'); vi.runOnlyPendingTimers(); h.type('/'); vi.runOnlyPendingTimers();
    expect(h.read().text).toBe('\\frac{}{}');
    h.type('a'); h.type('b');
    expect(h.emit('keydown', { key: 'Tab' })).toBe(true);
    expect(h.read().text).toBe('\\frac{ab}{}'); expect(h.read().selection.from).toBe(10);
  } finally { h.controller.dispose(); vi.useRealTimers(); }
});

test('handles Tab immediately after the expansion trigger, before its timer', () => {
  vi.useFakeTimers();
  const h = trustedHarness();
  try {
    h.type('/'); vi.runOnlyPendingTimers(); h.type('/');
    expect(h.emit('keydown', { key: 'Tab' })).toBe(true);
    expect(h.read().text).toBe('\\frac{}{}'); expect(h.read().selection.from).toBe(8);
  } finally { h.controller.dispose(); vi.useRealTimers(); }
});
