import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { JSDOM } from 'jsdom';
import { expect, test } from 'vitest';
const code=buildSync({entryPoints:['probe/diagnostic/popup.ts'],bundle:true,write:false,format:'iife'}).outputFiles[0].text;
const html=readFileSync('probe/diagnostic/popup.html','utf8');
async function setup(url='https://www.dropbox.com/paper/test', access=true, saved:Record<string,unknown>={}, connected=true) {
 const dom=new JSDOM(html,{runScripts:'outside-only'});
 const settings={...saved}; const writes:unknown[]=[]; let permissionGranted=access;
 Object.assign(dom.window,{browser:{
  storage:{local:{get:async()=>settings,set:async(value:object)=>{writes.push(value);Object.assign(settings,value);}}},
  tabs:{query:async()=>[{id:1,url}]},permissions:{contains:async()=>permissionGranted,request:async()=>{permissionGranted=true;return true}},
  scripting:{executeScript:async(options:{files?:string[]})=>{ if(options.files) connected=true; return [{result:{enabled:connected && settings.enabled!==false && settings.paperEnabled!==false}}]; }},
  runtime:{getManifest:()=>({version:'0.3.0'})},
 }});
 dom.window.eval(code); await tick();
 return {dom,writes,doc:dom.window.document,change:async(id:string,value:boolean)=>{
  const input=dom.window.document.querySelector<HTMLInputElement>(id)!;
  input.checked=value;input.dispatchEvent(new dom.window.Event('change'));await tick();
 }};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('shows the actual Paper connection and two independent controls',async()=>{
 const s=await setup(); expect(s.doc.querySelector('#status')?.textContent).toContain('Listo en Paper');
 expect(s.doc.querySelector<HTMLInputElement>('#paper-enabled')?.checked).toBe(true);
 await s.change('#paper-enabled',false);expect(s.writes).toEqual([{paperEnabled:false}]);
 expect(s.doc.querySelector('#status')?.textContent).toContain('Desactivado en Paper');
 expect(s.doc.querySelector<HTMLInputElement>('#enabled')?.checked).toBe(true);s.dom.window.close();
});
test('global disable is saved and takes precedence',async()=>{
 const s=await setup();await s.change('#enabled',false);
 expect(s.writes).toEqual([{enabled:false}]);
 expect(s.doc.querySelector('#status')?.textContent).toContain('Extensión desactivada');s.dom.window.close();
});
test('does not claim support on Google Docs',async()=>{
 const s=await setup('https://docs.google.com/document/d/test');
 expect(s.doc.querySelector('#status')?.textContent).toContain('Sitio no compatible');s.dom.window.close();
});
test('offers Firefox permission prompt and reconnects after it is granted',async()=>{
 const s=await setup(undefined,false);
 expect(s.doc.querySelector('#status')?.textContent).toContain('Dropbox necesita permiso');
 const button=s.doc.querySelector<HTMLButtonElement>('#permission')!;expect(button.hidden).toBe(false);button.click();await tick();await tick();
 expect(s.doc.querySelector('#status')?.textContent).toContain('Listo en Paper');
 expect(s.doc.querySelector<HTMLButtonElement>('#permission')!.hidden).toBe(true);s.dom.window.close();
});

test('a stale tab offers reconnection instead of an active status',async()=>{
 const s=await setup(undefined,true,{},false);
 expect(s.doc.querySelector('#status')?.textContent).toContain('necesita conectarse');
 const button=s.doc.querySelector<HTMLButtonElement>('#connect')!;
 expect(button.hidden).toBe(false);button.click();await tick();
 expect(s.doc.querySelector('#status')?.textContent).toContain('Listo en Paper');
 expect(button.hidden).toBe(true);s.dom.window.close();
});
