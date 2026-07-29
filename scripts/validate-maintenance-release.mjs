import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  canonicalPolicyHash,
  validateMediaManifest,
  validateMediaQualityPolicy,
} from './media-manifest-policy.mjs';
import {
  MEDIA_MANIFEST_PATH,
  MEDIA_POLICY_PATH,
} from './media-path-policy.mjs';
import { MEDIA_RELEASE_PLAN_PATH } from './media-release-plan.mjs';
import { validateMediaReleasePlan } from './copy-media-release-plan.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MAINTENANCE_RELEASE_REPORT_PATH = 'operations/maintenance/fr-maint-media-slim-01/release-report.json';
const BASELINE_DERIVATIVE_BYTES = 612770984;
const BASELINE_PAGES_BYTES = 706990045;
const BASELINE_SOURCES = 778;
const BASELINE_VARIANTS = 2735;
const CURRENT_VARIANTS = 778;
const CURRENT_RELEASE_FILES = 900;

function projectPath(repositoryPath) {
  const target = path.resolve(rootDir, ...repositoryPath.split('/'));
  const relative = path.relative(rootDir, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escaped the project root: ${repositoryPath}`);
  }
  return target;
}

async function readJson(repositoryPath) {
  return JSON.parse(await readFile(projectPath(repositoryPath), 'utf8'));
}

async function fileSha256(repositoryPath) {
  return createHash('sha256').update(await readFile(projectPath(repositoryPath))).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function validateMaintenanceRelease() {
  const [report, rawPolicy, rawManifest, rawPlan] = await Promise.all([
    readJson(MAINTENANCE_RELEASE_REPORT_PATH),
    readJson(MEDIA_POLICY_PATH),
    readJson(MEDIA_MANIFEST_PATH),
    readJson(MEDIA_RELEASE_PLAN_PATH),
  ]);
  const policy = validateMediaQualityPolicy(rawPolicy);
  const manifest = validateMediaManifest(rawManifest);
  const plan = validateMediaReleasePlan(rawPlan);
  const [manifestSha256, releasePlanSha256] = await Promise.all([
    fileSha256(MEDIA_MANIFEST_PATH),
    fileSha256(MEDIA_RELEASE_PLAN_PATH),
  ]);
  const policyHash = canonicalPolicyHash(rawPolicy);

  assert(report?.schemaVersion === 1, 'Maintenance release report must use schemaVersion 1.');
  assert(report.id === 'FR-MAINT-MEDIA-SLIM-01', 'Maintenance release report id is invalid.');
  assert(report.status === 'PASS', 'Maintenance release report status must be PASS.');
  assert(report.historyRewrite === false, 'Maintenance report must confirm that history was not rewritten.');
  assert(report.deployed === false, 'Local maintenance report must not claim deployment.');
  assert(report.baseline?.derivativeBytes === BASELINE_DERIVATIVE_BYTES, 'Sealed derivative baseline drifted.');
  assert(report.baseline?.pagesBytes === BASELINE_PAGES_BYTES, 'Sealed Pages baseline drifted.');

  assert(report.current?.policyPath === MEDIA_POLICY_PATH, 'Maintenance report policy path is stale.');
  assert(report.current?.policyHash === policyHash, 'Maintenance report policy hash is stale.');
  assert(report.current?.manifestPath === MEDIA_MANIFEST_PATH, 'Maintenance report manifest path is stale.');
  assert(report.current?.manifestSha256 === manifestSha256, 'Maintenance report manifest hash is stale.');
  assert(report.current?.releasePlanPath === MEDIA_RELEASE_PLAN_PATH, 'Maintenance report release plan path is stale.');
  assert(report.current?.releasePlanSha256 === releasePlanSha256, 'Maintenance report release plan hash is stale.');
  assert(report.current?.sources === BASELINE_SOURCES && manifest.totals.sources === BASELINE_SOURCES, 'Media source count drifted.');
  assert(report.baseline?.variants === BASELINE_VARIANTS, 'Sealed variant baseline drifted.');
  assert(report.current?.variants === CURRENT_VARIANTS && manifest.totals.variants === CURRENT_VARIANTS, 'Every current source must have exactly one variant.');
  assert(manifest.media.every((entry) => entry.variants.length === 1), 'Every current media entry must publish exactly one variant.');
  assert(report.current?.derivativeBytes === manifest.totals.derivativeBytes, 'Maintenance derivative bytes are stale.');
  assert(report.current?.pagesBytes === plan.byteTotals.total, 'Maintenance Pages bytes are stale.');
  assert(report.current?.releaseFiles === plan.counts.total, 'Maintenance release file count is stale.');
  assert(plan.counts.total === CURRENT_RELEASE_FILES, 'Single-tier release must contain exactly 900 files.');

  assert(manifest.policyHash === policyHash, 'Manifest does not use the maintenance policy.');
  assert(policy.profiles.length === 1, 'Maintenance policy must define exactly one image profile.');
  assert(policy.profiles[0].id === 'companion-640-webp', 'Maintenance policy profile id drifted.');
  assert(policy.profiles[0].width === 640, 'Maintenance policy width must be 640px.');
  assert(policy.profiles[0].quality === 88, 'Maintenance policy quality must be q88.');
  assert(manifest.totals.derivativeBytes < BASELINE_DERIVATIVE_BYTES, 'Derivative bytes did not improve on the sealed baseline.');
  assert(plan.byteTotals.total < BASELINE_PAGES_BYTES, 'Pages bytes did not improve on the sealed baseline.');
  assert(plan.byteTotals.total <= policy.budgets.distBytes, 'Pages closure exceeds the frozen dist budget.');
  assert(plan.byteTotals.total <= policy.budgets.pagesArtifactBytes, 'Pages closure exceeds the frozen artifact budget.');

  const derivativeSavings = BASELINE_DERIVATIVE_BYTES - manifest.totals.derivativeBytes;
  const pagesSavings = BASELINE_PAGES_BYTES - plan.byteTotals.total;
  assert(report.savings?.derivativeBytes === derivativeSavings, 'Derivative savings are stale.');
  assert(report.savings?.pagesBytes === pagesSavings, 'Pages savings are stale.');
  assert(report.savings?.derivativePercent === Number((derivativeSavings / BASELINE_DERIVATIVE_BYTES * 100).toFixed(2)), 'Derivative savings percent is stale.');
  assert(report.savings?.pagesPercent === Number((pagesSavings / BASELINE_PAGES_BYTES * 100).toFixed(2)), 'Pages savings percent is stale.');

  assert(report.visualExperiment?.samples === 2, 'Maintenance visual experiment must cover the two reported mobile fixtures.');
  assert(report.visualExperiment?.selectedWidth === 640, 'Maintenance single-tier width must be 640.');
  assert(report.visualExperiment?.selectedQuality === 88, 'Maintenance single-tier quality must be q88.');
  assert(report.visualExperiment?.variantsPerSource === 1, 'Maintenance must retain one variant per source.');
  assert(report.visualExperiment?.status === 'PASS', 'Maintenance visual experiment must pass.');
  assert(report.browserAcceptance?.status === 'PASS', 'Maintenance browser acceptance must pass.');
  assert(report.browserAcceptance?.routes?.length === 3, 'Maintenance browser acceptance must cover three representative routes.');
  assert(report.browserAcceptance?.policyPrefix === `public/media/derived/${policyHash.slice(0, 32)}/`, 'Maintenance browser policy prefix is stale.');
  assert(report.browserAcceptance?.horizontalOverflowFindings === 0, 'Maintenance browser acceptance found horizontal overflow.');
  assert(report.browserAcceptance?.requestFailures === 0, 'Maintenance browser acceptance found failed requests.');
  assert(report.browserAcceptance?.consoleErrors === 0, 'Maintenance browser acceptance found console errors.');
  assert(report.browserAcceptance?.whiteCanvasFindings === 0, 'Maintenance browser acceptance found a white lightbox canvas.');
  assert(report.browserAcceptance?.secondDprReduction === false, 'Maintenance browser still applies a second DPR reduction.');

  return {
    sources: manifest.totals.sources,
    variants: manifest.totals.variants,
    derivativeBytes: manifest.totals.derivativeBytes,
    pagesBytes: plan.byteTotals.total,
    derivativeSavings,
    pagesSavings,
    policyHash,
  };
}

const directExecutionPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const scriptPath = fileURLToPath(import.meta.url);
const sameScript = process.platform === 'win32'
  ? directExecutionPath.toLowerCase() === scriptPath.toLowerCase()
  : directExecutionPath === scriptPath;

if (sameScript) {
  validateMaintenanceRelease()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
      console.log('Maintenance release report passed.');
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
