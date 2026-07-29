import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMaintenanceRelease } from '../scripts/validate-maintenance-release.mjs';

test('maintenance release binds the slimmer media and Pages closure', async () => {
  const summary = await validateMaintenanceRelease();
  assert.equal(summary.sources, 778);
  assert.equal(summary.variants, 778);
  assert.equal(summary.derivativeBytes < 612770984, true);
  assert.equal(summary.pagesBytes < 706990045, true);
  assert.equal(summary.derivativeSavings > 0, true);
  assert.equal(summary.pagesSavings > 0, true);
  assert.match(summary.policyHash, /^[a-f0-9]{64}$/);
});
