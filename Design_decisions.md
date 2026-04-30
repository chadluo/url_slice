# Design decisions

## Data model

- **URL model**: `UrlModel` in `urlParser.ts` holds `subdomains[]`, `domain`, `port`, `pathSegments[]`,
  `searchParams[]`, `textFragments[]`, `mediaFragments[]`.
- **Path encoding**: `parseUrl` decodes each segment with `decodeURIComponent`; `buildUrl` re-encodes with
  `encodeURIComponent`.
- **Text fragments**: parsed from `#:~:text=prefix-,start,end,-suffix` per MDN spec.
- **Media fragments**: `#t=N,M` (time), `#xywh=x,y,w,h` (spatial), `#track=value`.

## Business logic

- **Apply flow**: `url-slice-app` keeps local model state in `appState`; Apply button calls
  `browser.tabs.update({ url })`.
- **Query param disabled state**: `search-params-editor` shows a checkbox per pair (default checked). The component
  maintains a stable `_rows: [key, value, enabled][]` list that is reset from appState only when the page key
  (hostname+path) changes — enabling/disabling within a session preserves visual order. Disabled pairs are excluded
  from `buildUrl` and persisted to `localStorage` keyed by `hostname+path` so they survive popup close/reopen.
  Both `model.searchParams` (enabled) and `appState.disabledParams` (disabled) are kept in sync via `_commitRows()`.
- **Content script**: uses CSS Custom Highlight API with `window.find` fallback for `HIGHLIGHT_TEXT`; sets
  `video.currentTime` for `SEEK_VIDEO`.

## State management

- **Global state**: `appState.ts` holds a single plain object (`AppState`) with `model`, `committedModel`, `tabId`,
  `error`, `dirty`, `disabledParams`, `disabledTextFragments`. Mutations go through `setState(patch)` which merges
  and fires a synchronous `change` event on an internal `EventTarget`.
- **Component reactivity**: all components call `createRenderRoot() { return this; }` (light DOM, no shadow root) and
  subscribe to the global bus via `subscribe(() => this.requestUpdate())`. Local UI state (suggestions, active tab,
  stable row order) uses Lit `@state()` properties. `tsconfig.json` sets `useDefineForClassFields: false` so that
  TypeScript experimental decorator accessors are not shadowed by class field initializers.

## History suggestions

- **History suggestions**: `getHistorySuggestions(prefix, field, currentHost, excludeValue?)` queries
  `browser.history.search` with 150ms debounce. Field values: `'host'`, `'path'`, `'port'`, `'subdomain-segment'`,
  `'path-segment'`.
- **Subdomain suggestions**: `subdomain-segment` field receives the suffix to the right of the chip (e.g.
  `spec.whatwg.org`) and extracts just the leftmost segment before that suffix — matching path-segment depth logic.

## UX interactions

- **Path segment editing**: editing a segment truncates all following segments (mirrors browser navigation).
- **Path segment close button**: sits to the right of its input (`[input] [×] [/]`), truncating the path up to that
  segment on click.
- **Domain host**: readonly — displayed as plain text. Only subdomains are editable chips. The `+sub` button appears
  to the left of the domain, reading as "insert a subdomain before the domain."

## UI / visual

- **Font**: `style.css` sets `font-family: system-ui, sans-serif` on `:root` and `font-family: monospace` via the
  `.mono` class. All sizes use the browser default (1rem / 16px); no reduced font sizes anywhere.
- **Dark mode**: `color-scheme: light dark` on `:root`; components use CSS system colors (`GrayText`, `LinkText`,
  `Canvas`, `AccentColor`) which adapt automatically to `prefers-color-scheme`.
- **Add buttons**: `.btn-add` class in `style.css` styles the `+ Add param` and `+ Add text fragment` buttons with
  `color: LinkText` and a lighter `color-mix(in oklch, LinkText, Canvas 30%)` on hover.
