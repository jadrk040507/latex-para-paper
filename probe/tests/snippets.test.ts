import { expect, test } from 'vitest';
import { expandSnippet } from '../src/snippets';
const expand = (text: string, from = text.length) => expandSnippet({editorId:'x', revision:0,text,selection:{from,to:from}}, {kind:'insertText',composing:false});
test.each([['xsr','^{2}'],['sq','\\sqrt{}'],['@a','\\alpha'],['@t','\\theta'],['@G','\\Gamma']])('expands %s', (input, output) => {
  expect(expand(input)?.insert).toBe(output);
});
test('root positions its field and exit', () => {
  expect(expand('sq')).toMatchObject({fields:[{from:6,to:6}],exit:7});
});
test('plain replacements have no placeholder session', () => {
  expect(expand('xsr')).toMatchObject({fields:[],exit:5});
});
test.each(['\\sq','\\textsr','@unknown'])('leaves unsupported context %s unchanged', text => expect(expand(text)).toBeNull());
test('matches at the caret without consuming following source', () => {
  expect(expand('xsr+y',3)?.replace).toEqual({from:1,to:3});
});
