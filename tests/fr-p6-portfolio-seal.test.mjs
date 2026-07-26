import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  validateContentRouteBaselineData,
  validateLivePagesBaselineData,
  validateMediaNetworkBaselineData,
  validatePhaseLedgerData,
  validatePortfolioSeal,
  validateRunManifestData,
  validateSealStateData,
} from '../scripts/validate-portfolio-seal.mjs';

const sentinel = 'RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF';
const finalArtifacts = [
  'docs/portfolio/fr-p6/FR-P6-final-acceptance-report.md',
  'docs/portfolio/fr-p6/FR-P6-live-pages-report.md',
  'docs/portfolio/fr-p6/FR-P6-known-limitations.md',
  'reports/portfolio/fr-p6/fr-p6-content-route-baseline.json',
  'reports/portfolio/fr-p6/fr-p6-media-network-baseline.json',
  'reports/portfolio/fr-p6/fr-p6-live-pages-baseline.json',
  'reports/portfolio/fr-p6/fr-p6-run-manifest.json',
];
const environmentProbes = [
  'native browser zoom',
  'physical iOS and Android devices',
  'external screen reader',
  'multi-POP CDN observation',
  'Lighthouse Windows temporary-directory cleanup',
  'platform-controlled mutable cache and MP3 MIME headers',
];
const historicalPhases = [
  ['FR-P0/P0R1', 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS', 'RESOLVED_IN_HISTORICAL_HANDOFF', 'docs/portfolio/fr-p0/FR-P0-final-report.md', 'Archmays/Family-Reading', 63, 'VALID_HISTORICAL_BASELINE_SUPERSEDED_BY_LATER_PHASES'],
  ['FR-P2', 'COMPLETE', '7397effccb417e7fa990490713b0f244fbb5c512', 'docs/portfolio/fr-p2/FR-P2-final-report.md', 'Archmays/Family-Reading', null, 'VALID_FOUNDATION_CURRENTLY_IN_USE'],
  ['FR-P3A', 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS', '45347b2c8b3767da90a51cc8759d51c4878b1bca', 'docs/portfolio/fr-p3a/FR-P3A-final-report.md', 'Archmays/Family-Reading', 83, 'VALID_CARMELA_DETAIL_ARCHITECTURE'],
  ['FR-P3B', 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS', '58be1b52710ee4631c591e834f52ae4dd88d4631', 'docs/portfolio/fr-p3b/FR-P3B-final-report.md', 'Archmays/Family-Reading', 90, 'VALID_CARMELA_MEDIA_AUDIO_FOUNDATION'],
  ['FR-P4A', 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS', '24fd0787bce84d45e5f71591e6da7201176c4c21', 'docs/portfolio/fr-p4a/FR-P4A-final-report.md', 'Archmays/Family-Reading', 118, 'VALID_RUNTIME_AND_ROUTE_LOADING_FOUNDATION'],
  ['FR-P4B', 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS', '0a4932e117632983359fef507c61aa770792f3e4', 'docs/portfolio/fr-p4b/FR-P4B-final-report.md', 'Archmays/Family-Reading-Codex', 133, 'VALID_WORK_CELLS_TOPIC_EXPERIENCE'],
  ['FR-P4B-R1', 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS', '33d07f6e1b29935945d4f7ce13465517c3a6363c', 'docs/portfolio/fr-p4b-r1/FR-P4B-R1-final-report.md', 'Archmays/Family-Reading-Codex', 137, 'VALID_RESPONSIVE_GEOMETRY_FOUNDATION'],
  ['FR-P5', 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS', 'f55859186f69e98a1cae689f77d7162f1bf565e0', 'docs/portfolio/fr-p5/FR-P5-final-report.md', 'Archmays/Family-Reading-Codex', 201, 'CURRENT_MEDIA_BUILD_AND_PAGES_TRUTH'],
];
const phaseIds = [
  'FR-P0/P0R1',
  'FR-P2',
  'FR-P3A',
  'FR-P3B',
  'FR-P4A',
  'FR-P4B',
  'FR-P4B-R1',
  'FR-P5',
  'FR-P6',
];

function ledger({
  p6Status = 'IN_PROGRESS',
  p6Truth = 'CANDIDATE_FINAL_TRUTH_PENDING_CODEX_ACCEPTANCE',
  finalMode = false,
} = {}) {
  return {
    schemaVersion: 1,
    repository: 'Archmays/Family-Reading-Codex',
    repositoryId: 1271691196,
    currentPagesUrl: 'https://archmays.github.io/Family-Reading-Codex/',
    currentTruth: finalMode
      ? {
          baseMainSha: 'f55859186f69e98a1cae689f77d7162f1bf565e0',
          lastCompletedPhase: 'FR-P6',
          portfolioStatus: 'SEALED',
          projectMode: 'MAINTENANCE',
          nextRecommendedPhase: 'NONE',
        }
      : {
          baseMainSha: 'f55859186f69e98a1cae689f77d7162f1bf565e0',
          lastCompletedPhase: 'FR-P5',
          portfolioStatus: 'FR_P6_IN_PROGRESS',
          projectMode: 'ACTIVE_DEVELOPMENT',
        },
    phases: [
      ...historicalPhases.map(([id, status, finalSha, reportPath, repositoryAtTime, testCount, currentTruth]) => ({
        id,
        status,
        finalSha,
        reportPath,
        repositoryAtTime,
        testCount,
        currentTruth,
        limitations: [],
        corrections: [],
      })),
      {
        id: 'FR-P6',
        reportPath: 'docs/portfolio/fr-p6/FR-P6-final-acceptance-report.md',
        repositoryAtTime: 'Archmays/Family-Reading-Codex',
        status: p6Status,
        finalSha: finalMode ? sentinel : null,
        testCount: finalMode ? 211 : null,
        currentTruth: p6Truth,
        limitations: finalMode
          ? [
              'NATIVE_BROWSER_ZOOM_AUTOMATION_UNAVAILABLE',
              'PHYSICAL_IOS_ANDROID_UNAVAILABLE',
              'EXTERNAL_SCREEN_READER_AUTOMATION_UNAVAILABLE',
              'MULTI_POP_CDN_OBSERVATION_UNAVAILABLE',
            ]
          : [],
        corrections: finalMode ? ['policy hash', 'print CSS', 'cross binding'] : [],
      },
    ],
  };
}

function provisionalState() {
  return {
    schemaVersion: 1,
    sealState: 'PROVISIONAL',
    portfolioStatus: 'FR_P6_IN_PROGRESS',
    projectMode: 'ACTIVE_DEVELOPMENT',
    repository: 'Archmays/Family-Reading-Codex',
    repositoryId: 1271691196,
    baseMainSha: 'f55859186f69e98a1cae689f77d7162f1bf565e0',
    nextRecommendedPhase: 'FR-P6 Final Acceptance and Project Seal',
    visibility: 'public',
    pagesUrl: 'https://archmays.github.io/Family-Reading-Codex/',
    lastCompletedPhase: 'FR-P5',
    finalMainSha: null,
    pagesStatus: 'PENDING_CODEX_FINAL_ACCEPTANCE',
    workspaceStatus: 'PENDING_CODEX_FINAL_ACCEPTANCE',
    finalTestCount: null,
    qualityCompromises: null,
    phaseLedgerPath: 'reports/portfolio/fr-p6/fr-p6-phase-ledger.json',
    requiredFinalArtifacts: [...finalArtifacts],
    environmentLimitationsToProbe: [...environmentProbes],
  };
}

test('FR-P6 candidate ledger preserves phase order and does not claim a final seal', () => {
  assert.deepEqual(validatePhaseLedgerData(ledger()), []);
  assert.deepEqual(validateSealStateData(provisionalState()), []);
});

test('FR-P6 final mode requires complete ledger truth and strict closeout fields', () => {
  const invalidLedger = ledger({ p6Status: 'IN_PROGRESS', finalMode: true });
  const ledgerFindings = validatePhaseLedgerData(invalidLedger, { finalMode: true });
  assert.ok(ledgerFindings.some((item) => item.code === 'LEDGER_P6_FINAL'));
  assert.ok(ledgerFindings.some((item) => item.code === 'LEDGER_P6_TRUTH'));

  const invalidState = {
    ...provisionalState(),
    sealState: 'SEALED',
    portfolioStatus: 'SEALED',
    projectMode: 'MAINTENANCE',
    lastCompletedPhase: 'FR-P6',
    nextRecommendedPhase: 'NONE',
    finalMainSha: null,
    pagesStatus: 'PENDING',
    workspaceStatus: 'DIRTY',
    qualityCompromises: 1,
    finalTestCount: 200,
  };
  const stateFindings = validateSealStateData(invalidState);
  for (const code of [
    'SEAL_FINAL_SHA',
    'SEAL_FINAL_CLOSEOUT',
    'SEAL_FINAL_QUALITY',
    'SEAL_FINAL_TESTS',
  ]) {
    assert.ok(stateFindings.some((item) => item.code === code), code);
  }
});

test('FR-P6 phase ledger rejects missing, duplicate or reordered phases', () => {
  const invalid = ledger();
  invalid.phases = [invalid.phases[1], ...invalid.phases.slice(1)];
  const findings = validatePhaseLedgerData(invalid);
  assert.ok(findings.some((item) => item.code === 'LEDGER_PHASE_ORDER'));
  assert.ok(findings.some((item) => item.code === 'LEDGER_DUPLICATE_PHASE'));
});

test('FR-P6 integration validator reconciles the current runtime, evidence and seal truth', async () => {
  const result = await validatePortfolioSeal();
  assert.equal(typeof result.finalMode, 'boolean');
  assert.deepEqual(result.findings, []);
});

test('FR-P6 ledger freezes every reconciled historical tuple', () => {
  const invalid = ledger();
  invalid.phases.find((phase) => phase.id === 'FR-P4A').finalSha = '0'.repeat(40);
  invalid.phases.find((phase) => phase.id === 'FR-P5').reportPath = 'docs/wrong.md';
  const findings = validatePhaseLedgerData(invalid);
  assert.equal(findings.filter((item) => item.code === 'LEDGER_HISTORICAL_DRIFT').length, 2);
});

test('FR-P6 provisional state rejects missing probes and premature closeout claims', () => {
  const invalid = provisionalState();
  invalid.environmentLimitationsToProbe.pop();
  invalid.pagesStatus = sentinel;
  const findings = validateSealStateData(invalid);
  assert.ok(findings.some((item) => item.code === 'SEAL_ENVIRONMENT_PROBES'));
  assert.ok(findings.some((item) => item.code === 'SEAL_PROVISIONAL_CLOSEOUT'));
});

test('FR-P6 sealed ledger and state require exact test, sentinel and maintenance truth', () => {
  const finalLedger = ledger({
    p6Status: 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS',
    p6Truth: 'CURRENT_FINAL_TRUTH',
    finalMode: true,
  });
  assert.deepEqual(validatePhaseLedgerData(finalLedger, { finalMode: true }), []);
  finalLedger.phases.at(-1).testCount = 210;
  assert.ok(validatePhaseLedgerData(finalLedger, { finalMode: true }).some((item) => item.code === 'LEDGER_P6_TESTS'));

  const finalState = {
    ...provisionalState(),
    sealState: 'SEALED',
    portfolioStatus: 'SEALED',
    projectMode: 'MAINTENANCE',
    lastCompletedPhase: 'FR-P6',
    finalMainSha: sentinel,
    pagesStatus: sentinel,
    workspaceStatus: sentinel,
    finalTestCount: 211,
    qualityCompromises: 0,
    nextRecommendedPhase: 'NONE',
  };
  assert.deepEqual(validateSealStateData(finalState), []);
  finalState.finalMainSha = '0'.repeat(40);
  assert.ok(validateSealStateData(finalState).some((item) => item.code === 'SEAL_FINAL_SHA'));
});

test('FR-P6 content baseline rejects route, retry and geometry coverage loss', async () => {
  const [doc, books, topics] = await Promise.all([
    readFile(new URL('../reports/portfolio/fr-p6/fr-p6-content-route-baseline.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/runtime/carmela/books.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/runtime/work-cells/topics.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  assert.deepEqual(validateContentRouteBaselineData(doc, { books, topics }), []);
  doc.entranceRoutes[0].identity = false;
  doc.carmelaDirectRoutes[0].initialAudioRequests = 1;
  doc.workCellsDirectRoutes[0].stationCount = 0;
  doc.invalidRoutes[0].localPathLeak = true;
  doc.retryRoutes[0].attempts = 1;
  doc.retryRoutes.pop();
  doc.carmelaMediaParity[0].originalSelections = 1;
  doc.geometry.overlapCount = 1;
  doc.geometry.coverage.continuousWidths = [320, 1440];
  const findings = validateContentRouteBaselineData(doc, { books, topics });
  for (const code of [
    'CONTENT_ENTRANCE_RECORD',
    'CONTENT_CARMELA_RECORD',
    'CONTENT_WORK_CELLS_RECORD',
    'CONTENT_INVALID_RECORD',
    'CONTENT_RETRY_ROUTES',
    'CONTENT_RETRY_RECORD',
    'CONTENT_CARMELA_MEDIA_RECORD',
    'CONTENT_GEOMETRY',
    'CONTENT_GEOMETRY_COVERAGE',
  ]) {
    assert.ok(findings.some((item) => item.code === code), code);
  }
});

test('FR-P6 media baseline rejects srcset, audio Range, state and Lighthouse regression', async () => {
  const doc = JSON.parse(await readFile(
    new URL('../reports/portfolio/fr-p6/fr-p6-media-network-baseline.json', import.meta.url),
    'utf8',
  ));
  assert.deepEqual(validateMediaNetworkBaselineData(doc), []);
  doc.routeBudgets[0].cold.diagnostics.consoleErrors = 1;
  doc.srcsetMatrix.pop();
  doc.roleCoverage[1].semanticRole = doc.roleCoverage[0].semanticRole;
  doc.lightboxChecks[0].escape.focusRestoredToOpener = false;
  doc.audio.metadata[0].audioLengthSeconds = 0;
  doc.audio.httpRanges[0].statusCode = 200;
  doc.audio.deepInteractions[0].network.responses[0].status = 200;
  doc.localHttp.exactFiles[1] = { ...doc.localHttp.exactFiles[0] };
  doc.storage.localStorageEntries = 1;
  doc.lighthouse.runs.find((run) => run.formFactor === 'mobile').performance = 81;
  const findings = validateMediaNetworkBaselineData(doc);
  for (const code of [
    'MEDIA_ROUTE_BUDGET_DETAIL',
    'MEDIA_SRCSET',
    'MEDIA_ROLE_LIGHTBOX',
    'MEDIA_AUDIO_METADATA_DETAIL',
    'MEDIA_AUDIO_RANGE_SEMANTICS',
    'MEDIA_AUDIO_SUMMARY',
    'MEDIA_LOCAL_HTTP_EXACT_SET',
    'MEDIA_PRIVATE_STATE',
    'MEDIA_LIGHTHOUSE',
  ]) {
    assert.ok(findings.some((item) => item.code === code), code);
  }
});

test('FR-P6 live and run manifests reject premature deployment and a second final gate', async () => {
  const [live, run] = await Promise.all([
    readFile(
      new URL('../reports/portfolio/fr-p6/fr-p6-live-pages-baseline.json', import.meta.url),
      'utf8',
    ).then(JSON.parse),
    readFile(
      new URL('../reports/portfolio/fr-p6/fr-p6-run-manifest.json', import.meta.url),
      'utf8',
    ).then(JSON.parse),
  ]);
  assert.deepEqual(validateLivePagesBaselineData(live), []);
  const invalidLive = structuredClone(live);
  invalidLive.postCommitResolution.liveDeploymentVerified = true;
  invalidLive.requiredLiveRoutes[0] = '#/not-accepted';
  invalidLive.localPrecommitExact.exactFiles[0].exactHashMatch = false;
  const liveFindings = validateLivePagesBaselineData(invalidLive);
  for (const code of [
    'LIVE_BASELINE_PREMATURE',
    'LIVE_BASELINE_REQUIREMENTS',
    'LIVE_BASELINE_LOCAL_DETAIL',
  ]) {
    assert.ok(liveFindings.some((item) => item.code === code), code);
  }
  const invalidLiveNarrative = structuredClone(live);
  invalidLiveNarrative.requiredHttpSemantics.pop();
  assert.ok(validateLivePagesBaselineData(invalidLiveNarrative)
    .some((item) => item.code === 'LIVE_BASELINE_REQUIREMENTS'));

  const state = { finalTestCount: 211 };
  const actualBindings = new Map(run.artifactBindings.map((binding) => [
    binding.path,
    {
      canonicalLfBytes: binding.canonicalLfBytes,
      sha256: binding.sha256,
    },
  ]));
  assert.deepEqual(validateRunManifestData(run, { state, actualBindings }), []);

  const invalidRun = structuredClone(run);
  invalidRun.rightsStatus = 'FAIL';
  invalidRun.scope.sourceChanged = true;
  invalidRun.completedPreGateEvidence.targetedAffectedClosure.status = 'FAIL';
  invalidRun.singleFinalGate.requiredInvocations = 2;
  const runFindings = validateRunManifestData(invalidRun, { state, actualBindings });
  for (const code of [
    'RUN_MANIFEST_BOUNDARY',
    'RUN_MANIFEST_SCOPE',
    'RUN_MANIFEST_PRE_GATE_EVIDENCE',
    'RUN_MANIFEST_FINAL_GATE',
  ]) {
    assert.ok(runFindings.some((item) => item.code === code), code);
  }

  const invalidLighthouseRuns = structuredClone(run);
  invalidLighthouseRuns.completedPreGateEvidence.lighthouse.runs = [];
  assert.ok(validateRunManifestData(invalidLighthouseRuns, { state, actualBindings })
    .some((item) => item.code === 'RUN_MANIFEST_PRE_GATE_EVIDENCE'));

  const invalidCountBasis = structuredClone(run);
  invalidCountBasis.singleFinalGate.expectedCountBasis = 'incorrect count basis';
  assert.ok(validateRunManifestData(invalidCountBasis, { state, actualBindings })
    .some((item) => item.code === 'RUN_MANIFEST_FINAL_GATE'));

  const invalidCompletedAt = structuredClone(run);
  invalidCompletedAt.completedAt = 'not-an-acceptance-time';
  assert.ok(validateRunManifestData(invalidCompletedAt, { state, actualBindings })
    .some((item) => item.code === 'RUN_MANIFEST_COMPLETED_AT'));

  const firstBinding = run.artifactBindings[0];
  const wrongBindings = new Map(actualBindings);
  wrongBindings.set(firstBinding.path, {
    canonicalLfBytes: firstBinding.canonicalLfBytes,
    sha256: '0'.repeat(64),
  });
  assert.ok(validateRunManifestData(run, { state, actualBindings: wrongBindings })
    .some((item) => item.code === 'RUN_MANIFEST_BINDING_HASH'));
});
