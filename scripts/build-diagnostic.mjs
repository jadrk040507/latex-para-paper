import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/diagnostic', { recursive: true });
await build({
  entryPoints: ['probe/diagnostic/popup.ts'],
  outfile: 'dist/diagnostic/popup.js',
  bundle: true, format: 'iife', target: 'firefox140', minify: false,
});
await build({ entryPoints: ['probe/src/content.ts'], outfile: 'dist/diagnostic/content.js', bundle: true, format: 'iife', target: 'firefox142', minify: false });
for (const name of ['manifest.json', 'popup.html', 'popup.css', 'icon.svg', 'icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-96.png']) {
  await copyFile(`probe/diagnostic/${name}`, `dist/diagnostic/${name}`);
}
await import('./build-shortcuts.mjs');
console.log('Automatic Paper extension built: dist/diagnostic/manifest.json');
