# Family Reading portfolio status

Current maintenance is [FR-MAINT-MEDIA-SLIM-01](../maintenance/FR-MAINT-MEDIA-SLIM-01.md). Its [release report](../../operations/maintenance/fr-maint-media-slim-01/release-report.json) records 778 media variants, 900 release files and 166,689,221 bytes with technical `PASS` and `deployed: false`. Deployment requires separate exact-SHA evidence. The FR-P6 status block, sentinels and acceptance counts below are preserved historical seal evidence; they do not block authorized ordinary maintenance.

## Current status

```text
PORTFOLIO_STATUS: SEALED
PROJECT_MODE: MAINTENANCE
LAST_COMPLETED_PHASE: FR-P6
FR_P6_BASE_MAIN: f55859186f69e98a1cae689f77d7162f1bf565e0
FINAL_MAIN_SHA: RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
PAGES_STATUS: RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
WORKSPACE_STATUS: RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
NEXT_RECOMMENDED_PHASE: NONE
```

The tracked portfolio has entered its sealed validation transaction. Local content, browser, network, media, Source, accessibility, print, build, dist and evidence inputs passed before this state change. The single complete release gate, final commit, exact-SHA Actions and Pages proof, task-branch deletion and clean-workspace proof are resolved by the post-commit final handoff; this tracked file does not claim those future facts.

## Product identity

Family Reading is a static companion beside physical books. It provides:

- 12 `不一样的卡梅拉` companion books with user-triggered audio;
- 27 `工作细胞` science topics;
- story review, questions, background, encyclopedia, science stations and parent guidance;
- on-demand responsive media and grouped lightboxes;
- A4 companion printing.

It is not:

- an ebook reader;
- a reading-progress or check-in product;
- a score, ranking or badge product;
- an account, login or administration system;
- a child-facing OCR full-text reader.

## Canonical locations

```text
REPOSITORY: Archmays/Family-Reading-Codex
REPOSITORY_ID: 1271691196
PAGES: https://archmays.github.io/Family-Reading-Codex/
DEFAULT_BRANCH: main
VISIBILITY: public
```

The former repository name `Archmays/Family-Reading` is historical only.

## FR-P6 historical technical baseline

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
FR_P5_DIST_FILES: 2857
FR_P5_DIST_BYTES: 706989895
FR_P6_DIST_FILES: 2857
FR_P6_DIST_BYTES: 706990045
```

The machine validator derives current content and media counts from runtime and media artifacts. Use the maintenance report linked above for the later media closure; do not reuse these FR-P5/FR-P6 counts as current inventory.

## FR-P6 acceptance summary

```text
ENTRANCE_ROUTES: 3/3
CARMELA_DIRECT_ROUTES: 108/108
WORK_CELLS_DIRECT_ROUTES: 135/135
INVALID_ROUTES: 7/7
RETRY_CASES: 2/2
SRCSET_CASES: 15/15
GEOMETRY_SAMPLES: 545/545
COLD_ROUTE_BUDGETS: 9/9
WARM_CACHE_CHECKS: 9/9
AUDIO_RANGE_RESPONSES: 12/12
MEDIA_ROLE_SAMPLES: 11/11
GROUPED_LIGHTBOX_CHECKS: 3/3
MOBILE_LIGHTHOUSE: 82/100/100/100
DESKTOP_LIGHTHOUSE: 100/100/100/100
QUALITY_COMPROMISES: 0
```

Accessibility and seven-page A4 print review passed. Protected Source remained at 1,278 files, 7,882,956,334 bytes and SHA-256 `ec186a6688129e95d34471930cd7bb6cb9d484aa745c6d5ba505b8abb4577cae`.

## Documented environment limitations

- `NATIVE_BROWSER_ZOOM_AUTOMATION_UNAVAILABLE`
- `PHYSICAL_IOS_ANDROID_UNAVAILABLE`
- `EXTERNAL_SCREEN_READER_AUTOMATION_UNAVAILABLE`
- `MULTI_POP_CDN_OBSERVATION_UNAVAILABLE`

Responsive emulation, keyboard and accessibility inspection, and the planned post-commit one-point-of-presence live checks are not represented as the unavailable native, physical, external-assistive-technology, or global-CDN capabilities.

## Post-commit resolution

The exact final main SHA and Pages deployment cannot be self-recorded by the commit that creates them. The final handoff must prove local/tracking/remote/GitHub main equality, the Actions and deployment identities, the Pages deployed SHA, branch deletion, temporary-evidence cleanup, one worktree and a clean main workspace.

Until those sentinel fields are resolved, only FR-P6 closeout actions are permitted. Ordinary maintenance work begins after that handoff; no new phase is recommended.
