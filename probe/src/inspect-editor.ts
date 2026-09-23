/** Self-contained: Firefox serializes this function into the selected page. */
export function inspectEditor(doc: Document = document) {
  const url = new URL(doc.URL);
  if (url.protocol !== 'https:' || !['www.dropbox.com', 'paper.dropbox.com', 'dropbox.com'].includes(url.hostname)) {
    return { status: 'unsupported-origin' };
  }
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  if (!active || active === doc.body || active === doc.documentElement) {
    return { status: 'focus-an-equation' };
  }
  const form = active.closest('form');
  const autocomplete = (active.getAttribute('autocomplete') ?? '').toLowerCase().split(/\s+/);
  const sensitiveAutocomplete = ['username', 'current-password', 'new-password', 'one-time-code'];
  const sensitiveForm = form?.querySelector('input[type="password" i], input[autocomplete~="one-time-code" i]');
  const plainTextInput = active.tagName === 'INPUT' && (active as HTMLInputElement).type === 'text';
  if ((active.tagName === 'INPUT' && !plainTextInput) || sensitiveForm ||
      autocomplete.some(token => sensitiveAutocomplete.includes(token))) {
    return { status: 'form-or-input' };
  }

  // No values, textContent, innerHTML, labels, IDs, URLs, or data attributes.
  const describe = (element: Element) => {
    const role = element.getAttribute('role');
    const editable = element.getAttribute('contenteditable');
    return {
      tag: element.localName,
      classes: Array.from(element.classList).filter(c => !/^(gutter-author-|zoneId-)/i.test(c)).slice(0, 12).map(c => c.slice(0, 80)),
      role: ['textbox', 'dialog', 'document', 'application', 'group'].includes(role ?? '') ? role : null,
      editable: ['', 'true', 'false', 'plaintext-only'].includes(editable ?? 'absent') ? editable : null,
      inputType: element.tagName === 'INPUT' ? (element as HTMLInputElement).type : null,
      selectionAPI: element.tagName === 'TEXTAREA' ||
        (element.tagName === 'INPUT' && (element as HTMLInputElement).type === 'text'),
      readOnly: element.hasAttribute('readonly'),
      disabled: element.hasAttribute('disabled'),
      shadowRoot: !!element.shadowRoot,
    };
  };
  const ancestors = [];
  let ancestor = active.parentElement;
  while (ancestor && ancestor !== doc.body && ancestors.length < 8) {
    ancestors.push(describe(ancestor));
    ancestor = ancestor.parentElement;
  }
  const mathEntry = (doc.defaultView as (Window & { __paperMathEntry?: { status(): { enabled: boolean; attempts: number; outcome: string } } }) | null)?.__paperMathEntry?.status();
  return {
    ...(mathEntry ? { mathEntry } : {}),
    ...(active.matches('.ace-editor') ? { entryContext: {
      collapsed: doc.getSelection()?.isCollapsed ?? false,
      anchor: doc.getSelection()?.anchorNode?.parentElement ? describe(doc.getSelection()!.anchorNode!.parentElement!) : null,
    } } : {}),
    status: active.tagName === 'IFRAME' ? 'frame-boundary' : 'inspected',
    host: url.hostname,
    active: describe(active),
    ancestors,
  };
}
