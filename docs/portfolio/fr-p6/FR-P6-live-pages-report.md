# FR-P6 live Pages report

## Tracked handoff boundary

```text
REPOSITORY: Archmays/Family-Reading-Codex
REPOSITORY_ID: 1271691196
PAGES_URL: https://archmays.github.io/Family-Reading-Codex/
DEFAULT_BRANCH: main
LIVE_PAGES_BASELINE_STATUS: PENDING_POST_COMMIT_FINAL_HANDOFF
FINAL_MAIN_SHA: RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
PAGES_STATUS: RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
WORKSPACE_STATUS: RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
```

This tracked report is intentionally pre-commit. It does not claim that the commit containing it is already on `main`, that GitHub Actions has already built it, or that Pages already serves it. Those self-referential facts are proven in the final user handoff.

## Accepted local exact-byte precursor

The same release candidate passed the local HTTP checks that precede live Pages verification:

```text
DIST_FILES: 2857
DIST_BYTES: 706990045
EXACT_FILE_CHECKS: 8/8
CONDITIONAL_REQUESTS: 2/2
CACHE_POLICY_CHECKS: 2/2
AUDIO_RANGE_RESPONSES: 12/12
SUFFIX_RANGE: PASS
MISSING_FILE_404: PASS
RELEASE_PLAN_INCLUSION: PASS
FAILURE_FINDINGS: 0
```

Exact-file samples covered the media manifest, owner-shard index, representative Carmela and Work Cells owner shards, and three representative WebP derivatives. Each sampled body matched the corresponding release file bytes and SHA-256 value. All 12 audio files returned `206`, a valid `Content-Range`, `Accept-Ranges: bytes`, and the expected 1,024-byte prefix.

These are local release-candidate checks. They are not substituted for live CDN evidence.

## Required post-commit proof

The final handoff must provide real values for:

```text
FINAL_MAIN_SHA
ACTIONS_RUN_ID
DEPLOYMENT_ID
PAGES_DEPLOYED_SHA
LOCAL_MAIN = ORIGIN_MAIN = GITHUB_MAIN = PAGES_DEPLOYED_SHA
BRANCH_DELETION
WORKSPACE_CLEAN
```

It must also verify on the canonical Pages URL:

- Home, both series pages, representative Carmela direct sections, and representative Work Cells direct sections;
- responsive `currentSrc` selection and grouped lightbox behavior;
- answer disclosure behavior;
- exact bytes for the manifest, index, representative owner shards, and representative WebP files;
- ETag conditional response and a missing-file `404`;
- all 12 audio byte-range responses;
- zero service-worker registration and zero private persisted state;
- accepted route budgets, cache behavior, and zero unexpected console, request, or overflow findings.

## CDN and platform observation boundary

Final live evidence is bounded to the CDN point of presence observed during the handoff. It must not be generalized to global point-of-presence coverage. Mutable-cache directives and MP3 MIME spelling are controlled by the Pages/CDN platform; they are recorded exactly as observed and are not treated as repository-controlled defects when playback, byte ranges, and cache semantics remain correct.

No additional tracked commit is required merely to copy the final commit SHA back into the commit that created it. The post-commit handoff resolves the sentinel without creating an infinite self-reference chain.
