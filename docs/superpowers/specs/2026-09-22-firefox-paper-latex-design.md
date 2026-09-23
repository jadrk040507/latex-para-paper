# Firefox LaTeX shortcuts for Dropbox Paper

Status: Written specification approved by the user on 2026-09-22.
Date: 2026-09-22

## Purpose and agreed scope

Deliver the Obsidian LaTeX Suite typing experience directly inside Dropbox Paper's equation editor, beginning with Firefox on desktop. Users type short triggers, see LaTeX expand in place, and navigate equation placeholders with Tab. A separate composer, image insertion, or clipboard-only workflow does not satisfy this product goal.

The release order is Firefox with Dropbox Paper first, then a separately scoped Google Docs integration. The product is intended for public use. This specification covers the Paper release only; it does not promise a working Google Docs integration.

The user approved this direction and first-release feature scope in conversation. No browser integration has been prototyped or verified yet. The workspace currently has no application code or Git repository.

## Evidence and feasibility boundary

Dropbox documents a native LaTeX editing mode entered with `$$`, with Enter rendering the result. This establishes an existing user workflow, not an extension API or proof that programmatic editing works.

Obsidian LaTeX Suite is coupled to CodeMirror and Obsidian. Snippetleaf provides an existing Overleaf browser port. Both are candidates for source review and reuse; neither establishes that Paper uses a compatible editor. Preserve applicable copyright and license notices for reused code.

Firefox content scripts can interact with permitted pages. That does not guarantee that DOM changes update a site's internal editor state. A Paper adapter must demonstrate real persistence, undo, and selection behavior before the product architecture is considered feasible.

## User experience

1. Install the Firefox extension and grant access to supported Dropbox origins.
2. Open an editable Paper document and enter its native equation mode with `$$`.
3. Type supported shortcuts. Expansion happens in that equation editor, without switching to another surface.
4. Use Tab and Shift+Tab to move between snippet fields. When no extension placeholder is active, preserve Paper's existing key behavior.
5. Press Enter to use Paper's normal render action. Reopen the equation to edit its stored LaTeX.
6. Use the extension toolbar to disable expansion or open snippet settings.

Normal prose, comments, unrelated inputs, read-only documents, and non-Paper Dropbox pages must not receive snippet expansion. Rendering remains Paper's responsibility.

## First-release features

- Superscript shortcut `sr` expands to `^{2}` in a valid math context.
- `sq` expands to `\sqrt{}` with the cursor inside the braces.
- A documented starter set of Greek-letter shortcuts, including `@a` to `\alpha` and `@t` to `\theta`.
- `//` creates `\frac{}{}` with numerator and denominator fields.
- Automatic fraction conversion supports a preceding simple operand, such as `x/`, and a balanced parenthesized expression. Unsupported or ambiguous expressions remain unchanged.
- Tab advances and Shift+Tab retreats through active fields. Leaving the last field ends the snippet session. Boundary behavior must never trap keyboard focus.
- Expansion and field navigation work with a collapsed caret. Nonempty selections are left alone in this release; visual wrapping snippets are deferred.
- Undo reverses an expansion predictably; redo restores it. Prefer a single undo step per expansion where the host supports it, and document the verified behavior.
- Settings support enable/disable and custom literal-trigger, text-replacement snippets with numbered placeholders. Reject invalid definitions with an actionable error.
- Store preferences and snippet definitions locally. Do not store document contents or equation histories.

Regex triggers, executable JavaScript snippets, matrices, concealment, visual snippets, arbitrary LaTeX compilation, mobile browsers, accounts, cloud sync, analytics, and Google Docs support are excluded from this release.

## Architecture

### Shared snippet engine

A TypeScript module independent of Firefox and Paper receives the active equation text, caret/selection, input context, and snippet session state. It returns either no action or a proposed replacement range, replacement text, and next selection/session state.

The engine owns trigger matching, placeholder offsets, supported fraction parsing, and snippet validation. It must not read the page, dispatch browser events, or persist document text. Define positions consistently as UTF-16 offsets and cover non-ASCII input in tests.

Review LaTeX Suite and Snippetleaf for reusable parsing and navigation logic. Keep only dependencies required by the supported feature set; do not build a fake Obsidian environment to run the entire plugin.

### Dropbox Paper adapter

The adapter detects editable equation sessions, translates host selection and text into engine inputs, and applies proposed edits through a mechanism proven to update Paper's actual document state.

It owns host-specific event handling, selection mapping, focus changes, equation rendering boundaries, undo integration, and cleanup. Do not assume `contenteditable`, CodeMirror, synthetic keystrokes, or direct DOM replacement is sufficient. The feasibility milestone selects the implementation based on observation and tests.

An active snippet session is invalidated when focus leaves the equation, the equation is rendered or removed, the extension is disabled, or a host edit makes its stored ranges stale. Never apply an edit using stale text or selection state. Revalidate before each replacement; cancel the snippet session if that check fails.

### Firefox extension shell

Use Firefox WebExtensions with bundled code, a content script, local settings storage, and a minimal toolbar/settings interface. Prefer Manifest V3, with background behavior designed for Firefox rather than assuming Chrome service-worker support.

Request only the Dropbox origins actually required by the verified Paper entry points. Further restrict activation to supported Paper editors at runtime. Do not request all-sites access, clipboard access, or document API credentials for this scope.

A future Google Docs adapter can share the engine contract, but must independently prove native editing feasibility.

## Input handling and failure behavior

- Do not expand during IME composition or blindly treat paste as typed triggers.
- Handle only keystrokes the active snippet session consumes; preserve native shortcuts otherwise.
- Preserve the last valid configuration if a custom snippet import or edit is invalid.
- When the host editor cannot be recognized, leave editing unchanged and expose an unsupported-editor status through the toolbar.
- If applying an edit cannot be confirmed, stop that snippet session. Do not repeatedly retry or replay keystrokes.
- Do not retain full document text in diagnostics. Error reports should contain capability and version information, not user content.
- Collaboration must not lead to stale replacements: test an external edit during a snippet session and cancel the session when safe reconciliation is unavailable.

## Feasibility milestone and decision

Use a disposable Paper document in Firefox. Inspect the live equation editor and prove the following before investing in the full extension:

1. Identify the actual equation input surface, text, and caret reliably.
2. Expand `//`, fill both fields, and navigate forward and backward.
3. Undo and redo with the document and neighboring prose intact.
4. Render, reopen, and reload the equation; confirm the stored source survives.
5. Verify paste, keyboard composition, selection changes, and focus changes do not cause unintended edits.
6. Identify which old/new Paper entry points and Firefox version were actually tested.

Pass only if direct editing, correct cursor navigation, and persisted document state are demonstrated together. A visual DOM change alone does not pass. Record exact observations and the supported compatibility boundary. If no reliable mechanism exists, stop and present the failed constraints and revised options; do not silently replace the product with a popup or image workflow.

## Verification and acceptance

Engine tests cover trigger boundaries, placeholder offsets, forward/backward navigation, simple and balanced fractions, malformed snippet rejection, and non-ASCII text.

Adapter tests cover editor activation, range invalidation, composition suppression, native key pass-through, navigation between documents, and disable/cleanup behavior. Simulated fixtures can support these tests but cannot replace live Paper verification.

Release acceptance requires a real Firefox session showing:

- Enter native math mode, type superscripts, a square root, Greek symbols, and a fraction.
- Traverse fields with Tab/Shift+Tab and continue typing at the expected caret.
- Undo/redo, render/reopen, and reload without loss or duplicate insertion.
- Normal text and comments remain unaffected.
- Paste and IME composition do not trigger unintended expansion.
- An external edit does not cause replacement at a stale range.
- Unsupported editor surfaces fail without altering user content.
- Settings persist across Firefox restart; disabling the extension restores normal interaction.

Record the Firefox version, operating system, Paper variant, supported features, and known limitations. The public compatibility statement must reflect tested behavior rather than claim universal website support.

## Public distribution

Publish a source repository with the license, upstream attribution, reproducible build instructions, contribution guidance, and tests. Prepare a Mozilla Add-ons listing with screenshots, a concise permission explanation, data handling disclosures, and reviewer instructions for a disposable Paper document. Submit the extension for Mozilla signing and listed distribution; provide source/build materials when required.

A Mozilla developer account and a Paper test session are external prerequisites for publishing and live validation respectively. Store review timing is outside the implementation's control. The first release should work locally without a backend, paid service, or product account.

Google Docs begins only after the Paper milestone is accepted and receives its own feasibility/design work. Native Docs equation support is not implied by shared snippet-engine reuse.

## Sources

- Obsidian LaTeX Suite: https://github.com/artisticat1/obsidian-latex-suite
- Upstream license: https://github.com/artisticat1/obsidian-latex-suite/blob/main/LICENSE.md
- Existing browser port: https://github.com/superle3/snippet-leaf
- Paper LaTeX mode: https://help.dropbox.com/view-edit/create-code-block
- Firefox content scripts: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts
- Firefox permissions: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions
- Mozilla distribution: https://extensionworkshop.com/documentation/publish/
- Mozilla submission: https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- Google Docs rendering constraints: https://workspaceupdates.googleblog.com/2021/05/Google-Docs-Canvas-Based-Rendering-Update.html
- Google Docs API requests: https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request
