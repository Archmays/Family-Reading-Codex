import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createMediaResolver } from '../assets/media-resolver.js';
import {
  DERIVATIVE_POLICY_HASH_HEX_LENGTH,
  derivativeRepositoryPath,
  normalizeImagePath,
  stableCompare,
} from '../scripts/media-path-policy.mjs';
import {
  canonicalJson,
  canonicalPolicyHash,
  encoderOptionsForProfile,
  validateMediaManifest,
  validateMediaQualityPolicy,
} from '../scripts/media-manifest-policy.mjs';

const root = path.resolve(import.meta.dirname, '..');
const SYNTHETIC_SOURCE_HASH = 'a'.repeat(64);
const SYNTHETIC_POLICY_HASH = 'b'.repeat(64);

function syntheticDerivativePath(profileId, extension = 'webp', {
  sourcePath = 'public/example/page.png',
  sourceHash = SYNTHETIC_SOURCE_HASH,
  policyHash = SYNTHETIC_POLICY_HASH,
} = {}) {
  return derivativeRepositoryPath({
    sourcePath,
    sourceHash,
    policyHash,
    profileId,
    extension,
  });
}

async function readJson(repositoryPath) {
  return JSON.parse(await readFile(path.join(root, ...repositoryPath.split('/')), 'utf8'));
}

function syntheticManifest() {
  const sourceHash = SYNTHETIC_SOURCE_HASH;
  return {
    schemaVersion: 2,
    generatorVersion: 'fr-p5-test',
    policyHash: SYNTHETIC_POLICY_HASH,
    toolVersions: {
      python: '3.12.7',
      pillow: '10.4.0',
      libwebp: '1.3.2',
    },
    media: [
      {
        sourcePath: 'public/example/page.png',
        sourceHash,
        sourceStoredWidth: 1600,
        sourceStoredHeight: 1200,
        sourceWidth: 1600,
        sourceHeight: 1200,
        sourceBytes: 900000,
        sourceFormat: 'png',
        sourceMode: 'RGB',
        hasAlpha: false,
        exifOrientation: 1,
        orientationNormalized: false,
        sourceFrames: 1,
        animated: false,
        lineageKind: 'self',
        derivationSourcePath: 'public/example/page.png',
        referenceHash: sourceHash,
        referenceStoredWidth: 1600,
        referenceStoredHeight: 1200,
        referenceWidth: 1600,
        referenceHeight: 1200,
        referenceBytes: 900000,
        referenceFormat: 'png',
        referenceMode: 'RGB',
        referenceHasAlpha: false,
        referenceExifOrientation: 1,
        referenceOrientationNormalized: false,
        referenceFrames: 1,
        referenceAnimated: false,
        roles: ['carmela-lightbox', 'carmela-page-preview'],
        fallbackPath: syntheticDerivativePath('preview-640'),
        fallbacksByRole: {
          'carmela-lightbox': syntheticDerivativePath('lightbox-1280'),
          'carmela-page-preview': syntheticDerivativePath('preview-640'),
        },
        variants: [
          {
            profileId: 'lightbox-1280',
            path: syntheticDerivativePath('lightbox-1280'),
            width: 1280,
            height: 960,
            format: 'webp',
            mode: 'RGB',
            hasAlpha: false,
            alphaPreserved: false,
            bytes: 160000,
            sha256: 'c'.repeat(64),
            sourceHash,
            roles: ['carmela-lightbox'],
            lossless: false,
            quality: 90,
            encoderOptions: {
              exact: true,
              lossless: false,
              method: 6,
              quality: 90,
            },
          },
          {
            profileId: 'preview-640',
            path: syntheticDerivativePath('preview-640'),
            width: 640,
            height: 480,
            format: 'webp',
            mode: 'RGB',
            hasAlpha: false,
            alphaPreserved: false,
            bytes: 50000,
            sha256: 'd'.repeat(64),
            sourceHash,
            roles: ['carmela-page-preview'],
            lossless: false,
            quality: 88,
            encoderOptions: {
              exact: true,
              lossless: false,
              method: 6,
              quality: 88,
            },
          },
        ],
      },
    ],
    totals: {
      sources: 1,
      referenceBytes: 900000,
      sourceBytes: 900000,
      variants: 2,
      derivativeBytes: 210000,
    },
  };
}

function syntheticPolicy() {
  const roles = [
    'carmela-book-cover',
    'carmela-explanation-preview',
    'carmela-lightbox',
    'carmela-page-preview',
    'carmela-series-cover',
    'work-cells-lightbox',
    'work-cells-manga-preview',
    'work-cells-series-thumbnail',
    'work-cells-station-preview',
    'work-cells-topic-hero',
  ];
  return {
    schemaVersion: 1,
    status: 'accepted',
    encoder: {
      name: 'Pillow',
      version: '10.4.0',
      pythonVersion: '3.12.7',
      libwebpVersion: '1.3.2',
    },
    profiles: roles.map((role, index) => ({
      id: `profile-${String(index + 1).padStart(2, '0')}`,
      format: 'webp',
      width: 640,
      quality: 90,
      lossless: false,
      method: 6,
      exact: true,
      preserveAlpha: true,
      roles: [role],
    })),
    alphaStrategy: {
      preserveWhenSupported: true,
      flattenColor: '#ffffff',
    },
    fallbackStrategy: {
      preferDerivative: true,
      allowSourcePath: false,
      formatOrder: ['webp', 'jpeg', 'png'],
    },
    visualAcceptance: {
      status: 'pass',
      sampleMediaIds: ['public/example/page.png'],
    },
    budgets: {
      status: 'frozen',
      distBytes: 1000000,
      pagesArtifactBytes: 1000000,
      routeTransferBytes: {
        '#/': 100000,
      },
    },
  };
}

test('FR-P5 media paths are ordinal, repository-relative and deterministic', () => {
  assert.equal(DERIVATIVE_POLICY_HASH_HEX_LENGTH, 32);
  assert.equal(stableCompare('A', 'B'), -1);
  assert.equal(stableCompare('B', 'A'), 1);
  assert.equal(stableCompare('同', '同'), 0);
  assert.equal(normalizeImagePath('public/example/page.png'), 'public/example/page.png');
  assert.throws(() => normalizeImagePath('../source/page.png'), /unsafe|public/i);
  const windowsAbsoluteFixture = ['C:', 'page.png'].join('/');
  assert.throws(() => normalizeImagePath(windowsAbsoluteFixture), /repository-relative/i);
  assert.throws(() => normalizeImagePath('public/CON/page.png'), /unsafe/i);
  assert.throws(() => normalizeImagePath('public/example./page.png'), /unsafe/i);
  assert.throws(() => normalizeImagePath('public/example/page?.png'), /unsafe/i);
  assert.throws(() => normalizeImagePath('public/example/page.txt'), /unsupported extension/i);
  const webpPath = syntheticDerivativePath('preview-640');
  assert.equal(
    webpPath,
    `public/media/derived/${SYNTHETIC_POLICY_HASH.slice(0, 32)}/aa/aaaaaaaaaaaa/page-preview-640.webp`,
  );
  assert.equal(
    syntheticDerivativePath('preview-640', 'jpeg'),
    `public/media/derived/${SYNTHETIC_POLICY_HASH.slice(0, 32)}/aa/aaaaaaaaaaaa/page-preview-640.jpg`,
  );
  assert.throws(
    () => derivativeRepositoryPath({
      sourcePath: 'public/example/page.png',
      sourceHash: SYNTHETIC_SOURCE_HASH,
      policyHash: 'not-a-policy-hash',
      profileId: 'preview-640',
      extension: 'webp',
    }),
    /policy SHA-256/i,
  );

  const changedPolicy = structuredClone(syntheticPolicy());
  changedPolicy.profiles[0].quality += 1;
  const originalPolicyPath = syntheticDerivativePath('preview-640', 'webp', {
    policyHash: canonicalPolicyHash(syntheticPolicy()),
  });
  const changedPolicyPath = syntheticDerivativePath('preview-640', 'webp', {
    policyHash: canonicalPolicyHash(changedPolicy),
  });
  assert.notEqual(changedPolicyPath, originalPolicyPath);
  const changedEncoder = structuredClone(syntheticPolicy());
  changedEncoder.encoder.libwebpVersion = '1.3.3';
  assert.notEqual(
    syntheticDerivativePath('preview-640', 'webp', {
      policyHash: canonicalPolicyHash(changedEncoder),
    }),
    originalPolicyPath,
  );
  assert.notEqual(
    syntheticDerivativePath('preview-640', 'webp', { sourceHash: 'c'.repeat(64) }),
    webpPath,
  );

  const parityVectors = [
    [
      'public/example/page.png',
      SYNTHETIC_SOURCE_HASH,
      SYNTHETIC_POLICY_HASH,
      'preview-640',
      'webp',
    ],
    [
      'public/example/Café—Page.png',
      'c'.repeat(64),
      'd'.repeat(64),
      'Detail_1280',
      'jpeg',
    ],
    [
      'public/example/图像 01.png',
      'e'.repeat(64),
      'f'.repeat(64),
      'cover-352',
      '.webp',
    ],
  ];
  const nodePaths = parityVectors.map(([
    sourcePath,
    sourceHash,
    policyHash,
    profileId,
    extension,
  ]) => derivativeRepositoryPath({
    sourcePath,
    sourceHash,
    policyHash,
    profileId,
    extension,
  }));
  const python = spawnSync('python', [
    '-c',
    [
      'import importlib.util,json,sys',
      'spec=importlib.util.spec_from_file_location("fr_p5_generator",sys.argv[1])',
      'module=importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(module)',
      'vectors=json.loads(sys.stdin.buffer.read().decode("utf-8"))',
      'sys.stdout.write(json.dumps([module.derivative_repository_path(*vector) for vector in vectors],ensure_ascii=False))',
    ].join(';'),
    path.join(root, 'scripts', 'generate-responsive-media.py'),
  ], {
    cwd: root,
    encoding: 'utf8',
    input: JSON.stringify(parityVectors),
    shell: false,
    windowsHide: true,
  });
  assert.equal(python.status, 0, python.stderr);
  assert.deepEqual(JSON.parse(python.stdout), nodePaths);
  assert.equal(nodePaths[0], webpPath);
});

test('FR-P5 policy-addressed derivatives preserve the full manifest hash and Windows path headroom', async () => {
  const inventory = await readJson('reports/portfolio/fr-p5/fr-p5-media-reference-inventory.json');
  const policy = await readJson('operations/maintenance/fr-maint-media-slim-01/media-quality-policy.json');
  const policyHash = canonicalPolicyHash(policy);
  assert.match(policyHash, /^[a-f0-9]{64}$/);

  const stagedPaths = [];
  for (const record of inventory.media) {
    for (const profile of policy.profiles) {
      if (!profile.roles.some((role) => record.roles.includes(role))) continue;
      const repositoryPath = derivativeRepositoryPath({
        sourcePath: record.path,
        sourceHash: record.derivationSource.sha256,
        policyHash,
        profileId: profile.id,
        extension: profile.format,
      });
      const segments = repositoryPath.split('/');
      assert.equal(segments[3], policyHash.slice(0, DERIVATIVE_POLICY_HASH_HEX_LENGTH));
      assert.match(segments[3], /^[a-f0-9]{32}$/);
      stagedPaths.push(path.join(
        root,
        'task-scratch',
        'fr-p5',
        'generate-12345678',
        'media',
        ...repositoryPath.slice('public/media/'.length).split('/'),
      ));
    }
  }

  assert.ok(stagedPaths.length > 0);
  const longestStagedPath = stagedPaths.reduce((longest, candidate) => (
    candidate.length > longest.length ? candidate : longest
  ));
  assert.ok(
    longestStagedPath.length < 260,
    `Longest Windows staging path is ${longestStagedPath.length} characters: ${longestStagedPath}`,
  );
});

test('FR-P5 media paths reject URL fragment delimiters in Node and Python', () => {
  const unsafePath = 'public/example/page#fragment.png';
  assert.throws(() => normalizeImagePath(unsafePath), /unsafe/i);
  const python = spawnSync('python', [
    '-c',
    [
      'import importlib.util,sys',
      'spec=importlib.util.spec_from_file_location("fr_p5_generator",sys.argv[1])',
      'module=importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(module)',
      'module.normalize_repository_path(sys.argv[2])',
    ].join(';'),
    path.join(root, 'scripts', 'generate-responsive-media.py'),
    unsafePath,
  ], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  assert.notEqual(python.status, 0);
  assert.match(python.stderr, /unsafe/i);
});

test('FR-P5 role-scoped generation narrows multi-role sources to a complete role closure', () => {
  const python = spawnSync('python', [
    '-c',
    [
      'import importlib.util,json,sys',
      'spec=importlib.util.spec_from_file_location("fr_p5_generator",sys.argv[1])',
      'module=importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(module)',
      'roles=["carmela-explanation-preview","carmela-lightbox"]',
      'policy={"profiles":[{"id":"explanation","roles":["carmela-explanation-preview"]},{"id":"lightbox","roles":["carmela-lightbox"]}]}',
      'selected=module.selected_entry_roles(roles,"carmela-explanation-preview")',
      'profiles=module.selected_profiles(policy,selected,"carmela-explanation-preview")',
      'sys.stdout.write(json.dumps({"roles":selected,"profiles":profiles}))',
    ].join(';'),
    path.join(root, 'scripts', 'generate-responsive-media.py'),
  ], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  assert.equal(python.status, 0, python.stderr);
  const result = JSON.parse(python.stdout);
  assert.deepEqual(result.roles, ['carmela-explanation-preview']);
  assert.deepEqual(result.profiles.map((profile) => profile.id), ['explanation']);
  assert.deepEqual(
    result.profiles[0].matchingRoles,
    ['carmela-explanation-preview'],
  );
});

test('FR-P5 manifest validation enforces metadata, hashes, options and derivative ownership', () => {
  const manifest = syntheticManifest();
  const validated = validateMediaManifest(manifest);
  assert.equal(validated.totals.sources, 1);
  assert.equal(validated.totals.variants, 2);
  const unsafe = structuredClone(manifest);
  unsafe.media[0].variants[0].path = 'public/example/not-derived.webp';
  assert.throws(() => validateMediaManifest(unsafe), /public\/media\/derived/);
  const duplicate = structuredClone(manifest);
  duplicate.media[0].variants[1].path = duplicate.media[0].variants[0].path;
  assert.throws(() => validateMediaManifest(duplicate), /Duplicate derivative path|deterministic derivative path/);
  const timestamp = structuredClone(manifest);
  timestamp.generatedAt = 'now';
  assert.throws(() => validateMediaManifest(timestamp), /forbidden/);
  const sourceFallback = structuredClone(manifest);
  sourceFallback.media[0].fallbackPath = sourceFallback.media[0].sourcePath;
  assert.throws(() => validateMediaManifest(sourceFallback), /fallbackPath/);
  const wrongOptions = structuredClone(manifest);
  wrongOptions.media[0].variants[0].encoderOptions.method = 7;
  assert.throws(() => validateMediaManifest(wrongOptions), /method/);
  const stalePolicyIdentity = structuredClone(manifest);
  stalePolicyIdentity.policyHash = 'c'.repeat(64);
  assert.throws(
    () => validateMediaManifest(stalePolicyIdentity),
    /deterministic derivative path/,
  );
});

test('FR-P5 manifest validation matches Python tuple order when one role list prefixes another', async () => {
  const manifest = await readJson('public/media/media-manifest.json');
  const entry = manifest.media.find((item) => (
    item.sourcePath === 'public/assets/cells-at-work/page-thumbnails/v01/abrasion__v01_page-139.webp'
  ));
  assert.ok(entry, 'expected the production role-prefix fixture');
  assert.deepEqual(
    entry.variants.map((variant) => ({
      profileId: variant.profileId,
      roles: variant.roles,
    })),
    [
      {
        profileId: 'companion-640-webp',
        roles: ['work-cells-series-thumbnail', 'work-cells-topic-hero'],
      },
    ],
  );
  assert.equal(validateMediaManifest(manifest).totals.variants, 778);
  assert.equal(
    manifest.media.every((item) => item.variants.length === 1),
    true,
    'every referenced source must publish exactly one companion-grade derivative',
  );
});

test('FR-P5 manifest records exact Work Cells thumbnail-to-high-resolution lineage', () => {
  const manifest = syntheticManifest();
  const entry = manifest.media[0];
  const thumbnail = 'public/assets/cells-at-work/page-thumbnails/v01/abrasion__v01_page-139.webp';
  const basis = 'public/assets/cells-at-work/pages-by-volume/v01/abrasion__v01_page-139.webp';
  entry.sourcePath = thumbnail;
  entry.lineageKind = 'work-cells-high-resolution-counterpart';
  entry.derivationSourcePath = basis;
  entry.referenceHash = 'e'.repeat(64);
  entry.referenceStoredWidth = 360;
  entry.referenceStoredHeight = 512;
  entry.referenceWidth = 360;
  entry.referenceHeight = 512;
  entry.referenceBytes = 20000;
  entry.referenceFormat = 'webp';
  entry.referenceMode = 'RGB';
  entry.sourceFormat = 'webp';
  entry.roles = ['work-cells-lightbox', 'work-cells-manga-preview'];
  entry.variants[0].roles = ['work-cells-lightbox'];
  entry.variants[1].roles = ['work-cells-manga-preview'];
  for (const variant of entry.variants) {
    variant.path = derivativeRepositoryPath({
      sourcePath: thumbnail,
      sourceHash: entry.sourceHash,
      policyHash: manifest.policyHash,
      profileId: variant.profileId,
      extension: variant.format,
    });
  }
  entry.fallbackPath = entry.variants[1].path;
  entry.fallbacksByRole = {
    'work-cells-lightbox': entry.variants[0].path,
    'work-cells-manga-preview': entry.variants[1].path,
  };
  manifest.totals.referenceBytes = 20000;
  assert.equal(validateMediaManifest(manifest).media[0].derivationSourcePath, basis);

  const guessed = structuredClone(manifest);
  guessed.media[0].derivationSourcePath = 'public/assets/cells-at-work/pages-by-volume/v01/other.webp';
  assert.throws(() => validateMediaManifest(guessed), /exact same-name/);
  const notLarger = structuredClone(manifest);
  notLarger.media[0].sourceWidth = 360;
  assert.throws(() => validateMediaManifest(notLarger), /strictly larger/);
});

test('FR-P5 accepted quality policy freezes tool versions, encoder options and all roles', () => {
  const policy = syntheticPolicy();
  assert.equal(validateMediaQualityPolicy(policy).profiles.length, 10);
  const missing = structuredClone(policy);
  missing.profiles.pop();
  assert.throws(() => validateMediaQualityPolicy(missing), /does not cover role/);
  const template = structuredClone(policy);
  template.status = 'candidate_template_not_accepted';
  assert.throws(() => validateMediaQualityPolicy(template), /status must be accepted/);
  const implicitMethod = structuredClone(policy);
  delete implicitMethod.profiles[0].method;
  assert.throws(() => validateMediaQualityPolicy(implicitMethod), /method/);
  const unsupportedSpeed = structuredClone(policy);
  unsupportedSpeed.profiles[0].speed = 5;
  assert.throws(() => validateMediaQualityPolicy(unsupportedSpeed), /not supported for webp/);
  assert.deepEqual(
    encoderOptionsForProfile(policy.profiles[0]),
    { exact: true, lossless: false, method: 6, quality: 90 },
  );
});

test('FR-P5 canonical policy hash is recursive and independent of object insertion order', () => {
  const policy = syntheticPolicy();
  const reordered = {
    budgets: policy.budgets,
    visualAcceptance: policy.visualAcceptance,
    fallbackStrategy: policy.fallbackStrategy,
    alphaStrategy: policy.alphaStrategy,
    profiles: policy.profiles,
    encoder: policy.encoder,
    status: policy.status,
    schemaVersion: policy.schemaVersion,
  };
  assert.equal(canonicalPolicyHash(reordered), canonicalPolicyHash(policy));
  const nodeHash = canonicalPolicyHash(policy);
  assert.equal(nodeHash, '345e4a8ccda972b6e056bbaa8f9d759539d06f302d971d8149914179d1d4dcc5');
  assert.ok(!canonicalJson(policy).includes('\n'));
  const python = spawnSync('python', ['-c', [
    'import hashlib,json,sys',
    'value=json.loads(sys.stdin.buffer.read().decode("utf-8"))',
    'encoded=json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode("utf-8")',
    'sys.stdout.write(hashlib.sha256(encoded).hexdigest())',
  ].join(';')], {
    cwd: root,
    encoding: 'utf8',
    input: JSON.stringify(policy),
    shell: false,
    windowsHide: true,
  });
  assert.equal(python.status, 0, python.stderr);
  assert.equal(python.stdout, nodeHash);
});

test('FR-P5 Pillow inspector is enriched and fail-closed on unsafe paths', () => {
  const inspector = path.join(root, 'scripts', 'inspect-media-images.py');
  const mediaPath = 'public/assets/cells-at-work/page-thumbnails/v01/abrasion__v01_page-139.webp';
  const pngPath = 'public/books/不一样的卡梅拉/我爱平底锅/generated/camel-merchant-sugar.png';
  const result = spawnSync('python', [inspector], {
    cwd: root,
    encoding: 'utf8',
    input: JSON.stringify({ paths: [mediaPath, pngPath] }),
    shell: false,
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  const inspected = JSON.parse(result.stdout);
  assert.equal(inspected.media[0].path, mediaPath);
  assert.equal(inspected.media[0].decodeStatus, 'ok');
  assert.ok(inspected.media[0].width > 0);
  assert.match(inspected.media[0].pixelHash, /^[a-f0-9]{64}$/);
  assert.equal(typeof inspected.media[0].hasAlpha, 'boolean');
  assert.equal(Number.isInteger(inspected.media[0].frameCount), true);
  assert.equal(inspected.media[1].path, pngPath);
  assert.equal(inspected.media[1].decodeStatus, 'ok');

  const unsafe = spawnSync('python', [inspector], {
    cwd: root,
    encoding: 'utf8',
    input: JSON.stringify({ paths: ['../source/private.png'] }),
    shell: false,
    windowsHide: true,
  });
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stderr, /unsafe|public/i);

  const unicodeOrdinal = spawnSync('python', [inspector], {
    cwd: root,
    encoding: 'utf8',
    input: JSON.stringify({
      // JavaScript ordinal order compares UTF-16 code units, so the surrogate
      // pair sorts before the private-use BMP character.
      paths: ['public/example/😀.png', 'public/example/\uE000.png'],
    }),
    shell: false,
    windowsHide: true,
  });
  assert.notEqual(unicodeOrdinal.status, 0);
  assert.doesNotMatch(unicodeOrdinal.stderr, /stable ordinal order/i);
  assert.ok(unicodeOrdinal.stderr.trim());
});

test('FR-P5 browser resolver emits picture/srcset and fails closed without validated derivatives', () => {
  const manifest = syntheticManifest();
  const resolver = createMediaResolver(manifest, { sitePath: (value) => `/Family-Reading-Codex/${value}` });
  const markup = resolver.picture('public/example/page.png', {
    role: 'carmela-page-preview',
    alt: '示例页面',
    className: 'example-image',
  });
  assert.match(markup, /^<picture /);
  assert.match(markup, /<source type="image\/webp"/);
  assert.match(markup, /640w/);
  assert.match(markup, /width="640"/);
  assert.match(markup, /height="480"/);
  assert.match(markup, /alt="示例页面"/);
  assert.equal(
    resolver.largestPath('public/example/page.png', 'carmela-lightbox'),
    `/Family-Reading-Codex/public/media/derived/${SYNTHETIC_POLICY_HASH.slice(0, 32)}/aa/aaaaaaaaaaaa/page-lightbox-1280.webp`,
  );
  const fallback = createMediaResolver(null).picture('public/example/original.png', {
    role: 'carmela-page-preview',
    alt: '原图回退',
  });
  assert.equal(fallback, '');
  assert.doesNotMatch(fallback, /public\/example\/original\.png/);
});

test('FR-P5 corrected Work Cells truth is 27 topics including hemorrhagic shock', async () => {
  const index = await readJson('public/runtime/work-cells/topics.json');
  assert.equal(index.topics.length, 27);
  assert.equal(new Set(index.topics.map((topic) => topic.category)).size, 24);
  assert.ok(index.topics.some((topic) => topic.slug === 'hemorrhagic-shock'));
  let stations = 0;
  let questions = 0;
  let pageRefs = 0;
  for (const summary of index.topics) {
    const topic = await readJson(summary.detailPath);
    stations += topic.bodyScienceStations.length;
    questions += topic.parentQuestionCards.length;
    pageRefs += Object.keys(topic.pageRefs).length;
  }
  assert.equal(stations, 108);
  assert.equal(questions, 162);
  assert.equal(pageRefs, 286);
});

test('FR-P5 package exposes explicit inventory, generation, validation and release-plan commands', async () => {
  const packageJson = await readJson('package.json');
  assert.equal(packageJson.scripts['inventory:media'], 'node scripts/inventory-runtime-media.mjs');
  assert.equal(packageJson.scripts['generate:media'], 'python scripts/generate-responsive-media.py');
  assert.equal(packageJson.scripts['validate:media'], 'node scripts/validate-responsive-media.mjs');
  assert.equal(packageJson.scripts['validate:fr-p5-evidence'], 'node scripts/validate-fr-p5-final-evidence.mjs');
  assert.equal(packageJson.scripts['plan:media-release'], 'node scripts/media-release-plan.mjs');
});
