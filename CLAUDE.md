# url_slice extension

A browser extension that decomposes the current page URL into editable, history-aware segments.

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

Feedback will be provided as a batch of todo items in a Markdown doc, refer to @prompts/FEEDBACK-template.md for the
structure.

For each batch, before implementing:

- analyze if any items can be done together
- update relevant docs linked in CLAUDE.md (but not CLAUDE.md itself unless necessary) to reflect latest project status

For each change, create a standalone commit and also ticking off the feedback item in the commit.
