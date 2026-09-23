"""Submit the built extension to Mozilla Add-ons without saving API credentials."""
import base64
import hashlib
import hmac
import json
import os
from getpass import getpass
from pathlib import Path
import secrets
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parent.parent
web_ext = root / "node_modules" / ".bin" / "web-ext"
manifest = json.loads((root / "probe" / "diagnostic" / "manifest.json").read_text())
source_archive = root / "dist" / "releases" / f"latex-para-paper-{manifest['version']}-source.zip"
metadata_file = root / "docs" / "release" / "amo-metadata.json"

if not web_ext.exists():
    print("Install project dependencies first with npm ci.", file=sys.stderr)
    raise SystemExit(2)
if not source_archive.exists() or not metadata_file.is_file():
    print("Build the matching extension and source archive with npm run submit:amo.", file=sys.stderr)
    raise SystemExit(2)
if not sys.stdin.isatty():
    print("Run this command in a terminal so Mozilla API credentials can be entered privately.", file=sys.stderr)
    raise SystemExit(2)

api_key = getpass("Mozilla Add-ons API key (issuer): ").strip()
api_secret = getpass("Mozilla Add-ons API secret: ").strip()
if not api_key.startswith("user:") or not api_secret:
    print("Use the API key (issuer) and matching API secret from AMO API Credentials.", file=sys.stderr)
    raise SystemExit(2)
if any(char.isspace() for char in api_key + api_secret):
    print("Credentials contain whitespace. Copy both again without spaces or line breaks.", file=sys.stderr)
    raise SystemExit(2)


def encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


now = int(time.time())
header = encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
payload = encode(json.dumps({
    "iss": api_key,
    "iat": now,
    "exp": now + 60,
    "jti": secrets.token_urlsafe(18),
}, separators=(",", ":")).encode())
signing_input = f"{header}.{payload}".encode("ascii")
signature = hmac.new(api_secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
token = f"{header}.{payload}.{encode(signature)}"
request = Request(
    "https://addons.mozilla.org/api/v5/accounts/profile/",
    headers={"Authorization": f"JWT {token}", "Accept": "application/json"},
)
print("Checking Mozilla API credentials before upload…", flush=True)
try:
    with urlopen(request, timeout=20) as response:
        if response.status != 200:
            print(f"Unexpected Mozilla profile response (HTTP {response.status}).", file=sys.stderr)
            raise SystemExit(2)
except HTTPError as error:
    if error.code == 401:
        print("Mozilla rejected this API key/secret pair. No add-on was uploaded. Generate a fresh matching pair in AMO API Credentials and check that your system clock is correct.", file=sys.stderr)
    elif error.code == 403:
        print("Mozilla denied the profile request before upload. Check your AMO developer agreement and account access.", file=sys.stderr)
    else:
        print(f"Mozilla credential check failed before upload (HTTP {error.code}).", file=sys.stderr)
    raise SystemExit(2)
except (URLError, TimeoutError, OSError) as error:
    print(f"Could not reach Mozilla to verify credentials: {error}.", file=sys.stderr)
    raise SystemExit(2)

env = os.environ.copy()
env["WEB_EXT_API_KEY"] = api_key
env["WEB_EXT_API_SECRET"] = api_secret
api_key = api_secret = ""
print("Credentials verified. Submitting the listed add-on and matching source to Mozilla…", flush=True)
result = subprocess.run([
    str(web_ext), "sign", "--source-dir", str(root / "dist" / "diagnostic"),
    "--channel", "listed",
    "--amo-metadata", str(metadata_file),
    "--upload-source-code", str(source_archive),
], cwd=root, env=env, check=False)
if result.returncode:
    print("Mozilla rejected the upload after accepting the credentials. Check the upload response and AMO listing requirements.", file=sys.stderr)
raise SystemExit(result.returncode)
