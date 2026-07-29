import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const publicTestFiles = [
  'tests/fr-p4a-content-loader.test.mjs',
  'tests/fr-p4b-r1-responsive-layout.test.mjs',
  'tests/fr-p5-runtime-media.test.mjs',
  'tests/fr-p5-media-shards.test.mjs',
  'tests/fr-p5-media-release-plan.test.mjs',
  'tests/fr-p5-release-gates.test.mjs',
  'tests/fr-p6-portfolio-seal.test.mjs',
  'tests/public-repository-validator.test.mjs',
  'tests/public-github-sync.test.mjs',
  'tests/maintenance-release.test.mjs',
  'tests/release-gates.test.mjs',
];

export function runPublicTestSuite() {
  const result = spawnSync(process.execPath, ['--test', ...publicTestFiles], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
  });
  return result.status ?? 1;
}

const directExecutionPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const scriptPath = fileURLToPath(import.meta.url);
const sameScript = process.platform === 'win32'
  ? directExecutionPath.toLowerCase() === scriptPath.toLowerCase()
  : directExecutionPath === scriptPath;

if (sameScript) {
  process.exitCode = runPublicTestSuite();
}
