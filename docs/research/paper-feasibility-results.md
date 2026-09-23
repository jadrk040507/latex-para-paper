# Firefox / Paper feasibility results

Date: 2026-09-22. Overall result: **core fraction flow confirmed by user; expanded catalog acceptance pending**.

## Evidence so far

| Check | Result | Scope |
|---|---|---|
| Native Paper equation input identified | Pass, user-provided diagnostic | Firefox manual session, www.dropbox.com, inline-latex-input text input inside ace-editor |
| Fraction replacement/UTF-16 boundaries | Pass | Automated unit tests |
| Stale editor/text/selection rejection | Pass | Synthetic adapter/session tests |
| Plain prose/comment/read-only exclusion | Pass | Synthetic DOM based on observed structure |
| Trusted // keyboard expansion and initial caret | Pass | Firefox 156 headless, synthetic local input |
| Tab / Shift+Tab / snippet exit | Pass | Real Firefox synthetic input |
| Native undo/redo | Pass | Real Firefox synthetic input; Paper undo grouping not tested |
| Rapid typing with no per-character waits | Pass | Single Firefox native key batch and deterministic timer regression tests |
| Disable/dispose | Pass | Local browser and controller tests |
| // expansion, Tab/Shift+Tab in actual Paper | Pass, user-reported | User confirmed on 2026-09-22 |
| Reload persistence and undo in Paper | Pass, user-reported | User answered yes to the four-step manual protocol |
| IME/paste behavior in actual Paper | Not tested | Unit/event guards are not live acceptance |
| External collaborative edit in actual Paper | Not tested | Requires a second live session |

## Candidate edit path and limits

The observed field is a standard text input. Firefox's native insertText command was measured to emit a trusted input event and participate in native undo/redo on a synthetic field. The candidate adapter uses that path and verifies the resulting local source and caret. It does not directly assign field values or access private Paper model objects. The user subsequently confirmed the fraction survived reload and the undo check worked. This is user-reported evidence, not automated inspection of Paper state.

The command is deprecated; it is an experimental compatibility choice supported by measured Firefox behavior, not a claim of long-term API stability.

## Review and corrections

Independent review found a rapid-input race: deferred bookkeeping could lose field positions before the next keystroke/Tab. Two deterministic tests reproduced the failure. The fix updates session bookkeeping synchronously and defers only the native replacement, with snapshot checks at application time. Unit tests and a real Firefox batch-typing test pass after the correction.

The structural inspector originally reported an author-related CSS class. No live identifier is saved here; the inspector now filters author and zone classes, covered by a regression test.

## Catalog increment

User requested all GitHub shortcuts. Version 0.2.0 imports all 199 default definitions and adapts mathematical rules, manual Tab, visual selection, repeated defaults, automatic fractions and matrices. Markdown entry uses native Paper $$; multiline variants use their inline counterparts. Native Firefox synthetic tests pass across these categories. Rendering support for individual TeX commands is owned by Paper and remains to be checked live.

Next live validation: reload the extension and Paper, without manually activating; test `sq`, `par` + Tab, `dint`, `pmat` and `outer`, then rendering and reload. Inspect other prose/comment inputs and IME/collaboration separately before public release.

Installed-extension check: the production bundle was temporarily installed in the dedicated anonymous Firefox 156 profile. Its content script automatically expanded a synthetic observed-structure input on the allowed origin (public `robots.txt` page), including after page refresh. This verifies manifest injection, isolated-world execution and default activation, not Paper's application model.
