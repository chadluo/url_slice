# URLs Browser Extension

A WXT + React 19 + TypeScript browser extension popup that decomposes the current page URL into editable, history-aware segments.

## Stack

- **WXT** v0.20.25 — browser extension framework (Vite-based, Chrome + Firefox)
- **React** 19 + TypeScript strict
- **Tailwind CSS** v4 via `@tailwindcss/vite`
- **pnpm** for package management

## Commands

```bash
pnpm dev          # dev server (Chrome)
pnpm dev:firefox  # dev server (Firefox)
pnpm build        # production build
pnpm compile      # TypeScript check only
```

## Architecture

```text
entrypoints/
  background.ts          # minimal — logs on install
  content.ts             # handles HIGHLIGHT_TEXT and SEEK_VIDEO messages
  popup/
    App.tsx              # root: useCurrentUrl → local model state → all editors
    components/
      Dropdown.tsx        # reusable: trigger + keyboard-navigable list + optional header slot
      HostEditor.tsx      # protocol + subdomain chips (per-segment suggestions) + domain plain text
      PortEditor.tsx      # section header + −/+ stepper + numeric input + history dropdown
      PathEditor.tsx      # section header + /segment chips (dropdown w/ text input, clears trailing on edit)
      SearchParamsEditor.tsx  # key=value rows, add/remove, history suggestions
      FragmentEditor.tsx  # text fragments + media fragments (two tabs)
    hooks/
      useCurrentUrl.ts        # tabs.query → parsed UrlModel
      useHistorySuggestions.ts  # debounced history.search → string[]
    utils/
      urlParser.ts    # parseUrl(raw) → UrlModel  (path segments decoded)
      urlBuilder.ts   # buildUrl(model) → string  (path segments re-encoded)
      fragmentParser.ts  # serialize/parse TextFragment and MediaFragment
```

## Key design decisions

- **History suggestions**: `useHistorySuggestions(prefix, field, currentHost, excludeValue?)` queries `browser.history.search` with 150ms debounce. Field values: `'host'`, `'path'`, `'port'`, `'subdomain-segment'`, `'path-segment'`.
- **Subdomain suggestions**: `subdomain-segment` field receives the suffix to the right of the chip (e.g. `spec.whatwg.org`) and extracts just the leftmost segment before that suffix — matching path-segment depth logic.
- **Path segment editing**: selecting or editing a segment truncates all following segments (mirrors browser navigation). Dropdown panel includes a text input for filtering suggestions or entering an arbitrary value (Enter to commit).
- **Path encoding**: `parseUrl` decodes each segment with `decodeURIComponent`; `buildUrl` re-encodes with `encodeURIComponent`.
- **URL model**: `UrlModel` in `urlParser.ts` holds `subdomains[]`, `domain`, `port`, `pathSegments[]`, `searchParams[]`, `textFragments[]`, `mediaFragments[]`.
- **Text fragments**: parsed from `#:~:text=prefix-,start,end,-suffix` per MDN spec.
- **Media fragments**: `#t=N,M` (time), `#xywh=x,y,w,h` (spatial), `#track=value`.
- **Content script**: uses CSS Custom Highlight API with `window.find` fallback for `HIGHLIGHT_TEXT`; sets `video.currentTime` for `SEEK_VIDEO`.
- **Apply flow**: popup keeps local model state; Apply button calls `browser.tabs.update({ url })` then closes.
- **Font**: root popup uses CSS `monospace` generic family (`font-[monospace]` in Tailwind).

## Permissions

`tabs` — read current URL, navigate
`history` — query visit history for suggestions
