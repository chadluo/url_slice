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
- **Query param async render**: `search-params-editor` defers row rendering by one macrotask (`setTimeout(0)`) after
  the page key changes, showing a "Loading N params…" placeholder first. Row rendering decodes each value (JSON/base64
  probing per row), which is slow on URLs with many params (e.g. Google search); deferring it lets the rest of the
  popup (host, port, path editors) paint first instead of blocking on this section.
- **Fragment edits**: text and media fragments are edited as URL parts and applied with the same `browser.tabs.update`
  navigation path as host, path, port, and query changes. The extension does not inject a content script for in-page
  highlighting or media seeking.

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
- **Origin alternatives**: `getHistoryOrigins(path, currentOrigin)` searches history by path text, collects distinct `hostname:port` values (excluding the current origin) that have visited the same path. Used by the origins editor on connect.
- **Subdomain suggestions**: `subdomain-segment` field receives the suffix to the right of the chip (e.g.
  `spec.whatwg.org`) and extracts just the leftmost segment before that suffix — matching path-segment depth logic.

## UX interactions

- **Path segment editing**: editing a segment truncates all following segments (mirrors browser navigation).
- **Path segment close button**: sits to the right of its input (`[input] [×] [/]`), truncating the path up to that
  segment on click.
- **Domain host**: readonly plain text. Origin swapping is handled by the origins editor, not the domain field directly.
- **Origins editor**: a `<select>` that appears beside the host+port editors (second column of a 2-column grid, spanning both rows) only when browser history contains visits to the same path on a different origin. The current origin is the first option (no decoration); alternatives follow. Selecting any option other than the current swaps subdomains + domain + port atomically. Hidden entirely when no alternatives exist.
- **New subdomain chips**: inserted chips start blank so users can type the desired segment directly. Blank host
  chips are omitted from the built URL until populated.
- **Enter to apply**: pressing Enter in text-like fields applies the pending URL change when the app is dirty. Modifier
  Enter combinations and composition events are ignored.

## Performance tracking

- **Render timing**: each editor's `render()` delegates to a private `_renderContent()` wrapped in
  `withPerf(name, fn)` (`utils/perf.ts`), which times the call with `performance.now()` and stores the
  duration keyed by editor name. `perf-tracker.ts` renders the latest timings at the bottom of the app.
  Deliberately simple: no `PerformanceObserver`, history, or aggregation — just the most recent render
  duration per part.
- **On/off setting**: lives on the options page (`entrypoints/options/`), reached from chrome://extensions →
  Details → "Extension options". It is persisted in `localStorage` under `perfTracking` (default on); the
  options page and the popup share the extension origin, so plain `localStorage` needs no `browser.storage`.
  When off, `withPerf` calls the render fn directly without timing and the stored timings are cleared, so
  `perf-tracker` renders nothing. `perf-tracker` listens for the `storage` event because a sidebar left open
  would otherwise keep the old value until reopened.
- **Perf store is separate from `appState`**: `perf.ts` keeps its own module-level record and
  `EventTarget`, and only `perf-tracker` subscribes to it. Timings must not live in `appState`, because
  every editor subscribes to that bus — a write from inside `render()` re-enters all of them and loops
  forever, which hangs the popup before first paint. Covered by `perf.test.ts`.

## UI / visual

- **Font**: `style.css` sets `font-family: system-ui, sans-serif` on `:root` and `font-family: monospace` via the
  `.mono` class. All sizes use the browser default (1rem / 16px); no reduced font sizes anywhere.
- **Dark mode**: `color-scheme: light dark` on `:root`; components use CSS system colors (`GrayText`, `LinkText`,
  `Canvas`, `AccentColor`) which adapt automatically to `prefers-color-scheme`.
- **Options page size**: Chrome sizes the embedded options dialog to its content (capped at roughly 600×600),
  so page CSS is the only lever. `options/index.html` sets `min-width: 400px` plus padding in a local `<style>`
  block, otherwise a page holding one checkbox renders as a cramped box.
- **Add buttons**: `.btn-add` class in `style.css` styles the `+ Add param` and `+ Add text fragment` buttons with
  `color: LinkText` and a lighter `color-mix(in oklch, LinkText, Canvas 30%)` on hover.
