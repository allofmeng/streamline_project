# AI API And WebSocket Notes

Read this when changing Decaid communication, machine or scale control, device discovery, settings transport, firmware upload, display commands, caches, or connection recovery.

## Authorities

Use these together:

- `src/modules/api.js`: client behavior, URL construction, caches, queues, and socket ownership.
- `rest_v1.yml`: local REST contract.
- `websocket_v1.yml`: local WebSocket contract.
- The calling module: product-level assumptions and UI state transitions.
- `docs/API.md`: prose reference; verify it against the schema and source when exact behavior matters.

Use **Decaid** in prose. Do not rename compatibility identifiers such as `reaHostname`, `REA_PORT`, REA-prefixed functions, or stored keys merely to modernize terminology.

## URL And Transport Ownership

`api.js` derives the Decaid host from the legacy `reaHostname` localStorage key or the page hostname, uses port `8080`, and selects `ws:` or `wss:` from the page protocol.

- Reuse exported URL and request helpers.
- Do not build a competing base URL in a settings, profile, or UI module.
- Keep all response-status checks, payload conversions, abort behavior, and logging at the boundary.
- Preserve request coalescing and cache invalidation where a settings family already has a cache.
- Do not turn an intentionally bounded request into an unbounded UI wait.

Device scanning is a useful example: the client may stop waiting and fall back to the current device list while the server-side scan continues. A client abort is not proof that the Decaid operation stopped.

## WebSocket Contracts

Use the existing reconnecting wrapper and socket-slot helpers. Socket replacement is close-before-open so a resync cannot leak a previous connection or deliver each frame twice.

Contract details are channel-specific:

- The machine snapshot socket may be opened before a machine exists. It can remain open and silent, then bind or rebind when a machine appears.
- The scale snapshot socket stays open across scale connect/disconnect cycles and emits explicit connection-status frames in addition to snapshots.
- Typed telemetry channels should not be treated as generic error/status channels unless their schema says so.
- Device, display, update, and raw-command sockets have different bidirectional and queueing behavior; inspect their schema and existing handler before modifying them.
- A reconnect, machine swap, or page navigation must not create a second owner for the same stream.

Keep UI work out of socket construction. Parse and normalize at the boundary, then call the owning app or UI handler.

## Machine And Settings Safety

Machine-control writes can have physical effects.

- Preserve existing validation, unit conversion, model gating, and state gating.
- Do not send a command based only on an optimistic visual state.
- Keep Bengle-only or refill-kit-only operations behind the established capability checks.
- Do not log credentials, auth headers, firmware payloads, profile notes, or feedback content.
- Do not add background MMR-backed reads while a firmware flash is in flight. The existing firmware gate avoids competing with the long BLE upload.
- Respect cancellation and progress state for firmware updates; do not infer completion from a closed UI alone.

Shot settings require special care. The client sends a complete cached settings object for some writes. The cache is initialized with zeros, so the existing “first shot-settings frame seen” guard prevents an early partial interaction from overwriting real machine settings with defaults. Do not bypass that guard.

Display writes also use established queue/latest-command behavior. Do not add an independent writer that races brightness, screensaver, wake, or display-state updates.

## Profiles And Workflow

Profile selection and edits must use the existing profile/workflow API wrappers. Do not replace them with ad hoc store writes or direct endpoint calls from page code.

Inspect both `src/modules/profileManager.js` and the target API wrapper before changing:

- profile upload/update/delete/visibility;
- active workflow selection;
- metadata;
- parent relationships;
- legacy KV migration;
- favorites that must follow a changed profile ID.

## Plugin Integrations

Plugin settings are transport, so they belong behind `api.js` like any other Decaid call. A skin switch and a plugin flag are not always one-to-one.

`src/modules/visualizer.js` presents two switches, `visualizerEnabled` (the integration) and `visualizerAutoUpload` (automatic upload), over the plugin's single `AutoUpload` flag, which receives the AND of the two. Manual per-shot upload goes through `uploadShotToVisualizer(shotId)` and is deliberately independent of the automatic flag. Read the current switch mapping before adding a third control or changing what the plugin is sent.

## Error Handling

- Check `response.ok` before parsing a success body.
- Preserve server error information when it is safe to show.
- Distinguish abort, timeout, disconnect, validation, and server errors.
- A socket closing, a machine disconnecting, and a page unmounting are different events.
- Keep retries bounded and cancel them when the owning state changes.
- Avoid catch blocks that silently convert a safety-critical failure into success.

## Contract Change Checklist

When an endpoint or channel changes:

1. Update the local schema.
2. Update or add the `api.js` wrapper.
3. Update all call sites and state assumptions.
4. Add a pure parser/policy/queue test where possible.
5. Test disconnected, reconnecting, slow, malformed, and unsupported-model paths.
6. Update `docs/API.md` and the relevant user documentation if behavior is public.
7. Update this note only for a new reusable constraint.

## Focused Checks

```sh
npm test
node --test test/device-command.test.mjs
node --test test/display-command-queue.test.mjs
node --test test/firmware-cancel.test.mjs
```

For schema or machine-control changes, also run a browser smoke test against Decaid and record which machine/model, scale, transport, and failure paths were exercised.
