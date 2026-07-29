import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  PUBLIC_GITHUB_SYNC_POLICY_PATH,
  validatePublicGitHubSync,
} from '../scripts/validate-public-github-sync.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');

test('public GitHub sync is default-deny and contains the exact Pages closure', async () => {
  const policy = JSON.parse(await readFile(
    path.join(rootDir, ...PUBLIC_GITHUB_SYNC_POLICY_PATH.split('/')),
    'utf8',
  ));
  assert.equal(policy.visibility, 'public');
  assert.equal(policy.defaultAction, 'exclude');
  assert.equal(policy.maximumBlobBytes, 100000000);
  assert.equal(policy.excludedPrefixes.includes('source/'), true);
  assert.equal(policy.excludedPrefixes.includes('public/assets/cells-at-work/'), true);
  assert.deepEqual(
    policy.excludedSegmentsUnderPrefixes['public/books/'],
    ['generated', 'pages'],
  );

  const result = await validatePublicGitHubSync();
  assert.deepEqual(result.findings, []);
  assert.equal(result.summary.releaseFiles, 900);
  assert.equal(result.summary.largestBlobBytes < policy.maximumBlobBytes, true);
});

test('Pages workflow uses only the tracked-only public release gate', async () => {
  const workflow = await readFile(
    path.join(rootDir, '.github', 'workflows', 'pages.yml'),
    'utf8',
  );
  assert.match(workflow, /npm run verify:public-release/);
  assert.doesNotMatch(workflow, /npm run verify:release(?:\s|$)/);
  assert.doesNotMatch(workflow, /setup-python|Pillow==/);
});
