"""Submit the built extension to Mozilla Add-ons without saving API credentials."""
from getpass import getpass
import os
from pathlib import Path
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
web_ext = root / "node_modules" / ".bin" / "web-ext"
if not web_ext.exists():
    print("Install project dependencies first with npm ci.", file=sys.stderr)
    raise SystemExit(2)
if not sys.stdin.isatty():
    print("Run this command in a terminal so the Mozilla API credentials can be entered privately.", file=sys.stderr)
    raise SystemExit(2)

api_key = getpass("Mozilla Add-ons API key (issuer): ")
api_secret = getpass("Mozilla Add-ons API secret: ")
if not api_key or not api_secret:
    print("Both credentials are required.", file=sys.stderr)
    raise SystemExit(2)

env = os.environ.copy()
env["WEB_EXT_API_KEY"] = api_key
env["WEB_EXT_API_SECRET"] = api_secret
api_key = api_secret = ""
manifest = __import__("json").loads((root / "probe" / "diagnostic" / "manifest.json").read_text())
source_archive = root / "dist" / "releases" / f"latex-para-paper-{manifest['version']}-source.zip"
if not source_archive.exists():
    print("Build the matching source archive first with npm run package:release.", file=sys.stderr)
    raise SystemExit(2)
print("Submitting the listed add-on and matching source to Mozilla for review…", flush=True)
result = subprocess.run([
    str(web_ext), "sign", "--source-dir", str(root / "dist" / "diagnostic"),
    "--channel", "listed",
    "--amo-metadata", str(root / "docs" / "release" / "amo-metadata.json"),
    "--upload-source-code", str(source_archive),
], cwd=root, env=env, check=False)
if result.returncode:
    print("Mozilla did not accept the submission. Check its response and try again.", file=sys.stderr)
raise SystemExit(result.returncode)
