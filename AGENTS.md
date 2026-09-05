# Family-Reading-Codex project instructions

## Product identity

This project is a family paper-book **Book Companion Panel**: book overview, story review, question cards, background/encyclopedia notes, and audio/companion material near the physical book.

Do not turn it into an ebook reader, reading-progress/check-in/statistics product, leaderboard, user system, or general admin system. The home page is a book-materials entrance, not a progress dashboard.

## Hard product boundaries

Do not add:

- reading progress/check-in/streak/duration tracking;
- charts, ranks, badges, user accounts, or gamified pressure;
- ebook-style full-text reading as the primary experience;
- OCR full text as the child-facing main reading body.

Do not introduce fields that track a child's reading progress, current chapter, completion, streak, reading duration, check-ins, or reading history, regardless of their names. Technical metadata such as audio duration or local generation-task progress/completion is allowed when it does not track a child's reading activity or add accounts, analytics, or a backend.

## Source assets

`source/` contains raw source material.

- Do not delete, move, rename, compress, overwrite, or re-encode original source PDF/MP3 files.
- Do not copy original source PDFs into public publishing directories.
- Write approved derived assets outside `source/`.
- Preserve the project’s current authoring/runtime/release-manifest boundary rather than hand-editing generated projections.

## Static deployment contract

Every runtime change must remain compatible with static GitHub Pages deployment:

- no server/database/login/private runtime service;
- project-subpath-safe asset paths;
- no dependency on local author-only source files at runtime.

For a runtime implementation change, run the affected tests/checks plus the project build or current release validator as required by the touched area. For documentation/source-metadata-only changes, inspect the changed content unless a project-specific validator applies.

Do not manually mutate generated `dist`/runtime artifacts when the repository already provides a generator/validator route.

## Engineering behavior

- Keep changes surgical and tied to the user’s request.
- Prefer the simplest implementation that satisfies the current product boundary.
- Do not add speculative features or abstractions.
- Use the current README/release-plan/maintenance docs as the source of truth for active build/release commands.
- If a source boundary is genuinely ambiguous, stop before destructive/bulk processing; otherwise make reasonable local decisions and continue.
- Do first-line UI/browser QA yourself before asking for human review.
