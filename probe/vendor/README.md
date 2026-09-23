# Upstream data provenance

Source: https://github.com/artisticat1/obsidian-latex-suite
Pinned commit: `265579790a1456c4a7a4a1b893a529041a81c27f`.
Copyright (c) 2022 artisticat1. MIT license is included alongside these files and in the extension bundle.

- `default-snippets.json`: all 199 definitions from `src/default_snippets.js`. Regex objects serialized to source strings, options preserved, stable source-order IDs added. Five functions represented by descriptive identifiers; their math behavior is reimplemented in the adapter rather than evaluated from source.
- `snippet-variables.json`: `src/default_snippet_variables.js` default regex variables.
- `macros.json`: static `ALL_MACROS` list from `src/snippets/luasnip_api/macros.ts`; no Obsidian network loader copied.

The compiled engine expands snippet variables, prioritizes rules, parses captures and numbered fields, implements visual/manual/automatic modes, and substitutes inline environments for multiline counterparts. Native Paper equation entry replaces the five Markdown/text-entry definitions. The complete source catalog and adaptation notes are shown by the extension's shortcut reference.

These are local, pinned data. Building or using the extension does not download or evaluate remote snippet code.
