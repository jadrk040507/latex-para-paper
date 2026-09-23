import { expect, test } from 'vitest';
import { expandFraction } from '../src/fraction';
import type { Snapshot } from '../src/types';

const typed = { kind: 'insertText', composing: false };
const atEnd = (text: string): Snapshot => ({
  editorId: 'equation-1', revision: 1, text,
  selection: { from: text.length, to: text.length },
});

test('replaces only the trigger and positions the two fraction fields', () => {
  const s = atEnd('z+//');
  expect(expandFraction(s, typed)).toEqual({
    expected: s, replace: { from: 2, to: 4 }, insert: '\\frac{}{}',
    fields: [{ from: 8, to: 8 }, { from: 10, to: 10 }], exit: 11,
  });
});

test('counts a non-BMP prefix in UTF-16 offsets', () => {
  const edit = expandFraction(atEnd('𝛼//'), typed);
  expect(edit?.replace).toEqual({ from: 2, to: 4 });
  expect(edit?.fields).toEqual([{ from: 8, to: 8 }, { from: 10, to: 10 }]);
});

test('preserves text after the caret', () => {
  const s = { ...atEnd('x+//+y'), selection: { from: 4, to: 4 } };
  const edit = expandFraction(s, typed);
  expect(edit).not.toBeNull();
  if (!edit) throw new Error('Expected a fraction expansion');
  expect(s.text.slice(0, edit.replace.from) + edit.insert + s.text.slice(edit.replace.to))
    .toBe('x+\\frac{}{}+y');
});

test.each(['', '/', 'x/y', '//x'])('leaves nontrigger text %j unchanged', (text) => {
  expect(expandFraction(atEnd(text), typed)).toBeNull();
});

test('does not replace a selection', () => {
  expect(expandFraction({ ...atEnd('//'), selection: { from: 0, to: 2 } }, typed)).toBeNull();
});

test.each([
  { kind: 'insertFromPaste', composing: false },
  { kind: 'insertText', composing: true },
  { kind: 'insertCompositionText', composing: false },
  { kind: 'insertFromComposition', composing: false },
  { kind: 'historyUndo', composing: false },
  { kind: 'historyRedo', composing: false },
  { kind: 'deleteContentBackward', composing: false },
])('does not trigger on input context %j', (context) => {
  expect(expandFraction(atEnd('//'), context)).toBeNull();
});

test.each([-1, 3, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
  'rejects invalid selection offset %s', (offset) => {
    expect(expandFraction({ ...atEnd('//'), selection: { from: offset, to: offset } }, typed)).toBeNull();
  },
);

test('does not mutate the supplied snapshot', () => {
  const selection = Object.freeze({ from: 2, to: 2 });
  const s = Object.freeze({ ...atEnd('//'), selection });
  expect(expandFraction(s, typed)?.insert).toBe('\\frac{}{}');
  expect(s.text).toBe('//');
  expect(s.selection).toEqual({ from: 2, to: 2 });
});
