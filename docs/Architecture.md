# Architecture

```text
src/
  assets/
    style.css              # global: color-scheme, font-family, .mono, .btn-add, .btn-muted
  components/
    url-slice-app.ts       # root custom element; mode=popup|sidebar; Apply/Reset/Copy
    host-editor.ts         # protocol + subdomain chips (per-segment suggestions) + readonly domain
    port-editor.ts         # section header + −/+ stepper + numeric input + history datalist
    origins-editor.ts      # <select> of other origins in history with the same path; swaps host + port
    path-editor.ts         # section header + /segment inputs (clears trailing on edit)
    search-params-editor.ts  # key=value rows + enable/disable checkbox; stable order within session
    fragment-editor.ts     # text fragments + media fragments (two tabs)
    perf-tracker.ts        # reads perf.ts store, shows render time per editor
  entrypoints/
    popup/
      index.html
      main.ts              # mounts <url-slice-app mode="popup">
    sidepanel/
      index.html
      main.ts              # mounts <url-slice-app mode="sidebar">
    options/
      index.html           # settings page; name is fixed — WXT maps it to manifest options_ui
      main.ts              # perf tracking checkbox; legacy localStorage cleanup
  utils/
    appState.ts            # plain object + EventTarget pub/sub (getState/setState/subscribe) + StoreController
    currentUrl.ts          # tabs.query → parses URL → setState; follows tab events; returns cleanup fn
    pageStateStorage.ts    # disabled params / text fragments per page in storage.session
    historySuggestions.ts  # browser.history.search helpers; createDebouncer (150ms)
    perf.ts                # withPerf — times a render fn; own store + bus, deliberately not appState
    urlParser.ts           # parseUrl(raw) → UrlModel (tldts-icann host split, path segments decoded); hostname(m), pageKey(m)
    urlBuilder.ts          # buildUrl(model) → string (path segments re-encoded)
    fragmentCodec.ts       # serialize/parse TextFragment and MediaFragment
    githubQuery.ts         # parse/serialize GitHub search qualifiers (`is:open label:x`)
```

Tests (`*.test.ts`, vitest) sit next to the modules in `utils/`.
