import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const steps = [
  {
    label: 'tracked runtime content staleness check',
    args: ['scripts/generate-runtime-content.mjs', '--check'],
  },
  {
    label: 'tracked media inventory staleness check',
    args: ['scripts/inventory-runtime-media.mjs', '--check'],
  },
  {
    label: 'responsive media manifest, derivative and reference validation',
    args: ['scripts/validate-responsive-media.mjs'],
  },
  {
    label: 'deterministic route media shard validation',
    args: ['scripts/generate-media-shards.mjs', '--check'],
  },
  {
    label: 'exact media release plan staleness check',
    args: ['scripts/media-release-plan.mjs', '--check'],
  },
  {
    label: 'historical portfolio seal and current maintenance overlay validation',
    args: ['scripts/validate-portfolio-seal.mjs'],
  },
  {
    label: 'current maintenance release evidence validation',
    args: ['scripts/validate-maintenance-release.mjs'],
  },
  {
    label: 'full test suite',
    args: ['scripts/run-tests.mjs'],
  },
  {
    label: 'public repository privacy boundary validation',
    args: ['scripts/validate-public-repository.mjs'],
  },
  {
    label: 'default-deny public GitHub sync validation',
    args: ['scripts/validate-public-github-sync.mjs'],
  },
  {
    label: 'validated static build and dist audit',
    args: ['scripts/build.mjs', '--validated-inputs'],
  },
];

for (const step of steps) {
  console.log(`Running ${step.label} with ${process.version}...`);
  const result = spawnSync(process.execPath, step.args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Release verification passed with ${process.version}.`);
