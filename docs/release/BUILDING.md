# Reproduce the extension

Use Linux, Node.js 24 (tested with 24.21.0), npm 11, and Python 3.

```sh
npm ci
npm test
npm run typecheck
npm run build:probe
npx web-ext lint --source-dir dist/diagnostic
npm run package:release
```

The exact dependencies are pinned in package-lock.json. No credentials or proprietary SDKs are needed. The build uses esbuild to bundle TypeScript into readable, unminified JavaScript. It does not fetch or execute remote snippet definitions. The extension contents are in `dist/diagnostic`.

`package:release` creates an unsigned add-on ZIP and a source ZIP in `dist/releases`. ZIP entries are sorted and have fixed timestamps. SHA256SUMS records the packaged artifacts. Build outputs, test profiles, local automation metadata, Codex skills, git data and credentials are excluded from the source package.

For signing, upload the unsigned ZIP and source ZIP to Mozilla Add-ons. The unsigned package is not a permanent-installation XPI. Mozilla returns a separately signed XPI after submission and validation.
