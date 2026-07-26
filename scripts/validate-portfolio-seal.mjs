import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  canonicalPolicyHash,
  validateMediaManifest,
  validateMediaQualityPolicy,
} from './media-manifest-policy.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POST_COMMIT_SENTINEL = 'RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF';
const REPOSITORY = 'Archmays/Family-Reading-Codex';
const REPOSITORY_ID = 1271691196;
const PAGES_URL = 'https://archmays.github.io/Family-Reading-Codex/';
const P5_MAIN_SHA = 'f55859186f69e98a1cae689f77d7162f1bf565e0';
const P6_FINAL_TEST_COUNT = 211;
const EXPECTED_PHASE_IDS = [
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
const REQUIRED_PRIOR_REPORTS = [
  'docs/portfolio/fr-p0/FR-P0-final-report.md',
  'docs/portfolio/fr-p2/FR-P2-final-report.md',
  'docs/portfolio/fr-p3a/FR-P3A-final-report.md',
  'docs/portfolio/fr-p3b/FR-P3B-final-report.md',
  'docs/portfolio/fr-p4a/FR-P4A-final-report.md',
  'docs/portfolio/fr-p4b/FR-P4B-final-report.md',
  'docs/portfolio/fr-p4b-r1/FR-P4B-R1-final-report.md',
  'docs/portfolio/fr-p5/FR-P5-final-report.md',
];
const REQUIRED_FINAL_REPORTS = [
  'docs/portfolio/fr-p6/FR-P6-final-acceptance-report.md',
  'docs/portfolio/fr-p6/FR-P6-live-pages-report.md',
  'docs/portfolio/fr-p6/FR-P6-known-limitations.md',
  'reports/portfolio/fr-p6/fr-p6-content-route-baseline.json',
  'reports/portfolio/fr-p6/fr-p6-media-network-baseline.json',
  'reports/portfolio/fr-p6/fr-p6-live-pages-baseline.json',
  'reports/portfolio/fr-p6/fr-p6-run-manifest.json',
];
const EXPECTED_PRIOR_PHASES = {
  'FR-P0/P0R1': {
    status: 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS',
    finalSha: 'RESOLVED_IN_HISTORICAL_HANDOFF',
    reportPath: 'docs/portfolio/fr-p0/FR-P0-final-report.md',
    repositoryAtTime: 'Archmays/Family-Reading',
    testCount: 63,
    currentTruth: 'VALID_HISTORICAL_BASELINE_SUPERSEDED_BY_LATER_PHASES',
  },
  'FR-P2': {
    status: 'COMPLETE',
    finalSha: '7397effccb417e7fa990490713b0f244fbb5c512',
    reportPath: 'docs/portfolio/fr-p2/FR-P2-final-report.md',
    repositoryAtTime: 'Archmays/Family-Reading',
    testCount: null,
    currentTruth: 'VALID_FOUNDATION_CURRENTLY_IN_USE',
  },
  'FR-P3A': {
    status: 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS',
    finalSha: '45347b2c8b3767da90a51cc8759d51c4878b1bca',
    reportPath: 'docs/portfolio/fr-p3a/FR-P3A-final-report.md',
    repositoryAtTime: 'Archmays/Family-Reading',
    testCount: 83,
    currentTruth: 'VALID_CARMELA_DETAIL_ARCHITECTURE',
  },
  'FR-P3B': {
    status: 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS',
    finalSha: '58be1b52710ee4631c591e834f52ae4dd88d4631',
    reportPath: 'docs/portfolio/fr-p3b/FR-P3B-final-report.md',
    repositoryAtTime: 'Archmays/Family-Reading',
    testCount: 90,
    currentTruth: 'VALID_CARMELA_MEDIA_AUDIO_FOUNDATION',
  },
  'FR-P4A': {
    status: 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS',
    finalSha: '24fd0787bce84d45e5f71591e6da7201176c4c21',
    reportPath: 'docs/portfolio/fr-p4a/FR-P4A-final-report.md',
    repositoryAtTime: 'Archmays/Family-Reading',
    testCount: 118,
    currentTruth: 'VALID_RUNTIME_AND_ROUTE_LOADING_FOUNDATION',
  },
  'FR-P4B': {
    status: 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS',
    finalSha: '0a4932e117632983359fef507c61aa770792f3e4',
    reportPath: 'docs/portfolio/fr-p4b/FR-P4B-final-report.md',
    repositoryAtTime: REPOSITORY,
    testCount: 133,
    currentTruth: 'VALID_WORK_CELLS_TOPIC_EXPERIENCE',
  },
  'FR-P4B-R1': {
    status: 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS',
    finalSha: '33d07f6e1b29935945d4f7ce13465517c3a6363c',
    reportPath: 'docs/portfolio/fr-p4b-r1/FR-P4B-R1-final-report.md',
    repositoryAtTime: REPOSITORY,
    testCount: 137,
    currentTruth: 'VALID_RESPONSIVE_GEOMETRY_FOUNDATION',
  },
  'FR-P5': {
    status: 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS',
    finalSha: P5_MAIN_SHA,
    reportPath: 'docs/portfolio/fr-p5/FR-P5-final-report.md',
    repositoryAtTime: REPOSITORY,
    testCount: 201,
    currentTruth: 'CURRENT_MEDIA_BUILD_AND_PAGES_TRUTH',
  },
};
const EXPECTED_ENVIRONMENT_PROBES = [
  'native browser zoom',
  'physical iOS and Android devices',
  'external screen reader',
  'multi-POP CDN observation',
  'Lighthouse Windows temporary-directory cleanup',
  'platform-controlled mutable cache and MP3 MIME headers',
];
const FINAL_DOCUMENTED_LIMITATIONS = [
  'NATIVE_BROWSER_ZOOM_AUTOMATION_UNAVAILABLE',
  'PHYSICAL_IOS_ANDROID_UNAVAILABLE',
  'EXTERNAL_SCREEN_READER_AUTOMATION_UNAVAILABLE',
  'MULTI_POP_CDN_OBSERVATION_UNAVAILABLE',
];
const CARMELA_SECTIONS = [
  'base',
  'overview',
  'review',
  'scenes',
  'questions',
  'background',
  'encyclopedia',
  'audio',
  'parents',
];
const WORK_CELLS_SECTIONS = [
  'science-overview',
  'science-station',
  'science-questions',
  'science-parent-guidance',
  'source',
];
const ENTRANCE_ROUTES = ['#/', '#/series/carmela-season-1', '#/series/work-cells'];
const INVALID_ROUTE_IDS = [
  'invalid-root',
  'invalid-series',
  'invalid-carmela-book',
  'invalid-work-cells-topic',
  'invalid-carmela-section',
  'invalid-work-cells-section',
  'malformed-route',
];
const RETRY_ROUTE_IDS = ['retry-carmela-owner-shard', 'retry-work-cells-owner-shard'];
const ROUTE_BUDGET_ROUTES = [
  '#/',
  '#/series/carmela-season-1',
  '#/book/carmela-s1-01',
  '#/book/carmela-s1-11',
  '#/series/work-cells',
  '#/science/work-cells/food-poisoning',
  '#/science/work-cells/induced-pluripotent-stem-cells',
  '#/science/work-cells/cancer-cell-ii',
  '#/science/work-cells/novel-coronavirus',
];
const ROUTE_COLD_BYTES = [
  294947,
  517760,
  432078,
  523743,
  663350,
  414854,
  501697,
  388273,
  470607,
];
const SRCSET_CASES = [
  [390, 1],
  [390, 2],
  [430, 1],
  [430, 2],
  [768, 1],
  [768, 2],
  [1024, 1],
  [1024, 2],
  [1280, 1],
  [1280, 1.5],
  [1280, 2],
  [1440, 1],
  [1440, 2],
  [1088, 2],
  [1089, 2],
];
const MEDIA_POLICY_HASH = '9289331de034dddc25a6dc13428712ab826b201c962a10fb6493843606570f08';
const MANIFEST_HASH = 'b292f10e698f30e51ae0f4e27935a8d0c551f286b3b3d5f0a4b1d74ec5c763d8';
const PROTECTED_SIGNATURE = {
  files: 1278,
  bytes: 7882956334,
  sha256: 'ec186a6688129e95d34471930cd7bb6cb9d484aa745c6d5ba505b8abb4577cae',
};
const MEDIA_ROLE_IDS = [
  'carmela-series-cover',
  'carmela-book-hero-cover',
  'carmela-page-preview',
  'carmela-page-carmela-lightbox',
  'carmela-explanation',
  'work-cells-series-thumbnail',
  'work-cells-hero',
  'work-cells-station-preview',
  'work-cells-station-work-cells-lightbox',
  'work-cells-manga-preview',
  'work-cells-manga-work-cells-lightbox',
];
const LIGHTBOX_IDS = ['carmela-page', 'work-cells-station', 'work-cells-manga'];
const LIVE_ACTION_CHECKS = [
  'workflow belongs to the final main SHA',
  'validation and build pass',
  'artifact upload pass',
  'Pages deployment pass',
  'annotations are zero or explicitly reported',
  'deployment source SHA equals final main SHA',
];
const LIVE_ROUTES = [
  '#/',
  '#/series/carmela-season-1',
  '#/book/carmela-s1-01',
  '#/book/carmela-s1-11',
  '#/series/work-cells',
  '#/science/work-cells/food-poisoning',
  '#/science/work-cells/induced-pluripotent-stem-cells',
  '#/science/work-cells/cancer-cell-ii',
  '#/science/work-cells/novel-coronavirus',
  '#/book/carmela-s1-01/audio',
  '#/book/carmela-s1-11/background',
  '#/science/work-cells/food-poisoning/science-station',
  '#/science/work-cells/cancer-cell-ii/science-questions',
  '#/science/work-cells/novel-coronavirus/source',
];
const LIVE_INTERACTIONS = [
  'responsive currentSrc',
  'Carmela grouped lightbox',
  'Work Cells grouped lightbox',
  'question answer toggle',
  'direct-section focus and aria-current',
];
const LIVE_EXACT_FILES = [
  {
    path: 'public/media/media-manifest.json',
    bytes: 3767069,
    sha256: MANIFEST_HASH,
    expectedContentType: 'application/json; charset=utf-8',
  },
  {
    path: 'public/media/media-shard-index.json',
    bytes: 12527,
    sha256: '893d7817bf87379133b43a79e97050e5e729104149195f001655aeb37a8e4828',
    expectedContentType: 'application/json; charset=utf-8',
  },
  {
    path: 'public/media/shards/carmela-book/carmela-s1-01.json',
    bytes: 157581,
    sha256: 'e0216e5c962dc5c541f47423b79ad57058c7b8d1234e7db5072ddf35e9dfa8a3',
    expectedContentType: 'application/json; charset=utf-8',
  },
  {
    path: 'public/media/shards/work-cells-topic/food-poisoning.json',
    bytes: 66091,
    sha256: '595d50c7a8a7c4f20871c13c377c402b6373153991756a73d04363f028311c5a',
    expectedContentType: 'application/json; charset=utf-8',
  },
  {
    path: 'public/media/shards/work-cells-topic/induced-pluripotent-stem-cells.json',
    bytes: 180163,
    sha256: 'c651dcda8d407fd43d11c7cea98359354cb38d64c75fb61be45685b9db1f5280',
    expectedContentType: 'application/json; charset=utf-8',
  },
  {
    path: 'public/media/derived/9289331de034dddc25a6dc13428712ab/3b/0fda9d420a74/corn-food-carmela-explanation-480-webp.webp',
    bytes: 75060,
    sha256: '8b6192cc6027ce27fdd8359d8a57e8acea98784092a3084f01a4001fce7f294b',
    expectedContentType: 'image/webp',
  },
  {
    path: 'public/media/derived/9289331de034dddc25a6dc13428712ab/50/bd020737a455/food-poisoning__v02_page-004-work-cells-lightbox-1440-webp.webp',
    bytes: 691334,
    sha256: '41504bc6c1738f95efd12c8425ee995d52d23d20bacbe6acf9122d577d1bde72',
    expectedContentType: 'image/webp',
  },
  {
    path: 'public/media/derived/9289331de034dddc25a6dc13428712ab/79/ef88b9d9b567/ips-cells__v06_page-057-work-cells-page-240-webp.webp',
    bytes: 25624,
    sha256: '5f4cef920a2fef1bb5b042f5a70ddc276c4f9ad3f450bc104ef90391363d94a6',
    expectedContentType: 'image/webp',
  },
];
const POST_COMMIT_REQUIRED_FIELDS = [
  'FINAL_MAIN_SHA',
  'ACTIONS_RUN_ID',
  'DEPLOYMENT_ID',
  'PAGES_URL',
  'LOCAL_MAIN_EQUALS_ORIGIN_MAIN_EQUALS_GITHUB_MAIN_EQUALS_PAGES_SHA',
  'BRANCH_DELETION',
  'WORKSPACE_CLEAN',
];
const LIVE_HTTP_SEMANTICS = [
  'manifest, shard index, representative owner shards and three WebP files match exact deployed bytes',
  'ETag conditional requests return HTTP 304',
  'missing asset returns HTTP 404',
  'content-addressed derivatives retain immutable caching',
  'mutable responses record their platform cache policy',
  'all 12 Carmela MP3 files return HTTP 206 byte ranges',
  'service-worker registrations and local/session/IndexedDB state remain zero',
  'nine route budgets pass without console, request or overflow errors',
];
const FINAL_GATE_COUNT_BASIS = 'FR-P5 201-test baseline plus ten FR-P6 seal and final-artifact validator tests.';
const LIGHTHOUSE_ROUTE = '#/science/work-cells/food-poisoning';
const RUN_COMPLETED_AT = '2026-07-26T14:33:27.0253641+08:00';
const GEOMETRY_CONTINUOUS_WIDTHS = [
  320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672,
  680, 696, 704, 712, 728, 736, 744, 760, 768, 776, 792, 800,
  808, 824, 832, 840, 856, 864, 872, 888, 896, 904, 920, 928,
  936, 952, 960, 968, 984, 992, 1000, 1016, 1024, 1032, 1048,
  1056, 1064, 1080, 1087, 1088, 1089, 1090, 1096, 1112, 1120,
  1152, 1184, 1216, 1248, 1280, 1312, 1344, 1376, 1408, 1440,
];
const GEOMETRY_NAMED_VIEWPORTS = [
  [773, 709],
  [1024, 400],
  [900, 500],
  [844, 390],
  [800, 450],
  [768, 1024],
  [667, 375],
  [430, 932],
  [390, 844],
  [1280, 720],
  [1440, 900],
  [1088, 400],
  [1089, 400],
  [1089, 481],
];

async function readText(repositoryPath) {
  return readFile(path.join(rootDir, ...repositoryPath.split('/')), 'utf8');
}

async function readJson(repositoryPath) {
  return JSON.parse(await readText(repositoryPath));
}

async function exists(repositoryPath) {
  try {
    await access(path.join(rootDir, ...repositoryPath.split('/')), constants.F_OK);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function finding(code, message, item = '') {
  return { code, message, item };
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function canonicalRouteEvidence(route) {
  return `${route.slug ?? route.bookId ?? ''}|${route.section ?? ''}|${route.route ?? ''}`;
}

function diagnosticsAreZero(diagnostics) {
  return equalJson(diagnostics, {
    consoleErrors: 0,
    pageErrors: 0,
    requestFailures: 0,
    badResponses: 0,
  });
}

function isDerivedPath(value) {
  return typeof value === 'string'
    && value.startsWith(`public/media/derived/${MEDIA_POLICY_HASH.slice(0, 32)}/`)
    && /^public\/media\/derived\/[a-f0-9]{32}\/[a-f0-9]{2}\/[a-f0-9]{12}\/.+\.(?:avif|jpe?g|png|webp)$/i.test(value);
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/i.test(String(value ?? ''));
}

export function validatePhaseLedgerData(ledger, { finalMode = false } = {}) {
  const findings = [];
  if (ledger?.schemaVersion !== 1) {
    findings.push(finding('LEDGER_SCHEMA', 'Phase ledger schemaVersion must be 1.'));
    return findings;
  }
  if (ledger.repository !== REPOSITORY || ledger.repositoryId !== REPOSITORY_ID) {
    findings.push(finding('LEDGER_REPOSITORY', 'Phase ledger must use the canonical repository identity.'));
  }
  if (ledger.currentPagesUrl !== PAGES_URL) {
    findings.push(finding('LEDGER_PAGES', 'Phase ledger must use the canonical Pages URL.'));
  }
  if (!Array.isArray(ledger.phases)) {
    findings.push(finding('LEDGER_PHASES', 'Phase ledger phases must be an array.'));
    return findings;
  }
  const ids = ledger.phases.map((phase) => phase.id);
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_PHASE_IDS)) {
    findings.push(finding('LEDGER_PHASE_ORDER', `Expected ${EXPECTED_PHASE_IDS.join(', ')}.`));
  }
  if (new Set(ids).size !== ids.length) {
    findings.push(finding('LEDGER_DUPLICATE_PHASE', 'Phase ledger contains duplicate phase ids.'));
  }
  ledger.phases.forEach((phase) => {
    if (!phase.reportPath || typeof phase.reportPath !== 'string') {
      findings.push(finding('LEDGER_REPORT_PATH', 'Each phase needs a reportPath.', phase.id));
    }
    if (!phase.status || typeof phase.status !== 'string') {
      findings.push(finding('LEDGER_STATUS', 'Each phase needs a status.', phase.id));
    }
    if (!phase.currentTruth || typeof phase.currentTruth !== 'string') {
      findings.push(finding('LEDGER_CURRENT_TRUTH', 'Each phase needs currentTruth.', phase.id));
    }
    if (!Array.isArray(phase.limitations)) {
      findings.push(finding('LEDGER_LIMITATIONS', 'Each phase limitations field must be an array.', phase.id));
    }
    if (!Array.isArray(phase.corrections)) {
      findings.push(finding('LEDGER_CORRECTIONS', 'Each phase corrections field must be an array.', phase.id));
    }
  });
  for (const [id, expected] of Object.entries(EXPECTED_PRIOR_PHASES)) {
    const phase = ledger.phases.find((item) => item.id === id);
    if (!phase) continue;
    for (const field of ['status', 'finalSha', 'reportPath', 'repositoryAtTime', 'testCount', 'currentTruth']) {
      if (phase[field] !== expected[field]) {
        findings.push(finding('LEDGER_HISTORICAL_DRIFT', `${field} must retain its reconciled historical value.`, id));
      }
    }
  }
  const p6 = ledger.phases.find((phase) => phase.id === 'FR-P6');
  if (!p6) return findings;
  if (p6.reportPath !== 'docs/portfolio/fr-p6/FR-P6-final-acceptance-report.md'
      || p6.repositoryAtTime !== REPOSITORY) {
    findings.push(finding('LEDGER_P6_IDENTITY', 'FR-P6 report and repository identity are incorrect.'));
  }
  const expectedCurrentTruth = finalMode
    ? {
        baseMainSha: P5_MAIN_SHA,
        lastCompletedPhase: 'FR-P6',
        portfolioStatus: 'SEALED',
        projectMode: 'MAINTENANCE',
        nextRecommendedPhase: 'NONE',
      }
    : {
        baseMainSha: P5_MAIN_SHA,
        lastCompletedPhase: 'FR-P5',
        portfolioStatus: 'FR_P6_IN_PROGRESS',
        projectMode: 'ACTIVE_DEVELOPMENT',
      };
  for (const [field, expected] of Object.entries(expectedCurrentTruth)) {
    if (ledger.currentTruth?.[field] !== expected) {
      findings.push(finding('LEDGER_CURRENT_STATE', `${field} must be ${expected}.`));
    }
  }
  if (finalMode) {
    if (!['COMPLETE', 'COMPLETE_WITH_DOCUMENTED_LIMITATIONS'].includes(p6.status)) {
      findings.push(finding('LEDGER_P6_FINAL', 'Final ledger must mark FR-P6 complete.'));
    }
    if (p6.currentTruth !== 'CURRENT_FINAL_TRUTH') {
      findings.push(finding('LEDGER_P6_TRUTH', 'Final ledger must mark FR-P6 as current final truth.'));
    }
    if (p6.finalSha !== POST_COMMIT_SENTINEL) {
      findings.push(finding('LEDGER_P6_SHA', 'Final ledger must retain the post-commit self-reference sentinel.'));
    }
    if (p6.testCount !== P6_FINAL_TEST_COUNT) {
      findings.push(finding('LEDGER_P6_TESTS', `Final ledger must expect ${P6_FINAL_TEST_COUNT} tests.`));
    }
    if (!equalJson(sortedUnique(p6.limitations ?? []), sortedUnique(FINAL_DOCUMENTED_LIMITATIONS))) {
      findings.push(finding('LEDGER_P6_LIMITATIONS', 'Final ledger must record the four accepted environment limitations exactly.'));
    }
    if (!Array.isArray(p6.corrections) || p6.corrections.length < 3) {
      findings.push(finding('LEDGER_P6_CORRECTIONS', 'Final ledger must record the actual FR-P6 corrections.'));
    }
  } else {
    const candidate = {
      status: 'IN_PROGRESS',
      finalSha: null,
      testCount: null,
      currentTruth: 'CANDIDATE_FINAL_TRUTH_PENDING_CODEX_ACCEPTANCE',
    };
    for (const [field, expected] of Object.entries(candidate)) {
      if (p6[field] !== expected) {
        findings.push(finding('LEDGER_P6_CANDIDATE', `Candidate FR-P6 ${field} is incorrect.`));
      }
    }
  }
  return findings;
}

export function validateSealStateData(state) {
  const findings = [];
  if (state?.schemaVersion !== 1) {
    findings.push(finding('SEAL_SCHEMA', 'Seal state schemaVersion must be 1.'));
    return findings;
  }
  if (!['PROVISIONAL', 'SEALED'].includes(state.sealState)) {
    findings.push(finding('SEAL_STATE', 'sealState must be PROVISIONAL or SEALED.'));
    return findings;
  }
  if (state.repository !== REPOSITORY || state.repositoryId !== REPOSITORY_ID) {
    findings.push(finding('SEAL_REPOSITORY', 'Seal state repository identity is incorrect.'));
  }
  if (state.visibility !== 'public' || state.pagesUrl !== PAGES_URL) {
    findings.push(finding('SEAL_PUBLIC_IDENTITY', 'Seal state must retain public canonical Pages identity.'));
  }
  if (state.baseMainSha !== P5_MAIN_SHA) {
    findings.push(finding('SEAL_BASE_SHA', 'FR-P6 base main SHA must be the FR-P5 final main SHA.'));
  }
  if (state.phaseLedgerPath !== 'reports/portfolio/fr-p6/fr-p6-phase-ledger.json') {
    findings.push(finding('SEAL_LEDGER_PATH', 'Seal state phaseLedgerPath is incorrect.'));
  }
  if (!equalJson(state.requiredFinalArtifacts, REQUIRED_FINAL_REPORTS)) {
    findings.push(finding('SEAL_ARTIFACTS', 'Seal state must list the seven final artifacts exactly once and in canonical order.'));
  }
  if (!equalJson(state.environmentLimitationsToProbe, EXPECTED_ENVIRONMENT_PROBES)) {
    findings.push(finding('SEAL_ENVIRONMENT_PROBES', 'Seal state must retain all six environment probes in canonical order.'));
  }
  if (state.sealState === 'PROVISIONAL') {
    if (state.portfolioStatus !== 'FR_P6_IN_PROGRESS') {
      findings.push(finding('SEAL_PROVISIONAL_STATUS', 'Provisional state must be FR_P6_IN_PROGRESS.'));
    }
    if (state.projectMode !== 'ACTIVE_DEVELOPMENT') {
      findings.push(finding('SEAL_PROVISIONAL_MODE', 'Provisional project mode must remain ACTIVE_DEVELOPMENT.'));
    }
    if (state.nextRecommendedPhase !== 'FR-P6 Final Acceptance and Project Seal') {
      findings.push(finding('SEAL_PROVISIONAL_NEXT', 'Provisional next phase must remain FR-P6.'));
    }
    if (state.lastCompletedPhase !== 'FR-P5'
        || state.finalMainSha !== null
        || state.pagesStatus !== 'PENDING_CODEX_FINAL_ACCEPTANCE'
        || state.workspaceStatus !== 'PENDING_CODEX_FINAL_ACCEPTANCE'
        || state.finalTestCount !== null
        || state.qualityCompromises !== null) {
      findings.push(finding('SEAL_PROVISIONAL_CLOSEOUT', 'Provisional state contains a premature or mismatched closeout field.'));
    }
  } else {
    if (state.portfolioStatus !== 'SEALED') {
      findings.push(finding('SEAL_FINAL_STATUS', 'Sealed state must set portfolioStatus SEALED.'));
    }
    if (state.projectMode !== 'MAINTENANCE') {
      findings.push(finding('SEAL_FINAL_MODE', 'Sealed state must set projectMode MAINTENANCE.'));
    }
    if (state.lastCompletedPhase !== 'FR-P6') {
      findings.push(finding('SEAL_FINAL_PHASE', 'Sealed state must set lastCompletedPhase FR-P6.'));
    }
    if (state.nextRecommendedPhase !== 'NONE') {
      findings.push(finding('SEAL_FINAL_NEXT', 'Sealed state must set nextRecommendedPhase NONE.'));
    }
    if (state.finalMainSha !== POST_COMMIT_SENTINEL) {
      findings.push(finding('SEAL_FINAL_SHA', 'Tracked sealed state must defer the self-referential final SHA to the post-commit handoff.'));
    }
    if (state.pagesStatus !== POST_COMMIT_SENTINEL || state.workspaceStatus !== POST_COMMIT_SENTINEL) {
      findings.push(finding('SEAL_FINAL_CLOSEOUT', 'Tracked sealed state must defer exact-SHA Pages and workspace closeout to the post-commit handoff.'));
    }
    if (state.qualityCompromises !== 0) {
      findings.push(finding('SEAL_FINAL_QUALITY', 'Sealed state requires qualityCompromises 0.'));
    }
    if (state.finalTestCount !== P6_FINAL_TEST_COUNT) {
      findings.push(finding('SEAL_FINAL_TESTS', `Sealed state requires the expected ${P6_FINAL_TEST_COUNT} final tests.`));
    }
  }
  return findings;
}

function validateArtifactEnvelope(doc, artifactName) {
  const findings = [];
  if (doc?.schemaVersion !== 1) findings.push(finding('FINAL_ARTIFACT_SCHEMA', 'schemaVersion must be 1.', artifactName));
  if (doc?.phase !== 'FR-P6') findings.push(finding('FINAL_ARTIFACT_PHASE', 'phase must be FR-P6.', artifactName));
  if (!Array.isArray(doc?.failures) || doc.failures.length !== 0) {
    findings.push(finding('FINAL_ARTIFACT_FAILURES', 'failures must be an empty array.', artifactName));
  }
  return findings;
}

function assertExactEvidenceSet(findings, {
  actual,
  expected,
  code,
  item,
  project = (value) => value,
}) {
  if (!Array.isArray(actual)) {
    findings.push(finding(code, 'Evidence must be an array.', item));
    return;
  }
  const projected = actual.map(project);
  if (!equalJson(sortedUnique(projected), sortedUnique(expected))
      || projected.length !== expected.length
      || actual.some((entry) => entry.status !== 'PASS')) {
    findings.push(finding(code, 'Evidence set is incomplete, duplicated, unexpected, or not fully passing.', item));
  }
}

export function validateContentRouteBaselineData(doc, { books, topics } = {}) {
  const findings = validateArtifactEnvelope(doc, 'fr-p6-content-route-baseline.json');
  if (doc?.status !== 'PASS' || doc?.acceptanceBaseSha !== P5_MAIN_SHA) {
    findings.push(finding('CONTENT_BASELINE_STATUS', 'Content baseline must be a passing FR-P5-base acceptance record.'));
  }
  const serialized = JSON.stringify(doc);
  if (/127\.0\.0\.1|localhost|task-scratch|[A-Za-z]:\\\\/i.test(serialized)) {
    findings.push(finding('CONTENT_BASELINE_LOCAL_PATH', 'Tracked content evidence must not contain local URLs or scratch paths.'));
  }

  assertExactEvidenceSet(findings, {
    actual: doc?.entranceRoutes,
    expected: ENTRANCE_ROUTES,
    project: (entry) => entry.route,
    code: 'CONTENT_ENTRANCES',
    item: 'entranceRoutes',
  });

  const bookSlugs = (books?.books ?? []).map((book) => book.slug);
  const expectedCarmela = bookSlugs.flatMap((slug) => CARMELA_SECTIONS.map((section) => {
    const route = section === 'base' ? `#/book/${slug}` : `#/book/${slug}/${section}`;
    return `${slug}|${section}|${route}`;
  }));
  assertExactEvidenceSet(findings, {
    actual: doc?.carmelaDirectRoutes,
    expected: expectedCarmela,
    project: canonicalRouteEvidence,
    code: 'CONTENT_CARMELA_ROUTES',
    item: 'carmelaDirectRoutes',
  });

  const topicSlugs = (topics?.topics ?? []).map((topic) => topic.slug);
  const expectedWorkCells = topicSlugs.flatMap((slug) => WORK_CELLS_SECTIONS.map((section) => (
    `${slug}|${section}|#/science/work-cells/${slug}/${section}`
  )));
  assertExactEvidenceSet(findings, {
    actual: doc?.workCellsDirectRoutes,
    expected: expectedWorkCells,
    project: canonicalRouteEvidence,
    code: 'CONTENT_WORK_CELLS_ROUTES',
    item: 'workCellsDirectRoutes',
  });
  assertExactEvidenceSet(findings, {
    actual: doc?.invalidRoutes,
    expected: INVALID_ROUTE_IDS,
    project: (entry) => entry.id,
    code: 'CONTENT_INVALID_ROUTES',
    item: 'invalidRoutes',
  });
  assertExactEvidenceSet(findings, {
    actual: doc?.retryRoutes,
    expected: RETRY_ROUTE_IDS,
    project: (entry) => entry.id,
    code: 'CONTENT_RETRY_ROUTES',
    item: 'retryRoutes',
  });
  assertExactEvidenceSet(findings, {
    actual: doc?.carmelaMediaParity,
    expected: bookSlugs,
    project: (entry) => entry.slug ?? entry.bookId,
    code: 'CONTENT_CARMELA_MEDIA_PARITY',
    item: 'carmelaMediaParity',
  });
  const entranceExpectations = new Map([
    ['#/', { id: 'entrance-home', heading: '选择阅读主题', breadcrumbCurrent: 0, cardCounts: { home: 2, carmela: 0, workCells: 0 } }],
    ['#/series/carmela-season-1', { id: 'entrance-carmela-series', heading: '不一样的卡梅拉', breadcrumbCurrent: 1, cardCounts: { home: 0, carmela: 12, workCells: 0 } }],
    ['#/series/work-cells', { id: 'entrance-work-cells-series', heading: '工作细胞', breadcrumbCurrent: 1, cardCounts: { home: 0, carmela: 0, workCells: 27 } }],
  ]);
  if ((doc?.entranceRoutes ?? []).some((entry) => {
    const expected = entranceExpectations.get(entry.route);
    return !expected
      || entry.id !== expected.id
      || entry.heading !== expected.heading
      || entry.identity !== true
      || entry.focus !== true
      || entry.h1Count !== 1
      || entry.breadcrumbCurrent !== expected.breadcrumbCurrent
      || !Number.isInteger(entry.contentBytes)
      || entry.contentBytes <= 0
      || !equalJson(entry.cardCounts, expected.cardCounts)
      || entry.contentGate !== true
      || entry.initialAudioRequests !== 0
      || entry.globalManifestRequests !== 0
      || entry.ownerShardRequests !== 1
      || entry.horizontalOverflow !== false
      || !diagnosticsAreZero(entry.diagnostics);
  })) {
    findings.push(finding('CONTENT_ENTRANCE_RECORD', 'Entrance records must retain exact identity, focus, cards, requests and zero diagnostics.'));
  }
  const directRecordInvalid = (entry, { workCells = false } = {}) => (
    entry.identity !== true
    || entry.focus !== true
    || entry.h1Count !== 1
    || entry.breadcrumbCurrent !== 1
    || entry.railCurrent !== (workCells || entry.section !== 'base' ? 1 : 0)
    || !Number.isInteger(entry.contentBytes)
    || entry.contentBytes <= 0
    || entry.contentGate !== true
    || entry.initialAudioRequests !== 0
    || entry.globalManifestRequests !== 0
    || entry.ownerShardRequests !== 1
    || entry.unrelatedDetailRequests !== 0
    || entry.unrelatedOwnerShardRequests !== 0
    || entry.horizontalOverflow !== false
    || entry.brokenPictures !== 0
    || entry.leakedLocalPath !== false
    || entry.leakedInternalStatus !== false
    || entry.leakedMedicalAdvice !== false
    || !diagnosticsAreZero(entry.diagnostics)
  );
  if ((doc?.carmelaDirectRoutes ?? []).some((entry) => directRecordInvalid(entry))) {
    findings.push(finding('CONTENT_CARMELA_RECORD', 'Every Carmela record must retain the direct-route semantic, request-isolation and diagnostic invariants.'));
  }
  if ((doc?.workCellsDirectRoutes ?? []).some((entry) => directRecordInvalid(entry, { workCells: true })
      || entry.stationCount !== 4
      || entry.questionCount !== 6
      || entry.hiddenAnswerCount !== 6
      || entry.initialHeroImages !== 1)) {
    findings.push(finding('CONTENT_WORK_CELLS_RECORD', 'Every Work Cells record must retain 4/6/6 content, one Hero and the direct-route invariants.'));
  }
  const invalidRouteMap = new Map([
    ['invalid-root', '#/not-a-route'],
    ['invalid-series', '#/series/not-a-series'],
    ['invalid-carmela-book', '#/book/not-a-book'],
    ['invalid-work-cells-topic', '#/science/work-cells/not-a-topic'],
    ['invalid-carmela-section', '#/book/carmela-s1-01/not-a-section'],
    ['invalid-work-cells-section', '#/science/work-cells/streptococcus-pneumoniae/not-a-section'],
    ['malformed-route', '#/science/work-cells'],
  ]);
  if ((doc?.invalidRoutes ?? []).some((entry) => entry.route !== invalidRouteMap.get(entry.id)
      || entry.view !== 'error'
      || entry.h1Count !== 1
      || entry.errorState !== true
      || entry.localPathLeak !== false
      || entry.staleBook !== false
      || entry.staleScience !== false
      || entry.horizontalOverflow !== false
      || !diagnosticsAreZero(entry.diagnostics))) {
    findings.push(finding('CONTENT_INVALID_RECORD', 'Invalid-route records must retain exact bounded error-state and zero-leak evidence.'));
  }
  const retryExpectations = new Map([
    ['retry-carmela-owner-shard', {
      route: '#/book/carmela-s1-01/overview',
      targetPath: '/public/media/shards/carmela-book/carmela-s1-01.json',
      recoveryView: 'book',
    }],
    ['retry-work-cells-owner-shard', {
      route: '#/science/work-cells/streptococcus-pneumoniae/science-overview',
      targetPath: '/public/media/shards/work-cells-topic/streptococcus-pneumoniae.json',
      recoveryView: 'science',
    }],
  ]);
  if ((doc?.retryRoutes ?? []).some((entry) => {
    const expected = retryExpectations.get(entry.id);
    return !expected
      || entry.route !== expected.route
      || entry.targetPath !== expected.targetPath
      || entry.attempts !== 2
      || entry.failureView !== 'error'
      || entry.failureErrorState !== true
      || entry.recoveryView !== expected.recoveryView
      || entry.recoveryErrorState !== false
      || entry.localPathLeak !== false
      || entry.staleRouteRender !== false
      || entry.expectedConsoleErrors !== 1
      || entry.expectedResourceErrors !== 1
      || entry.unexpectedConsoleErrors !== 0
      || entry.pageErrors !== 0
      || entry.requestFailures !== 0;
  })) {
    findings.push(finding('CONTENT_RETRY_RECORD', 'Retry records must retain the exact one-shot failure, recovery and zero-leak lifecycle.'));
  }
  if ((doc?.carmelaMediaParity ?? []).some((entry) => typeof entry.groupId !== 'string'
      || !entry.groupId.startsWith(`media-group-${entry.bookId}-`)
      || !Number.isInteger(entry.openedImageCount)
      || entry.openedImageCount <= 0
      || entry.openedLoaded !== true
      || entry.originalSelections !== 0
      || entry.retainedImagesWhenCollapsed !== entry.openedImageCount
      || entry.mountedImagesAfterRouteCleanup !== 0
      || entry.activeSourcesAfterRouteCleanup !== 0)) {
    findings.push(finding('CONTENT_CARMELA_MEDIA_RECORD', 'Carmela media parity must prove disclosure loading, no originals and full route cleanup for every book.'));
  }

  const coverage = doc?.coverage ?? {};
  const expectedCoverage = {
    entranceRoutes: { passed: 3, total: 3 },
    carmelaDirectRoutes: { passed: 108, total: 108, books: 12, sections: CARMELA_SECTIONS },
    workCellsDirectRoutes: { passed: 135, total: 135, topics: 27, sections: WORK_CELLS_SECTIONS },
    carmelaMediaParity: { passed: 12, total: 12 },
    invalidRoutes: { passed: 7, total: 7 },
    retryRoutes: { passed: 2, total: 2 },
  };
  if (!equalJson(coverage, expectedCoverage)) {
    findings.push(finding('CONTENT_COVERAGE', 'Content coverage summary must match the complete route matrix.'));
  }

  const invariants = doc?.routeInvariants ?? {};
  const requiredZero = [
    'identityFailures',
    'focusFailures',
    'semanticFailures',
    'contentGateFailures',
    'initialAudioRequests',
    'globalManifestRequests',
    'unrelatedDetailRequests',
    'unrelatedOwnerShardRequests',
    'horizontalOverflowFindings',
    'brokenPictureFindings',
    'localPathLeaks',
    'internalStatusLeaks',
    'medicalAdviceLeaks',
    'unexpectedConsoleErrors',
    'pageErrors',
    'requestFailures',
    'badResponses',
  ];
  const carmelaDomainGate = {
    heroCoverImages: 1,
    initialOnDemandMedia: 0,
    initialAudioRequests: 0,
  };
  const workCellsDomainGate = {
    initialHeroImages: 1,
    stations: 4,
    questions: 6,
    hiddenAnswers: 6,
    initialStationAndMangaMedia: 0,
    initialAudioRequests: 0,
  };
  if (invariants.directRoutesPassed !== 246
      || invariants.directRoutesTotal !== 246
      || requiredZero.some((field) => invariants[field] !== 0)
      || !equalJson(invariants.carmelaDomainGateDefinition, carmelaDomainGate)
      || !equalJson(invariants.workCellsDomainGateDefinition, workCellsDomainGate)) {
    findings.push(finding('CONTENT_ROUTE_INVARIANTS', 'Route invariants are incomplete or contain a nonzero failure.'));
  }

  const geometry = doc?.geometry ?? {};
  const expectedPhaseCounts = {
    'continuous-width': 469,
    'named-viewport': 14,
    'topic-endpoint': 54,
    'zoom-equivalent': 8,
  };
  const expectedModeCounts = { 'single-column': 409, 'dual-column': 136 };
  const geometryCounters = geometry.browserCounters ?? {};
  if (geometry.status !== 'PASS'
      || geometry.sampleCount !== 545
      || geometry.passedSamples !== 545
      || !equalJson(geometry.phaseCounts, expectedPhaseCounts)
      || !equalJson(geometry.modeCounts, expectedModeCounts)
      || ['failureCount', 'overlapCount', 'horizontalOverflowCount', 'clippedTextCount', 'brokenMediaCount', 'undersizedControlSamples']
        .some((field) => geometry[field] !== 0)) {
    findings.push(finding('CONTENT_GEOMETRY', 'Geometry evidence must retain all 545 passing samples and zero product findings.'));
  }
  if (!equalJson(geometry.coverage?.deepTopics, [
    'food-poisoning',
    'cancer-cell-ii',
    'novel-coronavirus',
    'hemorrhagic-shock',
    'erythroblast-and-myelocyte',
    'left-shift-of-white-blood-cells',
    'induced-pluripotent-stem-cells',
  ])
      || !equalJson(geometry.coverage?.zoomPercents, [80, 90, 100, 110, 125, 150, 175, 200])
      || !equalJson(geometry.coverage?.namedViewports, GEOMETRY_NAMED_VIEWPORTS)
      || !equalJson(geometry.coverage?.continuousWidths, GEOMETRY_CONTINUOUS_WIDTHS)
      || !equalJson(sortedUnique(geometry.coverage?.topicEndpointSlugs ?? []), sortedUnique(topicSlugs))
      || !equalJson(geometry.coverage?.topicEndpointViewports, [[390, 844], [1280, 720]])
      || geometry.measurementBoundary?.nativeBrowserZoomChanged !== false
      || geometry.measurementBoundary?.cssViewportPixels !== true
      || ['consoleErrorCount', 'consoleWarningCount', 'pageErrorCount', 'requestFailureCount', 'badResponseCount']
        .some((field) => geometryCounters[field] !== 0)) {
    findings.push(finding('CONTENT_GEOMETRY_COVERAGE', 'Geometry coverage or browser diagnostics do not match the accepted 545-case boundary.'));
  }
  const interactions = doc?.interactions ?? {};
  if (interactions.roleSamples?.passed !== 11 || interactions.roleSamples?.total !== 11
      || interactions.lightboxChecks?.passed !== 3 || interactions.lightboxChecks?.total !== 3
      || interactions.roles?.length !== 11
      || interactions.lightboxes?.length !== 3
      || interactions.roles?.some((entry) => entry.status !== 'PASS' || entry.derived !== true || entry.loaded !== true)
      || interactions.lightboxes?.some((entry) => entry.status !== 'PASS'
        || entry.previewAndLightboxPathsDiffer !== true
        || entry.lightboxMateriallyLarger !== true
        || entry.escape?.focusRestoredToOpener !== true
        || entry.escape?.activeSourceCandidates !== 0
        || entry.routeCleanup?.openDialogCount !== 0
        || entry.routeCleanup?.activeSourceCandidates !== 0)
      || Object.values(interactions.diagnostics ?? {}).some((value) => value !== 0)
      || interactions.status !== 'PASS') {
    findings.push(finding('CONTENT_INTERACTIONS', 'Interaction evidence must retain 11/11 roles and 3/3 lightboxes.'));
  }
  if (doc?.browserAccessibility?.status !== 'PASS'
      || doc?.overallAccessibilityStatus !== 'DOCUMENTED_LIMITATION') {
    findings.push(finding('CONTENT_ACCESSIBILITY', 'Browser accessibility must pass while the unavailable external screen-reader session remains documented.'));
  }
  const print = doc?.print ?? {};
  if (print.status !== 'PASS' || print.format !== 'A4' || print.pages !== 7
      || print.resourceRequestsDuringPrint !== 0
      || print.dom?.printMatches !== true
      || print.dom?.horizontalOverflow !== false
      || print.dom?.mediaDisclosureDisplays?.some((display) => display !== 'none')
      || print.dom?.answerDisplays?.some((display) => display !== 'block')
      || print.manualReview?.status !== 'PASS'
      || ['focusOutlineArtifacts', 'splitQuestionLabels', 'clippedText', 'overlap', 'brokenGlyphsOrBlackSquares', 'blankPages', 'brokenMedia']
        .some((field) => print.manualReview?.[field] !== 0)) {
    findings.push(finding('CONTENT_PRINT', 'A4 print evidence must pass all seven pages without defects or print media requests.'));
  }
  if (doc?.manualVisualReview?.status !== 'PASS') {
    findings.push(finding('CONTENT_MANUAL_VISUAL', 'Manual screen and print visual review must pass.'));
  }
  return findings;
}

function normalizedScore(value) {
  return typeof value === 'number' && value > 1 ? value / 100 : value;
}

export function validateMediaNetworkBaselineData(doc) {
  const findings = validateArtifactEnvelope(doc, 'fr-p6-media-network-baseline.json');
  if (doc?.status !== 'PASS' || doc?.policyHash !== MEDIA_POLICY_HASH || doc?.acceptanceBaseSha !== P5_MAIN_SHA) {
    findings.push(finding('MEDIA_BASELINE_STATUS', 'Media/network baseline must pass with the canonical policy hash.'));
  }
  const serialized = JSON.stringify(doc);
  if (/127\.0\.0\.1|localhost|task-scratch|[A-Za-z]:\\\\/i.test(serialized)) {
    findings.push(finding('MEDIA_BASELINE_LOCAL_PATH', 'Tracked media evidence must not contain local URLs or scratch paths.'));
  }
  const truth = doc?.currentMediaTruth ?? {};
  const exactTruth = {
    sources: 778,
    referenceBytes: 712808718,
    sourceBytes: 864715340,
    variants: 2735,
    derivativeBytes: 612770984,
    manifestBytes: 3767069,
    manifestSha256: MANIFEST_HASH,
    ownerShards: 42,
    ownerShardIndex: 1,
    sourcesAcrossShards: 820,
    variantsAcrossShards: 2898,
    shardBytes: 4039948,
    missing: 0,
    stale: 0,
    orphan: 0,
    corrupt: 0,
    unexpectedOriginals: 0,
  };
  if (!equalJson(truth, exactTruth)) {
    findings.push(finding('MEDIA_CURRENT_TRUTH', 'Current media truth does not match the independently rebuilt manifest and inventory.'));
  }
  const release = doc?.releaseClosure ?? {};
  if (release.releasePlanPath !== 'reports/portfolio/fr-p5/fr-p5-media-release-plan.json'
      || release.releasePlanSha256 !== '7f1076b699d12492594627bb4bdcda51d277625a664dd50558c17678d2fa747d'
      || release.counts?.total !== 2857
      || release.counts?.applicationFiles !== 10
      || release.counts?.runtimeJsonFiles !== 98
      || release.counts?.mediaShardFiles !== 43
      || release.counts?.audioFiles !== 12
      || release.counts?.mediaFiles !== 2736
      || release.counts?.derivatives !== 2735
      || release.counts?.fallbackOriginals !== 0
      || release.bytes?.total !== 706990045
      || release.bytes?.applicationFiles !== 219578
      || release.bytes?.runtimeJsonFiles !== 4686799
      || release.bytes?.mediaShardFiles !== 4039948
      || release.bytes?.audioFiles !== 85545615
      || release.bytes?.mediaFiles !== 616538053
      || release.bytes?.derivativeFiles !== 612770984
      || release.bytes?.fallbackOriginals !== 0
      || release.dist?.files !== 2857
      || release.dist?.bytes !== 706990045
      || release.dist?.exactPlanMatch !== true
      || release.status !== 'PASS') {
    findings.push(finding('MEDIA_RELEASE_CLOSURE', 'Release closure must match the current print-repair build plan.'));
  }
  assertExactEvidenceSet(findings, {
    actual: doc?.routeBudgets,
    expected: ROUTE_BUDGET_ROUTES,
    project: (entry) => entry.route,
    code: 'MEDIA_ROUTE_BUDGETS',
    item: 'routeBudgets',
  });
  if ((doc?.routeBudgets ?? []).some((entry) => entry.cold?.status !== 'PASS' || entry.warm?.status !== 'PASS')) {
    findings.push(finding('MEDIA_ROUTE_BUDGET_PHASES', 'Every frozen route needs passing cold and warm evidence.'));
  }
  for (let index = 0; index < (doc?.routeBudgets ?? []).length; index += 1) {
    const entry = doc.routeBudgets[index];
    const cold = entry.cold ?? {};
    const warm = entry.warm ?? {};
    if (entry.route !== ROUTE_BUDGET_ROUTES[index]
        || entry.status !== 'PASS'
        || !Number.isInteger(entry.budgetBytes)
        || entry.budgetBytes <= 0
        || cold.totalTransferBytes !== ROUTE_COLD_BYTES[index]
        || cold.totalTransferBytes > entry.budgetBytes
        || cold.budgetBytes !== entry.budgetBytes
        || cold.headroomBytes !== entry.budgetBytes - cold.totalTransferBytes
        || cold.jsonBytes + cold.imageBytes + cold.audioBytes + cold.otherBytes !== cold.totalTransferBytes
        || !Number.isInteger(cold.requestCount)
        || cold.requestCount <= 0
        || cold.cacheHits !== 0
        || cold.shardIndexRequests !== 1
        || cold.ownerShardRequests !== 1
        || cold.globalManifestRequests !== 0
        || cold.originalSelections !== 0
        || cold.horizontalOverflow !== false
        || cold.duplicateDownloads?.length !== 0
        || !diagnosticsAreZero(cold.diagnostics)
        || !Array.isArray(cold.selectedSources)
        || cold.selectedSources.length < 1
        || cold.selectedSources.some((source) => !isDerivedPath(source.path)
          || !Number.isFinite(source.naturalWidth)
          || source.naturalWidth <= 0
          || !Number.isFinite(source.naturalHeight)
          || source.naturalHeight <= 0)
        || !(isDerivedPath(cold.lcp?.path)
          || (cold.lcp?.path === '' && ['H1', 'P'].includes(cold.lcp?.tag)))
        || !Number.isInteger(cold.lcp?.size)
        || cold.lcp.size <= 0
        || cold.cls < 0
        || cold.cls > 0.1
        || warm.totalTransferBytes !== 395
        || warm.jsonBytes + warm.imageBytes + warm.audioBytes + warm.otherBytes !== warm.totalTransferBytes
        || warm.requestCount !== 1
        || warm.cacheHits !== 1
        || warm.shardIndexRequests !== 0
        || warm.ownerShardRequests !== 0
        || warm.globalManifestRequests !== 0
        || warm.originalSelections !== 0
        || warm.horizontalOverflow !== false
        || warm.duplicateDownloads?.length !== 0
        || !diagnosticsAreZero(warm.diagnostics)
        || !Array.isArray(warm.selectedSources)
        || warm.selectedSources.length !== cold.selectedSources.length
        || warm.selectedSources.some((source) => !isDerivedPath(source.path)
          || !Number.isFinite(source.naturalWidth)
          || source.naturalWidth <= 0
          || !Number.isFinite(source.naturalHeight)
          || source.naturalHeight <= 0)
        || !equalJson(
          warm.selectedSources.map((source) => source.path),
          cold.selectedSources.map((source) => source.path),
        )
        || warm.lcp !== null
        || warm.cls < 0
        || warm.cls > 0.1
        || warm.sameSelectionAsCold !== true) {
      findings.push(finding('MEDIA_ROUTE_BUDGET_DETAIL', 'Frozen cold/warm route evidence does not match the accepted request and cache behavior.', entry.route));
    }
  }
  const srcset = doc?.srcsetMatrix ?? [];
  const srcsetActual = srcset.map((entry) => `${entry.viewportWidth ?? entry.width}@${entry.dpr}`);
  const srcsetExpected = SRCSET_CASES.map(([width, dpr]) => `${width}@${dpr}`);
  if (!Array.isArray(srcset)
      || !equalJson(sortedUnique(srcsetActual), sortedUnique(srcsetExpected))
      || srcset.length !== srcsetExpected.length
      || srcset.some((entry) => entry.status !== 'PASS'
        || !isDerivedPath(entry.selectedPath)
        || typeof entry.selectedProfileId !== 'string'
        || entry.selectedProfileId.length === 0
        || !Number.isFinite(entry.naturalWidth)
        || entry.naturalWidth <= 0
        || !Number.isFinite(entry.naturalHeight)
        || entry.naturalHeight <= 0
        || entry.naturalWidth !== entry.selectedVariantWidth
        || entry.naturalHeight !== entry.selectedVariantHeight
        || !Number.isFinite(entry.renderedWidth)
        || entry.renderedWidth <= 0
        || !Number.isFinite(entry.renderedHeight)
        || entry.renderedHeight <= 0
        || !Number.isFinite(entry.requiredPixelWidth)
        || entry.requiredPixelWidth <= 0
        || !Number.isFinite(entry.upscalingRatio)
        || entry.upscalingRatio > 1
        || !Number.isInteger(entry.resourceBytes)
        || entry.resourceBytes <= 0
        || !Number.isInteger(entry.transferBytes)
        || entry.transferBytes < entry.resourceBytes
        || entry.candidateCount !== 3
        || entry.transferredCandidates !== 1
        || entry.originalSelection !== false
        || entry.duplicateCandidateTransfers !== 0
        || entry.horizontalOverflow !== false
        || entry.dimensionsTruthful !== true
        || !Number.isFinite(entry.cls)
        || entry.cls < 0
        || entry.cls > 0.1
        || !diagnosticsAreZero(entry.diagnostics))) {
    findings.push(finding('MEDIA_SRCSET', 'Responsive selection must retain the exact 15-case passing matrix.'));
  }
  const responsiveRoleBySemanticRole = new Map([
    ['carmela-series-cover', 'carmela-series-cover'],
    ['carmela-book-hero-cover', 'carmela-book-cover'],
    ['carmela-page-preview', 'carmela-page-preview'],
    ['carmela-page-carmela-lightbox', 'carmela-lightbox'],
    ['carmela-explanation', 'carmela-explanation-preview'],
    ['work-cells-series-thumbnail', 'work-cells-series-thumbnail'],
    ['work-cells-hero', 'work-cells-topic-hero'],
    ['work-cells-station-preview', 'work-cells-station-preview'],
    ['work-cells-station-work-cells-lightbox', 'work-cells-lightbox'],
    ['work-cells-manga-preview', 'work-cells-manga-preview'],
    ['work-cells-manga-work-cells-lightbox', 'work-cells-lightbox'],
  ]);
  if (!Array.isArray(doc?.roleCoverage)
      || doc.roleCoverage.length !== 11
      || !equalJson(sortedUnique(doc.roleCoverage.map((entry) => entry.semanticRole)), sortedUnique(MEDIA_ROLE_IDS))
      || doc.roleCoverage.some((entry) => entry.status !== 'PASS'
        || entry.responsiveRole !== responsiveRoleBySemanticRole.get(entry.semanticRole)
        || entry.derived !== true
        || entry.loaded !== true
        || !isDerivedPath(entry.selectedPath)
        || typeof entry.selectedProfileId !== 'string'
        || entry.selectedProfileId.length === 0
        || !Number.isFinite(entry.naturalWidth)
        || entry.naturalWidth <= 0
        || !Number.isFinite(entry.naturalHeight)
        || entry.naturalHeight <= 0
        || (entry.renderedWidth !== undefined && (!Number.isFinite(entry.renderedWidth) || entry.renderedWidth <= 0))
        || (entry.renderedHeight !== undefined && (!Number.isFinite(entry.renderedHeight) || entry.renderedHeight <= 0)))
      || !Array.isArray(doc?.lightboxChecks)
      || doc.lightboxChecks.length !== 3
      || !equalJson(sortedUnique(doc.lightboxChecks.map((entry) => entry.id)), sortedUnique(LIGHTBOX_IDS))
      || doc.lightboxChecks.some((entry) => entry.status !== 'PASS'
        || entry.preview?.status !== 'PASS'
        || entry.preview?.derived !== true
        || entry.preview?.loaded !== true
        || !isDerivedPath(entry.preview?.selectedPath)
        || entry.lightbox?.status !== 'PASS'
        || entry.lightbox?.derived !== true
        || entry.lightbox?.loaded !== true
        || !isDerivedPath(entry.lightbox?.selectedPath)
        || entry.preview?.selectedPath === entry.lightbox?.selectedPath
        || entry.previewAndLightboxPathsDiffer !== true
        || entry.lightboxMateriallyLarger !== true
        || entry.navigation?.focusInsideDialog !== true
        || entry.escape?.focusRestoredToOpener !== true
        || entry.escape?.hidden !== true
        || entry.escape?.imageSrc !== null
        || entry.escape?.imageSrcset !== null
        || entry.escape?.activeSourceCandidates !== 0
        || entry.escape?.bodyLightboxClass !== false
        || entry.routeCleanup?.openDialogCount !== 0
        || entry.routeCleanup?.activeSourceCandidates !== 0
        || entry.routeCleanup?.bodyLightboxClass !== false)) {
    findings.push(finding('MEDIA_ROLE_LIGHTBOX', 'Media role and preview/lightbox lifecycle coverage must be 11/11 and 3/3.'));
  }
  const network = doc?.networkInvariants ?? {};
  for (const field of [
    'globalManifestRequests',
    'unexpectedShardIndexRequests',
    'duplicateDownloads',
    'originalSelections',
    'unexpectedUpscaling',
    'duplicateCandidateTransfers',
    'horizontalOverflow',
    'failureCount',
  ]) {
    if (network[field] !== 0) findings.push(finding('MEDIA_NETWORK_INVARIANTS', `${field} must be zero.`));
  }
  if (typeof network.maxCls !== 'number' || network.maxCls > 0.1) {
    findings.push(finding('MEDIA_CLS', 'Maximum CLS must not exceed 0.1.'));
  }
  const audio = doc?.audio ?? {};
  const audioSlugs = Array.from({ length: 12 }, (_, index) => `carmela-s1-${String(index + 1).padStart(2, '0')}`);
  assertExactEvidenceSet(findings, {
    actual: audio.metadata,
    expected: audioSlugs,
    project: (entry) => entry.slug,
    code: 'MEDIA_AUDIO_METADATA',
    item: 'audio.metadata',
  });
  if (audio.metadataPassed !== 12
      || audio.metadataTotal !== 12
      || (audio.metadata ?? []).some((entry) => entry.path !== `public/audio/carmela-s1/${entry.slug}.mp3`
        || typeof entry.title !== 'string'
        || entry.title.length === 0
        || entry.markerCount !== 0
        || typeof entry.markerNote !== 'string'
        || entry.markerNote.length === 0
        || !Number.isFinite(entry.audioLengthSeconds)
        || entry.audioLengthSeconds <= 0
        || entry.paused !== true
        || !Number.isInteger(entry.readyState)
        || entry.readyState < 1)) {
    findings.push(finding('MEDIA_AUDIO_METADATA_DETAIL', 'Audio metadata must bind every slug/path and retain measurable idle metadata without fabricated markers.'));
  }
  assertExactEvidenceSet(findings, {
    actual: audio.httpRanges,
    expected: audioSlugs,
    project: (entry) => entry.slug,
    code: 'MEDIA_AUDIO_RANGES',
    item: 'audio.ranges',
  });
  if ((audio.httpRanges ?? []).some((entry) => entry.statusCode !== 206
      || entry.path !== `public/audio/carmela-s1/${entry.slug}.mp3`
      || entry.contentType !== 'audio/mpeg'
      || entry.acceptRanges !== 'bytes'
      || entry.receivedBytes !== 1024
      || entry.contentRange !== `bytes 0-1023/${entry.expectedFileBytes}`
      || !Number.isInteger(entry.expectedFileBytes)
      || entry.expectedFileBytes <= 1024
      || !isSha256(entry.expectedSliceSha256)
      || entry.expectedSliceSha256 !== entry.receivedSha256
      || entry.markerStatus !== 'NOT_APPLICABLE_NO_RELIABLE_MARKERS')) {
    findings.push(finding('MEDIA_AUDIO_RANGE_SEMANTICS', 'All audio Range records must be exact 1,024-byte HTTP 206 responses.'));
  }
  assertExactEvidenceSet(findings, {
    actual: audio.deepInteractions,
    expected: ['carmela-s1-01', 'carmela-s1-11'],
    project: (entry) => entry.slug,
    code: 'MEDIA_AUDIO_DEEP',
    item: 'audio.deepInteractions',
  });
  if ((audio.deepInteractions ?? []).some((entry) => entry.markerStatus !== 'NOT_APPLICABLE_NO_RELIABLE_MARKERS'
      || entry.initialAudioRequests !== 0
      || entry.route !== `#/book/${entry.slug}/audio`
      || entry.initial?.phase !== 'idle'
      || entry.initial?.preload !== 'none'
      || entry.initial?.src !== null
      || entry.initial?.currentTime !== 0
      || entry.initial?.paused !== true
      || entry.initial?.markerButtons !== 0
      || entry.initial?.noReliableMarkerNote !== true
      || entry.audioAttempts !== 3
      || entry.errorPhase !== 'error'
      || entry.afterRetry?.phase !== 'playing'
      || entry.afterRetry?.srcAttached !== true
      || entry.afterRetry?.paused !== false
      || !Number.isFinite(entry.afterRetry?.audioLengthSeconds)
      || entry.afterRetry.audioLengthSeconds <= 0
      || entry.pausePhase !== 'paused'
      || entry.continuePhase !== 'playing'
      || !Number.isFinite(entry.seek?.difference)
      || Math.abs(entry.seek.difference) > 0.1
      || entry.nearEnd?.seekStatus !== 'SEEKED'
      || entry.endedPhase !== 'ended'
      || entry.replay?.phase !== 'playing'
      || entry.replay?.paused !== false
      || entry.cleanup?.connected !== false
      || entry.cleanup?.srcAttribute !== null
      || entry.cleanup?.activeAudioElements !== 0)) {
    findings.push(finding('MEDIA_AUDIO_LIFECYCLE', 'Deep audio evidence does not prove the accepted lifecycle and teardown.'));
  }
  if (audio.deepPassed !== 2
      || audio.deepTotal !== 2
      || audio.rangePassed !== 12
      || audio.rangeTotal !== 12
      || audio.markerStatus !== 'NOT_APPLICABLE_NO_RELIABLE_MARKERS'
      || audio.status !== 'PASS'
      || (audio.deepInteractions ?? []).some((entry) => entry.freshRoute?.phase !== 'idle'
        || entry.freshRoute?.srcAttribute !== null
        || entry.freshRoute?.currentTime !== 0
        || entry.freshRoute?.paused !== true
        || entry.network?.expectedConsoleErrors !== 1
        || entry.network?.unexpectedConsoleErrors !== 0
        || entry.network?.pageErrors !== 0
        || entry.network?.expectedRequestFailures !== 1
        || entry.network?.unexpectedRequestFailures !== 0
        || entry.network?.requestRanges?.length !== 3
        || entry.network.requestRanges.some((request) => typeof request.range !== 'string'
          || !request.range.startsWith('bytes='))
        || !equalJson(entry.network?.responses?.map((response) => response.status), [503, 206, 206])
        || entry.network?.responses?.[0]?.contentRange !== null
        || !entry.network?.responses?.slice(1).every((response) => /^bytes \d+-\d+\/\d+$/.test(response.contentRange ?? '')))) {
    findings.push(finding('MEDIA_AUDIO_SUMMARY', 'Audio lifecycle and Range summaries must exactly reconcile with all records.'));
  }
  const suffix = audio.suffixRange ?? {};
  if (suffix.status !== 'PASS'
      || suffix.path !== 'public/audio/carmela-s1/carmela-s1-01.mp3'
      || suffix.statusCode !== 206
      || suffix.receivedBytes !== 1024
      || !/^bytes \d+-\d+\/\d+$/.test(suffix.contentRange ?? '')
      || !isSha256(suffix.expectedSliceSha256)
      || suffix.expectedSliceSha256 !== suffix.receivedSha256) {
    findings.push(finding('MEDIA_AUDIO_SUFFIX_RANGE', 'Suffix Range evidence must remain an exact passing 1,024-byte record.'));
  }
  const localHttp = doc?.localHttp ?? {};
  const expectedHttp = {
    exactFilesPassed: 8,
    exactFilesTotal: 8,
    conditionalRequestsPassed: 2,
    conditionalRequestsTotal: 2,
    cachePoliciesPassed: 2,
    cachePoliciesTotal: 2,
    audioRangesPassed: 12,
    audioRangesTotal: 12,
    suffixRangePassed: true,
    missingRoutePassed: true,
    releasePlanInclusionPassed: true,
  };
  if (localHttp.status !== 'PASS'
      || !equalJson(localHttp.summary && Object.fromEntries(
        Object.entries(localHttp.summary).filter(([key]) => key !== 'failureCount'),
      ), expectedHttp)
      || localHttp.summary?.failureCount !== 0
      || localHttp.exactFiles?.length !== 8
      || localHttp.exactFiles?.some((entry) => entry.status !== 'PASS'
        || entry.expectedBytes !== entry.receivedBytes
        || entry.expectedSha256 !== entry.receivedSha256)
      || localHttp.conditionalRequests?.length !== 2
      || localHttp.conditionalRequests?.some((entry) => entry.status !== 'PASS' || entry.statusCode !== 304)
      || localHttp.cachePolicy?.length !== 2
      || localHttp.cachePolicy?.some((entry) => entry.status !== 'PASS')) {
    findings.push(finding('MEDIA_LOCAL_HTTP', 'Local exact-byte, cache, Range, 404 and release-plan HTTP proof is incomplete.'));
  }
  const exactFileByPath = new Map(LIVE_EXACT_FILES.map((entry) => [entry.path, entry]));
  const exactPaths = (localHttp.exactFiles ?? []).map((entry) => entry.path);
  if (!equalJson(sortedUnique(exactPaths), sortedUnique(LIVE_EXACT_FILES.map((entry) => entry.path)))
      || exactPaths.length !== LIVE_EXACT_FILES.length
      || (localHttp.exactFiles ?? []).some((entry) => {
        const expected = exactFileByPath.get(entry.path);
        return !expected
          || entry.statusCode !== 200
          || entry.contentType !== expected.expectedContentType
          || typeof entry.cacheControl !== 'string'
          || entry.cacheControl.length === 0
          || typeof entry.etag !== 'string'
          || entry.etag.length === 0
          || entry.expectedBytes !== expected.bytes
          || entry.receivedBytes !== expected.bytes
          || entry.expectedSha256 !== expected.sha256
          || entry.receivedSha256 !== expected.sha256
          || entry.status !== 'PASS';
      })) {
    findings.push(finding('MEDIA_LOCAL_HTTP_EXACT_SET', 'Local exact HTTP evidence must bind the canonical eight unique files by bytes, SHA-256 and MIME.'));
  }
  const conditionalPaths = [
    'public/media/media-shard-index.json',
    LIVE_EXACT_FILES[5].path,
  ];
  if (!equalJson((localHttp.conditionalRequests ?? []).map((entry) => entry.path), conditionalPaths)
      || (localHttp.conditionalRequests ?? []).some((entry) => entry.statusCode !== 304
        || entry.responseBytes !== 0
        || entry.status !== 'PASS'
        || typeof entry.etag !== 'string'
        || entry.etag.length === 0)
      || !equalJson((localHttp.cachePolicy ?? []).map((entry) => entry.path), conditionalPaths)
      || localHttp.cachePolicy?.[0]?.expectedClass !== 'MUTABLE_SHORT_CACHE'
      || localHttp.cachePolicy?.[0]?.cacheControl !== 'public, max-age=600'
      || localHttp.cachePolicy?.[1]?.expectedClass !== 'IMMUTABLE_CONTENT_ADDRESSED'
      || localHttp.cachePolicy?.[1]?.cacheControl !== 'public, max-age=31536000, immutable'
      || localHttp.suffixRange?.status !== 'PASS'
      || localHttp.suffixRange?.statusCode !== 206
      || localHttp.suffixRange?.receivedBytes !== 1024
      || localHttp.suffixRange?.expectedSliceSha256 !== localHttp.suffixRange?.receivedSha256
      || localHttp.missingRoute?.status !== 'PASS'
      || localHttp.missingRoute?.statusCode !== 404
      || localHttp.releasePlan?.files !== 2857
      || localHttp.releasePlan?.bytes !== 706990045
      || localHttp.releasePlan?.testedPathsIncluded !== true) {
    findings.push(finding('MEDIA_LOCAL_HTTP_SEMANTICS', 'Conditional, cache, suffix Range, 404 and release-plan HTTP semantics must remain exact.'));
  }
  const lighthouse = doc?.lighthouse ?? {};
  const mobile = lighthouse.runs?.find((run) => run.formFactor === 'mobile') ?? {};
  const desktop = lighthouse.runs?.find((run) => run.formFactor === 'desktop') ?? {};
  if (normalizedScore(mobile.performance) < 0.82
      || ['accessibility', 'bestPractices', 'seo'].some((field) => normalizedScore(mobile[field]) !== 1)
      || ['performance', 'accessibility', 'bestPractices', 'seo'].some((field) => normalizedScore(desktop[field]) !== 1)
      || lighthouse.runs?.length !== 2
      || mobile.status !== 'PASS'
      || desktop.status !== 'PASS'
      || mobile.runtimeError !== null
      || desktop.runtimeError !== null
      || lighthouse.status !== 'PASS') {
    findings.push(finding('MEDIA_LIGHTHOUSE', 'Lighthouse must retain accepted mobile and perfect desktop results without runtime errors.'));
  }
  const storage = doc?.storage ?? {};
  if (['serviceWorkerRegistrations', 'localStorageEntries', 'sessionStorageEntries', 'indexedDbDatabases']
    .some((field) => storage[field] !== 0)) {
    findings.push(finding('MEDIA_PRIVATE_STATE', 'Service worker and private browser state counts must remain zero.'));
  }
  return findings;
}

export function validateLivePagesBaselineData(doc) {
  const findings = [];
  if (doc?.schemaVersion !== 1 || doc?.phase !== 'FR-P6') {
    findings.push(finding('LIVE_BASELINE_SCHEMA', 'Live baseline must be FR-P6 schema version 1.'));
  }
  if (doc?.status !== 'PENDING_POST_COMMIT_FINAL_HANDOFF'
      || doc?.resolutionSentinel !== POST_COMMIT_SENTINEL) {
    findings.push(finding('LIVE_BASELINE_TIMING', 'Tracked live baseline must remain pending for post-commit resolution.'));
  }
  const canonical = doc?.canonical ?? {};
  if (canonical.repository !== REPOSITORY
      || canonical.repositoryId !== REPOSITORY_ID
      || canonical.visibility !== 'public'
      || canonical.pagesUrl !== PAGES_URL
      || canonical.defaultBranch !== 'main'
      || canonical.projectSubpath !== '/Family-Reading-Codex/'
      || canonical.acceptanceBaseSha !== P5_MAIN_SHA) {
    findings.push(finding('LIVE_BASELINE_IDENTITY', 'Live baseline canonical identity is incorrect.'));
  }
  if (doc?.localPrecommitExact?.status !== 'PASS') {
    findings.push(finding('LIVE_BASELINE_LOCAL', 'Tracked live baseline must retain passing local exact-byte proof.'));
  }
  const resolution = doc?.postCommitResolution ?? {};
  if (resolution.status !== 'PENDING_POST_COMMIT_FINAL_HANDOFF'
      || resolution.finalMainSha !== POST_COMMIT_SENTINEL
      || resolution.pagesStatus !== POST_COMMIT_SENTINEL
      || resolution.workspaceStatus !== POST_COMMIT_SENTINEL
      || resolution.liveDeploymentVerified !== false
      || resolution.actionsRunId !== null
      || resolution.deploymentId !== null
      || !equalJson(resolution.requiredFields, POST_COMMIT_REQUIRED_FIELDS)) {
    findings.push(finding('LIVE_BASELINE_PREMATURE', 'Tracked baseline must not fabricate post-commit Actions, deployment, Pages or workspace success.'));
  }
  const expectedHttpSemantics = {
    conditional304: true,
    missing404: true,
    immutableDerivativeCache: true,
    mutableResponseCacheObserved: true,
    audioRange206: 12,
    serviceWorkerRegistrations: 0,
    localStorageEntries: 0,
    sessionStorageEntries: 0,
    indexedDbDatabases: 0,
    routeBudgets: 9,
    unexpectedConsoleRequestOverflowErrors: 0,
  };
  if (!equalJson(doc?.requiredActionsChecks, LIVE_ACTION_CHECKS)
      || !equalJson(doc?.requiredLiveRoutes, LIVE_ROUTES)
      || !equalJson(doc?.requiredLiveInteractions, LIVE_INTERACTIONS)
      || !equalJson(doc?.requiredLiveExactFiles, LIVE_EXACT_FILES)
      || !equalJson(doc?.requiredHttpSemantics, LIVE_HTTP_SEMANTICS)
      || !equalJson(doc?.requiredLiveHttpSemantics, expectedHttpSemantics)) {
    findings.push(finding('LIVE_BASELINE_REQUIREMENTS', 'Tracked live handoff requirements are incomplete.'));
  }
  if (doc?.platformObservationBoundary?.cdnGlobalUniformityClaimed !== false
      || doc?.platformObservationBoundary?.multiPopRequiredForPass !== false
      || doc?.platformObservationBoundary?.mutableCacheAndMp3MimeArePlatformControlledObservations !== true) {
    findings.push(finding('LIVE_BASELINE_PLATFORM_BOUNDARY', 'Live baseline must retain bounded CDN/cache/MIME claims.'));
  }
  const local = doc?.localPrecommitExact ?? {};
  const localPaths = (local.exactFiles ?? []).map((entry) => entry.path);
  if (!equalJson(localPaths, LIVE_EXACT_FILES.map((entry) => entry.path))
      || (local.exactFiles ?? []).some((entry) => {
        const expected = LIVE_EXACT_FILES.find((candidate) => candidate.path === entry.path);
        return !expected
          || entry.statusCode !== 200
          || entry.contentType !== expected.expectedContentType
          || entry.bytes !== expected.bytes
          || entry.sha256 !== expected.sha256
          || entry.exactByteMatch !== true
          || entry.exactHashMatch !== true
          || entry.status !== 'PASS';
      })
      || local.conditionalRequests?.length !== 2
      || !equalJson(local.conditionalRequests?.map((entry) => entry.path), [
        'public/media/media-shard-index.json',
        LIVE_EXACT_FILES[5].path,
      ])
      || local.conditionalRequests?.some((entry) => entry.statusCode !== 304
        || entry.responseBytes !== 0
        || entry.status !== 'PASS')
      || local.cachePolicy?.length !== 2
      || !equalJson(local.cachePolicy?.map((entry) => entry.path), [
        'public/media/media-shard-index.json',
        LIVE_EXACT_FILES[5].path,
      ])
      || local.cachePolicy?.[0]?.expectedClass !== 'MUTABLE_SHORT_CACHE'
      || local.cachePolicy?.[0]?.cacheControl !== 'public, max-age=600'
      || local.cachePolicy?.[0]?.status !== 'PASS'
      || local.cachePolicy?.[1]?.expectedClass !== 'IMMUTABLE_CONTENT_ADDRESSED'
      || local.cachePolicy?.[1]?.cacheControl !== 'public, max-age=31536000, immutable'
      || local.cachePolicy?.[1]?.status !== 'PASS'
      || local.audioRanges?.length !== 12
      || local.audioRanges?.some((entry, index) => entry.slug !== `carmela-s1-${String(index + 1).padStart(2, '0')}`
        || entry.path !== `public/audio/carmela-s1/${entry.slug}.mp3`
        || entry.statusCode !== 206
        || entry.contentType !== 'audio/mpeg'
        || entry.acceptRanges !== 'bytes'
        || entry.contentRange !== `bytes 0-1023/${entry.expectedFileBytes}`
        || !Number.isInteger(entry.expectedFileBytes)
        || entry.expectedFileBytes <= 1024
        || entry.receivedBytes !== 1024
        || !isSha256(entry.expectedSliceSha256)
        || entry.expectedSliceSha256 !== entry.receivedSha256
        || entry.status !== 'PASS')
      || local.suffixRange?.status !== 'PASS'
      || local.suffixRange?.path !== 'public/audio/carmela-s1/carmela-s1-01.mp3'
      || local.suffixRange?.statusCode !== 206
      || local.suffixRange?.receivedBytes !== 1024
      || !/^bytes \d+-\d+\/\d+$/.test(local.suffixRange?.contentRange ?? '')
      || !isSha256(local.suffixRange?.expectedSliceSha256)
      || local.suffixRange?.expectedSliceSha256 !== local.suffixRange?.receivedSha256
      || local.missingRoute?.statusCode !== 404
      || local.missingRoute?.status !== 'PASS'
      || local.releasePlan?.files !== 2857
      || local.releasePlan?.bytes !== 706990045
      || local.releasePlan?.testedPathsIncluded !== true
      || !equalJson(local.storage, {
        serviceWorkerRegistrations: 0,
        localStorageEntries: 0,
        sessionStorageEntries: 0,
        indexedDbDatabases: 0,
      })
      || local.summary?.exactFilesPassed !== 8
      || local.summary?.exactFilesTotal !== 8
      || local.summary?.audioRangesPassed !== 12
      || local.summary?.audioRangesTotal !== 12
      || local.summary?.failureCount !== 0) {
    findings.push(finding('LIVE_BASELINE_LOCAL_DETAIL', 'Local precommit exact proof must reconcile the canonical files, Range responses, cache and private-state boundary.'));
  }
  return findings;
}

export function validateRunManifestData(doc, { state, actualBindings } = {}) {
  const findings = [];
  if (doc?.schemaVersion !== 1 || doc?.phase !== 'FR-P6'
      || doc?.status !== 'LOCAL_ACCEPTANCE_PASS_FINAL_GATE_SELF_VALIDATING') {
    findings.push(finding('RUN_MANIFEST_STATUS', 'Run manifest must truthfully represent local acceptance and the enclosing final gate.'));
  }
  if (doc?.repository !== REPOSITORY || doc?.repositoryId !== REPOSITORY_ID || doc?.baseMainSha !== P5_MAIN_SHA) {
    findings.push(finding('RUN_MANIFEST_IDENTITY', 'Run manifest repository/base identity is incorrect.'));
  }
  if (doc?.branch !== 'codex/fr-p6-final-acceptance-project-seal'
      || doc?.rightsStatus !== 'PASS_BY_USER_AUTHORIZATION') {
    findings.push(finding('RUN_MANIFEST_BOUNDARY', 'Run manifest branch and rights boundary are incorrect.'));
  }
  if (doc?.changedPathClassification?.baseClassification !== 'shared-core'
      || doc?.changedPathClassification?.finalFullGateRequired !== true
      || !equalJson(doc?.changedPathClassification?.impacts, ['all-consumers', 'documentation'])) {
    findings.push(finding('RUN_MANIFEST_CLASSIFICATION', 'Run manifest must retain the shared-core final-gate dependency classification.'));
  }
  const expectedCorrections = [
    'Correct the portfolio validator to hash the canonical raw quality-policy object.',
    'Repair Work Cells A4 question-card flow and remove print-only focus-outline artifacts.',
    'Regenerate the exact release plan for the 150-byte application-class increase.',
  ];
  if (doc?.scope?.runtimeChanged !== false
      || doc?.scope?.mediaChanged !== false
      || doc?.scope?.sourceChanged !== false
      || doc?.scope?.productionBehaviorChanged !== true
      || !equalJson(doc?.scope?.productionCorrections, expectedCorrections)) {
    findings.push(finding('RUN_MANIFEST_SCOPE', 'Run manifest must retain the exact bounded production corrections and unchanged runtime/media/Source boundary.'));
  }
  const expectedCurrentTruth = {
    carmelaBooks: 12,
    carmelaAudio: 12,
    workCellsTopics: 27,
    workCellsCategories: 24,
    workCellsStations: 108,
    workCellsQuestions: 162,
    workCellsPageRefs: 286,
    requiredWorkCellsSlugs: ['hemorrhagic-shock', 'cancer-cell', 'cancer-cell-ii'],
    mediaSources: 778,
    mediaVariants: 2735,
    mediaDerivativeBytes: 612770984,
    policyHash: MEDIA_POLICY_HASH,
    releaseFiles: 2857,
    releaseBytes: 706990045,
  };
  if (!equalJson(doc?.currentTruth, expectedCurrentTruth)) {
    findings.push(finding('RUN_MANIFEST_CURRENT_TRUTH', 'Run manifest current content, media and release truth is incorrect.'));
  }
  const evidence = doc?.completedPreGateEvidence ?? {};
  if (!equalJson(evidence.targetedAffectedClosure, {
    passed: 140,
    total: 140,
    status: 'PASS',
    countBasis: 'Current task affected-closure execution after the final artifact freeze and validator hardening.',
  })
      || !equalJson(evidence.candidateSealTests, {
        passed: 10,
        total: 10,
        status: 'PASS',
        countBasis: 'Current FR-P6 seal and final-artifact validator tests.',
      })
      || !equalJson(evidence.contentRoutes, {
        entranceRoutes: { passed: 3, total: 3 },
        carmelaDirectRoutes: { passed: 108, total: 108, books: 12, sections: CARMELA_SECTIONS },
        workCellsDirectRoutes: { passed: 135, total: 135, topics: 27, sections: WORK_CELLS_SECTIONS },
        carmelaMediaParity: { passed: 12, total: 12 },
        invalidRoutes: { passed: 7, total: 7 },
        retryRoutes: { passed: 2, total: 2 },
      })
      || !equalJson(evidence.geometry, { passed: 545, total: 545, status: 'PASS' })
      || !equalJson(evidence.mediaNetwork, {
        srcset: '15/15',
        routeBudgets: '9/9',
        audioMetadata: '12/12',
        audioDeep: '2/2',
        audioRanges: '12/12',
        status: 'PASS',
      })
      || evidence.lighthouse?.status !== 'PASS'
      || evidence.lighthouse?.mobile?.performance !== 82
      || evidence.lighthouse?.mobile?.formFactor !== 'mobile'
      || evidence.lighthouse?.mobile?.route !== LIGHTHOUSE_ROUTE
      || evidence.lighthouse?.mobile?.accessibility !== 100
      || evidence.lighthouse?.mobile?.bestPractices !== 100
      || evidence.lighthouse?.mobile?.seo !== 100
      || evidence.lighthouse?.mobile?.runtimeError !== null
      || evidence.lighthouse?.mobile?.status !== 'PASS'
      || Number.isNaN(Date.parse(evidence.lighthouse?.mobile?.completedAt))
      || evidence.lighthouse?.desktop?.performance !== 100
      || evidence.lighthouse?.desktop?.formFactor !== 'desktop'
      || evidence.lighthouse?.desktop?.route !== LIGHTHOUSE_ROUTE
      || evidence.lighthouse?.desktop?.accessibility !== 100
      || evidence.lighthouse?.desktop?.bestPractices !== 100
      || evidence.lighthouse?.desktop?.seo !== 100
      || evidence.lighthouse?.desktop?.runtimeError !== null
      || evidence.lighthouse?.desktop?.status !== 'PASS'
      || Number.isNaN(Date.parse(evidence.lighthouse?.desktop?.completedAt))
      || !equalJson(evidence.lighthouse?.runs, [
        evidence.lighthouse?.mobile,
        evidence.lighthouse?.desktop,
      ])
      || evidence.localHttp?.exactFilesPassed !== 8
      || evidence.localHttp?.exactFilesTotal !== 8
      || evidence.localHttp?.audioRangesPassed !== 12
      || evidence.localHttp?.audioRangesTotal !== 12
      || evidence.localHttp?.failureCount !== 0
      || evidence.manualVisualReview !== 'PASS'
      || evidence.environmentCapabilities !== 'DOCUMENTED_LIMITATIONS') {
    findings.push(finding('RUN_MANIFEST_PRE_GATE_EVIDENCE', 'Run manifest pre-gate evidence summaries must reconcile the accepted targeted, browser, media and environment results.'));
  }
  const gate = doc?.singleFinalGate ?? {};
  if (gate.command !== 'npm run verify:release'
      || gate.requiredInvocations !== 1
      || gate.trackedState !== 'VALIDATED_ONLY_IF_ENCLOSING_FINAL_GATE_RETURNS_ZERO'
      || gate.expectedFinalTestCount !== P6_FINAL_TEST_COUNT
      || gate.expectedFinalTestCount !== state?.finalTestCount
      || gate.expectedCountBasis !== FINAL_GATE_COUNT_BASIS
      || gate.actualResultRecordedIn !== 'POST_COMMIT_FINAL_HANDOFF') {
    findings.push(finding('RUN_MANIFEST_FINAL_GATE', 'Run manifest must encode exactly one self-validating final release-gate invocation.'));
  }
  const protectedRoots = doc?.protectedSignatures ?? {};
  if (protectedRoots.before?.files !== PROTECTED_SIGNATURE.files
      || protectedRoots.before?.bytes !== PROTECTED_SIGNATURE.bytes
      || protectedRoots.before?.sha256 !== PROTECTED_SIGNATURE.sha256
      || !equalJson(protectedRoots.before, protectedRoots.after)
      || protectedRoots.trackedDiffCount !== 0
      || protectedRoots.status !== 'PASS') {
    findings.push(finding('RUN_MANIFEST_PROTECTED', 'Protected-root before/after signatures must match the accepted invariant.'));
  }
  if (doc?.qualityCompromises !== 0) {
    findings.push(finding('RUN_MANIFEST_QUALITY', 'Run manifest requires qualityCompromises 0.'));
  }
  if (doc?.completedAt !== RUN_COMPLETED_AT || Number.isNaN(Date.parse(doc?.completedAt))) {
    findings.push(finding('RUN_MANIFEST_COMPLETED_AT', 'Run manifest completion timestamp must retain the frozen FR-P6 acceptance time.'));
  }
  const contract = doc?.persistentArtifactContract ?? {};
  if (!equalJson(contract.requiredNarrative, REQUIRED_FINAL_REPORTS.slice(0, 3))
      || !equalJson(contract.requiredMachineReadable, REQUIRED_FINAL_REPORTS.slice(3))
      || !equalJson(contract.canonicalBindings, {
        policyHash: MEDIA_POLICY_HASH,
        manifestSha256: MANIFEST_HASH,
        releasePlanSha256: '7f1076b699d12492594627bb4bdcda51d277625a664dd50558c17678d2fa747d',
        protectedSignatureSha256: PROTECTED_SIGNATURE.sha256,
      })) {
    findings.push(finding('RUN_MANIFEST_CONTRACT', 'Run manifest persistent artifact paths and canonical hashes are incorrect.'));
  }
  const bindings = doc?.artifactBindings;
  const requiredBindingPaths = [
    'reports/portfolio/fr-p6/fr-p6-phase-ledger.json',
    'reports/portfolio/fr-p6/fr-p6-seal-state.json',
    'docs/portfolio/fr-p6/FR-P6-final-acceptance-report.md',
    'docs/portfolio/fr-p6/FR-P6-live-pages-report.md',
    'docs/portfolio/fr-p6/FR-P6-known-limitations.md',
    'reports/portfolio/fr-p6/fr-p6-content-route-baseline.json',
    'reports/portfolio/fr-p6/fr-p6-media-network-baseline.json',
    'reports/portfolio/fr-p6/fr-p6-live-pages-baseline.json',
  ];
  if (!Array.isArray(bindings)
      || !equalJson(sortedUnique(bindings.map((entry) => entry.path)), sortedUnique(requiredBindingPaths))
      || bindings.length !== requiredBindingPaths.length) {
    findings.push(finding('RUN_MANIFEST_BINDINGS', 'Run manifest must bind each non-self-referential final artifact exactly once.'));
  } else if (actualBindings) {
    for (const binding of bindings) {
      const actual = actualBindings.get(binding.path);
      if (!actual || binding.canonicalLfBytes !== actual.canonicalLfBytes || binding.sha256 !== actual.sha256) {
        findings.push(finding('RUN_MANIFEST_BINDING_HASH', 'Artifact binding does not match canonical LF bytes and SHA-256.', binding.path));
      }
    }
  }
  const resolution = doc?.postCommitResolution ?? {};
  if (resolution.status !== 'PENDING_POST_COMMIT_FINAL_HANDOFF'
      || resolution.finalMainSha !== POST_COMMIT_SENTINEL
      || resolution.pagesStatus !== POST_COMMIT_SENTINEL
      || resolution.workspaceStatus !== POST_COMMIT_SENTINEL) {
    findings.push(finding('RUN_MANIFEST_POSTCOMMIT', 'Run manifest must retain post-commit handoff sentinels.'));
  }
  if (!equalJson(doc?.evidenceHygiene, {
    rawHarTracked: false,
    tracesTracked: false,
    browserProfilesTracked: false,
    cookiesTracked: false,
    temporaryPdfTracked: false,
    lighthouseProfilesTracked: false,
    taskScratchTracked: false,
    transientEvidenceMustBeDeletedAtCloseout: true,
  })) {
    findings.push(finding('RUN_MANIFEST_HYGIENE', 'Run manifest must retain the exact tracked/transient evidence hygiene contract.'));
  }
  return findings;
}

function validateFinalMarkdown(repositoryPath, text) {
  const findings = [];
  if (Buffer.byteLength(text, 'utf8') < 100 || !/^# FR-P6\b/m.test(text)) {
    findings.push(finding('FINAL_DOC_SUBSTANCE', 'Final Markdown must be substantive and begin with an FR-P6 H1.', repositoryPath));
  }
  if (/[A-Za-z]:\\|task-scratch|127\.0\.0\.1|localhost|\bTODO\b|\bTBD\b/i.test(text)) {
    findings.push(finding('FINAL_DOC_HYGIENE', 'Final Markdown contains a local path, scratch reference, localhost, or placeholder token.', repositoryPath));
  }
  if (repositoryPath.endsWith('FR-P6-final-acceptance-report.md')) {
    for (const token of ['SEALED', 'MAINTENANCE', 'PASS_BY_USER_AUTHORIZATION', 'SOURCE_PROTECTED_ROOTS_UNCHANGED: VERIFIED', 'QUALITY_COMPROMISES: 0']) {
      if (!text.includes(token)) findings.push(finding('FINAL_DOC_ACCEPTANCE', `Acceptance report must contain ${token}.`, repositoryPath));
    }
  } else if (repositoryPath.endsWith('FR-P6-live-pages-report.md')) {
    if (!text.includes(POST_COMMIT_SENTINEL) || !text.includes('PENDING_POST_COMMIT_FINAL_HANDOFF')
        || text.includes('PAGES_STATUS: VERIFIED')) {
      findings.push(finding('FINAL_DOC_LIVE_TIMING', 'Tracked live report must retain the truthful pending post-commit boundary.', repositoryPath));
    }
  } else if (repositoryPath.endsWith('FR-P6-known-limitations.md')) {
    for (const token of FINAL_DOCUMENTED_LIMITATIONS) {
      if (!text.includes(token)) findings.push(finding('FINAL_DOC_LIMITATIONS', `Known-limitations report must contain ${token}.`, repositoryPath));
    }
  }
  return findings;
}

function canonicalLfEvidence(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return {
    canonicalLfBytes: Buffer.byteLength(normalized, 'utf8'),
    sha256: createHash('sha256').update(normalized, 'utf8').digest('hex'),
  };
}

function extractStatusBlock(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^## ${escaped}\\s*\\r?\\n+[\\s\\S]*?\`\`\`text\\s*\\r?\\n([\\s\\S]*?)\\r?\\n\`\`\``, 'm'));
  if (!match) return null;
  return Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const separator = line.indexOf(':');
    return separator === -1 ? [line.trim(), ''] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));
}

function sumTopicContent(topic) {
  return {
    stations: Array.isArray(topic.bodyScienceStations) ? topic.bodyScienceStations.length : 0,
    questions: Array.isArray(topic.parentQuestionCards) ? topic.parentQuestionCards.length : 0,
    pageRefs: topic.pageRefs && typeof topic.pageRefs === 'object' ? Object.keys(topic.pageRefs).length : 0,
  };
}

export async function validatePortfolioSeal() {
  const findings = [];
  const [
    ledger,
    state,
    readme,
    finalStatus,
    packageJson,
    verifyRelease,
    books,
    topics,
    rawPolicy,
    rawManifest,
  ] = await Promise.all([
    readJson('reports/portfolio/fr-p6/fr-p6-phase-ledger.json'),
    readJson('reports/portfolio/fr-p6/fr-p6-seal-state.json'),
    readText('README.md'),
    readText('docs/portfolio/FR-PORTFOLIO-FINAL-STATUS.md'),
    readJson('package.json'),
    readText('scripts/verify-release.mjs'),
    readJson('public/runtime/carmela/books.json'),
    readJson('public/runtime/work-cells/topics.json'),
    readJson('reports/portfolio/fr-p5/fr-p5-media-quality-policy.json'),
    readJson('public/media/media-manifest.json'),
  ]);
  const finalMode = state.sealState === 'SEALED';
  findings.push(...validatePhaseLedgerData(ledger, { finalMode }));
  findings.push(...validateSealStateData(state));
  const p6 = ledger.phases?.find((phase) => phase.id === 'FR-P6');
  if (finalMode && (p6?.testCount !== state.finalTestCount
      || ledger.currentTruth?.lastCompletedPhase !== state.lastCompletedPhase
      || ledger.currentTruth?.portfolioStatus !== state.portfolioStatus
      || ledger.currentTruth?.projectMode !== state.projectMode
      || ledger.currentTruth?.nextRecommendedPhase !== state.nextRecommendedPhase
      || ledger.repository !== state.repository
      || ledger.repositoryId !== state.repositoryId
      || ledger.currentTruth?.baseMainSha !== state.baseMainSha)) {
    findings.push(finding('SEAL_LEDGER_CROSS_BINDING', 'Ledger and seal state final truth do not agree.'));
  }

  for (const reportPath of REQUIRED_PRIOR_REPORTS) {
    if (!(await exists(reportPath))) findings.push(finding('MISSING_PHASE_REPORT', 'Required historical phase report is missing.', reportPath));
  }
  const finalArtifactPresence = await Promise.all(REQUIRED_FINAL_REPORTS.map((reportPath) => exists(reportPath)));
  if (finalMode) {
    for (let index = 0; index < REQUIRED_FINAL_REPORTS.length; index += 1) {
      if (!finalArtifactPresence[index]) {
        findings.push(finding('MISSING_FINAL_REPORT', 'Required FR-P6 final artifact is missing.', REQUIRED_FINAL_REPORTS[index]));
      }
    }
    if (finalArtifactPresence.every(Boolean)) {
      const [
        acceptanceReport,
        liveReport,
        limitationsReport,
        contentBaseline,
        mediaBaseline,
        liveBaseline,
        runManifest,
      ] = await Promise.all([
        readText(REQUIRED_FINAL_REPORTS[0]),
        readText(REQUIRED_FINAL_REPORTS[1]),
        readText(REQUIRED_FINAL_REPORTS[2]),
        readJson(REQUIRED_FINAL_REPORTS[3]),
        readJson(REQUIRED_FINAL_REPORTS[4]),
        readJson(REQUIRED_FINAL_REPORTS[5]),
        readJson(REQUIRED_FINAL_REPORTS[6]),
      ]);
      findings.push(...validateFinalMarkdown(REQUIRED_FINAL_REPORTS[0], acceptanceReport));
      findings.push(...validateFinalMarkdown(REQUIRED_FINAL_REPORTS[1], liveReport));
      findings.push(...validateFinalMarkdown(REQUIRED_FINAL_REPORTS[2], limitationsReport));
      findings.push(...validateContentRouteBaselineData(contentBaseline, { books, topics }));
      findings.push(...validateMediaNetworkBaselineData(mediaBaseline));
      findings.push(...validateLivePagesBaselineData(liveBaseline));

      const bindingPaths = [
        'reports/portfolio/fr-p6/fr-p6-phase-ledger.json',
        'reports/portfolio/fr-p6/fr-p6-seal-state.json',
        ...REQUIRED_FINAL_REPORTS.slice(0, 6),
      ];
      const bindingTexts = await Promise.all(bindingPaths.map((repositoryPath) => readText(repositoryPath)));
      const actualBindings = new Map(bindingPaths.map((repositoryPath, index) => [
        repositoryPath,
        canonicalLfEvidence(bindingTexts[index]),
      ]));
      findings.push(...validateRunManifestData(runManifest, { state, actualBindings }));
    }
  } else if (finalArtifactPresence.some(Boolean)) {
    findings.push(finding('PROVISIONAL_FINAL_ARTIFACT_TEAR', 'Final artifacts must not coexist with a provisional seal state.'));
  }

  if (!readme.includes(REPOSITORY) || !readme.includes(PAGES_URL)) {
    findings.push(finding('README_IDENTITY', 'README must contain the canonical repository and Pages identities.'));
  }
  if (readme.includes('https://archmays.github.io/Family-Reading/')) {
    findings.push(finding('README_OLD_PAGES', 'README must not contain the old active Pages URL.'));
  }
  if (packageJson.scripts?.['validate:portfolio-seal'] !== 'node scripts/validate-portfolio-seal.mjs') {
    findings.push(finding('PACKAGE_SEAL_SCRIPT', 'package.json must expose the exact portfolio seal command.'));
  }
  const sealStepMatches = [...verifyRelease.matchAll(/args:\s*\['scripts\/validate-portfolio-seal\.mjs'\]/g)];
  const sealStepIndex = verifyRelease.indexOf("args: ['scripts/validate-portfolio-seal.mjs']");
  const testsStepIndex = verifyRelease.indexOf("args: ['scripts/run-tests.mjs']");
  if (sealStepMatches.length !== 1 || sealStepIndex < 0 || testsStepIndex < 0 || sealStepIndex > testsStepIndex) {
    findings.push(finding('RELEASE_GATE_WIRING', 'Release gate must invoke the seal validator exactly once before the full tests.'));
  }

  const expectedStatus = finalMode
    ? {
        PORTFOLIO_STATUS: 'SEALED',
        PROJECT_MODE: 'MAINTENANCE',
        LAST_COMPLETED_PHASE: 'FR-P6',
        NEXT_RECOMMENDED_PHASE: 'NONE',
      }
    : {
        PORTFOLIO_STATUS: 'FR_P6_IN_PROGRESS',
        PROJECT_MODE: 'ACTIVE_DEVELOPMENT',
        LAST_COMPLETED_PHASE: 'FR-P5',
        NEXT_RECOMMENDED_PHASE: 'FR-P6 Final Acceptance and Project Seal',
      };
  for (const [surface, block] of [
    ['README.md', extractStatusBlock(readme, 'Portfolio status')],
    ['docs/portfolio/FR-PORTFOLIO-FINAL-STATUS.md', extractStatusBlock(finalStatus, 'Current status')],
  ]) {
    if (!block || Object.entries(expectedStatus).some(([field, expected]) => block[field] !== expected)) {
      findings.push(finding('STATUS_SURFACE', 'Primary status block does not match the seal state.', surface));
    }
  }

  if (!Array.isArray(books.books) || books.books.length !== 12) {
    findings.push(finding('CARMELA_COUNT', 'Carmela runtime must contain exactly 12 books.'));
  } else if (books.books.some((book) => book.hasAudio !== true)) {
    findings.push(finding('CARMELA_AUDIO', 'All 12 Carmela books must retain audio availability.'));
  }

  if (!Array.isArray(topics.topics) || topics.topics.length !== 27) {
    findings.push(finding('WORK_CELLS_COUNT', 'Work Cells runtime must contain exactly 27 topics.'));
  }
  if (!Array.isArray(topics.categories) || topics.categories.length !== 24) {
    findings.push(finding('WORK_CELLS_CATEGORIES', 'Work Cells runtime must contain exactly 24 categories.'));
  }
  const slugs = new Set((topics.topics ?? []).map((topic) => topic.slug));
  for (const requiredSlug of ['hemorrhagic-shock', 'cancer-cell', 'cancer-cell-ii']) {
    if (!slugs.has(requiredSlug)) findings.push(finding('WORK_CELLS_IDENTITY', 'Required Work Cells identity is missing.', requiredSlug));
  }
  if (slugs.size !== (topics.topics ?? []).length) {
    findings.push(finding('WORK_CELLS_DUPLICATE_SLUG', 'Work Cells topic slugs must be unique.'));
  }

  let stationCount = 0;
  let questionCount = 0;
  let pageRefCount = 0;
  for (const topicSummary of topics.topics ?? []) {
    try {
      const detail = await readJson(topicSummary.detailPath);
      const counts = sumTopicContent(detail);
      stationCount += counts.stations;
      questionCount += counts.questions;
      pageRefCount += counts.pageRefs;
    } catch (error) {
      findings.push(finding('WORK_CELLS_DETAIL', error.message, topicSummary.detailPath));
    }
  }
  if (stationCount !== 108) findings.push(finding('WORK_CELLS_STATIONS', `Expected 108 stations, found ${stationCount}.`));
  if (questionCount !== 162) findings.push(finding('WORK_CELLS_QUESTIONS', `Expected 162 questions, found ${questionCount}.`));
  if (pageRefCount !== 286) findings.push(finding('WORK_CELLS_PAGE_REFS', `Expected 286 page refs, found ${pageRefCount}.`));

  try {
    validateMediaQualityPolicy(rawPolicy);
    const manifest = validateMediaManifest(rawManifest);
    if (manifest.policyHash !== canonicalPolicyHash(rawPolicy)) {
      findings.push(finding('MEDIA_POLICY_HASH', 'Media manifest policy hash does not match the canonical policy.'));
    }
    if (manifest.totals.sources !== 778) findings.push(finding('MEDIA_SOURCES', `Expected 778 media sources, found ${manifest.totals.sources}.`));
    if (manifest.totals.variants !== 2735) findings.push(finding('MEDIA_VARIANTS', `Expected 2735 media variants, found ${manifest.totals.variants}.`));
    if (manifest.totals.derivativeBytes !== 612770984) {
      findings.push(finding('MEDIA_BYTES', `Expected 612770984 derivative bytes, found ${manifest.totals.derivativeBytes}.`));
    }
  } catch (error) {
    findings.push(finding('MEDIA_CURRENT_TRUTH', error.message));
  }

  return { finalMode, findings };
}

const directPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const scriptPath = fileURLToPath(import.meta.url);
const direct = process.platform === 'win32'
  ? directPath.toLocaleLowerCase('en-US') === scriptPath.toLocaleLowerCase('en-US')
  : directPath === scriptPath;

if (direct) {
  const result = await validatePortfolioSeal();
  if (result.findings.length) {
    console.error(`Portfolio seal validation failed with ${result.findings.length} finding(s).`);
    result.findings.forEach((item) => console.error(`[${item.code}] ${item.item ? `${item.item}: ` : ''}${item.message}`));
    process.exitCode = 1;
  } else {
    console.log(`Portfolio seal ${result.finalMode ? 'final' : 'candidate'} validation passed.`);
  }
}
