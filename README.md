# LaTeX para Paper

Firefox extension for writing LaTeX equations quickly in Dropbox Paper. It adapts the shortcut catalog from [Obsidian LaTeX Suite](https://github.com/artisticat1/obsidian-latex-suite) to Paper’s native equation editor. Independent project; not affiliated with Dropbox or Obsidian.

**Status:** public beta candidate, version 0.5.0. Designed for desktop Firefox and `www.dropbox.com`. Google Docs is not supported yet. Please report compatibility problems through GitHub Issues.

## Install

The add-on must be signed by Mozilla for a normal Firefox installation. The listed Firefox Add-ons page and signed release are being prepared; until that review is complete, the unsigned build is for development only and cannot be installed permanently in regular Firefox.

To try it temporarily, download the source, install Node.js 24+, then run:

```sh
npm ci
npm test
npm run typecheck
npm run build:probe
```

Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/diagnostic/manifest.json`. Temporary add-ons are removed when Firefox exits.

## Use

In Dropbox Paper, open an equation by typing `$$`, then enter shortcuts such as `//` for a fraction. Use Tab and Shift+Tab to move between fields. The toolbar menu has separate global and Paper switches. On first use, choose **Allow access to Dropbox** in the extension menu; Firefox asks for permission to `www.dropbox.com`.

The `mk` and `dm` prose shortcuts are experimental and must be confirmed in a live Paper document before relying on them. Supported output depends on Paper’s own TeX renderer.

## Privacy

Shortcut processing happens in the browser. The extension has no backend, analytics, or remote code. It stores only the two local enable preferences. It requests access only to `www.dropbox.com`; the optional permission can be granted or revoked in Firefox. The user-invoked editor diagnostic does not include document text. Dropbox continues to process and store documents under its own terms.

## Development

```sh
npm ci
npm test
npm run typecheck
npm run build:probe
npx web-ext lint --source-dir dist/diagnostic
npm run package:release
```

`dist/releases/` contains an unsigned extension archive and a reproducible source archive for Mozilla review. The unsigned archive is not a signed XPI. Build and installation details are in [`docs/release/BUILDING.md`](docs/release/BUILDING.md) and [`docs/release/INSTALL.md`](docs/release/INSTALL.md). Adapted shortcut data retains its upstream MIT license in the package.

The project is licensed under MIT; see [`LICENSE`](LICENSE).
