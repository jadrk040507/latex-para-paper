import type { PaperPort, Snapshot, Range } from './types';

export function sameSnapshot(a: Snapshot | null, b: Snapshot): boolean {
  return !!a && a.editorId === b.editorId && a.revision === b.revision &&
    a.text === b.text && a.selection.from === b.selection.from && a.selection.to === b.selection.to;
}

/** Only the input structure observed in the user's Paper document is supported. */
export function createPaperPort(doc: Document): PaperPort {
  return createInputPort(doc, () => {
    if (doc.location?.origin !== 'https://www.dropbox.com') return null;
    const element = doc.activeElement;
    if (!element?.matches('input.inline-latex-input')) return null;
    const input = element as HTMLInputElement;
    if (!input.closest('.inline-latex-input-container') || !input.closest('.inline-latex') ||
        input.closest('.ace-editor')?.getAttribute('contenteditable') !== 'true') return null;
    return input;
  });
}

/** Native input editing is separate from site-specific detection. */
export function createInputPort(doc: Document, resolve: () => HTMLInputElement | null): PaperPort {
  let disposed = false;
  let counter = 0;
  const states = new WeakMap<HTMLInputElement, { id: string; revision: number; text: string }>();
  function active(): HTMLInputElement | null {
    if (disposed) return null;
    const input = resolve();
    if (!input || input.ownerDocument !== doc || doc.activeElement !== input ||
        input.type !== 'text' || input.readOnly || input.disabled || !input.isConnected) return null;
    if (input.selectionStart === null || input.selectionEnd === null) return null;
    return input;
  }
  function state(input: HTMLInputElement) {
    let entry = states.get(input);
    if (!entry) {
      entry = { id: `paper-${++counter}`, revision: 0, text: input.value };
      states.set(input, entry);
    } else if (entry.text !== input.value) {
      entry.text = input.value;
      entry.revision++;
    }
    return entry;
  }
  function onInput(event: Event) {
    const input = active();
    if (!input || event.target !== input) return;
    const entry = state(input);
    entry.revision++;
  }
  doc.addEventListener('input', onInput, true);
  function read(): Snapshot | null {
    const input = active();
    if (!input) return null;
    const entry = state(input);
    return { editorId: entry.id, revision: entry.revision, text: input.value,
      selection: { from: input.selectionStart!, to: input.selectionEnd! } };
  }
  const validRange = (range: Range, length: number) => Number.isInteger(range.from) &&
    Number.isInteger(range.to) && range.from >= 0 && range.to >= range.from && range.to <= length;
  return {
    read,
    apply(edit) {
      if (!sameSnapshot(read(), edit.expected) || typeof doc.execCommand !== 'function') return false;
      const input = active()!;
      const expectedText = edit.expected.text.slice(0, edit.replace.from) + edit.insert + edit.expected.text.slice(edit.replace.to);
      const first = edit.fields[0] ?? { from: edit.exit, to: edit.exit };
      if (!validRange(edit.replace, input.value.length) || !first || !validRange(first, expectedText.length)) return false;
      input.setSelectionRange(edit.replace.from, edit.replace.to);
      let accepted = false;
      try { accepted = doc.execCommand('insertText', false, edit.insert); } catch { /* fail without value-setter fallback */ }
      if (!accepted || active() !== input || input.value !== expectedText) {
        if (active() === input && input.value === edit.expected.text) {
          input.setSelectionRange(edit.expected.selection.from, edit.expected.selection.to);
        }
        return false;
      }
      input.setSelectionRange(first.from, first.to);
      // Confirms native input acceptance, not server persistence. That needs live Paper verification.
      return active() === input && input.value === expectedText && input.selectionStart === first.from && input.selectionEnd === first.to;
    },
    select(expected, range) {
      if (!sameSnapshot(read(), expected) || !validRange(range, expected.text.length)) return false;
      const input = active()!;
      input.setSelectionRange(range.from, range.to);
      return active() === input && input.selectionStart === range.from && input.selectionEnd === range.to;
    },
    dispose() { disposed = true; doc.removeEventListener('input', onInput, true); },
  };
}
