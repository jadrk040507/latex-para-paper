import { JSDOM } from 'jsdom';
import { expect, test } from 'vitest';
import { readEntry, replaceEntry, startMathEntry } from '../src/math-entry';
function setup(text='Una ecuación mk', offset=text.length) {
 const dom=new JSDOM('<div class="ace-editor zoneId-0" contenteditable="true"><div class="ace-line"></div></div>',{url:'https://www.dropbox.com/paper/test'});
 const doc=dom.window.document;
 const editor=doc.querySelector<HTMLElement>('.ace-editor')!;
 const line=doc.querySelector<HTMLElement>('.ace-line')!;line.textContent=text;
 editor.focus();const range=doc.createRange();range.setStart(line.firstChild!,offset);range.collapse(true);
 doc.getSelection()!.removeAllRanges();doc.getSelection()!.addRange(range);
 return {dom,doc,editor,line};
}
test.each(['mk','dm'])('recognizes typed %s at a word boundary',trigger=>{
 const s=setup('Texto '+trigger);expect(readEntry(s.doc)?.trigger).toBe(trigger);
});
test.each(['bookmark','admk','admin','mdm','mkx'])('leaves ordinary word %s alone',text=>expect(readEntry(setup(text).doc)).toBeNull());
test('does not accept an unrelated contenteditable input',()=>{
 const s=setup();s.editor.className='comment-editor';expect(readEntry(s.doc)).toBeNull();
});
test('does not accept code or a noncollapsed selection',()=>{
 const s=setup();s.line.innerHTML='<code>mk</code>';let range=s.doc.createRange();range.selectNodeContents(s.line.firstChild!);range.collapse(false);s.doc.getSelection()!.removeAllRanges();s.doc.getSelection()!.addRange(range);
 expect(readEntry(s.doc)).toBeNull();
 const p=setup();range=p.doc.createRange();range.selectNodeContents(p.line);p.doc.getSelection()!.removeAllRanges();p.doc.getSelection()!.addRange(range);expect(readEntry(p.doc)).toBeNull();
});
test('rejects stale text instead of overwriting it',()=>{
 const s=setup();const entry=readEntry(s.doc)!;s.line.textContent='changed';expect(replaceEntry(s.doc,entry)).toBe(false);
});
test('recognizes a trigger split over formatting spans',()=>{
 const s=setup();s.line.innerHTML='Texto <b>m</b><span>k</span>';const range=s.doc.createRange();range.setStart(s.line.lastChild!.firstChild!,1);range.collapse(true);s.doc.getSelection()!.removeAllRanges();s.doc.getSelection()!.addRange(range);
 expect(readEntry(s.doc)?.trigger).toBe('mk');
});
test('does not replace across an embedded noneditable object',()=>{
 const s=setup();s.line.innerHTML='m<span contenteditable="false"></span>k';const range=s.doc.createRange();range.setStart(s.line.lastChild!,1);range.collapse(true);s.doc.getSelection()!.removeAllRanges();s.doc.getSelection()!.addRange(range);
 expect(readEntry(s.doc)).toBeNull();
});

test('diagnostic distinguishes last detected shortcut from last native attempt without exposing text',()=>{
 const s=setup('private text dm');const controller=startMathEntry(s.doc);
 expect(controller.status()).toEqual({enabled:true,attempts:0,outcome:'idle',attemptedTrigger:null,lastTrigger:null,lastStage:'idle'});
 s.editor.dispatchEvent(new s.dom.window.KeyboardEvent('keydown',{key:'m',bubbles:true}));
 expect(controller.status().lastTrigger).toBeNull();
 expect(JSON.stringify(controller.status())).not.toContain('private');
 controller.dispose();expect(controller.status().enabled).toBe(false);
});
