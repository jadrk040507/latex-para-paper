import { expect, test } from 'vitest';
import { expandSnippet } from '../src/snippets';
const edit = (text: string, kind='insertText', selection={from:text.length,to:text.length}) => expandSnippet({editorId:'one',revision:0,text,selection},{kind,composing:false});
test.each([
 ['xcb','x^{3}'],['ooo','\\infty'],['RR','\\mathbb{R}'],['>=','\\geq'],
 ['xhat','\\hat{x}'],['2rt','\\sqrt[2]{  }'],['x3','x_{3}'],['x_{3}4','x_{34}'],
 ['sin','\\sin'],['dint','\\int_{0}^{1}  \\, dx '],['pmat','\\begin{pmatrix}\\end{pmatrix}'],
 ['iden2','\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}'],
])('catalog %s expands to source', (text, expected) => {
 const e=edit(text); expect(e && text.slice(0,e.replace.from)+e.insert+text.slice(e.replace.to)).toBe(expected);
});
test('manual derivative expands on Tab only', () => {
 expect(edit('par')).toBeNull(); expect(edit('par','manual')?.insert).toBe('\\frac{ \\partial y }{ \\partial x } ');
});
test('visual snippets wrap selected math', () => {
 expect(edit('x+y','visual:U',{from:0,to:3})?.insert).toBe('\\underbrace{ x+y }_{  }');
});
test.each(['\\text{sr','\\ce{H2','\\pu{m2'])('respects context %s', text => expect(edit(text)).toBeNull());
test('repeated fields identify mirrors', () => {
 const e=edit('outer'); expect(e?.fields).toHaveLength(1); expect(e?.mirrors?.[0]).toHaveLength(1);
});
test('automatic fraction consumes a balanced operand', () => {
 expect(edit('(a+b)/')?.insert).toBe('\\frac{a+b}{}');
});
