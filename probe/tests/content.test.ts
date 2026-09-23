import { buildSync } from 'esbuild';
import { JSDOM } from 'jsdom';
import { expect, test } from 'vitest';
const code = buildSync({entryPoints:['probe/src/content.ts'],bundle:true,write:false,format:'iife'}).outputFiles[0].text;
async function setup(enabled?: boolean, paperEnabled?: boolean) {
  const dom = new JSDOM('', {url:'https://www.dropbox.com/paper/test',runScripts:'outside-only'});
  const listeners = new Set<(changes: unknown, area: string) => void>();
  Object.assign(dom.window, {browser:{storage:{local:{get:async () => ({enabled,paperEnabled})},onChanged:{
    addListener:(fn: any) => listeners.add(fn), removeListener:(fn: any) => listeners.delete(fn),
  }}}});
  dom.window.eval(code); await new Promise(resolve => setTimeout(resolve, 0));
  return {dom, listeners, control:() => (dom.window as any).__paperLatexProbe,
    change:(value: boolean, key='enabled') => {for (const fn of listeners) fn({[key]:{newValue:value}},'local');}};
}
test('automatically enables a fresh installation', async () => {
  const s = await setup(); expect(s.control().status().enabled).toBe(true); s.dom.window.close();
});
test('honors saved disable and reacts to enable/disable changes', async () => {
  const s = await setup(false); expect(s.control()?.status().enabled ?? false).toBe(false);
  s.change(true); expect(s.control().status().enabled).toBe(true);
  s.change(false); expect(s.control().status().enabled).toBe(false); s.dom.window.close();
});
test('reinjection replaces the controller and storage listener without duplicates', async () => {
  const s = await setup(); const old = s.control(); s.dom.window.eval(code);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(old.status().enabled).toBe(false); expect(s.listeners.size).toBe(1);
  expect(s.control().status().enabled).toBe(true); s.dom.window.close();
});

test('site preference disables Paper without changing the global switch', async () => {
 const s=await setup(true,false);
 expect(s.control()?.status().enabled ?? false).toBe(false);
 s.change(true,'paperEnabled'); expect(s.control().status().enabled).toBe(true);
 s.change(false); s.change(false,'paperEnabled'); s.change(true,'paperEnabled');
 expect(s.control().status().enabled).toBe(false);
 s.change(true); expect(s.control().status().enabled).toBe(true);
 s.dom.window.close();
});
