import catalog from '../vendor/default-snippets.json';
import variables from '../vendor/snippet-variables.json';
import macros from '../vendor/macros.json';
import { expandFraction } from './fraction';
import type { Edit, InputContext, Range, Snapshot } from './types';

const substitute = (text: string) => Object.entries(variables).reduce((s,[key,value]) => s.replaceAll(key,value),text);
const compiled = catalog.map(s => ({...s,pattern:s.regex ? new RegExp(`(?:${substitute(s.trigger)})$`) : null}))
  // Explicit bundled triggers (e.g. \xii) must win before the macro-spacing fallback.
  .sort((a,b) => (b.id===195 ? -100 : b.priority ?? 0)-(a.id===195 ? -100 : a.priority ?? 0) || b.trigger.length-a.trigger.length);
const greekPattern = new RegExp(`^${variables['${GREEK}']}$`);

/** Balanced placeholder defaults, including defaults containing TeX braces. */
export function renderTemplate(template: string, start: number, visual = '') {
  let insert = '';
  const groups = new Map<number,Range[]>();
  const defaults = new Map<number,string>();
  for (let i=0;i<template.length;) {
    if (template.startsWith('${VISUAL}',i)) { insert+=visual; i+=9; continue; }
    const match = /^\$(\d+)|^\$\{(\d+):/.exec(template.slice(i));
    if (!match) { insert+=template[i++]; continue; }
    const id=Number(match[1] ?? match[2]);
    i+=match[0].length;
    let value='';
    if (match[2] !== undefined) {
      let depth=1;
      while (i<template.length) {
        const c=template[i++];
        if (c==='{') depth++;
        if (c==='}' && --depth===0) break;
        value+=c;
      }
    }
    if (defaults.has(id)) value=defaults.get(id)!;
    else defaults.set(id,value);
    const range={from:start+insert.length,to:start+insert.length+value.length};
    const ranges=groups.get(id) ?? []; ranges.push(range); groups.set(id,ranges);
    insert+=value;
  }
  const ordered=[...groups.entries()].sort((a,b)=>a[0]-b[0]);
  let exit=start+insert.length;
  const last=ordered.at(-1);
  if (last && last[1].length===1 && last[1][0].from===exit && last[1][0].to===exit) ordered.pop();
  return {insert,fields:ordered.map(([,ranges])=>ranges[0]),mirrors:ordered.map(([,ranges])=>ranges.slice(1)),exit};
}

/** Names of open macro arguments; escaped braces do not change nesting. */
function openMacros(prefix: string) {
  const stack:string[]=[];
  for(let i=0;i<prefix.length;i++) {
    if(prefix[i]==='\\' && /[{}\\]/.test(prefix[i+1] ?? '')) {i++;continue;}
    if(prefix[i]==='{') stack.push(/\\([A-Za-z]+)\s*$/.exec(prefix.slice(0,i))?.[1] ?? '');
    if(prefix[i]==='}') stack.pop();
  }
  return stack;
}
function autoFraction(snapshot: Snapshot): Edit | null {
  const end=snapshot.selection.from;
  const before=snapshot.text.slice(0,end-1);
  if(snapshot.text[end-1]!=='/' || !before || /[\s/]/.test(before.at(-1)!)) return null;
  let start=before.length;
  let numerator='';
  if(before.endsWith(')')) {
    let depth=0;
    for(let i=before.length-1;i>=0;i--) {
      if(before[i]===')') depth++;
      if(before[i]==='(' && --depth===0) {start=i;numerator=before.slice(i+1,-1);break;}
    }
    if(!numerator) return null;
  } else {
    const match=/(?:\\[A-Za-z]+|[A-Za-z0-9]+)(?:[_^]\{[^{}]*\})*$/.exec(before);
    if(!match) return null;
    start=match.index;numerator=match[0];
  }
  const insert=`\\frac{${numerator}}{}`;
  const caret=start+insert.length-1;
  return {expected:snapshot,replace:{from:start,to:end},insert,fields:[{from:caret,to:caret}],exit:start+insert.length};
}

export function expandSnippet(snapshot: Snapshot, context: InputContext): Edit | null {
  const {from:end,to}=snapshot.selection;
  const visual=context.kind.startsWith('visual:');
  if(context.composing || !['insertText','manual'].includes(context.kind) && !visual ||
      !Number.isInteger(end) || end<0 || to<end || to>snapshot.text.length || !visual && end!==to) return null;
  const prefix=snapshot.text.slice(0,end);
  const open=openMacros(prefix);
  if(open.some(name=>['text','textrm','textsf','texttt','operatorname','begin','end'].includes(name))) return null;
  if(!visual && context.kind==='insertText') {
    const fraction=expandFraction(snapshot,context) ?? autoFraction(snapshot);
    if(fraction) return fraction;
  }
  for(const s of compiled) {
    if(s.options.includes('t') || s.options.includes('T') || s.options.includes('M')) continue;
    if(s.options.includes('v') !== visual) continue;
    if(!visual && s.options.includes('A') !== (context.kind==='insertText')) continue;
    if(s.excludedMacros?.some(name=>open.includes(name))) continue;
    let match:RegExpExecArray|null=null;
    let start=end;
    if(visual) { if(s.trigger!==context.kind.slice(7) || end===to) continue; }
    else if(s.pattern) {
      // A sentinel supplies the preceding non-backslash for equation-start matches.
      match=s.pattern.exec(' '+prefix);
      if(!match) continue;
      start=Math.max(0,match.index-1);
    } else {
      if(!prefix.endsWith(s.trigger)) continue;
      start=end-s.trigger.length;
      if(s.options.includes('w') && /[\w]/.test(prefix[start-1] ?? '')) continue;
      if(/\\[A-Za-z]*$/.test(prefix.slice(0,start)) && !s.trigger.startsWith('\\')) continue;
    }
    let replacement=s.replacement;
    if(s.id===194 || s.id===195) {
      const word=match![0];
      if(macros.some(name=>name.startsWith(word))) return null;
      if(s.id===194) continue;
      const base=word.slice(0,-1);
      if(!macros.includes(base)) return null;
      replacement=base+' '+word.at(-1);
    } else if(s.id===71) {
      const [,slash,name,digit]=match!;
      replacement=slash && !greekPattern.test(name) ? `\\${name} ${digit}` : `${slash}${name}_{${digit}}`;
    } else if(s.id===197) {
      const n=Number(match![1]);
      if(n<1) continue;
      replacement='\\begin{pmatrix} '+Array.from({length:n},(_,row)=>Array.from({length:n},(_,col)=>row===col?'1':'0').join(' & ')).join(' \\\\ ')+' \\end{pmatrix}';
    }
    if(replacement===null) continue;
    if(match) {
      replacement=replacement.replace(/\[\[(\d+)\]\]/g,(_,index)=>match![Number(index)+1] ?? '');
      if(match.index===0 && match[0].startsWith(' ') && replacement.startsWith(' ')) replacement=replacement.slice(1);
    }
    // Native Paper has a single-line input. TeX row separators remain intact.
    replacement=replacement.replace(/\r?\n/g,' ');
    // Preserve the compact root already verified in Paper.
    if(s.trigger==='sq') replacement='\\sqrt{$0}$1';
    const rendered=renderTemplate(replacement,start,visual?snapshot.text.slice(end,to):'');
    if(!visual && rendered.insert===snapshot.text.slice(start,end)) return null;
    // Regex rules may capture unchanged context before the trigger. Do not include
    // that context in the write range: it can lie outside the active placeholder.
    let common=0;
    const original=snapshot.text.slice(start,end);
    const firstField=Math.min(...rendered.fields.map(field=>field.from-start),rendered.insert.length);
    if(!visual) while(common<original.length && common<firstField && original[common]===rendered.insert[common]) common++;
    return {expected:snapshot,replace:{from:start+common,to:visual?to:end},...rendered,insert:rendered.insert.slice(common)};
  }
  return null;
}
