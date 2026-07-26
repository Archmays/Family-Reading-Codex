# FR-P6 phase evidence reconciliation

## Purpose

This document reconciles the Family Reading portfolio from FR-P0 through FR-P5 without rewriting historical reports. It distinguishes:

1. what each tracked report truthfully knew at commit time;
2. what a later phase corrected or superseded;
3. what remains current at the FR-P6 base main `f55859186f69e98a1cae689f77d7162f1bf565e0`;
4. what is accepted locally and what remains self-referential post-commit evidence.

The machine-readable counterpart is `reports/portfolio/fr-p6/fr-p6-phase-ledger.json`.

## Current repository truth

```text
REPOSITORY: Archmays/Family-Reading-Codex
REPOSITORY_ID: 1271691196
VISIBILITY: public
PAGES: https://archmays.github.io/Family-Reading-Codex/
FR-P6_BASE_MAIN: f55859186f69e98a1cae689f77d7162f1bf565e0
PORTFOLIO_STATUS: SEALED
PROJECT_MODE: MAINTENANCE
LAST_COMPLETED_PHASE: FR-P6
```

The former repository name `Archmays/Family-Reading` is historical evidence only. FR-P4B renamed the existing repository in place; no replacement repository was created.

## Phase reconciliation

### FR-P0 / P0R1

FR-P0 established the audit, privacy, publishing, build and roadmap baseline. Its original rights/privacy coupling was superseded by P0R1, which established `RIGHTS_STATUS: PASS_BY_USER_AUTHORIZATION` while retaining independent Source, privacy and release safeguards.

The P0 report contains historical repository and size values that were correct at that time. They are not current storage or release truth. Its post-commit SHA and Pages fields are intentionally self-reference placeholders rather than missing work.

### FR-P2

FR-P2 remains the live Warm Companion Atlas design foundation: shared shell, semantic navigation, focus, lightbox, responsive modes and print. Later phases extended the two domains without replacing this foundation.

### FR-P3A

FR-P3A remains the canonical Carmela detail information architecture for all 12 books. Its post-commit SHA and Pages evidence were resolved by the historical handoff rather than by rewriting the tracked report.

### FR-P3B

FR-P3B remains the Carmela on-demand media, grouped lightbox and user-triggered audio foundation. FR-P5 changed media paths and responsive selection but preserved the P3B lifecycle and audio behavior.

### FR-P4A

FR-P4A established the deterministic 31-file runtime projection and route-scoped JSON loading. Its report records two Linux exact-SHA findings before the final correction commits. Ordinal ordering, canonical UTF-8/LF source hashing and scoped `.gitattributes` rules resolved those findings. Current runtime truth remains 31 files and 393,121 bytes.

### FR-P4B

FR-P4B established the Work Cells Science Topic Atlas, 27-topic content parity, answer disclosures, on-demand science media and the repository rename. Its historical browser evidence lacked physical-device and external-screen-reader sessions.

Two historical P4B inventory JSON files declared 27 topics but contained 26 rows and omitted `hemorrhagic-shock`. Those files remain historical evidence and are not current machine truth.

### FR-P4B-R1

FR-P4B-R1 repaired the Work Cells Hero media/copy collision. Its 545-sample geometry evidence remains the continuous responsive baseline. The screenshot pixels did not reveal native browser zoom or DPR, so the report correctly used bounded CSS-viewport equivalents.

### FR-P5

FR-P5 is the accepted predecessor media, build and Pages truth at the FR-P6 base:

- 778 logical image sources;
- 2,735 responsive derivatives;
- 42 owner shards plus one index;
- zero missing, stale, orphan or unexpected-original release media;
- exact manifest-driven release allowlist;
- 2,857 dist files and 706,989,895 bytes;
- 201/201 local and CI tests;
- exact deployed main `f55859186f69e98a1cae689f77d7162f1bf565e0`.

FR-P5 corrected the Work Cells inventory to 27/27, including `hemorrhagic-shock`, without altering the historical P4B evidence. Its first CI failure remains recorded. A three-line `.gitattributes` correction stabilized Carmela release hashes; the successful deployment used a new push rather than rerunning the failed job.

FR-P5 limitations remain bounded observations, not hidden failures:

- native browser zoom unavailable;
- physical devices unavailable;
- external screen reader unavailable;
- Lighthouse completed reports before a Windows temporary-directory cleanup EPERM;
- CDN observation came from one Singapore POP;
- Pages mutable responses exposed `max-age=600` and MP3 responses used `audio/mp3`.

### FR-P6

FR-P6 independently reconciled the current tree, routes, media, Source, browser behavior, local HTTP behavior, accessibility and print. Its accepted current truth includes:

- 3/3 entrance routes;
- 108/108 Carmela direct routes;
- 135/135 Work Cells direct routes;
- 7/7 invalid-route cases and 2/2 owner-shard retry cases;
- 15/15 responsive-image selections;
- 545/545 responsive geometry samples with zero overlap or overflow findings;
- 9/9 cold route budgets and 9/9 warm-cache checks;
- 12/12 audio metadata and byte-range checks;
- complete deep audio interaction for Book 1 and Book 11;
- 11/11 media-role samples and 3/3 grouped-lightbox checks;
- passing browser accessibility and seven-page A4 print review;
- mobile Lighthouse 82/100/100/100 and desktop Lighthouse 100/100/100/100;
- 2,857 release files and 706,990,045 bytes.

FR-P6 corrected the seal validator's raw-policy hash binding and two print-only CSS defects. No product scope was added.

## FR-P6 seal transaction boundary

After the targeted, browser, network, media, Source, build, dist and evidence inputs passed, the tracked state changed to `SEALED` and `MAINTENANCE` so the one complete release gate can exercise final-mode validation. This tracked transition does not claim that the containing commit, Actions run, Pages deployment, branch deletion or clean final workspace already exists.

A tracked final report cannot contain the SHA of the commit that contains it, or the deployment triggered after that commit. Therefore the sealed tracked state uses:

```text
RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
```

for the exact final main SHA, Pages result and workspace closeout. The final handoff proves those values from Git, GitHub and live Pages and activates ordinary maintenance work. Until then, only FR-P6 closeout actions are authorized.

FR-P6 retains four exact documented environment limitations:

- `NATIVE_BROWSER_ZOOM_AUTOMATION_UNAVAILABLE`
- `PHYSICAL_IOS_ANDROID_UNAVAILABLE`
- `EXTERNAL_SCREEN_READER_AUTOMATION_UNAVAILABLE`
- `MULTI_POP_CDN_OBSERVATION_UNAVAILABLE`

The bounded browser substitutes are evidence for layout and accessibility behavior, not representations of the unavailable external capabilities.

## Current canonical counts

```text
CARMELA_BOOKS: 12
CARMELA_AUDIO: 12
WORK_CELLS_TOPICS: 27
WORK_CELLS_CATEGORIES: 24
WORK_CELLS_STATIONS: 108
WORK_CELLS_QUESTIONS: 162
WORK_CELLS_PAGE_REFS: 286
RUNTIME_FILES: 31
RUNTIME_BYTES: 393121
MEDIA_SOURCES: 778
MEDIA_VARIANTS: 2735
MEDIA_DERIVATIVE_BYTES: 612770984
DIST_FILES: 2857
DIST_BYTES: 706990045
```

These counts are validated from current runtime and media artifacts by `scripts/validate-portfolio-seal.mjs`; they are not copied from an unverified historical summary.
