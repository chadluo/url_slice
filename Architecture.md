# Architecture

<!-- markdownlint-disable-next-line fenced-code-language -->
```text
entrypoints/
  background.ts          # minimal — logs on install
  content.ts             # handles HIGHLIGHT_TEXT and SEEK_VIDEO messages
  popup/
    App.tsx              # root: useCurrentUrl → local model + disabledParams state → all editors
    components/
      Dropdown.tsx        # reusable: trigger + keyboard-navigable list + optional header slot
      HostEditor.tsx      # protocol + subdomain chips (per-segment suggestions) + domain plain text
      PortEditor.tsx      # section header + −/+ stepper + numeric input + history dropdown
      PathEditor.tsx      # section header + /segment chips (dropdown w/ text input, clears trailing on edit)
      SearchParamsEditor.tsx  # key=value rows + enable/disable checkbox; disabled params in localStorage
      FragmentEditor.tsx  # text fragments + media fragments (two tabs)
    hooks/
      useCurrentUrl.ts        # tabs.query → parsed UrlModel
      useHistorySuggestions.ts  # debounced history.search → string[]
    utils/
      urlParser.ts    # parseUrl(raw) → UrlModel  (path segments decoded)
      urlBuilder.ts   # buildUrl(model) → string  (path segments re-encoded)
      fragmentParser.ts  # serialize/parse TextFragment and MediaFragment
```
