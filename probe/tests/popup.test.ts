import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { JSDOM } from 'jsdom';
import { expect, test } from 'vitest';
const code=buildSync({entryPoints:['probe/diagnostic/popup.ts'],bundle:true,write:false,format:'iife'}).outputFiles[0].text;
const html=readFileSync('probe/diagnostic/popup.html','utf8');
async function setup(url='https://www.dropbox.com/paper/test', access=true, saved:Record<string,unknown>={}, connected=true) {
 const dom=new JSDOM(html,{runScripts:'outside-only'});const settings={...saved};const writes:unknown[]=[];let permissionGranted=access;
 Object.assign(dom.window,{browser:{
  storage:{local:{get:async()=>settings,set:async(value:object)=>{writes.push(value);Object.assign(settings,value);}}},
  tabs:{query:async()=>[{id:1,url}]},permissions:{contains:async()=>permissionGranted,request:async()=>{permissionGranted=true;return true}},
  scripting:{executeScript:async(options:{files?:string[]})=>{if(options.files)connected=true;return[{result:{enabled:connected&&settings.enabled!==false&&settings.paperEnabled!==false}}];}},
  runtime:{getManifest:()=>({version:'0.5.0'})},
 }});
 dom.window.eval(code);await tick();
 return {dom,writes,doc:dom.window.document,change:async(id:string,value:boolean)=>{const input=dom.window.document.querySelector<HTMLInputElement>(id)!;input.checked=value;input.dispatchEvent(new dom.window.Event('change'));await tick();}};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('keeps the connected quick-settings menu minimal and English',async()=>{
 const s=await setup();expect(s.doc.querySelector<HTMLElement>('#state-card')?.hidden).toBe(true);
 expect(s.doc.documentElement.lang).toBe('en');expect(s.doc.querySelector('.section-heading h2')?.textContent).toBe('Quick Settings');
 expect(s.doc.querySelector('#status')?.textContent).not.toContain('Ready');
 expect(s.doc.body.textContent).not.toContain('Paper ·');expect(s.doc.body.textContent).not.toContain('Fewer keys');
 await s.change('#paper-enabled',false);expect(s.writes).toEqual([{paperEnabled:false}]);expect(s.doc.querySelector<HTMLElement>('#state-card')?.hidden).toBe(true);s.dom.window.close();
});
test('saves the global switch without adding a status message',async()=>{const s=await setup();await s.change('#enabled',false);expect(s.writes).toEqual([{enabled:false}]);expect(s.doc.querySelector<HTMLElement>('#state-card')?.hidden).toBe(true);s.dom.window.close();});
test('does not show a connection notice on unrelated sites',async()=>{const s=await setup('https://docs.google.com/document/d/test');expect(s.doc.querySelector<HTMLElement>('#state-card')?.hidden).toBe(true);s.dom.window.close();});
test('requests Dropbox access and hides the notice after the grant',async()=>{const s=await setup(undefined,false);expect(s.doc.querySelector('#status')?.textContent).toBe('Dropbox access required');const button=s.doc.querySelector<HTMLButtonElement>('#permission')!;expect(button.hidden).toBe(false);button.click();await tick();await tick();expect(s.doc.querySelector<HTMLElement>('#state-card')?.hidden).toBe(true);s.dom.window.close();});
test('offers reconnect only for a stale Dropbox tab',async()=>{const s=await setup(undefined,true,{},false);expect(s.doc.querySelector('#status')?.textContent).toBe('Reconnect this tab');const button=s.doc.querySelector<HTMLButtonElement>('#connect')!;expect(button.hidden).toBe(false);button.click();await tick();await tick();expect(s.doc.querySelector<HTMLElement>('#state-card')?.hidden).toBe(true);s.dom.window.close();});
