import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  AUDIO_EXTENSIONS,
  MEDIA_MANIFEST_PATH,
  MEDIA_REFERENCE_REPORT_PATH,
  assertAllowedOutput,
  normalizeRepositoryPath,
  projectPath,
  stableCompare,
} from './media-path-policy.mjs';
import {
  declaredDerivativePaths,
  declaredFallbackPaths,
  validateMediaManifest,
} from './media-manifest-policy.mjs';
import {
  generateMediaShardSet,
  validateMaterializedShardSet,
} from './generate-media-shards.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MEDIA_RELEASE_PLAN_PATH = 'operations/maintenance/fr-maint-media-slim-01/media-release-plan.json';
const applicationEntrypoint = 'index.html';
const runtimeEntrypoint = 'public/runtime/index.json';
const runtimeManifestPath = 'public/runtime/runtime-manifest.json';
const EMPTY_SHA256 = createHash('sha256').update('').digest('hex');
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const APPLICATION_ROOT = 'assets/';
const TEXT_DEPENDENCY_EXTENSIONS = new Set(['.css', '.html', '.js', '.mjs', '.svg']);

async function readJson(projectRoot, repositoryPath) {
  return JSON.parse(await readFile(projectPath(projectRoot, repositoryPath), 'utf8'));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sortedUnique(values) {
  return [...new Set(values)].sort(stableCompare);
}

function assertSamePaths(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    const missing = expected.filter((item) => !actualSet.has(item));
    const extra = actual.filter((item) => !expectedSet.has(item));
    throw new Error(`${label} mismatch: missing=${missing.join(',') || '<none>'} extra=${extra.join(',') || '<none>'}`);
  }
}

function stripUrlSuffix(value) {
  return String(value ?? '').trim().split(/[?#]/u, 1)[0];
}

function isExternalReference(value) {
  return (
    !value
    || value.startsWith('#')
    || value.startsWith('//')
    || /^[a-z][a-z0-9+.-]*:/iu.test(value)
  );
}

function resolveRepositoryReference(fromPath, value) {
  const reference = stripUrlSuffix(value);
  if (isExternalReference(reference)) return null;
  if (reference.startsWith('/')) {
    throw new Error(`Root-absolute release reference is not GitHub Pages subpath-safe: ${fromPath} -> ${reference}`);
  }
  const resolved = reference.startsWith('assets/') || reference.startsWith('public/')
    ? reference
    : path.posix.join(path.posix.dirname(fromPath), reference);
  return normalizeRepositoryPath(resolved, {
    label: `Reference from ${fromPath}`,
    requirePublic: false,
  });
}

function extractApplicationSpecifiers(repositoryPath, content) {
  const extension = path.posix.extname(repositoryPath).toLowerCase();
  const references = [];
  const patterns = [];
  if (extension === '.html' || extension === '.svg') {
    patterns.push(/\b(?:href|src)\s*=\s*["']([^"']+)["']/giu);
  }
  if (extension === '.js' || extension === '.mjs') {
    patterns.push(
      /\b(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/gu,
      /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
    );
  }
  if (extension === '.css') {
    patterns.push(
      /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?/giu,
      /url\(\s*["']?([^"')]+)["']?\s*\)/giu,
    );
  }
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) references.push(match[1]);
  }
  return references;
}

async function assertFile(projectRoot, repositoryPath, label) {
  const target = projectPath(projectRoot, repositoryPath);
  try {
    await access(target, constants.R_OK);
    const state = await stat(target);
    if (!state.isFile()) throw new Error(`${label} is not a file: ${repositoryPath}`);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${label} is missing: ${repositoryPath}`);
    throw error;
  }
}

export async function discoverApplicationFiles(projectRoot = rootDir) {
  const visited = new Set();
  const queue = [applicationEntrypoint];
  while (queue.length > 0) {
    const repositoryPath = queue.shift();
    if (visited.has(repositoryPath)) continue;
    await assertFile(projectRoot, repositoryPath, 'Application dependency');
    visited.add(repositoryPath);
    if (!TEXT_DEPENDENCY_EXTENSIONS.has(path.posix.extname(repositoryPath).toLowerCase())) continue;
    const content = await readFile(projectPath(projectRoot, repositoryPath), 'utf8');
    for (const specifier of extractApplicationSpecifiers(repositoryPath, content)) {
      const dependency = resolveRepositoryReference(repositoryPath, specifier);
      if (!dependency) continue;
      if (!dependency.startsWith(APPLICATION_ROOT)) {
        throw new Error(`Application dependency must stay under assets/: ${repositoryPath} -> ${dependency}`);
      }
      queue.push(dependency);
    }
  }
  return [...visited].sort(stableCompare);
}

function collectStringValues(value, results = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, results));
    return results;
  }
  if (!value || typeof value !== 'object') return results;
  for (const child of Object.values(value)) {
    if (typeof child === 'string') results.push(child);
    else collectStringValues(child, results);
  }
  return results;
}

export async function discoverRuntimeJsonClosure(projectRoot = rootDir) {
  const visited = new Set();
  const queue = [runtimeEntrypoint];
  while (queue.length > 0) {
    const repositoryPath = queue.shift();
    if (visited.has(repositoryPath)) continue;
    if (!repositoryPath.endsWith('.json')) {
      throw new Error(`Runtime closure contains a non-JSON path: ${repositoryPath}`);
    }
    await assertFile(projectRoot, repositoryPath, 'Runtime JSON');
    const data = await readJson(projectRoot, repositoryPath);
    visited.add(repositoryPath);
    for (const value of collectStringValues(data)) {
      const stripped = stripUrlSuffix(value);
      if (
        !stripped
        || stripped.includes('{')
        || stripped.includes('}')
        || !stripped.toLowerCase().endsWith('.json')
      ) {
        continue;
      }
      const dependency = resolveRepositoryReference(repositoryPath, stripped);
      if (!dependency?.startsWith('public/')) continue;
      queue.push(dependency);
    }
  }

  const runtimeManifest = await readJson(projectRoot, runtimeManifestPath);
  const declaredRuntimeOutputs = sortedUnique(
    (runtimeManifest.outputs ?? []).map((output, index) => normalizeRepositoryPath(output.path, {
      label: `runtime-manifest.outputs[${index}].path`,
    })),
  );
  const missingRuntimeOutputs = declaredRuntimeOutputs.filter((filePath) => !visited.has(filePath));
  if (missingRuntimeOutputs.length > 0) {
    throw new Error(`Runtime JSON closure does not reach declared runtime outputs: ${missingRuntimeOutputs.join(', ')}`);
  }
  visited.add(runtimeManifestPath);
  return [...visited].sort(stableCompare);
}

function assertPublishablePath(value, label) {
  const repositoryPath = normalizeRepositoryPath(value, { label, requirePublic: false });
  const forbidden = [
    'source/',
    'source-private/',
    'private/',
    'data-private/',
    'task-scratch/',
    'test-results/',
    'playwright-report/',
    'reports/',
    'docs/',
  ];
  if (forbidden.some((prefix) => repositoryPath.startsWith(prefix))) {
    throw new Error(`${label} points at a forbidden release root: ${repositoryPath}`);
  }
  return repositoryPath;
}

export function mediaShardReleaseFiles(shardSet) {
  if (!shardSet || !Array.isArray(shardSet.shards)) {
    throw new Error('Generated media shard set is required for release planning.');
  }
  if (shardSet.shards.length !== 42) {
    throw new Error(`Release planning requires exactly 42 media shards; found ${shardSet.shards.length}.`);
  }
  const indexPath = normalizeRepositoryPath(shardSet.indexPath, {
    label: 'Media shard index',
  });
  if (indexPath !== 'public/media/media-shard-index.json') {
    throw new Error(`Unexpected media shard index path: ${indexPath}`);
  }
  const shardPaths = shardSet.shards.map((shard, index) => {
    const shardPath = normalizeRepositoryPath(shard.path, {
      label: `Media shard[${index}]`,
    });
    if (!shardPath.startsWith('public/media/shards/') || !shardPath.endsWith('.json')) {
      throw new Error(`Media shard path is outside the canonical shard root: ${shardPath}`);
    }
    return shardPath;
  });
  const files = sortedUnique([indexPath, ...shardPaths]);
  if (files.length !== 43) throw new Error('Media shard release paths must be unique.');
  return files;
}

async function fileIntegrity(projectRoot, repositoryPath) {
  if (repositoryPath === '.nojekyll') {
    return { path: repositoryPath, bytes: 0, sha256: EMPTY_SHA256 };
  }
  const bytes = await readFile(projectPath(projectRoot, repositoryPath));
  return {
    path: repositoryPath,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export async function createMediaReleasePlan({ projectRoot = rootDir } = {}) {
  const manifest = validateMediaManifest(await readJson(projectRoot, MEDIA_MANIFEST_PATH));
  const inventory = await readJson(projectRoot, MEDIA_REFERENCE_REPORT_PATH);
  const applicationFiles = await discoverApplicationFiles(projectRoot);
  const runtimeClosureFiles = await discoverRuntimeJsonClosure(projectRoot);
  const shardSet = await generateMediaShardSet({ projectRoot });
  const shardValidation = await validateMaterializedShardSet({
    projectRoot,
    expected: shardSet,
  });
  if (shardValidation.findings.length > 0) {
    const finding = shardValidation.findings[0];
    throw new Error(`Media shard release closure is invalid: ${finding.code}${finding.item ? ` (${finding.item})` : ''}`);
  }
  const mediaShardFiles = mediaShardReleaseFiles(shardSet);
  const runtimeJsonFiles = sortedUnique([...runtimeClosureFiles, ...mediaShardFiles]);

  const inventorySourcePaths = sortedUnique((inventory.media ?? []).map((record, index) => (
    normalizeRepositoryPath(record.path, {
      label: `inventory.media[${index}].path`,
    })
  )));
  const manifestSourcePaths = manifest.media.map((entry) => entry.sourcePath).sort(stableCompare);
  assertSamePaths(manifestSourcePaths, inventorySourcePaths, 'Manifest source and inventory reference closure');

  const audioFiles = sortedUnique((inventory.audio ?? []).map((audio, index) => {
    const audioPath = normalizeRepositoryPath(audio.path, {
      label: `inventory.audio[${index}].path`,
    });
    if (!AUDIO_EXTENSIONS.has(path.posix.extname(audioPath).toLowerCase())) {
      throw new Error(`Inventory audio has an unsupported extension: ${audioPath}`);
    }
    if (audio.present !== true) throw new Error(`Inventory audio is not present: ${audioPath}`);
    return assertPublishablePath(audioPath, 'Inventory audio');
  }));

  const derivativeFiles = [...declaredDerivativePaths(manifest)]
    .map((filePath) => assertPublishablePath(filePath, 'Media derivative'))
    .sort(stableCompare);
  const fallbackFiles = [...declaredFallbackPaths(manifest)]
    .map((filePath) => assertPublishablePath(filePath, 'Media fallback'))
    .sort(stableCompare);
  const mediaFiles = sortedUnique([MEDIA_MANIFEST_PATH, ...derivativeFiles, ...fallbackFiles]);

  const publishableGroups = [
    ...applicationFiles,
    ...runtimeJsonFiles,
    ...audioFiles,
    ...mediaFiles,
  ].map((filePath) => assertPublishablePath(filePath, 'Release file'));
  const files = sortedUnique(['.nojekyll', ...publishableGroups]);
  if (files.length !== publishableGroups.length + 1) {
    throw new Error('Release closure categories overlap; every published path must have one canonical owner.');
  }
  for (const filePath of files) {
    if (filePath !== '.nojekyll') await assertFile(projectRoot, filePath, 'Release file');
  }
  const integrity = [];
  for (const filePath of files) integrity.push(await fileIntegrity(projectRoot, filePath));

  const fallbackOriginals = fallbackFiles.filter((filePath) => !filePath.startsWith('public/media/derived/'));
  const integrityByPath = new Map(integrity.map((item) => [item.path, item]));
  const bytesFor = (filePaths) => filePaths.reduce(
    (sum, filePath) => sum + integrityByPath.get(filePath).bytes,
    0,
  );
  return {
    schemaVersion: 1,
    sourceManifest: MEDIA_MANIFEST_PATH,
    sourceInventory: MEDIA_REFERENCE_REPORT_PATH,
    entrypoints: {
      application: applicationEntrypoint,
      runtime: runtimeEntrypoint,
      runtimeManifest: runtimeManifestPath,
    },
    applicationFiles,
    runtimeJsonFiles,
    mediaShardFiles,
    audioFiles,
    mediaFiles,
    files,
    integrity,
    byteTotals: {
      total: bytesFor(files),
      applicationFiles: bytesFor(applicationFiles),
      runtimeJsonFiles: bytesFor(runtimeJsonFiles),
      mediaShardFiles: bytesFor(mediaShardFiles),
      audioFiles: bytesFor(audioFiles),
      mediaFiles: bytesFor(mediaFiles),
      derivativeFiles: bytesFor(derivativeFiles),
      fallbackFiles: bytesFor(fallbackFiles),
      fallbackOriginals: bytesFor(fallbackOriginals),
    },
    counts: {
      total: files.length,
      applicationFiles: applicationFiles.length,
      runtimeJsonFiles: runtimeJsonFiles.length,
      mediaShardFiles: mediaShardFiles.length,
      audioFiles: audioFiles.length,
      mediaFiles: mediaFiles.length,
      sources: manifest.media.length,
      derivatives: derivativeFiles.length,
      derivativeFiles: derivativeFiles.length,
      fallbackFiles: fallbackFiles.length,
      fallbackOriginals: fallbackOriginals.length,
    },
    derivativeFiles,
    fallbackFiles,
    fallbackOriginals,
  };
}

function parseArguments(argv) {
  const options = { mode: 'print' };
  for (const argument of argv) {
    if (argument === '--write') options.mode = 'write';
    else if (argument === '--check') options.mode = 'check';
    else throw new Error(`Unknown media release plan argument: ${argument}`);
  }
  return options;
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  const plan = await createMediaReleasePlan();
  const serialized = stableJson(plan);
  const target = projectPath(rootDir, MEDIA_RELEASE_PLAN_PATH);
  if (options.mode === 'write') {
    assertAllowedOutput(rootDir, target);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, serialized, 'utf8');
    console.log(`Media release plan written: ${MEDIA_RELEASE_PLAN_PATH}`);
  } else if (options.mode === 'check') {
    const current = await readFile(target, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') throw new Error(`Media release plan is missing: ${MEDIA_RELEASE_PLAN_PATH}`);
      throw error;
    });
    if (current.replaceAll('\r\n', '\n') !== serialized) {
      throw new Error(`Media release plan is stale: ${MEDIA_RELEASE_PLAN_PATH}`);
    }
    console.log('Media release plan is current.');
  } else {
    process.stdout.write(serialized);
  }
}

const directExecutionPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const scriptPath = fileURLToPath(import.meta.url);
const sameScript = process.platform === 'win32'
  ? directExecutionPath.toLowerCase() === scriptPath.toLowerCase()
  : directExecutionPath === scriptPath;

if (sameScript) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
