# Optimistic Loading for Popup/Sidebar

**Date:** 2026-04-28

## Problem

For complex URLs or large histories, the popup/sidebar opens and shows only `Loading…` until `useCurrentUrl` resolves. This delays the visual layout and feels slow.

## Goal

Render the full editor UI immediately on open, dimmed and non-interactive, then populate with real data when ready.

## Design

### `urlParser.ts`

Export a new constant:

```ts
export const EMPTY_URL_MODEL: UrlModel = {
  protocol: 'https:',
  subdomains: [],
  domain: '',
  port: '',
  pathSegments: [],
  searchParams: [],
  textFragments: [],
  mediaFragments: [],
}
```

### `App.tsx`

1. **Initial state:** `useState<UrlModel>(EMPTY_URL_MODEL)` — no more nullable `localModel`.
2. **Loading flag:** `const [loading, setLoading] = useState(true)` — set to `false` when the real model is applied in `useEffect`.
3. **Container:** Apply `pointer-events-none opacity-50` to the wrapper div while `loading` is true. Remove the `localModel === null` early-return and the `Loading…` paragraph.
4. **Guards:** Replace `localModel === null` checks in `handleApply`/`handleCopy` with `loading` checks.

No editor components change.

## Out of scope

- Per-section skeleton shapes
- Progressive section loading
