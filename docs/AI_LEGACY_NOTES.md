# AI Legacy And Rewrite Notes

Read this only when restoring old-skin behavior, researching feature parity, interpreting compatibility names, or deciding whether an experimental implementation belongs in production.

## Current Source First

The production application is the `index.html` + `src/` tree. Establish current behavior, API contracts, and tests before opening legacy material.

Legacy and exploratory references include:

- `skin.tcl`: original Tcl skin behavior.
- `tcl_rewrite_guide.md`: migration-oriented notes.
- `rewrite_roadmap.md`: early architecture plan.
- `settings_work/`: settings experiments and drafts.
- `figama_code/`: design/code experiments.
- `settings_ui.md`, loose plans, response dumps, transcripts, screenshots, `shots/`, and `shothistory/`: task-specific evidence or historical artifacts.

These files can be useful evidence, but they are not current architecture authority. Some still recommend frameworks, Plotly, CDN Tailwind, full-page assumptions, or obsolete paths.

## Progressive-Disclosure Workflow

For a parity question:

1. Identify the current production entry point and observed behavior.
2. Read the local REST/WebSocket contract for any machine interaction.
3. Search the legacy source for the exact feature, label, command, state, or setting.
4. Read only the surrounding procedure and its direct dependencies.
5. Write down the user-visible intent and edge cases.
6. Implement that intent using current modules, async APIs, WebView lifecycle, and storage rules.
7. Add focused pure tests and a browser/hardware smoke test.
8. Update user documentation if the restored behavior is public.

Do not translate Tcl line by line. Tcl globals, timers, direct machine access, fixed coordinates, and synchronous assumptions often need a different browser design.

## Compatibility Surfaces

Several old names remain intentionally:

- `reaHostname` identifies the Decaid API host.
- REA-prefixed functions and settings keys remain part of internal compatibility.
- `streamline.js` is the installed skin ID.
- `plotly-chart` remains an element identifier while ECharts renders it.
- the legacy `streamline` KV namespace is a profile-migration source.
- `.reaplugin` and other old product identifiers can be external contracts.

Rename only with a complete migration covering stored data, APIs, manifests, tests, user docs, and downstream consumers.

## Using The Tcl Source

The Tcl skin is valuable for:

- state-machine intent;
- numerical defaults and limits;
- labels and interaction sequences;
- profile semantics;
- unusual machine/model behavior;
- user expectations not yet documented elsewhere.

It is not automatically correct for:

- current Decaid endpoint names or payloads;
- browser/WebView lifecycle;
- asynchronous failure and reconnect behavior;
- current chart engine;
- current storage ownership;
- current responsive layout;
- security or escaping.

When legacy behavior conflicts with a current local schema or a deliberate newer test, surface the conflict instead of silently choosing the older implementation.

## Experimental Code

Do not copy an experimental directory wholesale into production.

Before reusing a fragment:

- identify its last known purpose;
- check imports and endpoint names against current source;
- check whether production already has a newer implementation;
- remove hardcoded local paths, credentials, response fixtures, and debug logging;
- adapt it to the router mount/cleanup contract;
- add tests for the behavior rather than preserving the experiment's shape.

Avoid editing large historical files merely to make them look current. Update canonical AI notes and production docs instead.

## Focused Checks

Use the tests for the production subsystem being changed, then compare against a real user flow. For machine behavior, record the legacy expectation, current API evidence, tested model, and any intentional difference.
