import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_GITHUB_SYNC_POLICY_PATH = 'operations/github-sync/public-github-sync-policy.json';

function repositoryPath(value) {
  const normalized = String(value ?? '').replaceAll('\\', '/');
  if (
    !normalized
    || normalized.startsWith('/')
    || /^[A-Za-z]:\//u.test(normalized)
    || normalized.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`Unsafe repository path: ${normalized || '<empty>'}`);
  }
  return normalized;
}

function absolutePath(repositoryRelativePath) {
  const normalized = repositoryPath(repositoryRelativePath);
  const target = path.resolve(rootDir, ...normalized.split('/'));
  const relative = path.relative(rootDir, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escaped the repository: ${normalized}`);
  }
  return target;
}

function trackedIndexEntries() {
  const result = spawnSync('git', ['ls-files', '-s', '-z'], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${String(result.stderr || result.stdout).trim()}`);
  }
  const entries = result.stdout.split('\0').filter(Boolean).map((line) => {
    const match = line.match(/^(\d+) ([a-f0-9]+) (\d+)\t([\s\S]+)$/u);
    if (!match || match[3] !== '0') throw new Error(`Unexpected staged index entry: ${line}`);
    return {
      mode: match[1],
      oid: match[2],
      path: repositoryPath(match[4]),
    };
  }).sort((left, right) => left.path.localeCompare(right.path, 'en-US'));
  const uniqueOids = [...new Set(entries.map((entry) => entry.oid))];
  const sizesResult = spawnSync('git', ['cat-file', '--batch-check=%(objectsize)'], {
    cwd: rootDir,
    encoding: 'utf8',
    input: `${uniqueOids.join('\n')}\n`,
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (sizesResult.status !== 0) {
    throw new Error(`git cat-file failed: ${String(sizesResult.stderr || sizesResult.stdout).trim()}`);
  }
  const sizes = sizesResult.stdout.trim().split(/\r?\n/u).map(Number);
  if (sizes.length !== uniqueOids.length || sizes.some((size) => !Number.isSafeInteger(size) || size < 0)) {
    throw new Error('git cat-file returned invalid staged blob sizes.');
  }
  const sizeByOid = new Map(uniqueOids.map((oid, index) => [oid, sizes[index]]));
  return entries.map((entry) => ({ ...entry, bytes: sizeByOid.get(entry.oid) }));
}

function assertStableUniqueStrings(values, label) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !value)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  const sorted = [...new Set(values)].sort();
  if (JSON.stringify(values) !== JSON.stringify(sorted)) {
    throw new Error(`${label} must be unique and use stable ordinal order.`);
  }
}

function validatePolicy(policy) {
  if (policy?.schemaVersion !== 1 || policy.status !== 'active') {
    throw new Error('Public GitHub sync policy must be active schemaVersion 1.');
  }
  if (policy.visibility !== 'public' || policy.defaultAction !== 'exclude') {
    throw new Error('Public GitHub sync policy must be public and default-deny.');
  }
  if (!Number.isSafeInteger(policy.maximumBlobBytes) || policy.maximumBlobBytes < 1) {
    throw new Error('maximumBlobBytes must be a positive integer.');
  }
  for (const field of ['allowedFiles', 'allowedPrefixes', 'excludedPrefixes']) {
    assertStableUniqueStrings(policy[field], field);
    policy[field].forEach((value) => {
      if (field === 'allowedFiles') repositoryPath(value);
      else {
        if (!value.endsWith('/')) throw new Error(`${field} entries must end with /: ${value}`);
        repositoryPath(value.slice(0, -1));
      }
    });
  }
  if (!policy.excludedSegmentsUnderPrefixes || typeof policy.excludedSegmentsUnderPrefixes !== 'object') {
    throw new Error('excludedSegmentsUnderPrefixes must be an object.');
  }
  for (const [prefix, segments] of Object.entries(policy.excludedSegmentsUnderPrefixes)) {
    if (!prefix.endsWith('/')) throw new Error(`Excluded segment prefixes must end with /: ${prefix}`);
    repositoryPath(prefix.slice(0, -1));
    assertStableUniqueStrings(segments, `excludedSegmentsUnderPrefixes[${prefix}]`);
    if (segments.some((segment) => segment.includes('/'))) {
      throw new Error(`Excluded path segments must not contain slashes: ${prefix}`);
    }
  }
  repositoryPath(policy.requiredReleasePlan);
  return policy;
}

function exclusionReason(filePath, policy) {
  const excludedPrefix = policy.excludedPrefixes.find((prefix) => filePath.startsWith(prefix));
  if (excludedPrefix) return `excluded prefix ${excludedPrefix}`;
  for (const [prefix, segments] of Object.entries(policy.excludedSegmentsUnderPrefixes)) {
    if (!filePath.startsWith(prefix)) continue;
    const relativeSegments = filePath.slice(prefix.length).split('/');
    const segment = segments.find((candidate) => relativeSegments.includes(candidate));
    if (segment) return `excluded segment ${segment} under ${prefix}`;
  }
  return '';
}

function isAllowed(filePath, policy) {
  return policy.allowedFiles.includes(filePath)
    || policy.allowedPrefixes.some((prefix) => filePath.startsWith(prefix));
}

export async function validatePublicGitHubSync() {
  const policy = validatePolicy(JSON.parse(
    await readFile(absolutePath(PUBLIC_GITHUB_SYNC_POLICY_PATH), 'utf8'),
  ));
  const tracked = trackedIndexEntries();
  const trackedSet = new Set(tracked.map((entry) => entry.path));
  const findings = [];
  let trackedBytes = 0;
  let largestBlobBytes = 0;
  let largestBlobPath = '';

  for (const entry of tracked) {
    const filePath = entry.path;
    const reason = exclusionReason(filePath, policy);
    if (reason) findings.push({ code: 'TRACKED_LOCAL_ONLY', path: filePath, message: reason });
    if (!isAllowed(filePath, policy)) {
      findings.push({ code: 'TRACKED_NOT_ALLOWLISTED', path: filePath, message: 'not covered by the default-deny allowlist' });
    }
    const fileState = await stat(absolutePath(filePath)).catch((error) => ({ error }));
    if (fileState.error || !fileState.isFile()) {
      findings.push({ code: 'TRACKED_FILE_MISSING', path: filePath, message: fileState.error?.message || 'not a regular file' });
      continue;
    }
    trackedBytes += entry.bytes;
    if (entry.bytes > largestBlobBytes) {
      largestBlobBytes = entry.bytes;
      largestBlobPath = filePath;
    }
    if (entry.bytes > policy.maximumBlobBytes) {
      findings.push({
        code: 'TRACKED_BLOB_TOO_LARGE',
        path: filePath,
        message: `${entry.bytes} bytes exceeds ${policy.maximumBlobBytes}`,
      });
    }
  }

  const releasePlan = JSON.parse(await readFile(absolutePath(policy.requiredReleasePlan), 'utf8'));
  const releaseFiles = Array.isArray(releasePlan.files) ? releasePlan.files : [];
  if (releaseFiles.length === 0) {
    findings.push({ code: 'RELEASE_PLAN_EMPTY', path: policy.requiredReleasePlan, message: 'release plan has no files' });
  }
  for (const releasePath of releaseFiles) {
    const normalized = repositoryPath(releasePath);
    if (normalized !== '.nojekyll' && !trackedSet.has(normalized)) {
      findings.push({ code: 'RELEASE_FILE_UNTRACKED', path: normalized, message: 'Pages release file is absent from Git' });
    }
  }

  return {
    findings,
    summary: {
      policy: PUBLIC_GITHUB_SYNC_POLICY_PATH,
      trackedFiles: tracked.length,
      trackedBytes,
      releaseFiles: releaseFiles.length,
      largestBlobBytes,
      largestBlobPath,
    },
  };
}

async function run() {
  const result = await validatePublicGitHubSync();
  console.log(JSON.stringify(result.summary, null, 2));
  if (result.findings.length > 0) {
    for (const finding of result.findings.slice(0, 100)) {
      console.error(`${finding.code}: ${finding.path}: ${finding.message}`);
    }
    if (result.findings.length > 100) {
      console.error(`...and ${result.findings.length - 100} additional findings.`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Public GitHub sync policy passed.');
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
