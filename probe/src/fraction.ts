import type { Edit, InputContext, Snapshot } from './types';

/** Propose a fraction edit; the host adapter must validate and apply it. */
export function expandFraction(snapshot: Snapshot, context: InputContext): Edit | null {
  const { from, to } = snapshot.selection;
  if (context.composing || context.kind !== 'insertText' || from !== to) return null;
  if (!Number.isInteger(from) || from < 2 || from > snapshot.text.length) return null;
  if (snapshot.text.slice(from - 2, from) !== '//') return null;

  const start = from - 2;
  return {
    expected: snapshot,
    replace: { from: start, to: from },
    insert: '\\frac{}{}',
    fields: [{ from: start + 6, to: start + 6 }, { from: start + 8, to: start + 8 }],
    exit: start + 9,
  };
}
