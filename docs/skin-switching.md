# Switching skins from inside the webview

Decaid serves the active skin folder on a **fresh ephemeral port every time**
(`webui_service.dart` `_serveFresh` binds port 0 and never reuses a port it
has already used). Switching the active skin therefore means restarting that
server, and the page asking for the switch is left on an origin that no
longer exists.

## Why the dashboard exit cannot end a skin switch

`window.decentApp.exitToDashboard()` navigates to
`http://localhost:<port>/__decent/exit-dashboard`, where `<port>` is baked in
by `buildSkinApiJavaScript()` when the page was served. Decaid's webview
gates that navigation twice (`skin_view.dart`):

1. `classifySkinNavigation()` accepts the URL only if it is string-equal to
   `skinExitDashboardUrlForPort(<port Decaid is serving right now>)`, and
2. `SkinExitCoordinator.tryStart()` additionally requires the page's own
   top-level URL to be on that same port.

The restart moves that port while the page stays where it was, so after a
switch every exit URL available to us loses one check or the other:

| exit URL | outcome |
| --- | --- |
| the port skin-api.js baked in (dead) | fails check 1 — `Blocking navigation to: http://localhost:<old>/__decent/exit-dashboard` |
| the port `/webui/server/status` just reported | passes check 1, fails check 2 — `Rejected skin dashboard request` |
| port 3000 | fails check 1 — the served port is never 3000 |

A field log of six consecutive switch attempts shows exactly this: 46
`Blocking navigation` lines and 4 `Rejected skin dashboard request` lines,
with the only successful `Skin requested dashboard` in the whole log being an
exit that had no server restart before it.

## What works instead

**Port 3000.** Decaid keeps it bound as a permanent 307 redirector to
whatever port currently serves the skin (`_serveEntryPoint`), and
`classifySkinNavigation()` allows port 3000 outright as well as the live
serving port the redirect lands on. So after the restart,

```js
window.location.assign(`http://${hostname}:3000/?_=${Date.now()}`)
```

puts the new skin on screen with no dashboard round trip.

Two things to keep true of any change here:

- **Wait for the restart before navigating.** `waitForSkinServer()` polls
  `GET /api/v1/webui/server/status` until it reports `serving`.
- **Then wait a beat longer.** The webview compares against the port its own
  view currently holds; a navigation sent before it picks the new port up is
  classified as an external link and opens in the system browser instead of
  the webview. The settle delay, and the single retry after it, exist for
  that window.

The plain "Go" exit button elsewhere in Settings is unaffected — it exits a
skin whose server has not been restarted, which is the case the host gate was
written for.
