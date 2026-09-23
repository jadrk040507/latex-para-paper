import { JSDOM } from 'jsdom';
import { expect, test } from 'vitest';
import { inspectEditor } from '../src/inspect-editor';

function page(html: string, url = 'https://paper.dropbox.com/doc/test') {
  return new JSDOM(html, { url }).window.document;
}

test('describes the focused textarea without reading its content', () => {
  const doc = page('<div class="math-editor"><textarea>PRIVATE EQUATION</textarea></div>');
  const input = doc.querySelector('textarea')!;
  input.focus();
  Object.defineProperty(input, 'value', { get() { throw new Error('Must not read content'); } });
  const result = inspectEditor(doc);
  expect(result).toMatchObject({
    status: 'inspected', host: 'paper.dropbox.com',
    active: { tag: 'textarea', selectionAPI: true },
    ancestors: [{ tag: 'div', classes: ['math-editor'] }],
  });
  expect(JSON.stringify(result)).not.toContain('PRIVATE EQUATION');
});

test('describes a contenteditable surface without serializing text or attributes', () => {
  const doc = page('<div contenteditable="true" role="textbox" tabindex="0" data-document="PRIVATE-ID" aria-label="PRIVATE TITLE">PRIVATE TEXT</div>');
  doc.querySelector('div')!.focus();
  expect(inspectEditor(doc)).toMatchObject({
    status: 'inspected', active: { tag: 'div', editable: 'true', role: 'textbox' },
  });
  expect(JSON.stringify(inspectEditor(doc))).not.toContain('PRIVATE');
});

test.each(['https://example.com', 'https://dropbox.com.attacker.test', 'http://paper.dropbox.com'])('refuses unsupported origin %s', (url) => {
  expect(inspectEditor(page('<textarea></textarea>', url))).toEqual({ status: 'unsupported-origin' });
});

test('refuses login forms', () => {
  const doc = page('<form><input type="password" value="SECRET"></form>', 'https://www.dropbox.com/login');
  doc.querySelector('input')!.focus();
  expect(inspectEditor(doc)).toEqual({ status: 'form-or-input' });
});

test('reports missing focus without enumerating the document', () => {
  expect(inspectEditor(page('<textarea>PRIVATE</textarea>'))).toEqual({ status: 'focus-an-equation' });
});

test('reports an iframe boundary without reading embedded content', () => {
  const doc = page('<iframe src="about:blank"></iframe>');
  doc.querySelector('iframe')!.focus();
  expect(inspectEditor(doc)).toMatchObject({ status: 'frame-boundary', active: { tag: 'iframe' } });
});

test('inspects a plain text equation input inside a form without reading its value', () => {
  const doc = page('<form class="equation-form"><input type="text" class="equation-source" value="PRIVATE EQUATION"></form>');
  const input = doc.querySelector('input')!;
  input.focus();
  Object.defineProperty(input, 'value', { get() { throw new Error('Must not read content'); } });
  const report = inspectEditor(doc);
  expect(report).toMatchObject({
    status: 'inspected',
    active: { tag: 'input', inputType: 'text', selectionAPI: true },
    ancestors: [{ tag: 'form', classes: ['equation-form'] }],
  });
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
});

test('inspects a textarea equation inside a non-login form', () => {
  const doc = page('<form><textarea>PRIVATE EQUATION</textarea></form>');
  doc.querySelector('textarea')!.focus();
  expect(inspectEditor(doc)).toMatchObject({ status: 'inspected', active: { tag: 'textarea' } });
});

test('treats an input without a type as a text input', () => {
  const doc = page('<input class="equation-source">');
  doc.querySelector('input')!.focus();
  expect(inspectEditor(doc)).toMatchObject({ status: 'inspected', active: { tag: 'input', inputType: 'text' } });
});

test.each(['password', 'email', 'tel'])('still refuses sensitive input type %s', (type) => {
  const doc = page(`<input type="${type}" value="PRIVATE">`);
  doc.querySelector('input')!.focus();
  expect(inspectEditor(doc)).toEqual({ status: 'form-or-input' });
});

test('still refuses text inputs in a password form', () => {
  const doc = page('<form><input type="text"><input type="password"></form>');
  doc.querySelector('input')!.focus();
  expect(inspectEditor(doc)).toEqual({ status: 'form-or-input' });
});

test('still refuses one-time-code text fields', () => {
  const doc = page('<input type="text" autocomplete="one-time-code">');
  doc.querySelector('input')!.focus();
  expect(inspectEditor(doc)).toEqual({ status: 'form-or-input' });
});

test('omits author and zone identifiers embedded in CSS classes', () => {
  const doc = page('<div class="ace-editor zoneId-8"><div class="ace-line gutter-author-PRIVATEAUTHOR"><input class="inline-latex-input"></div></div>');
  doc.querySelector('input')!.focus();
  const result = inspectEditor(doc);
  expect(JSON.stringify(result)).not.toContain('PRIVATEAUTHOR');
  expect(JSON.stringify(result)).not.toContain('zoneId-');
  expect(JSON.stringify(result)).toContain('ace-line');
});
