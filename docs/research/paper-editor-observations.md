# Paper editor observations

Date: 2026-09-22
Status: environment and upstream review recorded; automated sign-in was blocked; the user has confirmed the ordinary Firefox test document is ready. A manual diagnostic is prepared.

## Environment

- Linux desktop; Firefox 156.0.
- Snap geckodriver 0.37.1 started on localhost only.
- The user reported that sign-in was refused in the WebDriver-controlled window. This is a login-environment blocker, not a finding about Paper equation editing.
- A separate ordinary Firefox profile was launched without WebDriver for manual sign-in. Its local profile directory is Git-ignored. Do not attach automation or claim login success without confirmation.
- The user's existing Firefox profile was not read or reused.
- Node 24.21.0 and npm 11.19.0 are available through the existing nvm installation.
- No live Paper equation has been inspected, edited, or validated yet.

## Activation, text and selection, editing, undo, lifecycle

These capabilities are not yet observed. Manual authentication is required before opening the disposable test document. No CSS selector, editor API, or write mechanism is assumed. The actual Paper variant and required host origins must be recorded after live inspection.

## Upstream reuse assessment

Read-only source review used the following pinned revisions:

- LaTeX Suite: `artisticat1/obsidian-latex-suite@265579790a1456c4a7a4a1b893a529041a81c27f`.
- Snippetleaf: `superle3/snippet-leaf@51add8d469f23b752f224db1d83e03037452530f`.

LaTeX Suite's `src/features/autofraction.ts` consumes CodeMirror EditorView/SelectionRange and plugin context/configuration, builds snippet nodes, queues snippet expansion, and optionally enlarges brackets. Its algorithm walks backward through a candidate numerator and handles balanced brackets. This is useful for designing the later automatic-fraction feature, but imports substantial host-specific infrastructure.

Its `src/snippets/codemirror/tabstops_state_field.ts` maps fields through CodeMirror transactions and manages selection/decorations. This confirms why the host change model matters: its tabstop implementation is not a generic DOM replacement utility.

Snippetleaf's `browser_extension/browser_extension.ts` listens for Overleaf's `UNSTABLE_editor:extensions` event and obtains CodeMirror objects and an extension list from that event. It also accesses CodeMirror configuration internals. The mechanism is Overleaf-specific; it provides no evidence that the same event or API exists in Paper. Its broad host permissions are not needed for the proposed Paper-specific scope.

Decision: implement the small, pure `//` probe independently. No upstream code has been copied into the probe. Revisit reusable parsing logic when the host contract is proven and automatic fractions enter scope. Preserve upstream notices if code is subsequently reused.

## Local evidence

The pure fraction module was tested first with a no-op implementation: four expansion assertions failed as expected. After implementation, 21 tests pass and TypeScript checking passes. These tests establish replacement ranges and positions only, not browser compatibility, native undo, or persistence.

## Limitations and next evidence

The live gate remains open. Required observations: editable math activation versus prose/comments/read-only content; selection and source access; accepted write path; undo grouping; render/reopen/reload persistence; composition and lifecycle behavior; external-edit cancellation. None can be inferred from the unit suite.

## Dropbox connector capability check

The connected Dropbox tools expose file search, metadata/content retrieval, file operations, and sharing. They do not expose Paper browser editor selection, keystrokes, equation transactions, or undo. Using them would not test the required direct-editing behavior. No unrelated Dropbox files were read during this capability check.

## Read-only diagnostic

A user-invoked temporary Firefox extension (`probe/diagnostic/`) inspects only the focused element and up to eight ancestors. It reports tag names, class tokens, fixed role/editability flags, and host (not document path). It excludes field values, text, full HTML, IDs, labels, and data attributes, and refuses sensitive input types and password/one-time-code forms. Ordinary text inputs and non-login forms are allowed for structural inspection. No network or storage APIs are used. Eight synthetic DOM tests check these boundaries. The real Paper report is still pending; synthetic textarea/contenteditable fixtures do not establish Paper's actual implementation.

## First live diagnostic feedback

The user returned `form-or-input` from version 0.0.1 while targeting the equation. This only establishes that focus was an input or within a form; it does not identify Paper's editor type. The filter was overly broad. Version 0.0.2 permits structural inspection of plain text inputs and non-login forms, still without reading their values. Regression tests reproduce the original rejection for a text input, an input with implicit text type, and a textarea inside a form. Sensitive input cases remain rejected. The rebuilt report includes its extension version to distinguish stale installations. A detailed live report is still required.

## Observed inline equation structure

The user supplied a successful v0.0.2 diagnostic from www.dropbox.com. The active field is `input.inline-latex-input`, type text, contenteditable true, writable, enabled, with standard selection APIs. Its ancestors include `.inline-latex-input-container`, `.inline-latex-wrapper`, `.inline-latex`, `.ace-line`, and `.ace-editor[contenteditable="true"]`. This evidence identifies the field; it does not prove a host transaction or saved state. Author/zone classes were omitted from the synthetic fixture and saved observations.

Candidate native insertion and undo were tested independently in Firefox 156 on synthetic content, then integrated into the user-activated probe. See paper-feasibility-results.md for the explicit boundary between local evidence and still-pending live checks.
