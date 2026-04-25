# Design decisions

## Data model

- **URL model**: `UrlModel` in `urlParser.ts` holds `subdomains[]`, `domain`, `port`, `pathSegments[]`,
  `searchParams[]`, `textFragments[]`, `mediaFragments[]`.
- **Path encoding**: `parseUrl` decodes each segment with `decodeURIComponent`; `buildUrl` re-encodes with
  `encodeURIComponent`.
- **Text fragments**: parsed from `#:~:text=prefix-,start,end,-suffix` per MDN spec.
- **Media fragments**: `#t=N,M` (time), `#xywh=x,y,w,h` (spatial), `#track=value`.

## Business logic

- **Apply flow**: popup keeps local model state; Apply button calls `browser.tabs.update({ url })` then closes.
- **Query param disabled state**: `SearchParamsEditor` shows a checkbox per pair (default checked). Unchecked pairs are
  excluded from `buildUrl` but stored in `localStorage` keyed by `hostname+path` so they survive popup close/reopen.
  `App.tsx` holds `disabledParams: [string, string][]` alongside `localModel`.
- **Content script**: uses CSS Custom Highlight API with `window.find` fallback for `HIGHLIGHT_TEXT`; sets
  `video.currentTime` for `SEEK_VIDEO`.

## History suggestions

- **History suggestions**: `useHistorySuggestions(prefix, field, currentHost, excludeValue?)` queries
  `browser.history.search` with 150ms debounce. Field values: `'host'`, `'path'`, `'port'`, `'subdomain-segment'`,
  `'path-segment'`.
- **Subdomain suggestions**: `subdomain-segment` field receives the suffix to the right of the chip (e.g.
  `spec.whatwg.org`) and extracts just the leftmost segment before that suffix — matching path-segment depth logic.

## UX interactions

- **Path segment editing**: selecting or editing a segment truncates all following segments (mirrors browser
  navigation). Dropdown panel includes a text input for filtering suggestions or entering an arbitrary value (Enter to
  commit).

## UI / visual

- **Font**: `style.css` sets `--font-mono: monospace` via `@theme` (browser default monospace). Root popup uses
  `font-sans`; URL components (host, port, path, params, fragments preview) apply `font-mono` explicitly.
- **Dark mode**: `color-scheme: light dark` on `:root`; all components carry `dark:` Tailwind variants, responding
  automatically to `prefers-color-scheme`.
