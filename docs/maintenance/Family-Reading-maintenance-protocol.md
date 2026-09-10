# Family Reading maintenance protocol

## Status boundary

FR-P6 has prepared the tracked portfolio state as:

```text
PORTFOLIO_STATUS: SEALED
PROJECT_MODE: MAINTENANCE
```

FR-P6 transition and post-commit sentinels remain historical evidence. Current maintenance is recorded under `operations/maintenance/`, including `fr-maint-media-slim-01/release-report.json`; ordinary authorized work follows the task lanes in the root AGENTS. A tracked `SEALED` declaration is not proof of its containing commit or any deployment.

Local repair, Git delivery and public deployment are separate scopes. Use affected checks for a bounded repair. Run release gates and exact-SHA Pages verification when a release is authorized; a push that triggers Pages counts as deployment and must fall within that authorization. Do not silently turn a local repair into a public release.

## Canonical truth

After sealing:

- `main` is the only current truth;
- the canonical repository is `Archmays/Family-Reading-Codex`;
- the canonical site is `https://archmays.github.io/Family-Reading-Codex/`;
- P0–P6 reports remain historical evidence and are not reopened or rewritten;
- corrections are added as new records rather than inserted into old acceptance blocks.

## Maintenance task types

### Bug repair

Use an identifier such as:

```text
FR-MAINT-R1
FR-MAINT-R2
```

A bug repair must:

1. identify the exact regression and affected routes;
2. identify the current affected baseline, retaining historical seal evidence;
3. run targeted tests during development;
4. preserve Source, runtime, content and media parity unless the repair explicitly changes them;
5. run the affected browser/build checks required by the changed risk; documentation-only corrections use content inspection;
6. for an authorized maintenance release, run the final release gate and verify the deployed exact SHA;
7. review the final diff and commit/push when the remote/deployment policy permits. Preserve unrelated changes and branches; list task-created scratch for manual deletion under the current global instructions.

### New book, topic or series

New content is not a maintenance repair. Create a new extension phase with its own:

- content inventory;
- source and runtime projection;
- media roles and derivatives;
- route and print design;
- browser, network and Pages acceptance.

Do not append new content to the sealed P0–P6 ledger as though it existed at seal time.

### Existing content correction

A factual or wording correction must:

- preserve the original historical report;
- create a correction record;
- regenerate runtime if authoring data changed;
- regenerate media only when a referenced media source or role changed;
- verify content, route and print parity;
- update the current ledger without rewriting historical evidence.

### Media change

Any product image change requires the complete relevant closure:

```text
inventory
quality-policy applicability
responsive generation
manifest
owner shards
release plan
renderer currentSrc
visual review
route network
build/dist
Pages exact SHA (authorized release only)
```

Do not hand-edit derived files or the media manifest.

### Audio change

Any Carmela audio change requires:

- source identity and public copy validation;
- duration and metadata check;
- user-triggered loading;
- initial request zero;
- HTTP Range 206;
- play, pause, seek and route cleanup;
- release-plan verification; Pages verification for an authorized release.

Work Cells audio remains outside the product unless a future explicit extension phase changes that boundary.

### Runtime or schema change

Select the affected invariants below for a bounded runtime repair; a shared runtime or schema change requires the complete relevant consumer closure:

- authoring-to-runtime parity;
- deterministic generation;
- Windows/Linux byte stability;
- route request isolation;
- cache/race/error behavior;
- media owner-shard alignment;
- build verification; Pages verification for an authorized release.

## Permanent boundaries

### Source

Protected Source is permanently read-only. Do not delete, move, rename, compress, overwrite or re-encode protected roots as part of maintenance.

### Rights

User-provided or user-designated resources retain:

`RIGHTS_STATUS: PASS_BY_USER_AUTHORIZATION`

Do not restart copyright or licensing review unless the user explicitly requests it. Privacy, Source immutability and release engineering remain independent safeguards.

### Product

Do not add through a maintenance repair:

- progress, last-read or completion state;
- streak, check-in, score, ranking or badges;
- accounts, login or administration;
- an ebook-style primary reading body;
- child-facing OCR full text;
- analytics or a runtime backend;
- persisted audio or media state.

Such changes require a separately approved product phase.

## Evidence hygiene

Retain:

- final reports;
- compact machine baselines;
- accepted screenshot evidence;
- source/runtime/media hashes;
- release and Pages identities.

Do not retain:

- raw HAR;
- browser profiles;
- cookies;
- traces;
- duplicate screenshots;
- temporary contact sheets;
- generated candidates;
- task scratch.

## Branch and Git policy

- stay on the current branch, normally `main`; use a task branch only when the selected route requires one;
- do not create a PR unless explicitly requested;
- do not force-push;
- do not rewrite sealed history;
- normally commit and push once after the required checks pass, within the current remote/deployment authorization;
- branch deletion requires explicit authorization; never delete unknown or long-lived branches;
- preserve unrelated worktree changes and stash; do not force a clean workspace through unrelated cleanup.

## Final acceptance for every maintenance release

Every published maintenance change must prove:

```text
LOCAL_MAIN = ORIGIN_MAIN = GITHUB_MAIN = PAGES_DEPLOYED_SHA
WORKSPACE_STATUS = CLEAN
QUALITY_COMPROMISES = 0
```

Unavailable physical devices or external assistive technologies must be documented honestly and must not be reported as passed by emulation alone.
