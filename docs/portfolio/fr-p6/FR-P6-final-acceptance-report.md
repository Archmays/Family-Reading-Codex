# FR-P6 final acceptance report

## Disposition

```text
FR_PORTFOLIO_P6_STATUS: COMPLETE_WITH_DOCUMENTED_LIMITATIONS
FAMILY_READING_PORTFOLIO_STATUS: SEALED
PROJECT_MODE: MAINTENANCE
LAST_COMPLETED_PHASE: FR-P6
NEXT_RECOMMENDED_PHASE: NONE
RIGHTS_STATUS: PASS_BY_USER_AUTHORIZATION
PRIVACY_STATUS: PASS
SOURCE_PROTECTED_ROOTS_UNCHANGED: VERIFIED
QUALITY_COMPROMISES: 0
```

FR-P6 completed the independent local acceptance needed to prepare the tracked portfolio seal. The tracked state is now `SEALED`, and the repository declares maintenance mode. This is a transaction boundary, not a premature post-commit claim: the one complete release-gate invocation, final commit, exact-SHA GitHub Actions and Pages proof, task-branch deletion, and clean-workspace proof are resolved only in the final handoff.

The tracked self-reference value for final main, Pages, and workspace fields is:

```text
RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
```

## Scope and product boundary

FR-P6 introduced no planned product feature. It reconciled P0–P5 evidence, exercised the current static site, repaired only defects found during acceptance, and prepared the final evidence and maintenance transition.

The accepted product remains a companion beside physical books. It does not include reading progress, check-ins, statistics, rankings, badges, accounts, an ebook-style primary reading body, child-facing OCR full text, analytics, a backend, a database, a service worker, persisted media state, or Work Cells audio.

## Current content and runtime truth

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
```

The Work Cells topic identities include `hemorrhagic-shock`, `cancer-cell`, and `cancer-cell-ii` as three independently validated identities. The current runtime projection passed its staleness and content-parity checks.

## Media and release closure

```text
MEDIA_SOURCES: 778
MEDIA_VARIANTS: 2735
MEDIA_DERIVATIVE_BYTES: 612770984
MEDIA_OWNER_SHARDS: 42_PLUS_INDEX
MISSING_MEDIA: 0
STALE_MEDIA: 0
ORPHAN_MEDIA: 0
CORRUPT_MEDIA: 0
UNEXPECTED_ORIGINAL_RELEASE_IMAGES: 0
DIST_FILES: 2857
DIST_BYTES: 706990045
```

The accepted media policy hash is:

```text
9289331de034dddc25a6dc13428712ab826b201c962a10fb6493843606570f08
```

The inventory, responsive derivatives, owner shards, release plan, build, and dist audit passed against the same current tree. The release-plan byte change from the FR-P5 baseline is limited to the two accepted print-style repairs and their exact regenerated metadata.

## Direct-route and error acceptance

The real browser matrix passed:

```text
ENTRANCE_ROUTES: 3/3
CARMELA_DIRECT_ROUTE_CHECKS: 108/108
WORK_CELLS_DIRECT_ROUTE_CHECKS: 135/135
CARMELA_MEDIA_DISCLOSURE_PARITY: 12/12
INVALID_ROUTE_CASES: 7/7
ONE_SHOT_RETRY_CASES: 2/2
ROUTE_FAILURE_FINDINGS: 0
```

Each Carmela book covered its base detail and eight direct section routes. Each Work Cells topic covered five direct science section routes. Identity, heading structure, breadcrumb state, route focus, announcement, content presence, initial media/audio lifecycle, owner-shard isolation, overflow, and browser errors were checked. Invalid root, series, book, topic, section, and malformed routes rendered a bounded error state without stale content or local-path disclosure. One-shot Carmela and Work Cells owner-shard failures recovered through the visible retry path.

## Responsive geometry and visual interaction

```text
GEOMETRY_SAMPLES: 545/545
CONTINUOUS_WIDTH_SAMPLES: 469/469
NAMED_VIEWPORT_SAMPLES: 14/14
TOPIC_ENDPOINT_SAMPLES: 54/54
ZOOM_EQUIVALENT_SAMPLES: 8/8
HERO_OVERLAP_FINDINGS: 0
HORIZONTAL_OVERFLOW_FINDINGS: 0
CLIPPED_TEXT_FINDINGS: 0
BROKEN_MEDIA_FINDINGS: 0
UNDERSIZED_CONTROL_FINDINGS: 0
ROLE_SAMPLES: 11/11
GROUPED_LIGHTBOX_CHECKS: 3/3
```

The responsive matrix covered widths from 320 through 1,440 CSS pixels, the 1,088/1,089 breakpoint, short-landscape cases, seven deep Work Cells topics, and eight bounded CSS viewport-equivalent zoom samples. Those eight samples are layout evidence and are not represented as native browser zoom.

Carmela cover, hero, page preview, explanation, and lightbox roles passed. Work Cells series thumbnail, Hero, station preview, manga preview, and grouped lightbox roles passed. Manual review of representative Carmela and Work Cells screens found no overlap, clipped text, broken media, horizontal overflow, or unreadable controls.

## Network, cache, audio, and performance

```text
COLD_ROUTE_BUDGETS: 9/9
WARM_CACHE_STATUS: 9/9
SRCSET_CASES: 15/15
ORIGINAL_SELECTIONS: 0
DUPLICATE_CANDIDATE_TRANSFER: 0
GLOBAL_MANIFEST_REQUESTS: 0
UNEXPECTED_SHARD_INDEX_REQUESTS: 0
SERVICE_WORKER_REGISTRATIONS: 0
LOCAL_STORAGE_ENTRIES: 0
SESSION_STORAGE_ENTRIES: 0
INDEXED_DB_DATABASES: 0
AUDIO_METADATA: 12/12
AUDIO_DEEP_INTERACTIONS: 2/2
AUDIO_RANGE_STATUS: 12/12
HTTP_EXACT_FILES: 8/8
HTTP_CONDITIONAL_REQUESTS: 2/2
HTTP_CACHE_POLICIES: 2/2
```

All 15 frozen viewport/DPR responsive-image cases selected derived variants without unexpected upscaling, original selection, duplicate candidate transfer, or overflow. Maximum measured CLS was `0.06064966837565104`.

All 12 Carmela audio files returned valid byte-range responses. Book 1 and Book 11 additionally passed the initial-zero-request, one-shot error and retry, play, pause, continue, seek, end, replay, route cleanup, and fresh-route reset sequence. The current whole-book recordings have no reliable scene-marker evidence; marker behavior is therefore `NOT_APPLICABLE_NO_RELIABLE_MARKERS`, not a fabricated pass.

Local exact-byte checks covered the manifest, owner-shard index, representative owner shards, and representative WebP derivatives. Conditional requests, cache policy classes, suffix range, missing-file response, and release-plan inclusion also passed.

Lighthouse completed without a runtime error:

| Profile | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Mobile | 82 | 100 | 100 | 100 |
| Desktop | 100 | 100 | 100 | 100 |

## Accessibility and print

Keyboard-only navigation, skip-link focus, answer disclosure state, accessible names, route announcements, current-location state, reduced motion, forced colors, text spacing, 200-percent-equivalent reflow, and short-landscape layouts passed in the browser.

The A4 print review produced seven content pages. It found zero focus-outline artifacts, split question labels, clipped text, overlaps, broken glyphs, blank pages, or broken media. Printing caused no additional media request.

These browser checks do not claim an external screen-reader session or physical-device use.

## Source, privacy, and public-repository safeguards

The protected-root signature was identical before and after acceptance:

```text
FILES: 1278
BYTES: 7882956334
SHA256: ec186a6688129e95d34471930cd7bb6cb9d484aa745c6d5ba505b8abb4577cae
```

No protected source file was deleted, moved, renamed, overwritten, compressed, or re-encoded. Public-repository validation found no secret, private-source, local absolute-path, or prohibited product-state exposure.

## Repairs made from acceptance evidence

Three bounded corrections were made:

1. The portfolio seal validator now computes the manifest binding from the raw accepted media-policy JSON, matching the canonical manifest policy hash.
2. Print-only CSS now suppresses residual focus outlines.
3. Work Cells question cards now retain stable print spacing and page-break behavior. The exact release plan was regenerated for the two application-file changes.

Focused regression coverage was added for both corrections. The tracked expected complete-suite count is `211`; the actual `211/211` result belongs to the single current final-gate invocation and final handoff rather than to a pre-invocation claim in this report.

## Evidence

The accepted machine-readable records are:

- `reports/portfolio/fr-p6/fr-p6-content-route-baseline.json`
- `reports/portfolio/fr-p6/fr-p6-media-network-baseline.json`
- `reports/portfolio/fr-p6/fr-p6-live-pages-baseline.json`
- `reports/portfolio/fr-p6/fr-p6-run-manifest.json`
- `reports/portfolio/fr-p6/fr-p6-phase-ledger.json`
- `reports/portfolio/fr-p6/fr-p6-seal-state.json`

The phase reconciliation preserves historical report truth and records corrections only in the current FR-P6 layer.

## Transaction boundary

The local content, browser, network, media, Source, build, dist, evidence, and targeted regression inputs required to enter sealed validation have passed. The tracked state is therefore `SEALED`, enabling final-mode validation inside the one complete release gate.

This report does not claim that its containing commit already exists or that its deployment already ran. The final handoff must resolve:

- final local, tracking, remote, and GitHub main SHA identity;
- the GitHub Actions run and deployment identity;
- the Pages deployed SHA and representative live checks;
- task-branch deletion;
- server and temporary-evidence cleanup;
- one worktree, unchanged or empty stash, and a clean main workspace.
