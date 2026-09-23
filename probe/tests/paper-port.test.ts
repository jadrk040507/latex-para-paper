import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { expect, test, vi } from 'vitest';
import { createPaperPort } from '../src/paper-port';
import { expandFraction } from '../src/fraction';
const html = readFileSync(new URL('./fixtures/paper-equation.html', import.meta.url), 'utf8');
function setup(url = 'https://www.dropbox.com/paper/test') {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const input = doc.querySelector<HTMLInputElement>('.inline-latex-input')!;
  input.value = '//'; input.focus(); input.setSelectionRange(2, 2);
  return { dom, doc, input, port: createPaperPort(doc) };
}

test('reads only the observed editable equation structure', () => {
  const { port } = setup();
  expect(port.read()).toMatchObject({ text: '//', selection: { from: 2, to: 2 } });
});
test.each(['#comment', '#ordinary', '.ace-editor'])('does not activate on %s', (selector) => {
  const { doc, port } = setup(); (doc.querySelector(selector) as HTMLElement).focus();
  expect(port.read()).toBeNull();
});
test.each(['https://example.com', 'http://www.dropbox.com'])('refuses nonverified origin %s', (url) => {
  expect(setup(url).port.read()).toBeNull();
});
test.each(['readonly', 'disabled'])('does not edit %s input', (attribute) => {
  const { port, input } = setup(); input.setAttribute(attribute, '');
  expect(port.read()).toBeNull();
});
test('does not activate when the surrounding editor is read-only', () => {
  const { doc, port } = setup(); doc.querySelector('.ace-editor')!.setAttribute('contenteditable', 'false');
  expect(port.read()).toBeNull();
});
test('invalidates a replacement editor even when its text is the same', () => {
  const { input, port } = setup(); const before = port.read(); expect(before).not.toBeNull();
  const replacement = input.cloneNode(true) as HTMLInputElement;
  replacement.value = '//'; input.replaceWith(replacement); replacement.focus(); replacement.setSelectionRange(2, 2);
  expect(port.read()?.editorId).not.toBe(before!.editorId);
  expect(port.select(before!, { from: 0, to: 0 })).toBe(false);
});
test('rejects stale text before calling the native editor', () => {
  const { doc, input, port } = setup(); const snapshot = port.read()!; expect(snapshot).not.toBeNull();
  const edit = expandFraction(snapshot, { kind: 'insertText', composing: false })!;
  const command = vi.fn(() => true); doc.execCommand = command;
  input.value = 'external';
  expect(port.apply(edit)).toBe(false); expect(command).not.toHaveBeenCalled();
});
test('uses the native replacement operation and positions the first field', () => {
  const { doc, input, port } = setup(); const snapshot = port.read()!; expect(snapshot).not.toBeNull();
  // jsdom has no native editing/undo. Only this boundary is simulated here;
  // real Firefox tests must separately verify execCommand and native events.
  doc.execCommand = vi.fn((_name, _ui, text) => {
    input.setRangeText(text!, input.selectionStart!, input.selectionEnd!, 'end');
    input.dispatchEvent(new doc.defaultView!.InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    return true;
  });
  expect(port.apply(expandFraction(snapshot, { kind: 'insertText', composing: false })!)).toBe(true);
  expect(input.value).toBe('\\frac{}{}'); expect(input.selectionStart).toBe(6);
  expect(doc.execCommand).toHaveBeenCalledWith('insertText', false, '\\frac{}{}');
});
test('never falls back to directly writing values when native editing fails', () => {
  const { doc, input, port } = setup(); const snapshot = port.read()!; expect(snapshot).not.toBeNull();
  doc.execCommand = () => false;
  expect(port.apply(expandFraction(snapshot, { kind: 'insertText', composing: false })!)).toBe(false);
  expect(input.value).toBe('//'); expect(input.selectionStart).toBe(2);
});
test('disposed ports cannot edit or read', () => {
  const { port } = setup(); const before = port.read()!; expect(before).not.toBeNull(); port.dispose();
  expect(port.read()).toBeNull(); expect(port.select(before, { from: 0, to: 0 })).toBe(false);
});
