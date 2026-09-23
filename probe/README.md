# Firefox / Dropbox Paper LaTeX shortcuts

Version 0.3.1 adapts the pinned Obsidian LaTeX Suite default catalog to Paper's native inline equation input on `https://www.dropbox.com`. This is a temporary development extension, not a signed public release. Google Docs is not supported yet.

## Install or update

```sh
npm ci
npm test
npm run typecheck
npm run build:probe
npx web-ext lint --source-dir dist/diagnostic
```

Open `about:debugging#/runtime/this-firefox`, reload the existing temporary extension or load `dist/diagnostic/manifest.json`, and then reload Paper. Grant Firefox's requested access to `www.dropbox.com` for automatic operation. The extension now starts automatically; no toolbar activation is necessary. The toolbar panel has a global **Activar extensión** switch and a separate **Usar en Dropbox Paper** switch. Both preferences survive reloads and apply across open Paper tabs. The panel checks the current origin, required host access and content-script connection before displaying its status. A stale tab offers reconnection. A temporary add-on itself does not survive Firefox restart.

## Use

Enter a native Paper equation with `$$`. Examples:

| Type | Result |
|---|---|
| `xsr`, `xcb`, `xrd` | Powers 2, 3, editable exponent |
| `sq`, `3rt` | Square root, third root |
| `//`, `x/`, `(a+b)/` | Fractions |
| `@a`, `@t`, `@o` | Alpha, theta, omega |
| `RR`, `NN`, `>=`, `ooo` | Number sets, comparison, infinity |
| `xhat`, `xvec` | Accents |
| `par` then Tab | Partial derivative with editable defaults |
| `dint`, `oinf`, `infi` | Integral templates |
| `pmat`, `bmat`, `cases`, `iden3` | Environments and identity matrix |
| Select text, then `U`, `O`, `B`, `C`, `K`, `S` | Visual wrapping |

Tab/Shift+Tab traverse fields. Defaults are selected; typing replaces them. Repeated fields (e.g. `outer`, `tayl`, `beg`) update while typing. In a matrix body, Tab inserts a cell separator, Enter inserts a TeX row separator, and Shift+Enter exits the environment. Press Enter outside the matrix to use Paper's normal render action.

The toolbar links to a complete reference showing all 199 original definitions and their adaptation status. The catalog, regex variables and macro names are pinned MIT-licensed upstream data; see [provenance and license](vendor/README.md).

## Compatibility limits

- Five Markdown/text entry definitions (`mk`, `dm`, list layout) use Paper's native `$$` entry instead. Three multiline definitions share inline equivalents because Paper's input is single-line. Layout newlines become spaces; TeX row separators remain intact.
- Expansion is source insertion. Paper owns rendering and may not support chemistry, physics or other package-specific commands.
- Concealment, syntax coloring, preview overlays and Obsidian command-palette integration are not included. Custom snippet settings remain future work.
- The user confirmed the original fraction expansion, Tab/Shift+Tab, reload persistence and undo in live Paper. The expanded catalog is verified with unit tests and native Firefox on synthetic input; live Paper rendering of every category is not yet validated. Live IME and collaboration acceptance also remain pending.

## Implementation and privacy

Only a focused, connected, writable `input.inline-latex-input` inside `.inline-latex-input-container`, `.inline-latex`, and an editable `.ace-editor` is edited. Matching the Dropbox origin permits content-script loading across Paper routes; ordinary inputs/prose/comments do not match the adapter.

Edits use Firefox's deprecated native `document.execCommand('insertText')`, retaining native undo behavior in tested cases. There is no direct `.value` setter fallback. Mirrors can create additional native undo steps. Undo/redo, external changes, focus loss and selection movement invalidate tracked sessions rather than replaying edits.

All processing is local. Storage contains only the global and Paper enable preferences. Equation text is not logged, saved or transmitted. No remote code is loaded. Optional structural inspection excludes field text and known author/zone class identifiers.

## Native Firefox smoke test

```sh
npm run build:smoke
python3 scripts/firefox-smoke.py /path/to/local-webdriver-session.json
```

Use a dedicated test session; the script navigates it to a synthetic data page. The JSON contains `base` and `sessionId`. Tests cover trusted typing, fractions, roots, Greek, derivatives, repeated fields, automatic fractions, matrices, visual selection, undo/redo, rapid typing and disposal. This does not test Paper's server persistence. Keep profiles and connection files Git-ignored.

For an integration check of the installed production bundle, run `python3 scripts/firefox-extension-smoke.py /path/to/local-webdriver-session.json` in a dedicated **anonymous** Firefox profile. It temporarily installs the add-on, visits Dropbox's public `robots.txt`, inserts a synthetic editor fixture, and tests automatic activation before/after refresh. It then removes the temporary add-on. It never opens or edits a Paper document and cannot validate Paper persistence.
