import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  HISTORICAL_FR_P5_MEDIA_POLICY_PATH,
} from './media-path-policy.mjs';
import {
  canonicalJson,
  canonicalPolicyHash,
  validateMediaQualityPolicy,
} from './media-manifest-policy.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const DERIVED_MEDIA_PATTERN = /(?:^|\/)public\/media\/derived\/.+\.(?:avif|jpe?g|png|webp)$/i;
const SCREENSHOT_PATH_PATTERN = /^(?![A-Za-z]:)(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+\.(?:jpe?g|png|webp)$/i;
const ETAG_PATTERN = /^(?:W\/)?"[^"\r\n]+"$/;
const CONTENT_RANGE_PATTERN = /^bytes \d+-\d+\/\d+$/;
const PROJECT_SUBPATH = '/Family-Reading-Codex/';
const MAX_ACCEPTED_CLS = 0.1;
const PLACEHOLDER_PATTERN = /\b(?:FILL_ME|PLACEHOLDER|TBD|TODO|UNKNOWN)\b|<(?:artifact|bytes|count|id|number|passed|path|sha(?: or [^>]+)?|status|total|url|value)>/i;
const LOCAL_ABSOLUTE_PATH_PATTERN = /(?:^|[\s"'`(])(?:[A-Za-z]:[\\/]|\\\\|\/(?:Users|home|mnt|tmp|var)\/)/;
const optionalCommitShaKeys = new Set([
  'commitSha',
  'deployedSha',
  'exactSha',
  'finalMainSha',
  'liveSha',
  'pagesSha',
]);

export const FR_P5_SRCSET_CASES = Object.freeze([
  Object.freeze({ viewportWidth: 390, dpr: 1 }),
  Object.freeze({ viewportWidth: 390, dpr: 2 }),
  Object.freeze({ viewportWidth: 430, dpr: 1 }),
  Object.freeze({ viewportWidth: 430, dpr: 2 }),
  Object.freeze({ viewportWidth: 768, dpr: 1 }),
  Object.freeze({ viewportWidth: 768, dpr: 2 }),
  Object.freeze({ viewportWidth: 1024, dpr: 1 }),
  Object.freeze({ viewportWidth: 1024, dpr: 2 }),
  Object.freeze({ viewportWidth: 1280, dpr: 1 }),
  Object.freeze({ viewportWidth: 1280, dpr: 1.5 }),
  Object.freeze({ viewportWidth: 1280, dpr: 2 }),
  Object.freeze({ viewportWidth: 1440, dpr: 1 }),
  Object.freeze({ viewportWidth: 1440, dpr: 2 }),
  Object.freeze({ viewportWidth: 1088, dpr: 2 }),
  Object.freeze({ viewportWidth: 1089, dpr: 2 }),
]);

export const FR_P5_ROUTE_INVARIANTS = Object.freeze([
  'originalSelections',
  'globalManifestRequests',
  'unexpectedShardIndexRequests',
  'unexpectedUpscaling',
  'requestFailures',
  'consoleErrors',
  'horizontalOverflow',
]);

export const FR_P5_VISUAL_STATUS_KEYS = Object.freeze([
  'interaction',
  'a11y',
  'mode',
  'lightbox',
  'previewDetail',
]);

export const FR_P5_VISUAL_QUALITY_CHECK_KEYS = Object.freeze([
  'textReadability',
  'crop',
  'rotation',
  'alpha',
  'color',
  'lineEdges',
  'blur',
  'lightboxClarity',
]);

export const FR_P5_A11Y_CHECK_KEYS = Object.freeze([
  'keyboard',
  'focus',
  'aria',
  'reducedMotion',
  'forcedColors',
  'textSpacing',
  'reflow',
  'shortLandscape',
  'print',
  'audio',
]);

export const FR_P5_FINAL_EVIDENCE_PATHS = Object.freeze({
  policy: HISTORICAL_FR_P5_MEDIA_POLICY_PATH,
  routeNetwork: 'reports/portfolio/fr-p5/fr-p5-route-network-baseline.json',
  visualQuality: 'reports/portfolio/fr-p5/fr-p5-visual-quality-baseline.json',
  pagesPerformance: 'reports/portfolio/fr-p5/fr-p5-pages-performance-baseline.json',
  runManifest: 'reports/portfolio/fr-p5/fr-p5-run-manifest.json',
});

export const FR_P5_REQUIRED_DOC_PATHS = Object.freeze([
  'docs/portfolio/fr-p5/FR-P5-media-inventory-report.md',
  'docs/portfolio/fr-p5/FR-P5-quality-policy-acceptance.md',
  'docs/portfolio/fr-p5/FR-P5-derivative-generation-report.md',
  'docs/portfolio/fr-p5/FR-P5-browser-visual-network-report.md',
  'docs/portfolio/fr-p5/FR-P5-build-pages-performance-report.md',
  'docs/portfolio/fr-p5/FR-P5-final-report.md',
]);

export const FR_P5_VISUAL_REQUIREMENTS = Object.freeze({
  content: Object.freeze({
    carmelaBooks: 12,
    workCellsTopics: 27,
    scienceStations: 108,
    questions: 162,
    pageReferences: 286,
    audioTracks: 12,
  }),
  roleSamples: Object.freeze([
    'cover',
    'explanation',
    'hero',
    'lightbox',
    'preview',
    'textHeavyManga',
  ]),
  viewports: Object.freeze([
    '390x844',
    '773x709',
    '1088x400',
    '1089x400',
  ]),
  zeroFindings: Object.freeze([
    'heroOverlap',
    'horizontalOverflow',
    'clippedText',
    'brokenMedia',
  ]),
});

export const FR_P5_GEOMETRY_PHASE_COUNTS = Object.freeze({
  'continuous-width': 469,
  'named-viewport': 14,
  'topic-endpoint': 54,
  'zoom-equivalent': 8,
});

export const FR_P5_GEOMETRY_CONTINUOUS_WIDTHS = Object.freeze([
  320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672,
  680, 696, 704, 712, 728, 736, 744, 760, 768, 776, 792, 800,
  808, 824, 832, 840, 856, 864, 872, 888, 896, 904, 920, 928,
  936, 952, 960, 968, 984, 992, 1000, 1016, 1024, 1032, 1048,
  1056, 1064, 1080, 1087, 1088, 1089, 1090, 1096, 1112, 1120,
  1152, 1184, 1216, 1248, 1280, 1312, 1344, 1376, 1408, 1440,
]);

const FR_P5_GEOMETRY_NAMED_VIEWPORTS = Object.freeze([
  '773x709',
  '1024x400',
  '900x500',
  '844x390',
  '800x450',
  '768x1024',
  '667x375',
  '430x932',
  '390x844',
  '1280x720',
  '1440x900',
  '1088x400',
  '1089x400',
  '1089x481',
]);

const FR_P5_GEOMETRY_TOPIC_ENDPOINTS = Object.freeze([
  '390x844',
  '1280x720',
]);

const FR_P5_GEOMETRY_ZOOM_SCALES = Object.freeze([
  80, 90, 100, 110, 125, 150, 175, 200,
]);

function addFinding(findings, code, message, item = '') {
  findings.push({ code, message, item });
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeRepositoryPath(value) {
  if (!isNonEmptyString(value)
    || value.includes('\\')
    || value.startsWith('/')
    || /^[A-Za-z]:/.test(value)) return false;
  const segments = value.split('/');
  return segments.every((segment) => segment && segment !== '.' && segment !== '..');
}

function isRealSha256(value) {
  const hash = String(value ?? '');
  return HASH_PATTERN.test(hash) && !/^([a-f0-9])\1{63}$/.test(hash);
}

function isRealCommitSha(value) {
  const sha = String(value ?? '');
  return COMMIT_SHA_PATTERN.test(sha) && !/^([a-f0-9])\1{39}$/i.test(sha);
}

function currentSrcPath(value) {
  if (!isNonEmptyString(value)) return '';
  try {
    return new URL(value).pathname.replace(/^\/+/, '');
  } catch {
    return value.split(/[?#]/, 1)[0].replace(/\\/g, '/').replace(/^\/+/, '');
  }
}

function isDerivedCurrentSrc(value) {
  return DERIVED_MEDIA_PATTERN.test(currentSrcPath(value));
}

function derivedRepositoryPath(value) {
  const normalized = currentSrcPath(value);
  const index = normalized.indexOf('public/media/derived/');
  return index >= 0 ? normalized.slice(index) : '';
}

function srcsetCaseKey(viewportWidth, dpr) {
  return `${viewportWidth}@${dpr}`;
}

function nearlyEqual(left, right, tolerance) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}

function validateOptionalCommitShas(value, findings, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateOptionalCommitShas(item, findings, `${location}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    if (optionalCommitShaKeys.has(key) && !isRealCommitSha(child)) {
      addFinding(
        findings,
        'FINAL_EVIDENCE_COMMIT_SHA_INVALID',
        'Final/live SHA fields are optional before commit, but any present value must be a real 40-hex commit SHA.',
        childLocation,
      );
    }
    validateOptionalCommitShas(child, findings, childLocation);
  }
}

function validateEvidenceHeader(document, {
  label,
  expectedPolicyHash,
  findings,
}) {
  if (!isObject(document)) {
    addFinding(findings, 'FINAL_EVIDENCE_DOCUMENT_INVALID', `${label} must be a JSON object.`, label);
    return false;
  }
  if (document.schemaVersion !== 1) {
    addFinding(
      findings,
      'FINAL_EVIDENCE_SCHEMA_INVALID',
      `${label} schemaVersion must be 1.`,
      label,
    );
  }
  if (document.status !== 'PASS') {
    addFinding(
      findings,
      'FINAL_EVIDENCE_STATUS_INVALID',
      `${label} status must be PASS.`,
      label,
    );
  }
  if (!HASH_PATTERN.test(String(document.policyHash ?? '')) || document.policyHash !== expectedPolicyHash) {
    addFinding(
      findings,
      'FINAL_EVIDENCE_POLICY_HASH_MISMATCH',
      `${label} policyHash must equal the canonical accepted policy hash.`,
      label,
    );
  }
  validateOptionalCommitShas(document, findings, label);
  return true;
}

function validateSelectedCurrentSrc(records, findings, location) {
  if (!Array.isArray(records) || records.length === 0) {
    addFinding(
      findings,
      'ROUTE_NETWORK_CURRENT_SRC_INVALID',
      'selectedCurrentSrc must contain at least one measured record.',
      location,
    );
    return;
  }
  const identities = new Set();
  for (const [index, record] of records.entries()) {
    const item = `${location}[${index}]`;
    if (!isObject(record)) {
      addFinding(findings, 'ROUTE_NETWORK_CURRENT_SRC_INVALID', 'currentSrc records must be objects.', item);
      continue;
    }
    if (record.status !== 'PASS') {
      addFinding(findings, 'ROUTE_NETWORK_CURRENT_SRC_STATUS_INVALID', 'currentSrc record status must be PASS.', item);
    }
    if (!isNonEmptyString(record.role)) {
      addFinding(findings, 'ROUTE_NETWORK_CURRENT_SRC_ROLE_INVALID', 'currentSrc record role is required.', item);
    }
    if (!isDerivedCurrentSrc(record.currentSrc)) {
      addFinding(
        findings,
        'ROUTE_NETWORK_CURRENT_SRC_NOT_DERIVED',
        'Every selected currentSrc must resolve under public/media/derived.',
        item,
      );
    }
    const identity = `${record.role}\0${record.currentSrc}`;
    if (identities.has(identity)) {
      addFinding(findings, 'ROUTE_NETWORK_CURRENT_SRC_DUPLICATE', 'currentSrc records must be unique.', item);
    }
    identities.add(identity);
  }
}

function validateRouteMeasurement(measurement, phase, findings, location) {
  if (!isObject(measurement)) {
    addFinding(
      findings,
      'ROUTE_NETWORK_MEASUREMENT_INVALID',
      `Every route requires a ${phase} measurement object.`,
      location,
    );
    return;
  }
  if (measurement.status !== 'PASS') {
    addFinding(
      findings,
      'ROUTE_NETWORK_MEASUREMENT_STATUS_INVALID',
      `${phase} measurement status must be PASS.`,
      location,
    );
  }
  const integerFields = [
    'requests',
    'jsonBytes',
    'imageBytes',
    'audioBytes',
    'otherBytes',
    'totalTransferBytes',
    'cacheHits',
    'shardIndexRequests',
    'ownerShardRequests',
  ];
  for (const key of integerFields) {
    const valid = phase === 'cold' && key === 'totalTransferBytes'
      ? isPositiveInteger(measurement[key])
      : isNonNegativeInteger(measurement[key]);
    if (!valid) {
      addFinding(
        findings,
        'ROUTE_NETWORK_MEASUREMENT_VALUE_INVALID',
        `${phase}.${key} must be ${phase === 'cold' && key === 'totalTransferBytes' ? 'a positive' : 'a non-negative'} integer.`,
        `${location}.${key}`,
      );
    }
  }
  const expectedShardRequests = phase === 'cold' ? 1 : 0;
  for (const key of ['shardIndexRequests', 'ownerShardRequests']) {
    if (measurement[key] !== expectedShardRequests) {
      addFinding(
        findings,
        'ROUTE_NETWORK_SHARD_REQUEST_COUNT_INVALID',
        `${phase}.${key} must be exactly ${expectedShardRequests}.`,
        `${location}.${key}`,
      );
    }
  }
  if (isNonNegativeInteger(measurement.requests)
    && measurement.requests < measurement.shardIndexRequests + measurement.ownerShardRequests) {
    addFinding(
      findings,
      'ROUTE_NETWORK_REQUEST_COUNT_INCONSISTENT',
      `${phase}.requests cannot be lower than its index and owner-shard request count.`,
      `${location}.requests`,
    );
  }
  if (phase === 'cold'
    && (!isPositiveInteger(measurement.requests) || measurement.cacheHits !== 0)) {
    addFinding(
      findings,
      'ROUTE_NETWORK_COLD_CACHE_STATE_INVALID',
      'A cold load must record positive requests and exactly zero cache hits.',
      location,
    );
  }
  if (phase === 'warm'
    && (!isPositiveInteger(measurement.requests) || !isPositiveInteger(measurement.cacheHits))) {
    addFinding(
      findings,
      'ROUTE_NETWORK_WARM_CACHE_PROOF_MISSING',
      'A warm reload must record positive requests and at least one cache hit, even when transfer bytes are zero.',
      location,
    );
  }
  if (isNonNegativeInteger(measurement.totalTransferBytes)) {
    const categorizedBytes = ['jsonBytes', 'imageBytes', 'audioBytes', 'otherBytes']
      .map((key) => measurement[key])
      .filter(isNonNegativeInteger)
      .reduce((total, value) => total + value, 0);
    if (categorizedBytes !== measurement.totalTransferBytes) {
      addFinding(
        findings,
        'ROUTE_NETWORK_TOTAL_BYTES_INCONSISTENT',
        `${phase}.totalTransferBytes must equal its JSON, image, audio and other byte breakdown.`,
        `${location}.totalTransferBytes`,
      );
    }
  }
  if (!isObject(measurement.lcp)
    || !isNonEmptyString(measurement.lcp.path)
    || !(phase === 'cold' ? isPositiveInteger(measurement.lcp.bytes) : isNonNegativeInteger(measurement.lcp.bytes))) {
    addFinding(
      findings,
      'ROUTE_NETWORK_LCP_INVALID',
      `${phase}.lcp must record a non-empty path and ${phase === 'cold' ? 'positive' : 'non-negative'} integer bytes.`,
      `${location}.lcp`,
    );
  }
  if (!isNonNegativeFiniteNumber(measurement.cls) || measurement.cls > MAX_ACCEPTED_CLS) {
    addFinding(
      findings,
      'ROUTE_NETWORK_CLS_INVALID',
      `${phase}.cls must be finite, non-negative and no greater than ${MAX_ACCEPTED_CLS}.`,
      `${location}.cls`,
    );
  }
  if (measurement.duplicateDownloads !== 0) {
    addFinding(
      findings,
      'ROUTE_NETWORK_DUPLICATE_DOWNLOADS',
      `${phase}.duplicateDownloads must be exactly zero.`,
      `${location}.duplicateDownloads`,
    );
  }
  validateSelectedCurrentSrc(measurement.selectedCurrentSrc, findings, `${location}.selectedCurrentSrc`);
}

function validateRouteIntegrity(integrity, findings, location) {
  if (!isObject(integrity)) {
    addFinding(
      findings,
      'ROUTE_NETWORK_INTEGRITY_INVALID',
      'Every route requires index and owner-shard integrity evidence.',
      location,
    );
    return;
  }
  if (!isObject(integrity.index)
    || integrity.index.status !== 'PASS'
    || integrity.index.canonicalManifestShaMatch !== true) {
    addFinding(
      findings,
      'ROUTE_NETWORK_INDEX_INTEGRITY_INVALID',
      'integrity.index must be PASS with canonicalManifestShaMatch true.',
      `${location}.index`,
    );
  }
  if (!isObject(integrity.ownerShard)
    || integrity.ownerShard.status !== 'PASS'
    || integrity.ownerShard.bodyHashMatch !== true) {
    addFinding(
      findings,
      'ROUTE_NETWORK_OWNER_SHARD_INTEGRITY_INVALID',
      'integrity.ownerShard must be PASS with bodyHashMatch true.',
      `${location}.ownerShard`,
    );
  }
}

function validateSrcsetMatrix(matrix, findings) {
  const location = 'route-network baseline.srcsetMatrix';
  if (!Array.isArray(matrix)) {
    addFinding(findings, 'SRCSET_MATRIX_INVALID', 'srcsetMatrix must be an array.', location);
    return;
  }
  if (matrix.length !== FR_P5_SRCSET_CASES.length) {
    addFinding(
      findings,
      'SRCSET_MATRIX_CASE_COUNT_INVALID',
      `srcsetMatrix must contain exactly ${FR_P5_SRCSET_CASES.length} cases.`,
      location,
    );
  }

  const requiredKeys = new Set(FR_P5_SRCSET_CASES.map(({ viewportWidth, dpr }) => (
    srcsetCaseKey(viewportWidth, dpr)
  )));
  const measuredKeys = new Set();
  for (const [index, record] of matrix.entries()) {
    const item = `${location}[${index}]`;
    if (!isObject(record)) {
      addFinding(findings, 'SRCSET_MATRIX_RECORD_INVALID', 'Every srcset matrix record must be an object.', item);
      continue;
    }
    const key = srcsetCaseKey(record.viewportWidth, record.dpr);
    if (!requiredKeys.has(key)) {
      addFinding(
        findings,
        'SRCSET_MATRIX_CASE_UNEXPECTED',
        `Unexpected srcset matrix case ${key}.`,
        item,
      );
    }
    if (measuredKeys.has(key)) {
      addFinding(findings, 'SRCSET_MATRIX_CASE_DUPLICATE', `Duplicate srcset matrix case ${key}.`, item);
    }
    measuredKeys.add(key);
    if (record.status !== 'PASS') {
      addFinding(findings, 'SRCSET_MATRIX_STATUS_INVALID', 'srcset matrix record status must be PASS.', item);
    }
    if (!isDerivedCurrentSrc(record.currentSrc)) {
      addFinding(
        findings,
        'SRCSET_MATRIX_CURRENT_SRC_NOT_DERIVED',
        'srcset matrix currentSrc must resolve under public/media/derived.',
        `${item}.currentSrc`,
      );
    }
    if (!isNonEmptyString(record.selectedProfileId)) {
      addFinding(
        findings,
        'SRCSET_MATRIX_PROFILE_INVALID',
        'selectedProfileId must be a non-empty manifest profile id.',
        `${item}.selectedProfileId`,
      );
    }
    if (!isDerivedCurrentSrc(record.selectedPath)
      || derivedRepositoryPath(record.selectedPath) !== derivedRepositoryPath(record.currentSrc)) {
      addFinding(
        findings,
        'SRCSET_MATRIX_SELECTED_PATH_MISMATCH',
        'selectedPath must be derived and match the repository path selected by currentSrc.',
        `${item}.selectedPath`,
      );
    }
    if (!isPositiveInteger(record.selectedVariantWidth)
      || !isPositiveInteger(record.selectedVariantHeight)) {
      addFinding(
        findings,
        'SRCSET_MATRIX_VARIANT_WIDTH_INVALID',
        'selectedVariantWidth and selectedVariantHeight must be positive integers.',
        item,
      );
    }
    if (!isPositiveInteger(record.transferBytes)
      || !isPositiveInteger(record.resourceBytes)
      || record.transferBytes < record.resourceBytes
      || record.cacheState !== 'NETWORK_MISS') {
      addFinding(
        findings,
        'SRCSET_MATRIX_TRANSFER_INVALID',
        'Wire transferBytes must be >= positive resourceBytes and cacheState must be NETWORK_MISS.',
        item,
      );
    }
    if (!isPositiveFiniteNumber(record.renderedWidth)
      || !isPositiveFiniteNumber(record.renderedHeight)
      || !isPositiveFiniteNumber(record.naturalWidth)
      || !isPositiveFiniteNumber(record.naturalHeight)
      || !isPositiveFiniteNumber(record.dpr)) {
      addFinding(
        findings,
        'SRCSET_MATRIX_RENDERED_GEOMETRY_INVALID',
        'naturalWidth/naturalHeight, renderedWidth/renderedHeight and DPR must be positive finite numbers.',
        item,
      );
    } else {
      if (record.naturalWidth !== record.selectedVariantWidth
        || record.naturalHeight !== record.selectedVariantHeight) {
        addFinding(
          findings,
          'SRCSET_MATRIX_NATURAL_DIMENSIONS_MISMATCH',
          'naturalWidth/naturalHeight must equal the decoded selected variant pixel dimensions.',
          item,
        );
      }
      if (record.renderedBox !== 'OBJECT_FIT_CONTENT_BOX') {
        addFinding(
          findings,
          'SRCSET_MATRIX_RENDERED_BOX_INVALID',
          'renderedWidth/renderedHeight must be measured from the OBJECT_FIT_CONTENT_BOX.',
          `${item}.renderedBox`,
        );
      }
      const naturalAspect = record.naturalWidth / record.naturalHeight;
      const renderedAspect = record.renderedWidth / record.renderedHeight;
      if (!nearlyEqual(naturalAspect, renderedAspect, 0.01)) {
        addFinding(
          findings,
          'SRCSET_MATRIX_ASPECT_RATIO_MISMATCH',
          'Natural and rendered dimensions must preserve the same aspect ratio.',
          item,
        );
      }
    }
    if (!isPositiveFiniteNumber(record.requiredPixelWidth)) {
      addFinding(
        findings,
        'SRCSET_MATRIX_REQUIRED_WIDTH_INVALID',
        'requiredPixelWidth must be a positive finite number.',
        `${item}.requiredPixelWidth`,
      );
    } else if (isPositiveFiniteNumber(record.renderedWidth) && isPositiveFiniteNumber(record.dpr)) {
      const expectedRequiredWidth = record.renderedWidth * record.dpr;
      const tolerance = Math.max(0.01, expectedRequiredWidth * 0.000001);
      if (!nearlyEqual(record.requiredPixelWidth, expectedRequiredWidth, tolerance)) {
        addFinding(
          findings,
          'SRCSET_MATRIX_REQUIRED_WIDTH_MISMATCH',
          'requiredPixelWidth must equal renderedWidth multiplied by DPR.',
          `${item}.requiredPixelWidth`,
        );
      }
    }
    if (!isPositiveFiniteNumber(record.upscalingRatio) || record.upscalingRatio > 1.01) {
      addFinding(
        findings,
        'SRCSET_MATRIX_UPSCALING_INVALID',
        'upscalingRatio must be positive and no greater than 1.01.',
        `${item}.upscalingRatio`,
      );
    } else if (isPositiveFiniteNumber(record.requiredPixelWidth)
      && isPositiveInteger(record.selectedVariantWidth)
      && !nearlyEqual(
        record.upscalingRatio,
        record.requiredPixelWidth / record.selectedVariantWidth,
        0.01,
      )) {
      addFinding(
        findings,
        'SRCSET_MATRIX_UPSCALING_RATIO_MISMATCH',
        'upscalingRatio must agree with requiredPixelWidth divided by selectedVariantWidth.',
        `${item}.upscalingRatio`,
      );
    }
    if (record.transferredCandidates !== 1) {
      addFinding(
        findings,
        'SRCSET_MATRIX_TRANSFER_COUNT_INVALID',
        'transferredCandidates must be exactly one.',
        `${item}.transferredCandidates`,
      );
    }
    if (record.dimensionsTruthful !== true) {
      addFinding(
        findings,
        'SRCSET_MATRIX_DIMENSIONS_UNTRUTHFUL',
        'dimensionsTruthful must be true.',
        `${item}.dimensionsTruthful`,
      );
    }
  }
  for (const requiredKey of requiredKeys) {
    if (!measuredKeys.has(requiredKey)) {
      addFinding(
        findings,
        'SRCSET_MATRIX_CASE_MISSING',
        `Missing required srcset matrix case ${requiredKey}.`,
        location,
      );
    }
  }
}

function validateRouteInvariants(invariants, findings) {
  const location = 'route-network baseline.invariants';
  if (!isObject(invariants)) {
    addFinding(findings, 'ROUTE_NETWORK_INVARIANTS_INVALID', 'invariants must be an object.', location);
    return;
  }
  for (const key of FR_P5_ROUTE_INVARIANTS) {
    if (invariants[key] !== 0) {
      addFinding(
        findings,
        'ROUTE_NETWORK_INVARIANT_NONZERO',
        `Route invariant ${key} must be exactly zero.`,
        `${location}.${key}`,
      );
    }
  }
}

function validateLighthouse(lighthouse, findings) {
  const location = 'route-network baseline.lighthouse';
  if (!isObject(lighthouse)) {
    addFinding(
      findings,
      'LIGHTHOUSE_EVIDENCE_INVALID',
      'lighthouse must be a PASS measurement or explicit DOCUMENTED_LIMITATION.',
      location,
    );
    return null;
  }
  if (lighthouse.status === 'DOCUMENTED_LIMITATION') {
    if (!isNonEmptyString(lighthouse.reason)
      || /^(?:n\/?a|none|placeholder|todo|tbd)$/i.test(lighthouse.reason.trim())
      || !isPositiveInteger(lighthouse.boundedAttempts)
      || lighthouse.routeNetworkHardBudgetsPrimary !== true) {
      addFinding(
        findings,
        'LIGHTHOUSE_LIMITATION_INVALID',
        'A Lighthouse limitation requires a concrete reason, positive boundedAttempts and routeNetworkHardBudgetsPrimary true.',
        location,
      );
    }
    return lighthouse.status;
  }
  if (lighthouse.status !== 'PASS') {
    addFinding(
      findings,
      'LIGHTHOUSE_STATUS_INVALID',
      'lighthouse.status must be PASS or DOCUMENTED_LIMITATION.',
      `${location}.status`,
    );
    return lighthouse.status ?? null;
  }
  if (!Array.isArray(lighthouse.runs) || lighthouse.runs.length < 2) {
    addFinding(
      findings,
      'LIGHTHOUSE_RUNS_INVALID',
      'A Lighthouse PASS requires mobile and desktop run records.',
      `${location}.runs`,
    );
    return lighthouse.status;
  }
  const formFactors = new Set();
  for (const [index, run] of lighthouse.runs.entries()) {
    const item = `${location}.runs[${index}]`;
    if (!isObject(run)) {
      addFinding(findings, 'LIGHTHOUSE_RUN_INVALID', 'Every Lighthouse run must be an object.', item);
      continue;
    }
    if (run.status !== 'PASS') {
      addFinding(findings, 'LIGHTHOUSE_RUN_STATUS_INVALID', 'Every Lighthouse run status must be PASS.', item);
    }
    if (!['mobile', 'desktop'].includes(run.formFactor)) {
      addFinding(
        findings,
        'LIGHTHOUSE_FORM_FACTOR_INVALID',
        'Lighthouse formFactor must be mobile or desktop.',
        `${item}.formFactor`,
      );
    } else {
      formFactors.add(run.formFactor);
    }
    if (!isNonEmptyString(run.route) || !run.route.startsWith('#/')) {
      addFinding(findings, 'LIGHTHOUSE_ROUTE_INVALID', 'Lighthouse route must be a #/ route.', `${item}.route`);
    }
    for (const key of ['performance', 'accessibility', 'bestPractices', 'seo']) {
      if (!isNonNegativeFiniteNumber(run[key]) || run[key] > 100) {
        addFinding(
          findings,
          'LIGHTHOUSE_SCORE_INVALID',
          `Lighthouse ${key} must be a finite score from 0 to 100.`,
          `${item}.${key}`,
        );
      }
    }
  }
  for (const formFactor of ['mobile', 'desktop']) {
    if (!formFactors.has(formFactor)) {
      addFinding(
        findings,
        'LIGHTHOUSE_FORM_FACTOR_MISSING',
        `Lighthouse PASS is missing a ${formFactor} run.`,
        `${location}.runs`,
      );
    }
  }
  return lighthouse.status;
}

function validateRouteNetwork(document, policy, expectedPolicyHash, findings) {
  if (!validateEvidenceHeader(document, {
    label: 'route-network baseline',
    expectedPolicyHash,
    findings,
  })) return;

  const routes = Array.isArray(document.routes) ? document.routes : [];
  if (!Array.isArray(document.routes)) {
    addFinding(
      findings,
      'ROUTE_NETWORK_ROUTES_INVALID',
      'route-network baseline routes must be an array.',
      'route-network baseline.routes',
    );
  }

  const routesById = new Map();
  for (const [index, record] of routes.entries()) {
    const item = `route-network baseline.routes[${index}]`;
    if (!isObject(record) || typeof record.route !== 'string' || !record.route.startsWith('#/')) {
      addFinding(findings, 'ROUTE_NETWORK_ROUTE_INVALID', 'Every route record must declare a #/ route.', item);
      continue;
    }
    if (routesById.has(record.route)) {
      addFinding(
        findings,
        'ROUTE_NETWORK_ROUTE_DUPLICATE',
        `Route evidence must be unique for ${record.route}.`,
        item,
      );
    } else {
      routesById.set(record.route, record);
    }
    if (record.status !== 'PASS') {
      addFinding(findings, 'ROUTE_NETWORK_ROUTE_STATUS_INVALID', 'Every route status must be PASS.', item);
    }
    validateRouteMeasurement(record.cold, 'cold', findings, `${item}.cold`);
    validateRouteMeasurement(record.warm, 'warm', findings, `${item}.warm`);
    validateRouteIntegrity(record.integrity, findings, `${item}.integrity`);
  }

  for (const [route, budgetBytes] of Object.entries(policy.budgets.routeTransferBytes)) {
    const record = routesById.get(route);
    if (!record) {
      addFinding(
        findings,
        'ROUTE_NETWORK_BUDGET_ROUTE_MISSING',
        `Missing cold and warm network evidence for frozen route budget ${route}.`,
        route,
      );
      continue;
    }
    const measuredBytes = record.cold?.totalTransferBytes;
    if (isPositiveInteger(measuredBytes) && measuredBytes > budgetBytes) {
      addFinding(
        findings,
        'ROUTE_NETWORK_BUDGET_EXCEEDED',
        `${route} cold transfer exceeds its frozen budget (${measuredBytes} > ${budgetBytes} bytes).`,
        route,
      );
    }
  }
  validateSrcsetMatrix(document.srcsetMatrix, findings);
  validateRouteInvariants(document.invariants, findings);
  return validateLighthouse(document.lighthouse, findings);
}

function validateVisualScreenshots(screenshots, findings) {
  const location = 'visual-quality baseline.screenshots';
  const roleCounts = new Map(FR_P5_VISUAL_REQUIREMENTS.roleSamples.map((role) => [role, 0]));
  if (!Array.isArray(screenshots) || screenshots.length === 0) {
    addFinding(
      findings,
      'VISUAL_SCREENSHOTS_INVALID',
      'screenshots must contain real role-sampled screenshot records.',
      location,
    );
    return roleCounts;
  }

  const ids = new Set();
  const hashes = new Set();
  for (const [index, screenshot] of screenshots.entries()) {
    const item = `${location}[${index}]`;
    if (!isObject(screenshot)) {
      addFinding(findings, 'VISUAL_SCREENSHOT_RECORD_INVALID', 'Every screenshot record must be an object.', item);
      continue;
    }
    if (screenshot.status !== 'PASS') {
      addFinding(findings, 'VISUAL_SCREENSHOT_STATUS_INVALID', 'Screenshot record status must be PASS.', item);
    }
    if (!isNonEmptyString(screenshot.id) || ids.has(screenshot.id)) {
      addFinding(
        findings,
        'VISUAL_SCREENSHOT_ID_INVALID',
        'Screenshot id must be non-empty and unique.',
        `${item}.id`,
      );
    } else {
      ids.add(screenshot.id);
    }
    if (!SCREENSHOT_PATH_PATTERN.test(String(screenshot.path ?? ''))) {
      addFinding(
        findings,
        'VISUAL_SCREENSHOT_PATH_INVALID',
        'Screenshot path must be a safe repository-relative image path.',
        `${item}.path`,
      );
    }
    if (!isRealSha256(screenshot.sha256) || hashes.has(screenshot.sha256)) {
      addFinding(
        findings,
        'VISUAL_SCREENSHOT_HASH_INVALID',
        'Screenshot sha256 must be a non-placeholder unique 64-hex hash.',
        `${item}.sha256`,
      );
    } else {
      hashes.add(screenshot.sha256);
    }
    if (!isPositiveInteger(screenshot.bytes)) {
      addFinding(
        findings,
        'VISUAL_SCREENSHOT_BYTES_INVALID',
        'Screenshot bytes must be a positive integer.',
        `${item}.bytes`,
      );
    }
    if (!roleCounts.has(screenshot.role)) {
      addFinding(
        findings,
        'VISUAL_SCREENSHOT_ROLE_INVALID',
        'Screenshot role must be one of the required visual role samples.',
        `${item}.role`,
      );
    } else {
      roleCounts.set(screenshot.role, roleCounts.get(screenshot.role) + 1);
    }
  }
  return roleCounts;
}

function canonicalSha256(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function hasExactMembers(values, expectedValues) {
  const actual = new Set(values);
  const expected = new Set(expectedValues);
  return actual.size === expected.size && [...expected].every((value) => actual.has(value));
}

function validateGeometryEvidence(geometry, findings) {
  const location = 'visual-quality baseline.matrix.geometry';
  if (!isObject(geometry)) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_SAMPLES_INVALID',
      'Visual geometry evidence must be an object containing all 545 compact samples.',
      location,
    );
    return;
  }
  if (geometry.continuous320To1440 !== true) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_COVERAGE_INCOMPLETE',
      'Visual geometry must include the inherited continuous 320-1440 sweep.',
      `${location}.continuous320To1440`,
    );
  }
  if (geometry.dense680To1120 !== true) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_COVERAGE_INCOMPLETE',
      'Visual geometry must include the inherited dense 680-1120 sweep.',
      `${location}.dense680To1120`,
    );
  }

  const samples = geometry.samples;
  if (!Array.isArray(samples) || samples.length !== 545) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_SAMPLES_INVALID',
      'geometry.samples must contain all 545 inherited compact browser measurements.',
      `${location}.samples`,
    );
    return;
  }

  const phaseCounts = Object.fromEntries(
    Object.keys(FR_P5_GEOMETRY_PHASE_COUNTS).map((phase) => [phase, 0]),
  );
  const identities = new Set();
  let passedSamples = 0;
  let firstInvalidSample = -1;
  let duplicateSamples = false;
  for (const [index, sample] of samples.entries()) {
    const viewport = sample?.requestedViewport;
    const actualViewport = sample?.actualViewport;
    const phase = sample?.phase;
    if (Object.hasOwn(phaseCounts, phase)) phaseCounts[phase] += 1;
    if (sample?.pass === true) passedSamples += 1;

    const sampleValid = isObject(sample)
      && Object.hasOwn(FR_P5_GEOMETRY_PHASE_COUNTS, phase)
      && isNonEmptyString(sample.slug)
      && isObject(viewport)
      && isPositiveInteger(viewport.width)
      && isPositiveInteger(viewport.height)
      && isObject(actualViewport)
      && actualViewport.width === viewport.width
      && actualViewport.height === viewport.height
      && isPositiveFiniteNumber(actualViewport.dpr)
      && isPositiveFiniteNumber(sample.scale)
      && ['single-column', 'dual-column'].includes(sample.mode)
      && sample.contained === true
      && sample.controlsBelow44 === 0
      && isObject(sample.findings)
      && FR_P5_VISUAL_REQUIREMENTS.zeroFindings.every(
        (key) => sample.findings[key] === 0,
      )
      && sample.pass === true;
    if (!sampleValid && firstInvalidSample < 0) firstInvalidSample = index;

    const identity = [
      phase,
      sample?.slug,
      viewport?.width,
      viewport?.height,
      sample?.scale,
    ].join('|');
    if (identities.has(identity)) duplicateSamples = true;
    identities.add(identity);
  }
  if (firstInvalidSample >= 0) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_SAMPLE_INVALID',
      'Every geometry sample must bind its observed viewport, mode, containment, zero findings, touch-target count and PASS result.',
      `${location}.samples[${firstInvalidSample}]`,
    );
  }
  if (duplicateSamples) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_SAMPLE_DUPLICATE',
      'Geometry samples must have unique phase/slug/viewport/scale identities.',
      `${location}.samples`,
    );
  }

  const declaredPhaseCounts = geometry.phaseCounts;
  const phaseCountsValid = isObject(declaredPhaseCounts)
    && Object.keys(declaredPhaseCounts).length === Object.keys(FR_P5_GEOMETRY_PHASE_COUNTS).length
    && Object.entries(FR_P5_GEOMETRY_PHASE_COUNTS).every(([phase, expected]) => (
      declaredPhaseCounts[phase] === expected && phaseCounts[phase] === expected
    ));
  if (!phaseCountsValid) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_PHASE_COUNTS_INVALID',
      'Geometry phase counts must equal 469 continuous-width, 14 named-viewport, 54 topic-endpoint and 8 zoom-equivalent samples, both declared and derived.',
      `${location}.phaseCounts`,
    );
  }

  const continuous = samples.filter((sample) => sample?.phase === 'continuous-width');
  const continuousWidths = continuous.map((sample) => sample?.requestedViewport?.width);
  const continuousSlugs = new Set(continuous.map((sample) => sample?.slug));
  const continuousCoverageValid = hasExactMembers(
    continuousWidths,
    FR_P5_GEOMETRY_CONTINUOUS_WIDTHS,
  )
    && continuousSlugs.size === 7
    && continuous.every((sample) => sample?.requestedViewport?.height === 900)
    && FR_P5_GEOMETRY_CONTINUOUS_WIDTHS.every((width) => (
      continuous.filter((sample) => sample?.requestedViewport?.width === width).length === 7
    ))
    && [...continuousSlugs].every((slug) => (
      continuous.filter((sample) => sample?.slug === slug).length
        === FR_P5_GEOMETRY_CONTINUOUS_WIDTHS.length
    ));
  const denseWidthCount = new Set(
    continuousWidths.filter((width) => width >= 680 && width <= 1120),
  ).size;
  if (!continuousCoverageValid || denseWidthCount !== 45) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_COVERAGE_INCOMPLETE',
      'Continuous geometry must reproduce the inherited 67-width by 7-topic matrix, including all 45 dense widths from 680 through 1120.',
      `${location}.samples`,
    );
  }

  const named = samples.filter((sample) => sample?.phase === 'named-viewport');
  const namedViewports = named.map(
    (sample) => `${sample?.requestedViewport?.width}x${sample?.requestedViewport?.height}`,
  );
  if (!hasExactMembers(namedViewports, FR_P5_GEOMETRY_NAMED_VIEWPORTS)) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_COVERAGE_INCOMPLETE',
      'Named geometry must reproduce all 14 inherited viewport cases.',
      `${location}.samples`,
    );
  }

  const topicEndpoints = samples.filter((sample) => sample?.phase === 'topic-endpoint');
  const topicSlugs = new Set(topicEndpoints.map((sample) => sample?.slug));
  const topicEndpointCoverageValid = topicSlugs.size === 27
    && [...topicSlugs].every((slug) => {
      const viewportKeys = topicEndpoints
        .filter((sample) => sample?.slug === slug)
        .map((sample) => (
          `${sample?.requestedViewport?.width}x${sample?.requestedViewport?.height}`
        ));
      return hasExactMembers(viewportKeys, FR_P5_GEOMETRY_TOPIC_ENDPOINTS);
    });
  if (!topicEndpointCoverageValid) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_COVERAGE_INCOMPLETE',
      'Topic endpoint geometry must cover all 27 topics at 390x844 and 1280x720.',
      `${location}.samples`,
    );
  }

  const zoom = samples.filter((sample) => sample?.phase === 'zoom-equivalent');
  if (!hasExactMembers(
    zoom.map((sample) => sample?.scale),
    FR_P5_GEOMETRY_ZOOM_SCALES,
  )) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_COVERAGE_INCOMPLETE',
      'Zoom-equivalent geometry must reproduce the inherited 80, 90, 100, 110, 125, 150, 175 and 200 percent cases.',
      `${location}.samples`,
    );
  }

  if (geometry.totalSamples !== 545
    || geometry.passedSamples !== 545
    || passedSamples !== 545
    || Object.values(phaseCounts).reduce((total, count) => total + count, 0) !== 545) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_TOTAL_INVALID',
      'Geometry evidence must bind the accepted 545/545 measured samples.',
      location,
    );
  }
  if (!isRealSha256(geometry.samplesSha256)
    || geometry.samplesSha256 !== canonicalSha256(samples)) {
    addFinding(
      findings,
      'VISUAL_GEOMETRY_SAMPLE_HASH_MISMATCH',
      'geometry.samplesSha256 must equal the canonical SHA-256 of the complete ordered samples array.',
      `${location}.samplesSha256`,
    );
  }
}

function validateVisualQuality(document, expectedPolicyHash, findings) {
  if (!validateEvidenceHeader(document, {
    label: 'visual-quality baseline',
    expectedPolicyHash,
    findings,
  })) return;

  const evidenceFindings = document.findings;
  if (!isObject(evidenceFindings)) {
    addFinding(
      findings,
      'VISUAL_FINDINGS_INVALID',
      'visual-quality baseline findings must be an object.',
      'visual-quality baseline.findings',
    );
  } else {
    for (const key of FR_P5_VISUAL_REQUIREMENTS.zeroFindings) {
      if (evidenceFindings[key] !== 0) {
        addFinding(
          findings,
          'VISUAL_ZERO_FINDING_REQUIRED',
          `Visual finding ${key} must be exactly zero.`,
          `visual-quality baseline.findings.${key}`,
        );
      }
    }
  }

  if (!isObject(document.statuses)) {
    addFinding(
      findings,
      'VISUAL_STATUSES_INVALID',
      'visual-quality baseline statuses must be an object.',
      'visual-quality baseline.statuses',
    );
  } else {
    for (const key of FR_P5_VISUAL_STATUS_KEYS) {
      if (document.statuses[key] !== 'PASS') {
        addFinding(
          findings,
          'VISUAL_REQUIRED_STATUS_INVALID',
          `Visual ${key} status must be PASS.`,
          `visual-quality baseline.statuses.${key}`,
        );
      }
    }
  }
  for (const [matrixKey, requiredKeys] of [
    ['qualityChecks', FR_P5_VISUAL_QUALITY_CHECK_KEYS],
    ['a11yChecks', FR_P5_A11Y_CHECK_KEYS],
  ]) {
    const checks = document[matrixKey];
    if (!isObject(checks)) {
      addFinding(
        findings,
        'VISUAL_CHECK_MATRIX_INVALID',
        `${matrixKey} must be an object.`,
        `visual-quality baseline.${matrixKey}`,
      );
      continue;
    }
    for (const key of requiredKeys) {
      if (checks[key] !== 'PASS') {
        addFinding(
          findings,
          'VISUAL_CHECK_STATUS_INVALID',
          `${matrixKey}.${key} must be PASS.`,
          `visual-quality baseline.${matrixKey}.${key}`,
        );
      }
    }
  }
  const screenshotRoleCounts = validateVisualScreenshots(document.screenshots, findings);

  const matrix = document.matrix;
  if (!isObject(matrix)) {
    addFinding(
      findings,
      'VISUAL_MATRIX_INVALID',
      'visual-quality baseline matrix must be an object.',
      'visual-quality baseline.matrix',
    );
    return;
  }

  for (const [key, expected] of Object.entries(FR_P5_VISUAL_REQUIREMENTS.content)) {
    if (matrix.content?.[key] !== expected) {
      addFinding(
        findings,
        'VISUAL_CONTENT_COVERAGE_INCOMPLETE',
        `Visual content coverage ${key} must equal ${expected}.`,
        `visual-quality baseline.matrix.content.${key}`,
      );
    }
  }
  if (matrix.content?.allMediaUseSites !== true) {
    addFinding(
      findings,
      'VISUAL_MEDIA_USE_SITE_COVERAGE_INCOMPLETE',
      'Visual evidence must cover all media use-sites.',
      'visual-quality baseline.matrix.content.allMediaUseSites',
    );
  }

  for (const role of FR_P5_VISUAL_REQUIREMENTS.roleSamples) {
    const declaredSamples = matrix.roleSamples?.[role];
    const screenshotSamples = screenshotRoleCounts.get(role);
    if (!Number.isInteger(declaredSamples)
      || declaredSamples < 2
      || screenshotSamples < 2
      || declaredSamples !== screenshotSamples) {
      addFinding(
        findings,
        'VISUAL_ROLE_COVERAGE_INCOMPLETE',
        `Visual role ${role} requires at least two accepted screenshots and an exact roleSamples count.`,
        `visual-quality baseline.matrix.roleSamples.${role}`,
      );
    }
  }

  validateGeometryEvidence(matrix.geometry, findings);
  const viewports = new Set(Array.isArray(matrix.geometry?.viewports) ? matrix.geometry.viewports : []);
  for (const viewport of FR_P5_VISUAL_REQUIREMENTS.viewports) {
    if (!viewports.has(viewport)) {
      addFinding(
        findings,
        'VISUAL_VIEWPORT_COVERAGE_INCOMPLETE',
        `Visual geometry is missing required viewport ${viewport}.`,
        'visual-quality baseline.matrix.geometry.viewports',
      );
    }
  }
}

function validatePassCheck(check, label, findings) {
  if (!isObject(check)) {
    addFinding(findings, 'PAGES_LOCAL_EXACT_CHECK_INVALID', `${label} must be an object.`, label);
    return false;
  }
  if (check.status !== 'PASS') {
    addFinding(findings, 'PAGES_LOCAL_EXACT_STATUS_INVALID', `${label} status must be PASS.`, label);
  }
  return true;
}

function expectedImageMime(repositoryPath) {
  const extension = path.posix.extname(String(repositoryPath ?? '').split(/[?#]/, 1)[0]).toLowerCase();
  return {
    '.avif': 'image/avif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  }[extension] ?? '';
}

function validateTopByteRecords(records, {
  label,
  includeFiles,
  findings,
}) {
  if (!Array.isArray(records) || records.length === 0) {
    addFinding(findings, 'PAGES_TOP_BYTES_INVALID', `${label} must be a non-empty array.`, label);
    return;
  }
  const paths = new Set();
  let priorBytes = Number.POSITIVE_INFINITY;
  for (const [index, record] of records.entries()) {
    const item = `${label}[${index}]`;
    if (!isObject(record)
      || !isSafeRepositoryPath(record.path)
      || !isPositiveInteger(record.bytes)
      || (includeFiles && !isPositiveInteger(record.files))
      || paths.has(record.path)
      || record.bytes > priorBytes) {
      addFinding(
        findings,
        'PAGES_TOP_BYTES_INVALID',
        `${label} records must be unique, descending, repository-relative and contain positive bytes${includeFiles ? '/files' : ''}.`,
        item,
      );
    }
    if (isObject(record)) {
      paths.add(record.path);
      if (isPositiveInteger(record.bytes)) priorBytes = record.bytes;
    }
  }
}

function validateLocalExactChecks(checks, findings) {
  const location = 'Pages-performance baseline.localExactChecks';
  if (!validatePassCheck(checks, location, findings)) return;

  const projectSubpath = checks.projectSubpath;
  if (validatePassCheck(projectSubpath, `${location}.projectSubpath`, findings)
    && projectSubpath.value !== PROJECT_SUBPATH) {
    addFinding(
      findings,
      'PAGES_PROJECT_SUBPATH_INVALID',
      `projectSubpath.value must be exactly ${PROJECT_SUBPATH}.`,
      `${location}.projectSubpath.value`,
    );
  }

  const manifest = checks.manifestMimeHash;
  if (validatePassCheck(manifest, `${location}.manifestMimeHash`, findings)) {
    if (manifest.path !== 'public/media/media-manifest.json'
      || manifest.mime !== 'application/json'
      || !isRealSha256(manifest.sha256)
      || !isPositiveInteger(manifest.bytes)) {
      addFinding(
        findings,
        'PAGES_MANIFEST_MIME_HASH_INVALID',
        'manifestMimeHash must record the canonical manifest path, application/json MIME, real sha256 and positive bytes.',
        `${location}.manifestMimeHash`,
      );
    }
  }

  const derivatives = checks.derivativeMimeHash;
  if (validatePassCheck(derivatives, `${location}.derivativeMimeHash`, findings)) {
    if (!Array.isArray(derivatives.samples) || derivatives.samples.length === 0) {
      addFinding(
        findings,
        'PAGES_DERIVATIVE_MIME_HASH_INVALID',
        'derivativeMimeHash.samples must contain at least one exact derivative record.',
        `${location}.derivativeMimeHash.samples`,
      );
    } else {
      const paths = new Set();
      for (const [index, sample] of derivatives.samples.entries()) {
        const item = `${location}.derivativeMimeHash.samples[${index}]`;
        const expectedMime = expectedImageMime(sample?.path);
        if (!isObject(sample)
          || sample.status !== 'PASS'
          || !isDerivedCurrentSrc(sample.path)
          || sample.mime !== expectedMime
          || !expectedMime
          || !isRealSha256(sample.sha256)
          || !isPositiveInteger(sample.bytes)
          || paths.has(sample.path)) {
          addFinding(
            findings,
            'PAGES_DERIVATIVE_MIME_HASH_INVALID',
            'Every derivative sample must be PASS, unique, derived, MIME-truthful, and include real sha256 and positive bytes.',
            item,
          );
        } else {
          paths.add(sample.path);
        }
      }
    }
  }

  const etag = checks.etag;
  if (validatePassCheck(etag, `${location}.etag`, findings)
    && !ETAG_PATTERN.test(String(etag.value ?? ''))) {
    addFinding(
      findings,
      'PAGES_ETAG_INVALID',
      'etag.value must be a concrete quoted HTTP ETag.',
      `${location}.etag.value`,
    );
  }

  for (const [key, expectedStatusCode] of [
    ['conditional304', 304],
    ['notFound404', 404],
  ]) {
    const check = checks[key];
    if (validatePassCheck(check, `${location}.${key}`, findings)
      && check.statusCode !== expectedStatusCode) {
      addFinding(
        findings,
        'PAGES_HTTP_STATUS_INVALID',
        `${key}.statusCode must be ${expectedStatusCode}.`,
        `${location}.${key}.statusCode`,
      );
    }
  }

  const audioRange = checks.audioRange206;
  if (validatePassCheck(audioRange, `${location}.audioRange206`, findings)
    && (audioRange.statusCode !== 206
      || audioRange.acceptRanges !== 'bytes'
      || !CONTENT_RANGE_PATTERN.test(String(audioRange.contentRange ?? '')))) {
    addFinding(
      findings,
      'PAGES_AUDIO_RANGE_INVALID',
      'audioRange206 must record statusCode 206, acceptRanges bytes and a concrete Content-Range.',
      `${location}.audioRange206`,
    );
  }

  const immutableCache = checks.immutableCache;
  if (validatePassCheck(immutableCache, `${location}.immutableCache`, findings)
    && (!isPositiveInteger(immutableCache.checkedDerivedResponses)
      || immutableCache.violations !== 0
      || immutableCache.stableUrlBytesHash !== true
      || !/\bmax-age=\d+\b/i.test(String(immutableCache.observedCacheControl ?? '')))) {
    addFinding(
      findings,
      'PAGES_IMMUTABLE_CACHE_INVALID',
      'immutableCache must prove stable URL bytes/hash, checked derivatives, zero violations and record observed Cache-Control.',
      `${location}.immutableCache`,
    );
  }

  const sourcePolicyPathChange = checks.sourcePolicyPathChange;
  if (validatePassCheck(sourcePolicyPathChange, `${location}.sourcePolicyPathChange`, findings)
    && (!Number.isInteger(sourcePolicyPathChange.cases)
      || sourcePolicyPathChange.cases < 2
      || sourcePolicyPathChange.sourceChangeProducesNewPath !== true
      || sourcePolicyPathChange.policyChangeProducesNewPath !== true
      || sourcePolicyPathChange.unchangedPathViolations !== 0)) {
    addFinding(
      findings,
      'PAGES_SOURCE_POLICY_PATH_CHANGE_INVALID',
      'sourcePolicyPathChange must prove independent source and policy changes produce new paths with zero unchanged-path violations.',
      `${location}.sourcePolicyPathChange`,
    );
  }

  const orphanClosure = checks.orphanClosure;
  if (validatePassCheck(orphanClosure, `${location}.orphanClosure`, findings)) {
    for (const key of ['missing', 'stale', 'orphan', 'unexpectedOriginals']) {
      if (orphanClosure[key] !== 0) {
        addFinding(
          findings,
          'PAGES_ORPHAN_CLOSURE_INVALID',
          `orphanClosure.${key} must be exactly zero.`,
          `${location}.orphanClosure.${key}`,
        );
      }
    }
  }

  const noServiceWorkers = checks.noServiceWorkers;
  if (validatePassCheck(noServiceWorkers, `${location}.noServiceWorkers`, findings)
    && noServiceWorkers.registrations !== 0) {
    addFinding(
      findings,
      'PAGES_SERVICE_WORKER_STATE_INVALID',
      'noServiceWorkers.registrations must be exactly zero.',
      `${location}.noServiceWorkers.registrations`,
    );
  }

  const noPrivateState = checks.noPrivateState;
  if (validatePassCheck(noPrivateState, `${location}.noPrivateState`, findings)
    && noPrivateState.exposedEntries !== 0) {
    addFinding(
      findings,
      'PAGES_PRIVATE_STATE_INVALID',
      'noPrivateState.exposedEntries must be exactly zero.',
      `${location}.noPrivateState.exposedEntries`,
    );
  }
}

function isConcreteLiveUrlForPath(value, repositoryPath) {
  if (!isNonEmptyString(value)
    || !/^https:\/\//i.test(value)
    || /placeholder|example\.com|pending/i.test(value)) return false;
  try {
    return new URL(value).pathname.endsWith(`/${repositoryPath}`);
  } catch {
    return false;
  }
}

function validateLiveExactRecord(record, {
  expectedLocal,
  label,
  findings,
}) {
  let valid = true;
  if (!isObject(record)
    || record.status !== 'PASS'
    || !isSafeRepositoryPath(record.path)
    || !isConcreteLiveUrlForPath(record.url, record.path)
    || !isRealSha256(record.observedSha256)
    || !isRealSha256(record.expectedGitSha256)
    || record.observedSha256 !== record.expectedGitSha256
    || !isPositiveInteger(record.observedBytes)
    || !isPositiveInteger(record.expectedGitBytes)
    || record.observedBytes !== record.expectedGitBytes
    || record.gitBlobMatch !== true
    || !isObject(expectedLocal)
    || record.path !== expectedLocal.path
    || record.expectedGitSha256 !== expectedLocal.sha256
    || record.expectedGitBytes !== expectedLocal.bytes) {
    valid = false;
    addFinding(
      findings,
      'PAGES_LIVE_EXACT_RECORD_INVALID',
      `${label} must bind a concrete live URL and observed bytes/hash to the expected Git-backed local record.`,
      label,
    );
  }
  return valid;
}

function validateLiveExactChecks(checks, sourceDocument, findings) {
  const location = 'Pages-performance baseline.deploymentBoundary.liveExactChecks';
  if (!isObject(checks) || checks.status !== 'PASS' || checks.scope !== 'LIVE_EXACT_SHA') {
    addFinding(
      findings,
      'PAGES_LIVE_EXACT_CHECKS_INVALID',
      'A deployment PASS requires liveExactChecks status PASS and scope LIVE_EXACT_SHA.',
      location,
    );
    return false;
  }
  let valid = validateLiveExactRecord(checks.manifest, {
    expectedLocal: sourceDocument?.localExactChecks?.manifestMimeHash,
    label: `${location}.manifest`,
    findings,
  });
  const expectedDerivatives = sourceDocument?.localExactChecks?.derivativeMimeHash?.samples ?? [];
  if (!Array.isArray(checks.derivatives)
    || checks.derivatives.length !== expectedDerivatives.length
    || checks.derivatives.length === 0) {
    addFinding(
      findings,
      'PAGES_LIVE_EXACT_DERIVATIVES_INVALID',
      'Live derivative checks must cover every local derivative MIME/hash sample.',
      `${location}.derivatives`,
    );
    return false;
  }
  const liveByPath = new Map(checks.derivatives.map((record) => [record?.path, record]));
  for (const [index, expectedLocal] of expectedDerivatives.entries()) {
    if (!validateLiveExactRecord(liveByPath.get(expectedLocal.path), {
      expectedLocal,
      label: `${location}.derivatives[${index}]`,
      findings,
    })) valid = false;
  }
  return valid;
}

function validateDeploymentBoundary(boundary, {
  sourceDocument,
  expectedArtifactBytes,
  artifactBudgetBytes,
  findings,
}) {
  const location = 'Pages-performance baseline.deploymentBoundary';
  if (!isObject(boundary)) {
    addFinding(
      findings,
      'PAGES_DEPLOYMENT_BOUNDARY_INVALID',
      'deploymentBoundary must explicitly distinguish pre-deploy evidence from a live PASS.',
      location,
    );
    return { status: null, liveDeploymentVerified: false };
  }
  if (boundary.status === 'PENDING_POSTDEPLOY_FINAL_HANDOFF') {
    if (boundary.liveVerified !== false) {
      addFinding(
        findings,
        'PAGES_DEPLOYMENT_PENDING_STATE_INVALID',
        'Pending deployment evidence must set liveVerified to false.',
        `${location}.liveVerified`,
      );
    }
    for (const key of ['exactSha', 'liveSha', 'artifact', 'deploymentUrl']) {
      if (boundary[key] !== undefined) {
        addFinding(
          findings,
          'PAGES_DEPLOYMENT_PENDING_LIVE_DATA_FORBIDDEN',
          `Pending deployment evidence must omit live-only field ${key}.`,
          `${location}.${key}`,
        );
      }
    }
    for (const key of ['deployedSha', 'exactSha', 'finalMainSha', 'liveSha', 'pagesSha']) {
      if (sourceDocument?.[key] !== undefined) {
        addFinding(
          findings,
          'PAGES_DEPLOYMENT_PENDING_LIVE_DATA_FORBIDDEN',
          `Pending Pages evidence must omit top-level live-only field ${key}.`,
          `Pages-performance baseline.${key}`,
        );
      }
    }
    if (!isObject(boundary.durations)
      || boundary.durations.status !== 'PENDING_POSTDEPLOY_FINAL_HANDOFF'
      || boundary.durations.uploadMs !== undefined
      || boundary.durations.deployMs !== undefined) {
      addFinding(
        findings,
        'PAGES_DEPLOYMENT_PENDING_DURATIONS_INVALID',
        'Pending deployment evidence requires an explicit pending durations boundary and no duration values.',
        `${location}.durations`,
      );
    }
    if (!isObject(boundary.cdnPropagation)
      || boundary.cdnPropagation.status !== 'PENDING_POSTDEPLOY_FINAL_HANDOFF'
      || boundary.cdnPropagation.liveVerified !== false) {
      addFinding(
        findings,
        'PAGES_CDN_PROPAGATION_PENDING_INVALID',
        'Pending deployment evidence requires cdnPropagation pending with liveVerified false.',
        `${location}.cdnPropagation`,
      );
    }
    if (!isObject(boundary.liveExactChecks)
      || boundary.liveExactChecks.status !== 'PENDING_POSTDEPLOY_FINAL_HANDOFF'
      || Object.keys(boundary.liveExactChecks).length !== 1) {
      addFinding(
        findings,
        'PAGES_LIVE_EXACT_PENDING_INVALID',
        'Pending deployment evidence requires a liveExactChecks object containing only the pending status.',
        `${location}.liveExactChecks`,
      );
    }
    return {
      status: boundary.status,
      liveDeploymentVerified: false,
    };
  }
  if (boundary.status !== 'PASS') {
    addFinding(
      findings,
      'PAGES_DEPLOYMENT_BOUNDARY_STATUS_INVALID',
      'deploymentBoundary.status must be PENDING_POSTDEPLOY_FINAL_HANDOFF or PASS.',
      `${location}.status`,
    );
    return { status: boundary.status ?? null, liveDeploymentVerified: false };
  }

  let valid = true;
  if (boundary.liveVerified !== true) {
    valid = false;
    addFinding(
      findings,
      'PAGES_DEPLOYMENT_PASS_STATE_INVALID',
      'A deployment PASS must set liveVerified to true.',
      `${location}.liveVerified`,
    );
  }
  if (!isRealCommitSha(boundary.exactSha)
    || !isRealCommitSha(boundary.liveSha)
    || boundary.exactSha !== boundary.liveSha) {
    valid = false;
    addFinding(
      findings,
      'PAGES_DEPLOYMENT_EXACT_SHA_INVALID',
      'A deployment PASS requires matching real 40-hex exactSha and liveSha values.',
      location,
    );
  }
  if (!isNonEmptyString(boundary.deploymentUrl)
    || !/^https:\/\//i.test(boundary.deploymentUrl)
    || /placeholder|example\.com|pending/i.test(boundary.deploymentUrl)) {
    valid = false;
    addFinding(
      findings,
      'PAGES_DEPLOYMENT_URL_INVALID',
      'A deployment PASS requires a concrete HTTPS deploymentUrl.',
      `${location}.deploymentUrl`,
    );
  }
  const artifact = boundary.artifact;
  if (!isPositiveInteger(expectedArtifactBytes)
    || !isObject(artifact)
    || artifact.status !== 'PASS'
    || !isPositiveInteger(artifact.id)
    || !isPositiveInteger(artifact.bytes)
    || !isRealSha256(artifact.sha256)
    || artifact.bytes !== expectedArtifactBytes
    || artifact.bytes > artifactBudgetBytes) {
    valid = false;
    addFinding(
      findings,
      'PAGES_DEPLOYMENT_ARTIFACT_INVALID',
      'A deployment PASS requires budgeted PASS artifact data matching compressedBytes, with positive id/bytes and a real sha256.',
      `${location}.artifact`,
    );
  }
  if (!isObject(boundary.durations)
    || boundary.durations.status !== 'PASS'
    || !isPositiveFiniteNumber(boundary.durations.uploadMs)
    || !isPositiveFiniteNumber(boundary.durations.deployMs)) {
    valid = false;
    addFinding(
      findings,
      'PAGES_DEPLOYMENT_DURATIONS_INVALID',
      'A deployment PASS requires positive uploadMs and deployMs duration evidence.',
      `${location}.durations`,
    );
  }
  if (!isObject(boundary.cdnPropagation)
    || boundary.cdnPropagation.status !== 'PASS'
    || boundary.cdnPropagation.liveVerified !== true
    || !isPositiveInteger(boundary.cdnPropagation.checks)
    || boundary.cdnPropagation.finalStatusCode !== 200) {
    valid = false;
    addFinding(
      findings,
      'PAGES_CDN_PROPAGATION_INVALID',
      'A deployment PASS requires live CDN propagation evidence with positive checks and finalStatusCode 200.',
      `${location}.cdnPropagation`,
    );
  }
  if (!validateLiveExactChecks(boundary.liveExactChecks, sourceDocument, findings)) {
    valid = false;
  }
  return {
    status: boundary.status,
    liveDeploymentVerified: valid,
  };
}

function validatePagesPerformance(document, policy, expectedPolicyHash, findings) {
  if (!validateEvidenceHeader(document, {
    label: 'Pages-performance baseline',
    expectedPolicyHash,
    findings,
  })) return { status: null, liveDeploymentVerified: false };

  const dist = document.dist;
  if (!isObject(dist)) {
    addFinding(
      findings,
      'PAGES_PERFORMANCE_DIST_INVALID',
      'Pages-performance baseline dist must be an object.',
      'Pages-performance baseline.dist',
    );
    validateLocalExactChecks(document.localExactChecks, findings);
    return validateDeploymentBoundary(document.deploymentBoundary, {
      sourceDocument: document,
      expectedArtifactBytes: document.pagesArtifact?.compressedBytes,
      artifactBudgetBytes: policy.budgets.pagesArtifactBytes,
      findings,
    });
  }
  if (dist.status !== 'PASS') {
    addFinding(findings, 'PAGES_PERFORMANCE_DIST_STATUS_INVALID', 'dist status must be PASS.', 'Pages-performance baseline.dist');
  }
  for (const key of ['filesBefore', 'bytesBefore', 'filesAfter', 'bytesAfter']) {
    if (!isPositiveInteger(dist[key])) {
      addFinding(
        findings,
        'PAGES_PERFORMANCE_DIST_MEASUREMENT_INVALID',
        `dist.${key} must be a positive integer.`,
        `Pages-performance baseline.dist.${key}`,
      );
    }
  }
  for (const key of ['imageBytesBefore', 'imageBytesAfter', 'audioBytes']) {
    if (!isNonNegativeInteger(dist[key])) {
      addFinding(
        findings,
        'PAGES_PERFORMANCE_DIST_MEASUREMENT_INVALID',
        `dist.${key} must be a non-negative integer.`,
        `Pages-performance baseline.dist.${key}`,
      );
    }
  }
  if (isNonNegativeInteger(dist.imageBytesBefore) && dist.imageBytesBefore > dist.bytesBefore) {
    addFinding(
      findings,
      'PAGES_PERFORMANCE_IMAGE_BYTES_INVALID',
      'Initial image bytes cannot exceed initial dist bytes.',
      'Pages-performance baseline.dist.imageBytesBefore',
    );
  }
  if (isPositiveInteger(dist.bytesBefore)
    && isPositiveInteger(dist.bytesAfter)
    && dist.bytesAfter >= dist.bytesBefore) {
    addFinding(
      findings,
      'PAGES_PERFORMANCE_DIST_NOT_IMPROVED',
      'Final dist bytes must be strictly lower than the measured initial dist bytes.',
      'Pages-performance baseline.dist.bytesAfter',
    );
  }
  if (isNonNegativeInteger(dist.imageBytesBefore)
    && isNonNegativeInteger(dist.imageBytesAfter)
    && dist.imageBytesAfter >= dist.imageBytesBefore) {
    addFinding(
      findings,
      'PAGES_PERFORMANCE_IMAGE_NOT_IMPROVED',
      'Final image bytes must be strictly lower than the measured initial image bytes.',
      'Pages-performance baseline.dist.imageBytesAfter',
    );
  }
  if (isPositiveInteger(dist.bytesAfter) && dist.bytesAfter > policy.budgets.distBytes) {
    addFinding(
      findings,
      'PAGES_PERFORMANCE_DIST_BUDGET_EXCEEDED',
      `Final dist bytes exceed the frozen budget (${dist.bytesAfter} > ${policy.budgets.distBytes} bytes).`,
      'Pages-performance baseline.dist.bytesAfter',
    );
  }
  if (isNonNegativeInteger(dist.imageBytesAfter) && dist.imageBytesAfter > dist.bytesAfter) {
    addFinding(
      findings,
      'PAGES_PERFORMANCE_IMAGE_BYTES_INVALID',
      'Final image bytes cannot exceed total dist bytes.',
      'Pages-performance baseline.dist.imageBytesAfter',
    );
  }
  if (isNonNegativeInteger(dist.audioBytes) && dist.audioBytes > dist.bytesAfter) {
    addFinding(
      findings,
      'PAGES_PERFORMANCE_AUDIO_BYTES_INVALID',
      'Final audio bytes cannot exceed total dist bytes.',
      'Pages-performance baseline.dist.audioBytes',
    );
  }
  validateTopByteRecords(dist.topDirectories, {
    label: 'Pages-performance baseline.dist.topDirectories',
    includeFiles: true,
    findings,
  });
  validateTopByteRecords(dist.topFiles, {
    label: 'Pages-performance baseline.dist.topFiles',
    includeFiles: false,
    findings,
  });

  const pagesArtifact = document.pagesArtifact;
  if (!isObject(pagesArtifact)) {
    addFinding(
      findings,
      'PAGES_ARTIFACT_EVIDENCE_INVALID',
      'Pages-performance baseline pagesArtifact must be an object.',
      'Pages-performance baseline.pagesArtifact',
    );
    validateLocalExactChecks(document.localExactChecks, findings);
    return validateDeploymentBoundary(document.deploymentBoundary, {
      sourceDocument: document,
      expectedArtifactBytes: document.pagesArtifact?.compressedBytes,
      artifactBudgetBytes: policy.budgets.pagesArtifactBytes,
      findings,
    });
  }
  if (pagesArtifact.status !== 'PASS') {
    addFinding(
      findings,
      'PAGES_ARTIFACT_EVIDENCE_STATUS_INVALID',
      'pagesArtifact status must be PASS.',
      'Pages-performance baseline.pagesArtifact',
    );
  }
  if (!isPositiveInteger(pagesArtifact.conservativeBytes)) {
    addFinding(
      findings,
      'PAGES_ARTIFACT_CONSERVATIVE_BYTES_INVALID',
      'pagesArtifact.conservativeBytes must be a positive integer.',
      'Pages-performance baseline.pagesArtifact.conservativeBytes',
    );
  } else {
    if (pagesArtifact.conservativeBytes !== dist.bytesAfter) {
      addFinding(
        findings,
        'PAGES_ARTIFACT_CONSERVATIVE_BASIS_MISMATCH',
        'Pages artifact conservative bytes must equal the exact final dist bytes.',
        'Pages-performance baseline.pagesArtifact.conservativeBytes',
      );
    }
    if (pagesArtifact.conservativeBytes > policy.budgets.pagesArtifactBytes) {
      addFinding(
        findings,
        'PAGES_ARTIFACT_BUDGET_EXCEEDED',
        `Conservative Pages artifact bytes exceed the frozen budget (${pagesArtifact.conservativeBytes} > ${policy.budgets.pagesArtifactBytes} bytes).`,
        'Pages-performance baseline.pagesArtifact.conservativeBytes',
      );
    }
  }
  if (!isPositiveInteger(pagesArtifact.compressedBytes)) {
    addFinding(
      findings,
      'PAGES_ARTIFACT_COMPRESSED_BYTES_INVALID',
      'pagesArtifact.compressedBytes is required and must be a positive integer.',
      'Pages-performance baseline.pagesArtifact.compressedBytes',
    );
  } else if (pagesArtifact.compressedBytes > policy.budgets.pagesArtifactBytes) {
    addFinding(
      findings,
      'PAGES_ARTIFACT_COMPRESSED_BUDGET_EXCEEDED',
      `Compressed Pages artifact exceeds the frozen budget (${pagesArtifact.compressedBytes} > ${policy.budgets.pagesArtifactBytes} bytes).`,
      'Pages-performance baseline.pagesArtifact.compressedBytes',
    );
  }
  validateLocalExactChecks(document.localExactChecks, findings);
  return validateDeploymentBoundary(document.deploymentBoundary, {
    sourceDocument: document,
    expectedArtifactBytes: pagesArtifact.compressedBytes,
    artifactBudgetBytes: policy.budgets.pagesArtifactBytes,
    findings,
  });
}

function validateNoPlaceholdersOrAbsolutePaths(value, findings, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => (
      validateNoPlaceholdersOrAbsolutePaths(item, findings, `${location}[${index}]`)
    ));
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      validateNoPlaceholdersOrAbsolutePaths(child, findings, `${location}.${key}`);
    }
    return;
  }
  if (typeof value !== 'string') return;
  if (PLACEHOLDER_PATTERN.test(value)) {
    addFinding(
      findings,
      'FR_P5_PERSISTENT_ARTIFACT_PLACEHOLDER',
      'Persistent FR-P5 evidence must not contain placeholder text.',
      location,
    );
  }
  if (LOCAL_ABSOLUTE_PATH_PATTERN.test(value)) {
    addFinding(
      findings,
      'FR_P5_PERSISTENT_ARTIFACT_ABSOLUTE_PATH',
      'Persistent FR-P5 evidence must not contain local absolute paths.',
      location,
    );
  }
}

function validateRunManifest(document, expectedPolicyHash, findings) {
  const label = 'run manifest';
  if (!validateEvidenceHeader(document, {
    label,
    expectedPolicyHash,
    findings,
  })) return;
  validateNoPlaceholdersOrAbsolutePaths(document, findings, label);

  const counts = document.counts;
  if (!isObject(counts)) {
    addFinding(findings, 'RUN_MANIFEST_COUNTS_INVALID', 'run manifest counts must be an object.', `${label}.counts`);
  } else {
    for (const key of [
      'commands',
      'targetedTestsPassed',
      'targetedTestsTotal',
      'finalTestsPassed',
      'finalTestsTotal',
      'fullGateRuns',
      'builds',
    ]) {
      if (!isPositiveInteger(counts[key])) {
        addFinding(
          findings,
          'RUN_MANIFEST_COUNT_INVALID',
          `run manifest counts.${key} must be a positive integer.`,
          `${label}.counts.${key}`,
        );
      }
    }
    if (counts.targetedTestsPassed !== counts.targetedTestsTotal
      || counts.finalTestsPassed !== counts.finalTestsTotal) {
      addFinding(
        findings,
        'RUN_MANIFEST_TEST_COUNT_MISMATCH',
        'Targeted and final test passed counts must equal their totals.',
        `${label}.counts`,
      );
    }
    if (counts.fullGateRuns !== 1) {
      addFinding(
        findings,
        'RUN_MANIFEST_FULL_GATE_COUNT_INVALID',
        'run manifest must record exactly one final full gate.',
        `${label}.counts.fullGateRuns`,
      );
    }
  }

  if (!Array.isArray(document.commands)
    || document.commands.length !== counts?.commands
    || document.commands.some((command) => !isNonEmptyString(command))) {
    addFinding(
      findings,
      'RUN_MANIFEST_COMMANDS_INVALID',
      'run manifest commands must be non-empty strings matching counts.commands.',
      `${label}.commands`,
    );
  }

  const signatures = document.protectedSignatures;
  if (!isObject(signatures)
    || signatures.status !== 'PASS'
    || !isRealSha256(signatures.beforeSha256)
    || !isRealSha256(signatures.afterSha256)
    || signatures.beforeSha256 !== signatures.afterSha256
    || signatures.unchanged !== true) {
    addFinding(
      findings,
      'RUN_MANIFEST_PROTECTED_SIGNATURE_INVALID',
      'protectedSignatures must be PASS with equal real before/after sha256 values and unchanged true.',
      `${label}.protectedSignatures`,
    );
  }
}

export function validateFinalEvidenceDocuments({
  policy: rawPolicy,
  routeNetwork,
  visualQuality,
  pagesPerformance,
  runManifest,
}) {
  const findings = [];
  let policy;
  try {
    policy = validateMediaQualityPolicy(rawPolicy);
  } catch (error) {
    addFinding(findings, 'FINAL_EVIDENCE_POLICY_INVALID', error.message, 'policy');
    return { findings, summary: null };
  }
  const expectedPolicyHash = canonicalPolicyHash(rawPolicy);
  const lighthouseStatus = validateRouteNetwork(
    routeNetwork,
    policy,
    expectedPolicyHash,
    findings,
  );
  validateVisualQuality(visualQuality, expectedPolicyHash, findings);
  const deployment = validatePagesPerformance(
    pagesPerformance,
    policy,
    expectedPolicyHash,
    findings,
  );
  validateRunManifest(runManifest, expectedPolicyHash, findings);
  return {
    findings,
    summary: {
      policyHash: expectedPolicyHash,
      frozenRouteBudgets: Object.keys(policy.budgets.routeTransferBytes).length,
      measuredRoutes: Array.isArray(routeNetwork?.routes) ? routeNetwork.routes.length : 0,
      srcsetMatrixCases: Array.isArray(routeNetwork?.srcsetMatrix) ? routeNetwork.srcsetMatrix.length : 0,
      lighthouseStatus: lighthouseStatus ?? null,
      distBytes: pagesPerformance?.dist?.bytesAfter ?? null,
      pagesArtifactConservativeBytes: pagesPerformance?.pagesArtifact?.conservativeBytes ?? null,
      pagesArtifactCompressedBytes: pagesPerformance?.pagesArtifact?.compressedBytes ?? null,
      deploymentBoundaryStatus: deployment?.status ?? null,
      liveDeploymentVerified: deployment?.liveDeploymentVerified === true,
      commandCount: runManifest?.counts?.commands ?? null,
      finalTestCount: runManifest?.counts?.finalTestsTotal ?? null,
      buildCount: runManifest?.counts?.builds ?? null,
    },
  };
}

function resolveInputPath(projectRoot, inputPath) {
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(projectRoot, ...inputPath.split('/'));
}

async function readEvidenceJson(projectRoot, repositoryPath, label, findings) {
  const target = resolveInputPath(projectRoot, repositoryPath);
  try {
    return JSON.parse(await readFile(target, 'utf8'));
  } catch (error) {
    addFinding(
      findings,
      error.code === 'ENOENT' ? 'FINAL_EVIDENCE_FILE_MISSING' : 'FINAL_EVIDENCE_FILE_INVALID',
      `${label} could not be read as JSON: ${error.message}`,
      repositoryPath,
    );
    return null;
  }
}

function repositoryFilePath(projectRoot, repositoryPath) {
  if (!isSafeRepositoryPath(repositoryPath)) {
    throw new Error(`Unsafe repository-relative path: ${repositoryPath}`);
  }
  const resolvedRoot = path.resolve(projectRoot);
  const resolved = path.resolve(resolvedRoot, ...repositoryPath.split('/'));
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Path escapes project root: ${repositoryPath}`);
  }
  return resolved;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function validateFileBinding(projectRoot, record, {
  label,
  findings,
}) {
  if (!isObject(record) || !isSafeRepositoryPath(record.path)) {
    addFinding(findings, 'FR_P5_BOUND_FILE_PATH_INVALID', `${label} path is unsafe.`, label);
    return null;
  }
  let bytes;
  try {
    bytes = await readFile(repositoryFilePath(projectRoot, record.path));
  } catch (error) {
    addFinding(
      findings,
      error.code === 'ENOENT' ? 'FR_P5_BOUND_FILE_MISSING' : 'FR_P5_BOUND_FILE_READ_FAILED',
      `${label} could not be read: ${error.message}`,
      record.path,
    );
    return null;
  }
  const actualHash = sha256(bytes);
  if (record.bytes !== bytes.length || record.sha256 !== actualHash) {
    addFinding(
      findings,
      'FR_P5_BOUND_FILE_MISMATCH',
      `${label} bytes/sha256 do not match the actual file.`,
      record.path,
    );
  }
  return bytes;
}

async function validatePersistentDocs(projectRoot, findings) {
  await Promise.all(FR_P5_REQUIRED_DOC_PATHS.map(async (repositoryPath) => {
    let bytes;
    try {
      bytes = await readFile(repositoryFilePath(projectRoot, repositoryPath));
    } catch (error) {
      addFinding(
        findings,
        error.code === 'ENOENT' ? 'FR_P5_REQUIRED_DOC_MISSING' : 'FR_P5_REQUIRED_DOC_READ_FAILED',
        `Required FR-P5 document could not be read: ${error.message}`,
        repositoryPath,
      );
      return;
    }
    const content = bytes.toString('utf8');
    if (bytes.length < 100 || !/^# FR-P5\b/m.test(content)) {
      addFinding(
        findings,
        'FR_P5_REQUIRED_DOC_CONTENT_INVALID',
        'Required FR-P5 documents must be substantive and contain an FR-P5 H1.',
        repositoryPath,
      );
    }
    validateNoPlaceholdersOrAbsolutePaths(content, findings, repositoryPath);
  }));
}

function mediaVariantIndex(manifest, findings) {
  if (!isObject(manifest) || !Array.isArray(manifest.media)) {
    addFinding(
      findings,
      'FR_P5_BOUND_MANIFEST_INVALID',
      'The bound media manifest must contain a media array.',
      'public/media/media-manifest.json',
    );
    return new Map();
  }
  const variants = new Map();
  for (const entry of manifest.media) {
    if (!Array.isArray(entry?.variants)) continue;
    for (const variant of entry.variants) {
      if (!isSafeRepositoryPath(variant?.path) || variants.has(variant.path)) {
        addFinding(
          findings,
          'FR_P5_BOUND_MANIFEST_VARIANT_INVALID',
          'Manifest derivative paths must be safe and unique.',
          String(variant?.path ?? ''),
        );
        continue;
      }
      variants.set(variant.path, variant);
    }
  }
  return variants;
}

async function validateBoundEvidenceFiles(projectRoot, {
  routeNetwork,
  visualQuality,
  pagesPerformance,
  findings,
}) {
  const manifestRecord = pagesPerformance?.localExactChecks?.manifestMimeHash;
  const manifestBytes = await validateFileBinding(projectRoot, manifestRecord, {
    label: 'media manifest',
    findings,
  });
  let manifest = null;
  if (manifestBytes) {
    try {
      manifest = JSON.parse(manifestBytes.toString('utf8'));
    } catch (error) {
      addFinding(
        findings,
        'FR_P5_BOUND_MANIFEST_INVALID',
        `The bound media manifest is invalid JSON: ${error.message}`,
        manifestRecord.path,
      );
    }
  }
  const variants = mediaVariantIndex(manifest, findings);
  const selectedPaths = new Set();
  for (const [index, record] of (routeNetwork?.srcsetMatrix ?? []).entries()) {
    if (!isObject(record) || !isSafeRepositoryPath(record.selectedPath)) continue;
    const item = `route-network baseline.srcsetMatrix[${index}]`;
    const variant = variants.get(record.selectedPath);
    if (!variant
      || variant.profileId !== record.selectedProfileId
      || variant.width !== record.selectedVariantWidth
      || variant.height !== record.selectedVariantHeight
      || variant.bytes !== record.resourceBytes
      || !isRealSha256(variant.sha256)) {
      addFinding(
        findings,
        'SRCSET_MATRIX_MANIFEST_BINDING_MISMATCH',
        'Selected profile/path/width/height/bytes must match the actual media manifest variant.',
        item,
      );
      continue;
    }
    selectedPaths.add(record.selectedPath);
    const selectedBytes = await validateFileBinding(projectRoot, {
      path: record.selectedPath,
      bytes: variant.bytes,
      sha256: variant.sha256,
    }, {
      label: 'selected srcset derivative',
      findings,
    });
    if (selectedBytes) {
      const manifestAspect = variant.width / variant.height;
      const naturalAspect = record.naturalWidth / record.naturalHeight;
      if (!nearlyEqual(manifestAspect, naturalAspect, 0.01)) {
        addFinding(
          findings,
          'SRCSET_MATRIX_NATURAL_DIMENSIONS_MISMATCH',
          'Natural dimensions must preserve the actual selected manifest variant aspect ratio.',
          item,
        );
      }
    }
  }

  const derivativeSamples = pagesPerformance?.localExactChecks?.derivativeMimeHash?.samples ?? [];
  await Promise.all(derivativeSamples.map((record, index) => (
    validateFileBinding(projectRoot, record, {
      label: `derivative MIME/hash sample ${index}`,
      findings,
    })
  )));
  await Promise.all((visualQuality?.screenshots ?? []).map((record, index) => (
    validateFileBinding(projectRoot, record, {
      label: `visual screenshot ${index}`,
      findings,
    })
  )));

  return [
    manifestRecord?.path,
    ...selectedPaths,
    ...derivativeSamples.map((record) => record?.path),
    ...(visualQuality?.screenshots ?? []).map((record) => record?.path),
  ].filter(isSafeRepositoryPath);
}

async function validateTrackedFiles(projectRoot, repositoryPaths, findings) {
  const uniquePaths = [...new Set(repositoryPaths.filter(isSafeRepositoryPath))];
  if (uniquePaths.length === 0) return;
  try {
    const tracked = await execFileAsync(
      'git',
      ['ls-files', '-z', '--', ...uniquePaths],
      { cwd: projectRoot, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, windowsHide: true },
    );
    const trackedPaths = new Set(
      tracked.stdout.toString('utf8').split('\0').filter(Boolean).map((value) => value.replace(/\\/g, '/')),
    );
    for (const repositoryPath of uniquePaths) {
      if (!trackedPaths.has(repositoryPath)) {
        addFinding(
          findings,
          'FR_P5_PERSISTENT_ARTIFACT_UNTRACKED',
          'Required FR-P5 evidence and its bound files must be tracked or staged.',
          repositoryPath,
        );
      }
    }
    const changed = await execFileAsync(
      'git',
      ['diff', '--name-only', '-z', '--', ...uniquePaths],
      { cwd: projectRoot, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, windowsHide: true },
    );
    for (const repositoryPath of changed.stdout.toString('utf8').split('\0').filter(Boolean)) {
      addFinding(
        findings,
        'FR_P5_PERSISTENT_ARTIFACT_UNSTAGED_DRIFT',
        'Bound evidence file bytes must match the staged Git content.',
        repositoryPath.replace(/\\/g, '/'),
      );
    }
  } catch (error) {
    addFinding(
      findings,
      'FR_P5_GIT_BINDING_CHECK_FAILED',
      `Git binding check failed: ${error.message}`,
      projectRoot,
    );
  }
}

export async function validateFinalEvidence({
  projectRoot = rootDir,
  paths = FR_P5_FINAL_EVIDENCE_PATHS,
  requireTrackedFiles,
} = {}) {
  const findings = [];
  const normalizedPaths = { ...FR_P5_FINAL_EVIDENCE_PATHS, ...paths };
  const docsPromise = validatePersistentDocs(projectRoot, findings);
  const [policy, routeNetwork, visualQuality, pagesPerformance, runManifest] = await Promise.all([
    readEvidenceJson(projectRoot, normalizedPaths.policy, 'Accepted media policy', findings),
    readEvidenceJson(projectRoot, normalizedPaths.routeNetwork, 'Route-network baseline', findings),
    readEvidenceJson(projectRoot, normalizedPaths.visualQuality, 'Visual-quality baseline', findings),
    readEvidenceJson(projectRoot, normalizedPaths.pagesPerformance, 'Pages-performance baseline', findings),
    readEvidenceJson(projectRoot, normalizedPaths.runManifest, 'Run manifest', findings),
  ]);
  await docsPromise;
  if ([policy, routeNetwork, visualQuality, pagesPerformance, runManifest].some((document) => document === null)) {
    return { findings, summary: null };
  }
  const validation = validateFinalEvidenceDocuments({
    policy,
    routeNetwork,
    visualQuality,
    pagesPerformance,
    runManifest,
  });
  const allFindings = [...findings, ...validation.findings];
  const boundPaths = await validateBoundEvidenceFiles(projectRoot, {
    routeNetwork,
    visualQuality,
    pagesPerformance,
    findings: allFindings,
  });
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedDefaultRoot = path.resolve(rootDir);
  const isDefaultProjectRoot = process.platform === 'win32'
    ? resolvedProjectRoot.toLowerCase() === resolvedDefaultRoot.toLowerCase()
    : resolvedProjectRoot === resolvedDefaultRoot;
  if (requireTrackedFiles ?? isDefaultProjectRoot) {
    await validateTrackedFiles(projectRoot, [
      ...Object.values(normalizedPaths),
      ...FR_P5_REQUIRED_DOC_PATHS,
      ...boundPaths,
    ], allFindings);
  }
  return {
    findings: allFindings,
    summary: validation.summary,
  };
}

function parseArguments(argv) {
  const paths = { ...FR_P5_FINAL_EVIDENCE_PATHS };
  const flags = {
    '--policy': 'policy',
    '--route-network': 'routeNetwork',
    '--visual-quality': 'visualQuality',
    '--pages-performance': 'pagesPerformance',
    '--run-manifest': 'runManifest',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = flags[argv[index]];
    if (!key) throw new Error(`Unknown final evidence argument: ${argv[index]}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing path for ${argv[index]}`);
    paths[key] = value;
    index += 1;
  }
  return paths;
}

async function run() {
  const paths = parseArguments(process.argv.slice(2));
  const result = await validateFinalEvidence({ paths });
  if (result.summary) console.log(JSON.stringify(result.summary, null, 2));
  if (result.findings.length > 0) {
    for (const finding of result.findings) {
      console.error(`${finding.code}: ${finding.message}${finding.item ? ` (${finding.item})` : ''}`);
    }
    process.exitCode = 1;
    return;
  }
  if (result.summary.deploymentBoundaryStatus === 'PENDING_POSTDEPLOY_FINAL_HANDOFF') {
    console.log(
      'FR-P5 local route, visual and Pages evidence is valid; deploymentBoundary remains '
      + 'PENDING_POSTDEPLOY_FINAL_HANDOFF. This is not a live Pages PASS.',
    );
    return;
  }
  console.log('FR-P5 final route, visual and live Pages evidence is current and within frozen policy budgets.');
}

const directExecutionPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const scriptPath = fileURLToPath(import.meta.url);
const sameScript = process.platform === 'win32'
  ? directExecutionPath.toLocaleLowerCase('en-US') === scriptPath.toLocaleLowerCase('en-US')
  : directExecutionPath === scriptPath;

if (sameScript) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
