# Publish and install in Firefox

Regular Firefox requires a Mozilla-signed add-on. To publish this extension for everyone, submit it as a **listed** add-on on Firefox Add-ons (AMO).

1. Sign in at https://addons.mozilla.org/developers/.
2. Create API credentials at https://addons.mozilla.org/developers/addon/api/key/. Keep the API secret private; never commit it or paste it into chat.
3. In a terminal, run `npm run package:release` to build the extension and matching source archives.
4. Run `npm run submit:amo`. Enter the API key and secret at the hidden prompts; the script passes them to `web-ext` for this run and does not store them. It submits the listed add-on with `docs/release/amo-metadata.json`. Upload the matching source archive in AMO if Mozilla requests it.
5. Complete the public listing using `AMO_LISTING.md`, review Mozilla’s developer agreement, and submit for review.
6. After Mozilla approves the listing, install it from its Firefox Add-ons page. Firefox will deliver signed updates automatically.

A ZIP renamed to `.xpi` is not signed. Unsigned builds only install temporarily in `about:debugging`.
