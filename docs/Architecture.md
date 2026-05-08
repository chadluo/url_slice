# Architecture

```text
src/
  style.css                # global: color-scheme, font-family, .mono, .btn-add
  components/
    url-slice-app.ts       # root custom element; mode=popup|sidebar; Apply/Reset/Copy
    host-editor.ts         # protocol + subdomain chips (per-segment suggestions) + readonly domain
    port-editor.ts         # section header + −/+ stepper + numeric input + history datalist
    path-editor.ts         # section header + /segment inputs (clears trailing on edit)
    search-params-editor.ts  # key=value rows + enable/disable checkbox; stable order within session
    fragment-editor.ts     # text fragments + media fragments (two tabs)
  entrypoints/
    background.ts          # minimal — logs on install
    content.ts             # handles HIGHLIGHT_TEXT and SEEK_VIDEO messages
    popup/
      index.html
      main.ts              # mounts <url-slice-app mode="popup">
    sidepanel/
      index.html
      main.ts              # mounts <url-slice-app mode="sidebar">
  lib/
    currentUrl.ts          # tabs.query → parses URL → setState; returns cleanup fn
    historySuggestions.ts  # browser.history.search helpers with 150ms debounce
  state/
    appState.ts            # plain object + EventTarget pub/sub (getState/setState/subscribe)
  utils/
    urlParser.ts           # parseUrl(raw) → UrlModel  (path segments decoded)
    urlBuilder.ts          # buildUrl(model) → string  (path segments re-encoded)
    fragmentParser.ts      # serialize/parse TextFragment and MediaFragment
```
