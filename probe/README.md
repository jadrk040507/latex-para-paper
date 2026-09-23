# LaTeX Shortcuts for Firefox

A Firefox extension that adapts the pinned Obsidian LaTeX Suite shortcut catalog to Dropbox Paper’s native equation editor. This is an unsigned beta candidate; a regular Firefox installation requires Mozilla signing. Google Docs is not supported yet.

## Build and try temporarily

```sh
npm ci
npm test
npm run typecheck
npm run build:probe
npx web-ext lint --source-dir dist/diagnostic
```

Open `about:debugging#/runtime/this-firefox`, load `dist/diagnostic/manifest.json`, and reload Paper. If Firefox asks, allow site access to `www.dropbox.com` from the extension menu. Temporary add-ons are removed when Firefox exits. The menu has persistent **Shortcuts** and **Dropbox Paper** switches.

## Shortcuts

Enter an equation with `$$`. Examples:

| Type | Result |
|---|---|
| `xsr`, `xcb`, `xrd` | Powers 2, 3, and editable exponent |
| `sq`, `3rt` | Square root and cube root |
| `//`, `x/`, `(a+b)/` | Fractions |
| `@a`, `@t`, `@o` | Greek letters |
| `RR`, `NN`, `>=`, `ooo` | Number sets, comparison, infinity |
| `xhat`, `xvec` | Accents |
| `par` then Tab | Partial derivative template |
| `dint`, `oinf`, `infi` | Integral templates |
| `pmat`, `bmat`, `cases`, `iden3` | Matrices and identity matrix |
| Select text, then `U`, `O`, `B`, `C`, `K`, `S` | Wrap selected text |

Tab and Shift+Tab move through fields. In matrices, Tab adds a cell, Enter adds a TeX row, and Shift+Enter exits. Paper controls which TeX commands it renders. The `mk` and `dm` prose entry shortcuts are experimental.

The shortcut reference includes the 199 upstream definitions and adaptation notes. The bundled shortcut data is adapted from Obsidian LaTeX Suite under its included MIT license.

## Privacy and compatibility

Processing happens locally. The extension stores the two activation preferences. It requests access only to `www.dropbox.com` after a user click. Equation source is not logged, persisted by the extension, or transmitted to an extension backend. The optional editor diagnostic omits document text and author identifiers.

Paper owns equation rendering. This extension does not add a renderer, concealment, or syntax colors. IME/collaboration behavior and every catalog entry have not been validated in live Paper.

## Tests

`npm test`, `npm run typecheck`, and `web-ext lint` cover the extension and browser build. The scripts in `scripts/firefox-smoke.py` and `scripts/firefox-extension-smoke.py` use an anonymous dedicated Firefox WebDriver session and synthetic editor fixtures; they do not test Paper server persistence.
