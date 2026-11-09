# YT Playlist Filter

A live filter for a playlist: type, and every row whose title or channel does not match is
hidden. Press **Escape** to clear.

Works on both playlist surfaces, which is the part naive filters miss:

- `youtube.com/playlist?list=…`
- the playlist panel beside a video (`ytd-playlist-panel-renderer`)

## Use it

1. Click **Filter** on the shared toolbar.
2. Type. Rows hide as you type; the panel shows `shown / total`.
3. **Escape** clears the filter. There is also a *Clear filter* button.

Rows are only hidden (`display:none` via a data attribute). Nothing is deleted, moved or
written to YouTube.

Rows re-render as YouTube pages the playlist in, so the filter re-applies to newly rendered
rows after a short debounce. It does this with one `MutationObserver` that lives only while
the panel is open and only on playlist surfaces.

## Settings

One entry — **Settings…** — opens the shared settings popup.

| Field | Default | Purpose |
|---|---|---|
| Match against | both | `both` = title + channel, `title`, `channel` |
| Treat the query as a regular expression | off | invalid patterns fall back to plain text with a toast |
| Re-apply as more rows load | on | off stops the filter following newly rendered rows |

## Limits

- Loaded rows only. A filter cannot hide a row YouTube has not rendered yet.
- Closing the panel with its ✕ clears the filter, as does any in-app navigation. If another
  script replaces the shared panel, rows can stay hidden — reopen Filter and press Escape.

## Install

Follow the [install guide](https://github.com/chirag127/userscript-install-guide). The script
`@require`s [yt-core-lib](https://github.com/chirag127/yt-core-lib), which is never installed
on its own.

## Docs

Collection documentation is single-sourced in the workspace bundle: `c:\ws\docs\okf\`.
