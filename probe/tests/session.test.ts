import { expect, test } from 'vitest';
import { createSession } from '../src/session';
import type { PaperPort, Snapshot, InputContext } from '../src/types';
const typed = { kind: 'insertText', composing: false };
function setup() {
  let snapshot: Snapshot = { editorId: 'one', revision: 0, text: '', selection: { from: 0, to: 0 } };
  let rejectApply = false, rejectSelect = false;
  const port: PaperPort = {
    read: () => structuredClone(snapshot),
    apply(edit) {
      if (rejectApply) return false;
      snapshot.text = snapshot.text.slice(0, edit.replace.from) + edit.insert + snapshot.text.slice(edit.replace.to);
      snapshot.revision++; snapshot.selection = { ...(edit.fields[0] ?? {from:edit.exit,to:edit.exit}) }; return true;
    },
    select(_expected, selection) { if (rejectSelect) return false; snapshot.selection = { ...selection }; return true; },
    dispose() {},
  };
  const session = createSession(port);
  function type(text: string, context: InputContext = typed) {
    session.beforeInput(context);
    const { from, to } = snapshot.selection;
    snapshot.text = snapshot.text.slice(0, from) + text + snapshot.text.slice(to);
    snapshot.selection = { from: from + text.length, to: from + text.length }; snapshot.revision++;
    session.onInput(context); session.flush();
  }
  return { session, type, read: () => snapshot, rejectApply: () => { rejectApply = true; }, rejectSelect: () => { rejectSelect = true; } };
}

test('expands fraction and maps both fields while typing', () => {
  const s = setup(); s.type('/'); s.type('/');
  expect(s.read().text).toBe('\\frac{}{}'); expect(s.read().selection).toEqual({ from: 6, to: 6 });
  s.type('a'); expect(s.session.onTab(false)).toBe(true); expect(s.read().selection.from).toBe(9);
  s.type('b'); expect(s.read().text).toBe('\\frac{a}{b}');
  expect(s.session.onTab(true)).toBe(true); expect(s.read().selection.from).toBe(7);
  expect(s.session.onTab(false)).toBe(true); expect(s.read().selection.from).toBe(10);
  expect(s.session.onTab(false)).toBe(true); expect(s.read().selection.from).toBe(11);
  expect(s.session.onTab(false)).toBe(false);
});
test('Shift+Tab at first field ends the session and preserves native focus behavior', () => {
  const s = setup(); s.type('/'); s.type('/');
  expect(s.session.onTab(true)).toBe(false); expect(s.session.onTab(false)).toBe(false);
});
test.each(['editor', 'revision', 'text', 'selection'])('cancels when %s changes outside the session', (change) => {
  const s = setup(); s.type('/'); s.type('/'); expect(s.read().text).toBe('\\frac{}{}');
  if (change === 'editor') s.read().editorId = 'replacement';
  if (change === 'revision') s.read().revision++;
  if (change === 'text') s.read().text = 'external';
  if (change === 'selection') s.read().selection = { from: 0, to: 0 };
  expect(s.session.onTab(false)).toBe(false);
});
test('ignores input without a paired local beforeinput', () => {
  const s = setup(); s.read().text = '//'; s.read().selection = { from: 2, to: 2 };
  s.session.onInput(typed); expect(s.read().text).toBe('//');
});
test.each(['insertFromPaste', 'insertCompositionText', 'historyUndo', 'historyRedo'])('ignores %s and releases Tab', (kind) => {
  const s = setup(); s.type('//', { kind, composing: false });
  expect(s.read().text).toBe('//'); expect(s.session.onTab(false)).toBe(false);
});
test('does not expand an IME commit reported as insertText', () => {
  const s = setup(); s.type('//', { kind: 'insertText', composing: true }); expect(s.read().text).toBe('//');
});
test('failed native apply leaves no active fields', () => {
  const s = setup(); s.rejectApply(); s.type('/'); s.type('/');
  expect(s.read().text).toBe('//'); expect(s.session.onTab(false)).toBe(false);
});
test('failed cursor movement ends the session', () => {
  const s = setup(); s.type('/'); s.type('/'); s.rejectSelect();
  expect(s.session.onTab(false)).toBe(false); expect(s.session.onTab(false)).toBe(false);
});
test.each(['cancel', 'dispose'] as const)('%s releases Tab', (method) => {
  const s = setup(); s.type('/'); s.type('/'); s.session[method](); expect(s.session.onTab(false)).toBe(false);
});
test('backspace within a field remaps later placeholders', () => {
  const s = setup(); s.type('/'); s.type('/'); s.type('ab');
  const context = { kind: 'deleteContentBackward', composing: false };
  s.session.beforeInput(context);
  s.read().text = '\\frac{a}{}'; s.read().selection = { from: 7, to: 7 }; s.read().revision++;
  s.session.onInput(context);
  expect(s.session.onTab(false)).toBe(true); expect(s.read().selection.from).toBe(9);
});
test('deleting across a field boundary cancels navigation', () => {
  const s = setup(); s.type('/'); s.type('/');
  const context = { kind: 'deleteContentBackward', composing: false };
  s.session.beforeInput(context); s.read().text = '\\frac}{}'; s.read().selection = { from: 5, to: 5 }; s.read().revision++;
  s.session.onInput(context); expect(s.session.onTab(false)).toBe(false);
});

test('square root navigation exits after its braces', () => {
  const s = setup(); for (const key of 'sq') s.type(key);
  expect(s.read().text).toBe('\\sqrt{}');
  s.type('x'); expect(s.session.onTab(false)).toBe(true);
  expect(s.read().selection.from).toBe(8);
});
test('Greek and superscript expansion inside numerator preserve denominator navigation', () => {
  const s = setup(); for (const key of '//@asr') s.type(key);
  expect(s.read().text).toBe('\\frac{\\alpha^{2}}{}');
  expect(s.session.onTab(false)).toBe(true);
  s.type('b'); expect(s.read().text).toBe('\\frac{\\alpha^{2}}{b}');
});
test('root inside fraction returns to parent field then denominator', () => {
  const s = setup(); for (const key of '//sqx') s.type(key);
  expect(s.read().text).toBe('\\frac{\\sqrt{x}}{}');
  expect(s.session.onTab(false)).toBe(true);
  expect(s.read().selection.from).toBe(14);
  expect(s.session.onTab(false)).toBe(true);
  s.type('b'); expect(s.read().text).toBe('\\frac{\\sqrt{x}}{b}');
});
test('Tab expands manual derivative and typed defaults are replaced', () => {
 const s=setup(); for(const key of 'par') s.type(key);
 expect(s.session.onTab(false)).toBe(true);
 s.type('f'); expect(s.session.onTab(false)).toBe(true); s.type('t');
 expect(s.read().text).toBe('\\frac{ \\partial f }{ \\partial t } ');
});
test('editing repeated fields mirrors text while typing', () => {
 const s=setup(); for(const key of 'outer') s.type(key);
 s.type('x'); expect(s.read().text).toBe('\\ket{x} \\bra{x} ');
 expect(s.session.onTab(false)).toBe(true);
});
test('visual key replaces selected equation text', () => {
 const s=setup(); s.type('x+y'); s.read().selection={from:0,to:3};
 expect(s.session.onKey('U')).toBe(true);
 expect(s.read().text).toBe('\\underbrace{ x+y }_{  }');
});
test('matrix keys insert cells and rows, then Shift+Enter exits', () => {
 const s=setup(); for(const key of 'pmat') s.type(key); s.type('a');
 expect(s.session.onTab(false)).toBe(true); s.type('b');
 expect(s.session.onKey('Enter')).toBe(true); s.type('c');
 expect(s.read().text).toBe('\\begin{pmatrix}a & b \\\\ c\\end{pmatrix}');
 expect(s.session.onKey('Shift+Enter')).toBe(true);
 expect(s.read().selection.from).toBe(s.read().text.length);
});
test('typing a paired closing delimiter moves over it', () => {
 const s=setup(); s.type('('); s.type('x'); expect(s.session.onKey(')')).toBe(true);
 expect(s.read().text).toBe('(x)'); expect(s.read().selection.from).toBe(3);
});

test('Taylor fields update multiple mirrors and keep later defaults aligned', () => {
 const s=setup(); for(const key of 'tayl') s.type(key);
 s.type('g'); expect(s.read().text.match(/g/g)).toHaveLength(4);
 expect(s.session.onTab(false)).toBe(true); s.type('z');
 expect(s.read().text.match(/z/g)).toHaveLength(4);
 expect(s.session.onTab(false)).toBe(true); s.type('k');
 expect(s.read().text.match(/k/g)).toHaveLength(3);
});
test('begin environment mirrors its name without expanding inside it', () => {
 const s=setup(); for(const key of ' beg') s.type(key);
 for(const key of 'matrix') s.type(key);
 expect(s.read().text).toBe(' \\begin{matrix}  \\end{matrix}');
});

import catalog from '../vendor/default-snippets.json';
import { renderTemplate } from '../src/snippets';
const literalCases=catalog.filter(s=>!s.regex && s.replacement!==null && s.options.includes('A') && !/[tTMv]/.test(s.options));
test.each(literalCases.map(s=>[s.trigger,s.replacement!] as const))('replays bundled literal %s through typing events', (trigger,replacement) => {
 const s=setup(); for(const key of trigger) s.type(key);
 const expected=renderTemplate(trigger==='sq'?'\\sqrt{$0}$1':replacement,0).insert;
 expect(s.read().text).toBe(expected);
});
test('closing a nested pair preserves the parent fraction fields', () => {
 const s=setup(); for(const key of '//(x') s.type(key);
 expect(s.session.onKey(')')).toBe(true);
 expect(s.session.onTab(false)).toBe(true); s.type('y');
 expect(s.read().text).toBe('\\frac{(x)}{y}');
});
test.each([['sin','\\sin'],['alpha','\\alpha'],['log','\\log'],['int','\\int']])('expands %s at the start of a nested field', (trigger,expected) => {
 const s=setup(); for(const key of '//'+trigger) s.type(key);
 expect(s.read().text).toBe('\\frac{'+expected+'}{}');
 // Tab after \\int intentionally opens its manual integral template.
 if(trigger==='int') return;
 expect(s.session.onTab(false)).toBe(true); s.type('y');
 expect(s.read().text).toBe('\\frac{'+expected+'}{y}');
});
