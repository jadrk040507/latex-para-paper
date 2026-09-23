"""Produce explicit-allowlist unsigned and source archives for Mozilla review."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'probe/diagnostic/manifest.json').read_text())['version']
build = root / 'dist/diagnostic'
out = root / 'dist/releases'
out.mkdir(parents=True, exist_ok=True)
expected = {'manifest.json','content.js','popup.js','popup.html','popup.css','icon.svg','icon-16.png','icon-32.png','icon-48.png','icon-96.png','shortcuts.html','obsidian-latex-suite-LICENSE.md'}
assert {p.name for p in build.iterdir() if p.is_file()} == expected, 'Unexpected or missing files in extension build'
assert json.loads((build / 'manifest.json').read_text())['version'] == version, 'Run build:probe first'

def archive(path, entries):
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, source in sorted(entries):
            assert source.is_file() and not source.is_symlink(), source
            info = zipfile.ZipInfo(name, date_time=(1980,1,1,0,0,0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, source.read_bytes())

unsigned = out / f'latex-para-paper-{version}-unsigned.zip'
source = out / f'latex-para-paper-{version}-source.zip'
archive(unsigned, [(name, build/name) for name in expected])
entries = [(name, root/name) for name in ['package.json','package-lock.json','tsconfig.json','README.md','LICENSE']]
for folder in ['probe','scripts','docs/release']:
    for path in (root/folder).rglob('*'):
        if path.is_file() and path.suffix in {'.ts','.js','.mjs','.py','.md','.html','.css','.json','.svg','.png'}:
            entries.append((path.relative_to(root).as_posix(), path))
archive(source, entries)
lines = [hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name for p in [unsigned,source]]
(out/'SHA256SUMS').write_text('\n'.join(lines)+'\n')
print('Unsigned add-on:', unsigned.relative_to(root))
print('Reproducible source:', source.relative_to(root))
print('Signing required: these artifacts are not a signed permanent-installation XPI.')
