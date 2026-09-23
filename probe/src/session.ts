import { expandSnippet } from './snippets';
import { sameSnapshot } from './paper-port';
import type { InputContext, PaperPort, Snapshot, Range, Edit } from './types';

type Live = { snapshot: Snapshot; fields: Range[]; mirrors: Range[][]; index: number; pristine: boolean[]; exit: number };
function remap(current: Live, change: Range, delta: number, snapshot: Snapshot) {
  const active=current.fields[current.index];
  for(const range of [...current.fields,...current.mirrors.flat()]) {
    if(range===active && change.from>=range.from && change.to<=range.to) range.to+=delta;
    else if(range.from>=change.to) {range.from+=delta;range.to+=delta;}
    else if(range.to>=change.to) range.to+=delta;
  }
  if(current.exit>=change.to) current.exit+=delta;
  current.snapshot=snapshot;
}

function matrixAt(snapshot: Snapshot) {
  const stack: string[]=[];
  const pattern=/\\(begin|end)\{([A-Za-z*]+)\}/g;
  for(const match of snapshot.text.slice(0,snapshot.selection.from).matchAll(pattern)) {
    if(match[1]==='begin') stack.push(match[2]); else if(stack.at(-1)===match[2]) stack.pop();
  }
  const name=stack.at(-1);
  return name && /^(?:[pbBvV]?matrix|cases|align\*?|array)$/.test(name) ? name : null;
}

/** Paired trusted beforeinput/input events establish local-edit provenance. */
export function createSession(port: PaperPort) {
  let pending: { snapshot: Snapshot; kind: string } | null = null;
  let live: Live | null = null;
  let parents: Live[] = [];
  let disposed = false;
  let queued: Edit | null = null;
  const states=()=>live?[...parents,live]:[];
  const allowed = (c: InputContext) => !c.composing &&
    ['insertText', 'deleteContentBackward', 'deleteContentForward'].includes(c.kind);
  const cancel = () => { pending = null; live = null; parents = []; queued = null; };
  function apply(edit: Edit) {
    if(disposed || !sameSnapshot(port.read(),edit.expected) || !port.apply(edit)) {cancel();return false;}
    const applied=port.read();
    const first=edit.fields[0] ?? {from:edit.exit,to:edit.exit};
    const expectedText=edit.expected.text.slice(0,edit.replace.from)+edit.insert+edit.expected.text.slice(edit.replace.to);
    if(!applied || applied.editorId!==edit.expected.editorId || applied.text!==expectedText ||
       applied.selection.from!==first.from || applied.selection.to!==first.to) {cancel();return false;}
    for(const state of states()) remap(state,edit.replace,edit.insert.length-(edit.replace.to-edit.replace.from),applied);
    if(edit.fields.length) {
      if(live) parents.push(live);
      live={snapshot:applied,fields:edit.fields.map(r=>({...r})),mirrors:edit.fields.map((_,i)=>(edit.mirrors?.[i] ?? []).map(r=>({...r}))),index:0,pristine:edit.fields.map(()=>true),exit:edit.exit};
    }
    return true;
  }
  function syncMirrors() {
    for(const state of states().reverse()) {
      for(const mirror of state.mirrors[state.index]) {
        const snapshot=port.read();
        if(!snapshot || !sameSnapshot(snapshot,state.snapshot)) {cancel();return;}
        const field=state.fields[state.index];
        const value=snapshot.text.slice(field.from,field.to);
        if(snapshot.text.slice(mirror.from,mirror.to)===value) continue;
        const change={...mirror};
        const delta=value.length-(change.to-change.from);
        const selection={...snapshot.selection};
        if(selection.from>=change.to) {selection.from+=delta;selection.to+=delta;}
        const edit:Edit={expected:snapshot,replace:change,insert:value,fields:[selection],exit:selection.to};
        if(!port.apply(edit)) {cancel();return;}
        const after=port.read();
        if(!after || after.text!==snapshot.text.slice(0,change.from)+value+snapshot.text.slice(change.to)) {cancel();return;}
        // The edited mirror is not the active field; map all other ranges, then restore its bounds.
        for(const current of states()) remap(current,change,delta,after);
        mirror.from=change.from;mirror.to=change.from+value.length;
      }
    }
  }
  return {
    beforeInput(context: InputContext) {
      pending = null; queued = null;
      if (disposed || !allowed(context)) { cancel(); return; }
      const snapshot = port.read();
      if (!snapshot) { cancel(); return; }
      if (live && !sameSnapshot(snapshot, live.snapshot)) { live = null; parents = []; }
      if(snapshot.selection.from!==snapshot.selection.to) {
        const field=live?.fields[live.index];
        if(!field || snapshot.selection.from!==field.from || snapshot.selection.to!==field.to) {cancel();return;}
      }
      pending = { snapshot, kind: context.kind };
    },
    onInput(context: InputContext) {
      const before = pending; pending = null;
      const after = port.read();
      if (disposed || !allowed(context) || !before || before.kind !== context.kind ||
          !after || before.snapshot.editorId !== after.editorId || after.selection.from !== after.selection.to) {
        cancel(); return;
      }
      const old = before.snapshot;
      const delta = after.text.length - old.text.length;
      let from = old.selection.from, to = old.selection.to;
      let inserted = '';
      if (context.kind === 'insertText' && delta+(to-from)>0) {
        inserted = after.text.slice(from, from + delta+(to-from));
      } else if (context.kind === 'deleteContentBackward' && delta < 0) {
        if(from===to) from += delta;
      } else if (context.kind === 'deleteContentForward' && delta < 0) {
        if(from===to) to -= delta;
      } else { cancel(); return; }
      if (from < 0 || to > old.text.length ||
          after.text !== old.text.slice(0, from) + inserted + old.text.slice(to) ||
          after.selection.from !== from + inserted.length) { cancel(); return; }
      if (live) {
        const field = live.fields[live.index];
        if (!sameSnapshot(old, live.snapshot) || from < field.from || to > field.to) { cancel(); return; }
        live.pristine[live.index]=false;
        for (const current of states()) remap(current, {from,to}, delta, after);
      }
      if (inserted.length !== 1) return;
      queued = expandSnippet(after, context);
      if (queued && live && queued.replace.from < live.fields[live.index].from) queued = null;
    },
    // Called outside input dispatch, or before the next native key edit.
    flush() {
      const edit = queued; queued = null;
      if(disposed) return;
      if(edit) apply(edit);
      syncMirrors();
    },
    onKey(key: string) {
      if(disposed) return false;
      const snapshot=port.read();
      if(!snapshot) return false;
      if(live && !sameSnapshot(snapshot,live.snapshot)) cancel();
      if(snapshot.selection.from===snapshot.selection.to) {
        const position=snapshot.selection.from;
        const matrix=matrixAt(snapshot);
        if(matrix && key==='Enter') {
          const insert=' \\\\ ';
          return apply({expected:snapshot,replace:snapshot.selection,insert,fields:[],exit:position+insert.length});
        }
        if(matrix && key==='Shift+Enter') {
          const close='\\end{'+matrix+'}';
          const end=snapshot.text.indexOf(close,position);
          if(end<0) return false;
          const accepted=port.select(snapshot,{from:end+close.length,to:end+close.length}); cancel(); return accepted;
        }
        if([')',']','}'].includes(key) && snapshot.text[position]===key) {
          if(!port.select(snapshot,{from:position+1,to:position+1})) {cancel();return false;}
          if(live && live.exit===position+1) live=parents.pop() ?? null;
          const after=port.read();
          if(!after) cancel();
          else for(const state of states()) state.snapshot=after;
          return true;
        }
        return false;
      }
      const edit=expandSnippet(snapshot,{kind:`visual:${key}`,composing:false});
      if(!edit) return false;
      cancel(); return apply(edit);
    },
    onTab(backward: boolean) {
      if(disposed) return false;
      const current=port.read();
      if(live && !sameSnapshot(current,live.snapshot)) cancel();
      if(!backward && current) {
        const edit=expandSnippet(current,{kind:'manual',composing:false});
        if(edit && (!live || edit.replace.from>=live.fields[live.index].from)) return apply(edit);
      }
      if(!backward && current && current.selection.from===current.selection.to && matrixAt(current) &&
         (!live || live.fields[live.index].to===current.text.indexOf('\\end{',current.selection.from))) {
        return apply({expected:current,replace:current.selection,insert:' & ',fields:[],exit:current.selection.from+3});
      }
      if (!live || !sameSnapshot(port.read(), live.snapshot)) { cancel(); return false; }
      const index = live.index + (backward ? -1 : 1);
      if (index < 0) { cancel(); return false; }
      const target = index >= live.fields.length ? {from:live.exit,to:live.exit} : live.pristine[index] ? live.fields[index] : {from:live.fields[index].to,to:live.fields[index].to};
      if (!port.select(live.snapshot, target)) { cancel(); return false; }
      const snapshot=port.read();
      if(!snapshot) {cancel();return false;}
      if (index >= live.fields.length) {
        live = parents.pop() ?? null;
        if(!live) cancel();
      } else live.index=index;
      for(const state of states()) state.snapshot=snapshot;
      return true;
    },
    cancel,
    dispose() { cancel(); disposed = true; port.dispose(); },
  };
}
