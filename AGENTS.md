# AGENTS.md — YT Playlist Filter

Read the collection rules first: [`../AGENTS.md`](../AGENTS.md). Documentation lives once in
`c:\ws\docs\okf\` — do not create an `okf/` copy here.

## What this repo is

One userscript, one job: hide playlist rows that do not match a typed query, on `/playlist`
and in the watch-page playlist panel.

## Non-negotiables

1. **Exactly one context-menu entry**, `Settings…`, calling `Ytk.openSettings`.
2. **Never `innerHTML`.** The input and buttons are built with `Ytk.h`; the only CSS this
   script injects is the one hiding rule.
3. **The shared toolbar and shared panel are the only chrome.** No custom floating bar.
   The filter input lives inside `Ytk.panel` — that is core chrome, not a second surface.
4. **Hiding only.** `data-ytpf-hidden="1"` plus one rule
   (`[data-ytpf-hidden="1"]{display:none!important}`). Never touch YouTube state, never
   remove rows from the DOM.
5. **Core is required, pinned:** `@require …/yt-core-lib-1.3.0.js`. 1.3.0 reuses the
   `.ytk2-bar` already in the DOM; 1.2.0 drew one bar per script sandbox.

## Why the code looks the way it does

- **One attribute, one rule.** Hiding via elements' inline `style.display` is undone whenever
  YouTube re-renders the row. A data attribute plus a stylesheet survives re-render and is
  trivially reversible.
- **The observer is deliberately narrow.** Rows page in on scroll, so a stale filter silently
  stops working. The observer watches only the playlist root, is debounced, does nothing when
  the query is empty, and disconnects when the panel is gone. Do not widen it to
  `document.body`.
- **Both row shapes.** Current rows are `yt-lockup-view-model` (data in
  `node.data.lockupViewModel`); older sessions still render `ytd-playlist-video-renderer` and
  the sidebar's `ytd-playlist-panel-video-renderer`. All three are read.
- **Duration is in a bare badge anchor** on lockup rows, so the row reader scans anchor text
  for `/^\d{1,2}:\d{2}(:\d{2})?$/` before falling back to the legacy `#time-status #text`.
- **Typing must not reach YouTube.** The input's `keydown` stops propagation, so `k`, `j`,
  digits and `/` type instead of triggering player shortcuts.
- **The AI grants stay.** The shared settings popup renders its AI section, which needs
  `GM_xmlhttpRequest`; dropping that grant (or `@connect *`) makes the connection test fail.
- **Settings survive because of `onSave`.** Core 1.3.0's `openSettings` rebuilds
  `ytk.settings` from its own defaults and drops keys it does not know
  (`filterScope`, `filterUseRegex`, `filterReapply`). The `onSave` merge restores them.
- **Closing the panel clears the filter.** The ✕ is hooked with an extra listener so rows can
  never stay hidden behind a query the user can no longer see.

## Verification before claiming a change works

```bash
node --check yt-playlist-filter.user.js
grep -c "GM_registerMenuCommand(" yt-playlist-filter.user.js   # must be 1
grep -c "innerHTML" yt-playlist-filter.user.js                 # must be 0
```

Then test live on `/playlist` and on a watch page with a playlist sidebar: type, scroll to
force re-render, press Escape. Say whether you ran that or only the static checks.
