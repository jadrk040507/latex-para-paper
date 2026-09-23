# Paper default-snippet catalog adaptation

User requested all GitHub shortcuts after confirming the fraction, Tab/Shift+Tab, persistence and undo checks in live Paper. This supersedes the initial three-shortcut increment and earlier regex/visual exclusion for bundled defaults.

Source: artisticat1/obsidian-latex-suite, commit 265579790a1456c4a7a4a1b893a529041a81c27f, 199 default definitions; retain MIT attribution.

1. Finish automatic content-script activation and persistent global enable/disable.
2. Import a fixed data catalog; implement literal/regex matching, capture substitution, defaults, ordered fields, repeated fields, manual Tab and visual triggers. No downloaded code execution.
3. Adapt bundled dynamic snippets, automatic fractions and matrix entry to the native single-line input; collapse layout newlines to spaces, retain TeX row separators.
4. Preserve native undo, stale-state rejection, text/chemistry exclusions, and composition/paste guards.
5. Test categories and interactions with native Firefox input; document each incompatible host-specific definition rather than claim Obsidian editor parity. Paper renders the resulting TeX; macro package availability is host-owned.
6. Build the temporary Firefox extension, review changes, and provide reload instructions and shortcut reference.

Paper uses native $$ entry. Markdown prose entry snippets (mk/dm and list indentation) cannot safely be substituted into the equation field. Syntax concealment and editor decorations are not snippet definitions and require a separate editor integration.
