# URLs Browser Extension

A WXT + React 19 + TypeScript browser extension popup that decomposes the current page URL into editable, history-aware segments.

## Permissions

- `tabs` — read current URL, navigate
- `history` — query visit history for suggestions
- `contextMenus` — add selected text to text fragment highlights

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

@Architecture.md

## Key design decisions

@Design_decisions.md

## Feedback flow

Feedback will be provided as todo items in a Markdown doc, refer to @prompts/FEEDBACK-template.md for the structure. For
each batch, in addition to the existing workflow, also analyze if any items can be done together. For each change,
create a standalone commit and also commit ticking off the feedback item.
