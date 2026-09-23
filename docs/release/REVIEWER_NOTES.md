# Mozilla reviewer notes

Name: LaTeX para Paper
Planned channel: listed on addons.mozilla.org (experimental beta; not submitted)
Target: desktop Firefox 142+, Dropbox Paper on https://www.dropbox.com

Purpose: local LaTeX typing shortcuts in Paper's native equation text input. The popup has independent persistent global and Paper-specific enable controls. It uses no backend, analytics or remote execution. No document text is transmitted or stored.

Permissions:
- optional_host_permissions https://www.dropbox.com/*: requested from the popup after an explicit user click; after grant, automatic activation on Paper routes; editing is gated by the specific native Paper editor structure.
- storage: two boolean enable preferences only.
- activeTab and scripting: read the active tab's integration state, reconnect a stale tab and run the user-invoked structural inspector. Inspection excludes field values, document text, identifiers and author/zone classes.

Verification:
1. Sign in with your own Dropbox account and open a disposable Paper document. We do not bundle credentials.
2. Type $$ to open Paper's native equation input.
3. Type //, a, Tab, b. Expect a fraction. Try Shift+Tab, Enter to render and reload to check persistence.
4. Try sq, @a, par then Tab, dint, and pmat. Tab/Shift+Tab move between fields; matrices use Tab for a cell, Enter for a TeX row and Shift+Enter to exit.
5. In prose, mk converts to Paper's $$ entry at a word boundary. dm does the same at a paragraph end and precedes it with a newline when the paragraph already contains text. This new native-entry path is a compatibility candidate pending user confirmation in live Paper; its diagnostic distinguishes native-equation-opened from entry-text-only. It does not synthesize Paper objects or modify private application state.
6. Disable the global or Paper switch. Edits stop on all matching tabs. Preferences survive reloads.

Implementation: document.execCommand('insertText') is used for native edits and undo history, with caret/source checks; no document value-setter fallback. Snippet regexes and templates are bundled, pinned data adapted from artisticat1/obsidian-latex-suite under the included MIT license. All dynamic snippet implementations are local, build-time code, not eval or downloaded JavaScript.

Known limits: Paper determines the supported TeX macros. Google Docs, mobile, live IME/collaboration acceptance and universal site support are not claimed. Input source may be processed in memory while editing but is not persisted. Synthetic native-Firefox tests do not replace Paper application validation.

See BUILDING.md for reproducible source build instructions.
