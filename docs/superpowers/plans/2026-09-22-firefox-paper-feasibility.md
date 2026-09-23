# Firefox Paper Direct Equation Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demonstrate direct fraction expansion, placeholder navigation, reliable undo, and persisted equations in Dropbox Paper using a Firefox development extension.

**Architecture:** A deliberately small WebExtension probe connects an observed Paper equation editor to a pure fraction-edit module. A host port separates browser mechanics from text operations. Only a live Firefox/Paper pass permits planning the complete production extension; a local fixture cannot establish product feasibility.

**Tech Stack:** TypeScript, npm, Vitest, esbuild, web-ext, Firefox desktop; no backend or external rendering service. Resolve compatible current package versions during execution and commit the lockfile.

**Spec:** `docs/superpowers/specs/2026-09-22-firefox-paper-latex-design.md` (approved).

## Global Constraints

- “A separate composer, image insertion, or clipboard-only workflow does not satisfy this product goal.”
- “The release order is Firefox with Dropbox Paper first, then a separately scoped Google Docs integration.”
- “Do not store document contents or equation histories.”
- “Define positions consistently as UTF-16 offsets and cover non-ASCII input in tests.”
- “Nonempty selections are left alone in this release; visual wrapping snippets are deferred.”
- “Do not expand during IME composition or blindly treat paste as typed triggers.”
- “Never apply an edit using stale text or selection state.”
- “Do not request all-sites access, clipboard access, or document API credentials for this scope.”
- “A visual DOM change alone does not pass.”
- “If no reliable mechanism exists, stop and present the failed constraints and revised options; do not silently replace the product with a popup or image workflow.”

## Scope and execution boundary

This is the executable plan for the first, independently testable milestone in the approved specification. The production adapter cannot honestly be prescribed before observing Paper. Tasks 1–4 establish that missing evidence. Do not describe the resulting probe as a public beta or a finished product.

The production continuation below maps every remaining spec requirement to its next work package. After a successful probe, write that implementation plan against the measured host interface. After a failed probe, report the constraint and revisit the design. Do not invent CSS selectors, editor APIs, or undo semantics to fill the gap.

The workspace has only the skill installation and design documents; it is not currently a Git repository. At execution, initialize a local Git repository, preserve existing files, and make focused commits. No remote repository is needed for this milestone.

## Review Focus

- A non-BMP character before a trigger must not shift the caret or overwrite adjacent content (Task 2).
- A host rerender between reading and applying must cancel the edit, even when the new editor has identical text (Task 3).
- Paste and IME completion must not be mistaken for ordinary trigger typing (Tasks 2–4).
- A focused comment, ordinary paragraph, or read-only equation must never activate the probe (Tasks 1, 3, 4).
- Undo, focus changes, and external edits must invalidate stale placeholder positions rather than hijack the next Tab (Tasks 3–4).

## Files and responsibilities

| File | Responsibility |
|---|---|
| `docs/research/paper-editor-observations.md` | Firefox version, Paper surface, editor evidence, reusable-code assessment |
| `docs/research/paper-feasibility-results.md` | Actual results and pass/fail decision |
| `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore` | Reproducible development setup |
| `scripts/build-probe.mjs` | Bundle the development extension |
| `probe/manifest.json` | Verified Dropbox host matches; Firefox manifest |
| `probe/README.md` | Temporary installation and test instructions |
| `probe/src/fraction.ts` | Pure `//` expansion and field positions |
| `probe/src/types.ts` | Shared snapshot, edit, and port types |
| `probe/src/session.ts` | Placeholder navigation and stale-session cancellation |
| `probe/src/paper-port.ts` | Evidence-backed access to the actual host editor |
| `probe/src/content.ts` | Composition/input/key/focus lifecycle |
| `probe/tests/fraction.test.ts` | Text and UTF-16 behavior |
| `probe/tests/session.test.ts` | Host-independent session behavior |
| `probe/tests/activation.test.ts` | Adapter activation against sanitized observed fixtures |
| `probe/tests/fixtures/` | Minimal, synthetic reproductions of observed editor structures |

Do not commit a browser profile, private document HTML, cookies, or user equation content. Use synthetic equations for all saved evidence.

## Task 1: Establish the live editor contract

**Files:** Create `docs/research/paper-editor-observations.md`.

**Interfaces:** Produces the observed host contract consumed by Task 3: how to identify an editable equation, read source/selection, commit an edit, set selection, and detect replacement of the editor instance. This is evidence, not an invented public Paper API.

- [ ] Confirm the available Firefox binary/version and browser-control capabilities. The current UI tool explicitly lists Chromium surfaces, so do not assume it can automate Firefox. If Firefox automation is unavailable, use a visible Firefox development session and a precise manual test run. Live verification still requires Firefox, not Chromium.
- [ ] Obtain access to a disposable Paper test document. If authentication is unavailable, ask the user to sign in themselves; never request credentials. Continue Task 2 independently, but mark Tasks 3–4 blocked on live access.
- [ ] Record the actual URL origin, Paper entry point/variant, edit permissions, and equation entry/render behavior. Limit observation and changes to the disposable document.
- [ ] Inspect the active equation input and selection. Compare it with a normal paragraph, comment input, rendered equation, and read-only surface. Record the concrete distinction used for activation.
- [ ] Observe the actual editor's input/transaction mechanisms and undo handling using Firefox developer tools. Do not mutate an undocumented internal object just because it exists. Prefer a supported editing operation if one is available; explicitly record fragility if an internal bridge is necessary.
- [ ] Review upstream LaTeX Suite fraction/tabstop modules and Snippetleaf's host bridge at pinned commits. Record which logic is reusable, its dependencies/license, and why it is or is not appropriate for this tiny probe. No full-plugin port or dependency installation from those repositories is required.
- [ ] Write the observation document with these sections: environment, activation, text/selection access, edit path, undo, lifecycle, upstream reuse, limitations. Include only measured facts; label untested operations explicitly.
- [ ] Commit the observation document after checking it contains no private content. If no equation surface can be inspected, report that blocker; do not replace the observation with assumptions.

## Task 2: Build a tested fraction operation

**Files:** Create development configuration, `probe/src/types.ts`, `probe/src/fraction.ts`, and `probe/tests/fraction.test.ts`.

**Interfaces:** Produces the following types and function for Tasks 3–4:

```ts
export type Range = { from: number; to: number };
export type Snapshot = {
  editorId: string;
  revision: number;
  text: string;
  selection: Range;
};
export type Edit = {
  expected: Snapshot;
  replace: Range;
  insert: string;
  fields: Range[]; // absolute positions after replacement
  exit: number;   // position after the inserted fraction
};
export type InputContext = { kind: string; composing: boolean };
export interface PaperPort {
  read(): Snapshot | null;
  apply(edit: Edit): boolean; // confirms host acceptance; false ends session
  select(expected: Snapshot, range: Range): boolean;
  dispose(): void;
}
export function expandFraction(s: Snapshot, c: InputContext): Edit | null;
```

`revision` is an adapter-local monotonic change counter, not a presumed Paper revision API. `editorId` distinguishes live editor instances. `apply` is synchronous only if the observed host supports synchronous confirmation; if it does not, revise the contract and its tests explicitly before Task 3, with cancellation/revalidation across the wait.

- [ ] Initialize Git if still absent. Ignore `node_modules/`, `dist/`, `.web-ext/`, and browser profiles. Record a baseline commit of the existing project documents and installed skill.
- [ ] Create a private npm package with TypeScript, Vitest, esbuild, and web-ext as development dependencies. Configure `test` as `vitest run`, `typecheck` as `tsc --noEmit`, and `build:probe` as `node scripts/build-probe.mjs`. Do not run the build until Task 3 supplies that script.
- [ ] Write the failing tests before implementing the operation:

```ts
import { expect, test } from 'vitest';
import { expandFraction } from '../src/fraction';
import type { Snapshot } from '../src/types';
const typed = { kind: 'insertText', composing: false };
const atEnd = (text: string): Snapshot => ({
  editorId: 'equation-1', revision: 1, text,
  selection: { from: text.length, to: text.length }
});

test('expands at the caret without consuming surrounding text', () => {
  const s = atEnd('z+//');
  expect(expandFraction(s, typed)).toEqual({
    expected: s, replace: { from: 2, to: 4 }, insert: '\\frac{}{}',
    fields: [{ from: 8, to: 8 }, { from: 10, to: 10 }], exit: 11
  });
});
test('uses UTF-16 offsets', () => {
  expect(expandFraction(atEnd('𝛼//'), typed)?.fields[0].from).toBe(8);
});
test('leaves selected text alone', () => {
  const s = atEnd('//'); s.selection.from = 0;
  expect(expandFraction(s, typed)).toBeNull();
});
test('does not expand paste or composition', () => {
  expect(expandFraction(atEnd('//'), { kind: 'insertFromPaste', composing: false })).toBeNull();
  expect(expandFraction(atEnd('//'), { kind: 'insertText', composing: true })).toBeNull();
  expect(expandFraction(atEnd('//'), { kind: 'insertCompositionText', composing: false })).toBeNull();
});
```

- [ ] Run `npm test -- probe/tests/fraction.test.ts`; confirm a missing implementation failure rather than a configuration error.
- [ ] Implement the narrow operation:

```ts
import type { Edit, InputContext, Snapshot } from './types';
export function expandFraction(s: Snapshot, c: InputContext): Edit | null {
  const { from, to } = s.selection;
  if (c.composing || c.kind !== 'insertText' || from !== to || from < 2) return null;
  if (from > s.text.length || s.text.slice(from - 2, from) !== '//') return null;
  const start = from - 2;
  return {
    expected: s, replace: { from: start, to: from }, insert: '\\frac{}{}',
    fields: [{ from: start + 6, to: start + 6 }, { from: start + 8, to: start + 8 }],
    exit: start + 9
  };
}
```

- [ ] Add a test with `//` in the middle of an equation to prove trailing text is preserved, and tests for a nontrigger and a caret outside the text. Reject negative, noninteger, or out-of-range selection offsets before constructing edits.
- [ ] Run the focused tests and `npm run typecheck`. Commit the passing operation and lockfile. Passing here establishes text transformation only, not Paper support.

## Task 3: Connect the probe to the measured Paper editor

**Files:** Create the build script, manifest, port, session/controller modules, README, session and activation tests, and sanitized fixtures listed above.

**Interfaces:** Consumes Task 2's `PaperPort`, `Snapshot`, and `Edit`; implement `createPaperPort(document: Document): PaperPort`. Expose `createSession(port: PaperPort)` with `onInput(context: InputContext): void`, `onTab(backward: boolean): boolean`, `cancel(): void`, and `dispose(): void`. `onTab` returns true only when it has successfully moved a live placeholder selection.

**Entry condition:** Task 1 must supply observed activation and editing mechanics. If it cannot, stop this task rather than write a fake production adapter.

- [ ] Write activation tests against synthetic versions of the measured equation surface: editable math yields a snapshot; prose, comments, rendered math, and read-only math yield null. Do not copy private page captures into fixtures.
- [ ] Write session tests using a fake port. Expand `//`, type numerator `a`, Tab to denominator, type `b`, Shift+Tab back, and Tab past the final field. Assert the selection offsets against `\\frac{a}{b}`. At the first field, Shift+Tab ends the session and passes through rather than trapping focus.
- [ ] Add tests where the port returns a new editor ID with the same text, a changed revision, a failed `apply`, and a failed `select`. In each case cancel the session; the next Tab returns false. Add tests for cancellation on focus loss, undo/redo, and disabling the probe.
- [ ] Run `npm test -- probe/tests/session.test.ts probe/tests/activation.test.ts` and confirm the expected unimplemented behavior failures.
- [ ] Implement `paper-port.ts` using the documented evidence from Task 1. Immediately before editing or moving selection, compare editor identity, revision, source, and selection against the expected snapshot. The core check is:

```ts
const matches = (a: Snapshot | null, b: Snapshot): boolean => !!a &&
  a.editorId === b.editorId && a.revision === b.revision && a.text === b.text &&
  a.selection.from === b.selection.from && a.selection.to === b.selection.to;
```

The actual host operation must be derived from observation; this plan intentionally provides no unverified selector or transaction call. Confirm the post-edit source and selection through the host, not just through the DOM value that was written.

- [ ] Implement a session that remaps later field offsets after a confirmed local insertion/deletion wholly inside the active field. If an edit crosses a field boundary, originates externally, or cannot be classified safely, cancel. Snapshot differences alone are insufficient evidence that an edit is local; use the observed input lifecycle. Undo/redo always cancels probe sessions.
- [ ] Wire composition/input/focus events. Maintain composition state through its commit event so `compositionend` does not immediately enable an unintended expansion. Call `preventDefault()` for Tab only after `onTab` reports success. Do not synthesize keyboard events as proof of accepted edits.
- [ ] Bundle `probe/src/content.ts` into `dist/probe/content.js` with esbuild and copy the manifest into `dist/probe/`. Use only the observed HTTPS Dropbox host matches, no background process unless evidence requires it, and no remote code. Temporary-install the manifest through Firefox's extension debugging page or `web-ext run --source-dir dist/probe`.
- [ ] Document the exact build/run commands, how to disable/remove the temporary extension, and the verified Paper entry point in `probe/README.md`.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build:probe`, and `npx web-ext lint --source-dir dist/probe`. Fix actual errors, record any justified warnings, and commit the probe. This still does not establish persisted Paper behavior.

## Task 4: Run the live pass/fail protocol

**Files:** Create `docs/research/paper-feasibility-results.md`; update probe code/tests only for observed defects.

**Interfaces:** Produces the go/no-go evidence consumed by the production implementation plan. Each row records pass, fail, or not tested with exact observations; never treat not tested as pass.

- [ ] Record Firefox version, OS, date, Paper entry point/variant, probe commit, and installation command.
- [ ] In the disposable document, type a prose sentinel before and after a native equation. Type `//`, fill `a` and `b`, traverse forward/backward, exit the snippet, and render. Confirm the result is a fraction and the sentinels are unchanged.
- [ ] Reopen the equation, inspect its LaTeX, reload the document, and repeat the inspection. Expected source: `\\frac{a}{b}` (a single literal backslash in the actual equation). Record the exact stored source without escaping ambiguity.
- [ ] Undo and redo the expansion and subsequent field edits. Record the actual grouping; require predictable recovery of source and caret, no duplicates, and unchanged prose. A visually correct but unsaved fraction fails.
- [ ] Paste `//`, enter an IME composition, select text, leave/reenter the editor, and trigger a rerender. Verify no unintended replacement and no stale Tab handling. If an IME cannot be exercised, mark it not tested and do not declare all acceptance checks passed.
- [ ] Test paragraph/comment/read-only surfaces and a second Paper document. Confirm activation stays inside a supported editable equation and old sessions do not leak across documents.
- [ ] Introduce an external edit during a snippet session using a second browser session on the same disposable document if available. Confirm stale state cancels. A unit-test simulation does not substitute for this collaboration check; record absent access explicitly.
- [ ] Disable/remove the probe and verify normal Paper editing resumes.
- [ ] For each defect, add the narrow regression test, reproduce failure, implement the correction, and rerun affected checks. Do not broaden the feature scope to hide a failed integration.
- [ ] Write the decision: pass only for observed direct edits, navigation, undo, persistence, and all required lifecycle/input checks. Distinguish an access/tooling blocker from evidence that the integration is impossible. List supported surfaces precisely.
- [ ] Commit results and report the milestone outcome. Do not claim release readiness or publish the probe.

## Production continuation after a successful probe

These are sequenced work packages, not authorization to skip the feasibility gate or an executable implementation plan for unknown host mechanics.

| Package | Deliverable and required acceptance |
|---|---|
| Engine and documented defaults | `sr`, `sq`, Greek shortcuts, literal custom triggers, numbered fields, UTF-16 correctness, deterministic trigger conflicts; concrete snippet grammar and boundary tests |
| Automatic fractions | Simple operand and balanced-parenthesis conversion; ambiguous expressions unchanged; nested/malformed cases tested |
| Production Paper adapter | Port the proven edit path, preserve native input/rendering, invalidation/undo/cleanup coverage, rerender and collaboration regression tests |
| Firefox controls and local settings | Toolbar enable/status, settings editor, validated text-only snippets, last-good configuration on error, persistence across restart, no equation history |
| Public release | Full spec acceptance matrix in live Firefox, public source and attribution, reproducible build, README/contribution guide, privacy and permission disclosures, screenshots, reviewer test instructions, signed Mozilla Add-ons submission |

Map every remaining feature to its file/API/tests in the next implementation plan using the proven host contract. Google Docs remains a separate subsequent design/feasibility effort. Public release requires Mozilla account access and store review; neither is needed for this temporary probe.

## Plan self-review

- Coverage: This milestone covers the spec's feasibility gate; the table above explicitly retains all production requirements instead of implying they are implemented here.
- Evidence: No Paper selectors, editor implementation, persistence behavior, or browser-control capability is presumed.
- Interfaces: Snapshot/Edit/PaperPort are shared by the pure operation and the controller. Host-driven asynchronous changes require an explicit contract revision before connection.
- Review focus: UTF-16 and composition belong to Task 2; rerender, activation, cancellation, and event handling belong to Task 3; actual persistence, undo, and collaboration belong to Task 4.
- Limits: No dates, performance claims, public availability, or full feature parity are promised from unit-test results.
