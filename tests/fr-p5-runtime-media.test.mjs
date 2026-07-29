import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  createContentLoader,
  validateMediaShardIndex,
  validateRouteMediaShard,
} from '../assets/content-loader.js';
import {
  createMediaResolver,
  MEDIA_ROLE_SIZES,
  mediaSizes,
} from '../assets/media-resolver.js';
import { clearResponsiveImageCandidates } from '../assets/a11y.js';
import {
  createScienceTopicViewModel,
  renderScienceTopicAtlas,
} from '../assets/science-companion.js';

const root = path.resolve(import.meta.dirname, '..');
const runtimeIndexPath = 'public/runtime/index.json';
const globalMediaManifestPath = 'public/media/media-manifest.json';
const mediaShardIndexPath = 'public/media/media-shard-index.json';
const canonicalManifestSha256 = 'a'.repeat(64);
const policyHash = 'b'.repeat(64);
const shardGeneratorVersion = 'fr-p5-media-shards/1';
const canonicalManifest = Object.freeze({
  path: globalMediaManifestPath,
  bytes: 3540144,
  sha256: canonicalManifestSha256,
  policyHash,
  sources: 778,
  variants: 2666,
});
const mediaShardPaths = {
  home: 'public/media/shards/home.json',
  carmelaSeries: 'public/media/shards/carmela-series.json',
  carmelaBook: 'public/media/shards/carmela-book/carmela-s1-01.json',
  workCellsSeries: 'public/media/shards/work-cells-series.json',
  workCellsTopic: 'public/media/shards/work-cells-topic/sample-topic.json',
};

function variant({
  profileId,
  path: variantPath,
  width,
  height,
  format = 'webp',
  roles,
}) {
  return {
    profileId,
    path: variantPath,
    width,
    height,
    format,
    roles,
  };
}

function entry(sourcePath, roles, variants, fallbackPath = variants[0].path) {
  const fallbacksByRole = Object.fromEntries(roles.map((role) => [
    role,
    variants.find((item) => item.path === fallbackPath && item.roles.includes(role))?.path
      ?? variants.find((item) => item.roles.includes(role))?.path
      ?? fallbackPath,
  ]));
  return {
    sourcePath,
    sourceWidth: 1600,
    sourceHeight: 1200,
    sourceFormat: 'png',
    roles,
    fallbackPath,
    fallbacksByRole,
    variants,
  };
}

function routeShard(route, media) {
  return {
    schemaVersion: 1,
    generatorVersion: shardGeneratorVersion,
    policyHash,
    canonicalManifestPath: globalMediaManifestPath,
    canonicalManifest,
    route,
    media,
    totals: {
      sources: media.length,
      variants: media.reduce((total, item) => total + item.variants.length, 0),
    },
  };
}

function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value));
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function mediaIndex(resources) {
  const shards = Object.entries(resources)
    .filter(([resourcePath, value]) => (
      resourcePath.startsWith('public/media/shards/')
      && value
      && typeof value === 'object'
      && value.route
    ))
    .map(([resourcePath, shard]) => {
      const bytes = jsonBytes(shard);
      return {
        routeId: shard.route.id,
        path: resourcePath,
        sha256: digest(bytes),
        bytes: bytes.byteLength,
        sources: shard.totals.sources,
        variants: shard.totals.variants,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path, 'en'));
  return {
    schemaVersion: 1,
    generatorVersion: shardGeneratorVersion,
    policyHash,
    canonicalManifest,
    shards,
    totals: {
      shards: shards.length,
      sourcesAcrossShards: shards.reduce((total, item) => total + item.sources, 0),
      variantsAcrossShards: shards.reduce((total, item) => total + item.variants, 0),
    },
  };
}

function cleanRequestPath(resourcePath) {
  return resourcePath.split('?')[0];
}

function createVerifiedLoader({
  resources,
  calls = [],
  fetchJsonOverride = null,
  fetchBytesOverride = null,
} = {}) {
  const index = mediaIndex(resources);
  return createContentLoader({
    expectedCanonicalManifestSha256: canonicalManifestSha256,
    fetchJson: async (requestPath, options = {}) => {
      const resourcePath = cleanRequestPath(requestPath);
      calls.push({ type: 'json', requestPath, resourcePath, options });
      if (fetchJsonOverride) {
        return fetchJsonOverride(resourcePath, requestPath, options);
      }
      if (!(resourcePath in resources)) throw new Error(`Missing ${resourcePath}`);
      return resources[resourcePath];
    },
    fetchBytes: async (requestPath, options = {}) => {
      const resourcePath = cleanRequestPath(requestPath);
      calls.push({ type: 'bytes', requestPath, resourcePath, options });
      if (fetchBytesOverride) {
        const overridden = await fetchBytesOverride(resourcePath, requestPath, options, index);
        if (overridden !== undefined) return overridden;
      }
      if (resourcePath === mediaShardIndexPath) return jsonBytes(index);
      if (!(resourcePath in resources)) throw new Error(`Missing ${resourcePath}`);
      return jsonBytes(resources[resourcePath]);
    },
  });
}

function mediaManifest() {
  const thumbnail = 'public/example/topic.png';
  const station = 'public/example/station.png';
  const manga = 'public/example/manga.png';
  const media = [
    entry(thumbnail, ['work-cells-topic-hero'], [
      variant({
        profileId: 'hero-640-webp',
        path: 'public/media/derived/topic-640.webp',
        width: 640,
        height: 480,
        roles: ['work-cells-topic-hero'],
      }),
      variant({
        profileId: 'hero-960-webp',
        path: 'public/media/derived/topic-960.webp',
        width: 960,
        height: 720,
        roles: ['work-cells-topic-hero'],
      }),
    ]),
    entry(station, ['work-cells-lightbox', 'work-cells-station-preview'], [
      variant({
        profileId: 'station-640-webp',
        path: 'public/media/derived/station-640.webp',
        width: 640,
        height: 480,
        roles: ['work-cells-station-preview'],
      }),
      variant({
        profileId: 'station-1440-webp',
        path: 'public/media/derived/station-1440.webp',
        width: 1440,
        height: 1080,
        roles: ['work-cells-lightbox'],
      }),
    ]),
    entry(manga, ['work-cells-lightbox', 'work-cells-manga-preview'], [
      variant({
        profileId: 'manga-480-webp',
        path: 'public/media/derived/manga-480.webp',
        width: 480,
        height: 640,
        roles: ['work-cells-manga-preview'],
      }),
      variant({
        profileId: 'manga-1280-webp',
        path: 'public/media/derived/manga-1280.webp',
        width: 1280,
        height: 1707,
        roles: ['work-cells-lightbox'],
      }),
    ]),
  ];
  return routeShard(
    {
      id: 'work-cells-topic/sample-topic',
      kind: 'work-cells-topic',
      ownerId: 'sample-topic',
    },
    media,
  );
}

test('FR-P5 route shard loader is exact, URL-cached and fail-closed', async () => {
  const calls = [];
  const carmelaCover = 'public/example/carmela-home.png';
  const workCellsCover = 'public/example/work-cells-home.png';
  const homeMedia = [
    entry(carmelaCover, ['carmela-series-cover'], [
      variant({
        profileId: 'carmela-home-240',
        path: 'public/media/derived/carmela-home-240.webp',
        width: 240,
        height: 320,
        roles: ['carmela-series-cover'],
      }),
    ]),
    entry(workCellsCover, ['work-cells-series-thumbnail'], [
      variant({
        profileId: 'work-cells-home-240',
        path: 'public/media/derived/work-cells-home-240.webp',
        width: 240,
        height: 180,
        roles: ['work-cells-series-thumbnail'],
      }),
    ]),
  ];
  const resources = {
    [runtimeIndexPath]: {
      series: [
        { seriesSlug: 'carmela-season-1', coverImage: carmelaCover },
        { seriesSlug: 'work-cells', coverImage: workCellsCover },
      ],
    },
    [mediaShardPaths.home]: routeShard({ id: 'home', kind: 'home' }, homeMedia),
  };
  const loader = createVerifiedLoader({ resources, calls });

  const first = await loader.loadHome();
  const second = await loader.loadHome();
  assert.equal(first.mediaShard, second.mediaShard);
  assert.deepEqual(
    calls.map((call) => call.resourcePath),
    [runtimeIndexPath, mediaShardIndexPath, mediaShardPaths.home],
  );
  assert.match(calls[0].requestPath, new RegExp(`\\?release=${canonicalManifestSha256}$`));
  assert.equal(calls[0].options.cache, 'no-cache');
  assert.match(calls[1].requestPath, new RegExp(`\\?manifest=${canonicalManifestSha256}$`));
  assert.equal(calls[1].options.cache, 'no-store');
  assert.match(calls[2].requestPath, /\?sha256=[a-f0-9]{64}$/);
  assert.equal(calls[2].options.cache, 'no-cache');
  assert.equal(calls.some((call) => call.resourcePath === globalMediaManifestPath), false);

  const missingCalls = [];
  const missingLoader = createVerifiedLoader({
    resources,
    calls: missingCalls,
    fetchBytesOverride: async (resourcePath) => {
      if (resourcePath === mediaShardPaths.home) {
        throw Object.assign(new Error('required route shard unavailable'), { status: 404 });
      }
      return undefined;
    },
  });
  await assert.rejects(
    missingLoader.loadHome(),
    (error) => error.status === 404,
  );
  await assert.rejects(
    missingLoader.loadHome(),
    (error) => error.status === 404,
  );
  assert.deepEqual(
    missingCalls.map((call) => call.resourcePath),
    [runtimeIndexPath, mediaShardIndexPath, mediaShardPaths.home, mediaShardPaths.home],
    'a missing required shard must fail closed while remaining retryable',
  );

  let transientAttempt = 0;
  const transientLoader = createVerifiedLoader({
    resources,
    fetchBytesOverride: async (resourcePath) => {
      if (resourcePath === mediaShardPaths.home) {
        transientAttempt += 1;
        if (transientAttempt === 1) {
          throw Object.assign(new Error('temporary media shard failure'), { status: 503 });
        }
      }
      return undefined;
    },
  });
  await assert.rejects(
    transientLoader.loadHome(),
    (error) => error.status === 503,
  );
  assert.deepEqual(
    (await transientLoader.loadHome()).mediaShard,
    resources[mediaShardPaths.home],
  );
  assert.equal(transientAttempt, 2, 'transient shard failures must remain retryable');

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    transientLoader.loadHome({ signal: controller.signal }),
    { name: 'AbortError' },
  );
});

test('FR-P5 stale shard indexes fail closed, evict only the index and remain retryable', async () => {
  const carmelaCover = 'public/example/index-retry-carmela.png';
  const workCellsCover = 'public/example/index-retry-work-cells.png';
  const resources = {
    [runtimeIndexPath]: {
      series: [
        { seriesSlug: 'carmela-season-1', coverImage: carmelaCover },
        { seriesSlug: 'work-cells', coverImage: workCellsCover },
      ],
    },
    [mediaShardPaths.home]: routeShard({ id: 'home', kind: 'home' }, [
      entry(carmelaCover, ['carmela-series-cover'], [
        variant({
          profileId: 'index-retry-carmela',
          path: 'public/media/derived/index-retry-carmela.webp',
          width: 240,
          height: 320,
          roles: ['carmela-series-cover'],
        }),
      ]),
      entry(workCellsCover, ['work-cells-series-thumbnail'], [
        variant({
          profileId: 'index-retry-work-cells',
          path: 'public/media/derived/index-retry-work-cells.webp',
          width: 240,
          height: 180,
          roles: ['work-cells-series-thumbnail'],
        }),
      ]),
    ]),
  };
  const calls = [];
  let indexAttempts = 0;
  const loader = createVerifiedLoader({
    resources,
    calls,
    fetchBytesOverride: async (resourcePath, _requestPath, _options, validIndex) => {
      if (resourcePath !== mediaShardIndexPath) return undefined;
      indexAttempts += 1;
      if (indexAttempts > 1) return jsonBytes(validIndex);
      const stale = structuredClone(validIndex);
      stale.canonicalManifest.sha256 = 'c'.repeat(64);
      return jsonBytes(stale);
    },
  });

  await assert.rejects(
    loader.loadHome(),
    (error) => error.code === 'INVALID_MEDIA_SHARD_INDEX',
  );
  assert.equal((await loader.loadHome()).mediaShard.route.id, 'home');
  assert.equal(calls.filter((call) => call.resourcePath === runtimeIndexPath).length, 1);
  assert.equal(calls.filter((call) => call.resourcePath === mediaShardIndexPath).length, 2);
  assert.equal(calls.filter((call) => call.resourcePath === mediaShardPaths.home).length, 1);
});

test('FR-P5 shard index validator rejects route/path aliases and inconsistent totals', () => {
  const shard = routeShard({ id: 'home', kind: 'home' }, [
    entry('public/example/index-contract.png', ['carmela-series-cover'], [
      variant({
        profileId: 'index-contract',
        path: 'public/media/derived/index-contract.webp',
        width: 240,
        height: 320,
        roles: ['carmela-series-cover'],
      }),
    ]),
  ]);
  const valid = mediaIndex({ [mediaShardPaths.home]: shard });
  assert.equal(validateMediaShardIndex(valid, {
    expectedCanonicalManifestSha256: canonicalManifestSha256,
  }), valid);

  for (const mutate of [
    (index) => { index.generatorVersion = 'fr-p5-media-shards/stale'; },
    (index) => { index.policyHash = 'c'.repeat(64); },
    (index) => { index.canonicalManifest.sha256 = 'c'.repeat(64); },
    (index) => { index.shards[0].path = 'public/media/shards/alias.json'; },
    (index) => { index.shards[0].sha256 = 'not-a-hash'; },
    (index) => { index.totals.shards += 1; },
  ]) {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.throws(
      () => validateMediaShardIndex(candidate, {
        expectedCanonicalManifestSha256: canonicalManifestSha256,
      }),
      (error) => error.code === 'INVALID_MEDIA_SHARD_INDEX',
    );
  }
});

test('FR-P5 route shards validate schema, identity, totals, source closure and role fallbacks', () => {
  const sourcePath = 'public/example/validated-topic.png';
  const role = 'work-cells-topic-hero';
  const valid = routeShard(
    {
      id: 'work-cells-topic/validated-topic',
      kind: 'work-cells-topic',
      ownerId: 'validated-topic',
    },
    [entry(sourcePath, [role], [
      variant({
        profileId: 'validated-topic-960',
        path: 'public/media/derived/validated-topic-960.webp',
        width: 960,
        height: 720,
        roles: [role],
      }),
    ])],
  );
  const contract = {
    routeId: 'work-cells-topic/validated-topic',
    kind: 'work-cells-topic',
    ownerId: 'validated-topic',
    requirements: [{ sourcePath, roles: [role] }],
    canonicalManifest,
    policyHash,
  };
  assert.equal(validateRouteMediaShard(valid, contract), valid);

  const invalidCases = [
    ['schema', (shard) => { shard.schemaVersion = 2; }],
    ['generator', (shard) => { shard.generatorVersion = 'fr-p5-media-shards/stale'; }],
    ['policy', (shard) => { shard.policyHash = 'c'.repeat(64); }],
    ['manifest', (shard) => { shard.canonicalManifestPath = 'public/media/other.json'; }],
    ['manifest hash', (shard) => { shard.canonicalManifest.sha256 = 'c'.repeat(64); }],
    ['route id', (shard) => { shard.route.id = 'work-cells-topic/other'; }],
    ['route kind', (shard) => { shard.route.kind = 'work-cells-series'; }],
    ['route owner', (shard) => { shard.route.ownerId = 'other'; }],
    ['media array', (shard) => { shard.media = null; }],
    ['source totals', (shard) => { shard.totals.sources = 2; }],
    ['variant totals', (shard) => { shard.totals.variants = 2; }],
    ['variant format', (shard) => { shard.media[0].variants[0].format = 'svg'; }],
    ['variant canonical path', (shard) => {
      const nonCanonical = 'public/media/derived/nested/../validated-topic-960.webp';
      shard.media[0].variants[0].path = nonCanonical;
      shard.media[0].fallbackPath = nonCanonical;
      shard.media[0].fallbacksByRole[role] = nonCanonical;
    }],
    ['duplicate source', (shard) => {
      shard.media.push(structuredClone(shard.media[0]));
      shard.totals.sources = 2;
      shard.totals.variants = 2;
    }],
    ['source closure', (shard) => { shard.media[0].sourcePath = 'public/example/other.png'; }],
    ['required role', (shard) => { shard.media[0].roles = []; }],
    ['role variant', (shard) => { shard.media[0].variants[0].roles = []; }],
    ['role fallback', (shard) => { delete shard.media[0].fallbacksByRole[role]; }],
  ];
  for (const [label, mutate] of invalidCases) {
    const shard = structuredClone(valid);
    mutate(shard);
    assert.throws(
      () => validateRouteMediaShard(shard, contract),
      (error) => error.code === 'INVALID_MEDIA_SHARD',
      label,
    );
  }
});

test('FR-P5 invalid route shards are evicted so retry fetches only the shard again', async () => {
  const carmelaSource = 'public/example/retry-carmela.png';
  const workCellsSource = 'public/example/retry-work-cells.png';
  const media = [
    entry(carmelaSource, ['carmela-series-cover'], [
      variant({
        profileId: 'retry-carmela-240',
        path: 'public/media/derived/retry-carmela-240.webp',
        width: 240,
        height: 320,
        roles: ['carmela-series-cover'],
      }),
    ]),
    entry(workCellsSource, ['work-cells-series-thumbnail'], [
      variant({
        profileId: 'retry-work-cells-240',
        path: 'public/media/derived/retry-work-cells-240.webp',
        width: 240,
        height: 180,
        roles: ['work-cells-series-thumbnail'],
      }),
    ]),
  ];
  const validShard = routeShard({ id: 'home', kind: 'home' }, media);
  const invalidShard = structuredClone(validShard);
  invalidShard.totals.variants += 1;
  let shardAttempts = 0;
  const calls = [];
  const resources = {
    [runtimeIndexPath]: {
      series: [
        { seriesSlug: 'carmela-season-1', coverImage: carmelaSource },
        { seriesSlug: 'work-cells', coverImage: workCellsSource },
      ],
    },
    [mediaShardPaths.home]: validShard,
  };
  const loader = createVerifiedLoader({
    resources,
    calls,
    fetchBytesOverride: async (resourcePath) => {
      if (resourcePath !== mediaShardPaths.home) return undefined;
      shardAttempts += 1;
      return jsonBytes(shardAttempts === 1 ? invalidShard : validShard);
    },
  });

  await assert.rejects(
    loader.loadHome(),
    (error) => error.code === 'INVALID_MEDIA_SHARD',
  );
  assert.deepEqual((await loader.loadHome()).mediaShard, validShard);
  assert.equal(calls.filter((call) => call.resourcePath === runtimeIndexPath).length, 1);
  assert.equal(calls.filter((call) => call.resourcePath === mediaShardIndexPath).length, 1);
  assert.equal(shardAttempts, 2);
});

test('FR-P5 shard caching is URL-scoped when routes share a media source', async () => {
  const carmelaIndexPath = 'public/runtime/carmela/books.json';
  const sharedSource = 'public/example/shared-cover.png';
  const sharedEntry = entry(sharedSource, ['carmela-series-cover', 'carmela-book-cover'], [
    variant({
      profileId: 'shared-series-352-webp',
      path: 'public/media/derived/shared-series-352.webp',
      width: 352,
      height: 469,
      roles: ['carmela-series-cover'],
    }),
    variant({
      profileId: 'shared-book-640-webp',
      path: 'public/media/derived/shared-book-640.webp',
      width: 640,
      height: 853,
      roles: ['carmela-book-cover'],
    }),
  ]);
  const workCellsSource = 'public/example/work-cells-shared-route.png';
  const workCellsEntry = entry(workCellsSource, ['work-cells-series-thumbnail'], [
    variant({
      profileId: 'work-cells-home-240-webp',
      path: 'public/media/derived/work-cells-home-240.webp',
      width: 240,
      height: 180,
      roles: ['work-cells-series-thumbnail'],
    }),
  ]);
  const resources = {
    [runtimeIndexPath]: {
      series: [
        {
          seriesSlug: 'carmela-season-1',
          seriesTitle: '不一样的卡梅拉',
          coverImage: sharedSource,
          indexPath: carmelaIndexPath,
        },
        {
          seriesSlug: 'work-cells',
          seriesTitle: '工作细胞',
          coverImage: workCellsSource,
          indexPath: 'public/runtime/work-cells/topics.json',
        },
      ],
    },
    [carmelaIndexPath]: {
      books: [{
        slug: 'shared-book',
        cover: sharedSource,
      }],
    },
    [mediaShardPaths.home]: routeShard(
      { id: 'home', kind: 'home' },
      [sharedEntry, workCellsEntry],
    ),
    [mediaShardPaths.carmelaSeries]: routeShard(
      { id: 'carmela-series', kind: 'carmela-series' },
      [sharedEntry],
    ),
  };
  const calls = [];
  const loader = createVerifiedLoader({ resources, calls });

  const firstHome = await loader.loadHome();
  const series = await loader.loadCarmelaSeries();
  const secondHome = await loader.loadHome();
  assert.equal(firstHome.mediaShard, secondHome.mediaShard);
  assert.notEqual(firstHome.mediaShard, series.mediaShard);
  assert.equal(calls.filter((item) => item.resourcePath === mediaShardPaths.home).length, 1);
  assert.equal(calls.filter((item) => item.resourcePath === mediaShardPaths.carmelaSeries).length, 1);
});

test('FR-P5 home shard renders exactly two derivative pictures and no source original', () => {
  const carmelaSource = 'public/example/carmela-home-cover.png';
  const workCellsSource = 'public/example/work-cells-home-cover.png';
  const homeShard = {
    schemaVersion: 1,
    canonicalManifestPath: globalMediaManifestPath,
    route: { id: 'home', kind: 'home' },
    media: [
      entry(carmelaSource, ['carmela-series-cover'], [
        variant({
          profileId: 'carmela-home-352-webp',
          path: 'public/media/derived/carmela-home-352.webp',
          width: 352,
          height: 469,
          roles: ['carmela-series-cover'],
        }),
      ]),
      entry(workCellsSource, ['work-cells-series-thumbnail'], [
        variant({
          profileId: 'work-cells-home-352-webp',
          path: 'public/media/derived/work-cells-home-352.webp',
          width: 352,
          height: 264,
          roles: ['work-cells-series-thumbnail'],
        }),
      ]),
    ],
  };
  const resolver = createMediaResolver(homeShard, {
    sitePath: (value) => `/Family-Reading-Codex/${value}`,
  });
  const markup = [
    resolver.picture(carmelaSource, {
      role: 'carmela-series-cover',
      sizes: '176px',
      alt: '不一样的卡梅拉入口图',
    }),
    resolver.picture(workCellsSource, {
      role: 'work-cells-series-thumbnail',
      sizes: '176px',
      alt: '工作细胞入口图',
    }),
  ].join('');

  assert.equal(resolver.count, 2);
  assert.equal((markup.match(/<picture\b/g) ?? []).length, 2);
  assert.match(markup, /carmela-home-352\.webp 352w/);
  assert.match(markup, /work-cells-home-352\.webp 352w/);
  assert.match(markup, /width="352" height="469"/);
  assert.doesNotMatch(markup, /carmela-home-cover\.png|work-cells-home-cover\.png/);
  assert.equal(resolver.has('public/example/topic-only.png'), false);
});

test('FR-P5 resolver orders modern srcsets narrowly to widely and uses derivatives by default', () => {
  const sourcePath = 'public/example/page.png';
  const manifest = {
    media: [entry(sourcePath, ['carmela-page-preview', 'carmela-lightbox'], [
      variant({
        profileId: 'preview-960-webp',
        path: 'public/media/derived/page-960.webp',
        width: 960,
        height: 720,
        roles: ['carmela-page-preview'],
      }),
      variant({
        profileId: 'preview-480-avif',
        path: 'public/media/derived/page-480.avif',
        width: 480,
        height: 360,
        format: 'avif',
        roles: ['carmela-page-preview'],
      }),
      variant({
        profileId: 'preview-480-webp',
        path: 'public/media/derived/page-480.webp',
        width: 480,
        height: 360,
        roles: ['carmela-page-preview'],
      }),
      variant({
        profileId: 'lightbox-1440-webp',
        path: 'public/media/derived/page-1440.webp',
        width: 1440,
        height: 1080,
        roles: ['carmela-lightbox'],
      }),
    ], 'public/media/derived/page-480.webp')],
  };
  const resolver = createMediaResolver(manifest, {
    sitePath: (value) => `/Family-Reading-Codex/${value}`,
  });
  const markup = resolver.picture(sourcePath, {
    role: 'carmela-page-preview',
    alt: '页面线索',
  });

  assert.ok(markup.indexOf('type="image/avif"') < markup.indexOf('type="image/webp"'));
  assert.match(
    markup,
    /page-480\.webp 480w, \/Family-Reading-Codex\/public\/media\/derived\/page-960\.webp 960w/,
  );
  assert.match(markup, /src="\/Family-Reading-Codex\/public\/media\/derived\/page-480\.webp"/);
  assert.match(markup, /width="480" height="360"/);
  assert.doesNotMatch(markup, /src="\/Family-Reading-Codex\/public\/example\/page\.png"/);
  assert.equal(
    resolver.largestPath(sourcePath, 'carmela-lightbox'),
    '/Family-Reading-Codex/public/media/derived/page-1440.webp',
  );
  assert.equal(
    resolver.resolve(sourcePath, 'carmela-lightbox').fallback.path,
    'public/media/derived/page-1440.webp',
    'v2 fallbacksByRole must override an entry fallback declared for another role',
  );
  const lightbox = resolver.presentation(sourcePath, { role: 'carmela-lightbox' });
  assert.equal(lightbox.fallback.src, '/Family-Reading-Codex/public/media/derived/page-1440.webp');
  assert.match(lightbox.sizes, /640px/);
  assert.deepEqual(
    lightbox.sources.map((source) => source.format),
    ['webp'],
  );
  assert.doesNotThrow(() => createMediaResolver({ media: null }).picture(sourcePath));
});

test('FR-P5 runtime sizes are centralized and unresolved roles never emit source originals', () => {
  assert.equal(mediaSizes('carmela-series-cover'), MEDIA_ROLE_SIZES['carmela-series-cover']);
  assert.match(mediaSizes('carmela-series-cover'), /\(max-width: 920px\) 168px/);
  assert.match(mediaSizes('carmela-series-cover'), /\(max-width: 1072px\) 96px/);
  assert.match(mediaSizes('carmela-series-cover'), /107px/);
  assert.equal(mediaSizes('carmela-series-cover', 'home-series-entry'), '176px');
  assert.equal(
    mediaSizes('work-cells-topic-hero'),
    '(max-width: 1088px) min(88vw, 448px), 320px',
    'the 1088px DPR 2 contract must continue selecting an available 960w hero candidate',
  );

  const missingSource = 'public/example/not-in-route-shard.png';
  const resolver = createMediaResolver({
    media: [entry('public/example/known.png', ['carmela-page-preview'], [
      variant({
        profileId: 'known-preview-480',
        path: 'public/media/derived/known-preview-480.webp',
        width: 480,
        height: 360,
        roles: ['carmela-page-preview'],
      }),
    ])],
  });
  assert.equal(resolver.picture(missingSource, {
    role: 'carmela-page-preview',
    alt: '不得回退原图',
  }), '');
  assert.equal(resolver.picture('public/example/known.png', {
    role: 'carmela-lightbox',
    alt: '缺少角色',
  }), '');
  assert.equal(resolver.presentation(missingSource, {
    role: 'carmela-page-preview',
  }).available, false);
  assert.equal(resolver.largestPath(missingSource, 'carmela-lightbox'), '');
});

test('FR-P5 Work Cells renderer keeps disclosure media inert and resolves preview and lightbox roles', () => {
  const thumbnailPath = 'public/example/topic.png';
  const topic = {
    slug: 'sample-topic',
    displayTitle: '示例主题',
    category: '科学主题',
    source: { sourceLabel: '示例来源' },
    topicOverview: {
      summary: '示例主题概览。',
      readingFocus: '观察画面。',
      keyBiologyConcepts: ['细胞'],
    },
    bodyScienceStations: [{
      stationId: 'sample-station',
      title: '示例小站',
      coreQuestion: '发生了什么？',
      explanation: '这是一个示例解释。',
      imageAsset: 'public/example/station.png',
      imageAlt: '示例解释图',
      relatedPageIds: ['page-1'],
    }],
    parentQuestionCards: [],
    pageRefs: {
      'page-1': {
        imagePath: 'public/example/manga.png',
        label: '示例漫画页面',
      },
    },
  };
  const resolver = createMediaResolver(mediaManifest());
  const markup = renderScienceTopicAtlas(createScienceTopicViewModel(topic), {
    thumbnailPath,
    mediaResolver: resolver,
  });
  const activeMarkup = markup.replaceAll(/<template data-media-template>[\s\S]*?<\/template>/g, '');

  assert.equal((activeMarkup.match(/<img\b[^>]*\ssrc=/g) ?? []).length, 1);
  assert.match(activeMarkup, /<picture data-responsive-media="work-cells-topic-hero">/);
  assert.match(activeMarkup, /topic-640\.webp 640w, public\/media\/derived\/topic-960\.webp 960w/);
  assert.match(activeMarkup, /sizes="\(max-width: 1088px\) min\(88vw, 448px\), 320px"/);
  assert.match(activeMarkup, /fetchpriority="high"/);
  assert.match(markup, /<picture data-responsive-media="work-cells-station-preview">/);
  assert.match(markup, /<picture data-responsive-media="work-cells-manga-preview">/);
  assert.match(markup, /data-lightbox-src="public\/media\/derived\/station-1440\.webp"/);
  assert.match(markup, /data-lightbox-src="public\/media\/derived\/manga-1280\.webp"/);
  assert.match(markup, /data-lightbox-srcset-webp="public\/media\/derived\/station-1440\.webp 1440w"/);
  assert.match(markup, /data-lightbox-width="1440" data-lightbox-height="1080"/);
  assert.match(markup, /data-lightbox-fallback-format="webp"/);
  assert.match(markup, /<picture class="lightbox-picture" data-lightbox-picture hidden>/);
  assert.match(markup, /<source type="image\/avif" data-lightbox-source="avif">/);
  assert.match(markup, /aria-describedby="lightbox-caption" aria-busy="false"/);
  assert.match(markup, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.doesNotMatch(
    markup.match(/<picture class="lightbox-picture"[\s\S]*?<\/picture>/)?.[0] ?? '',
    /\s(?:src|srcset|sizes)=/,
  );
  assert.doesNotMatch(markup, /data-lightbox-src="public\/example\/(?:station|manga)\.png"/);
});

test('FR-P5 responsive candidate cleanup removes every authored request candidate', () => {
  function node(tagName, attributes) {
    const state = new Map(Object.entries(attributes));
    return {
      matches: (selector) => selector === tagName,
      querySelectorAll: () => [],
      removeAttribute: (name) => state.delete(name),
      hasAttribute: (name) => state.has(name),
      getAttribute: (name) => state.get(name) ?? null,
    };
  }
  const source = node('source', {
    src: 'legacy-source.webp',
    srcset: 'source-480.webp 480w',
    sizes: '160px',
    type: 'image/webp',
  });
  const image = node('img', {
    src: 'fallback.webp',
    srcset: 'fallback-480.webp 480w',
    sizes: '160px',
    alt: '页面线索',
    width: '480',
    height: '360',
  });
  const rootNode = {
    matches: () => false,
    querySelectorAll: (selector) => selector === 'source' ? [source] : [image],
  };

  clearResponsiveImageCandidates(rootNode);
  for (const candidate of [source, image]) {
    assert.equal(candidate.hasAttribute('src'), false);
    assert.equal(candidate.hasAttribute('srcset'), false);
    assert.equal(candidate.hasAttribute('sizes'), false);
  }
  assert.equal(source.getAttribute('type'), 'image/webp');
  assert.equal(image.getAttribute('alt'), '页面线索');
  assert.equal(image.getAttribute('width'), '480');
  assert.equal(image.getAttribute('height'), '360');
});

test('maintenance lightbox preserves intrinsic aspect ratio without a second DPR reduction', async () => {
  const [a11ySource, styles] = await Promise.all([
    readFile(path.join(root, 'assets/a11y.js'), 'utf8'),
    readFile(path.join(root, 'assets/styles.css'), 'utf8'),
  ]);
  const pictureRule = styles.match(/\.lightbox-picture\s*\{[^}]+\}/)?.[0] ?? '';
  const imageRule = styles.match(/\.lightbox-panel img\s*\{[^}]+\}/)?.[0] ?? '';

  assert.doesNotMatch(a11ySource, /devicePixelRatio|picture\.style\.maxWidth/);
  assert.match(pictureRule, /display:\s*flex/);
  assert.match(pictureRule, /align-items:\s*center/);
  assert.match(pictureRule, /justify-content:\s*center/);
  assert.match(imageRule, /width:\s*auto/);
  assert.match(imageRule, /height:\s*auto/);
  assert.match(imageRule, /max-width:\s*100%/);
  assert.match(imageRule, /max-height:\s*100%/);
});

test('FR-P5 cache identity covers the complete CSS and ES-module graph', async () => {
  const cacheIdentity = 'fr-maint-single-tier-20260729';
  const indexSource = await readFile(path.join(root, 'index.html'), 'utf8');
  const appSource = await readFile(path.join(root, 'assets', 'app.js'), 'utf8');
  const scienceSource = await readFile(path.join(root, 'assets', 'science-companion.js'), 'utf8');
  const indexAssets = [...indexSource.matchAll(/assets\/(?:styles|science-companion)\.css\?v=([^"]+)|assets\/app\.js\?v=([^"]+)/g)]
    .map((match) => match[1] ?? match[2]);
  const moduleSpecifiers = [
    ...appSource.matchAll(/from '(\.\/[^']+)'/g),
    ...scienceSource.matchAll(/from '(\.\/[^']+)'/g),
  ].map((match) => match[1]);

  assert.deepEqual(indexAssets, [cacheIdentity, cacheIdentity, cacheIdentity]);
  assert.equal(moduleSpecifiers.length, 6);
  moduleSpecifiers.forEach((specifier) => {
    assert.match(specifier, new RegExp(`\\?v=${cacheIdentity}$`));
  });
  assert.equal(
    (indexSource.match(
      /<meta name="fr-p5-media-manifest-sha256" content="[a-f0-9]{64}">/g,
    ) ?? []).length,
    1,
  );
  assert.match(appSource, /expectedCanonicalManifestSha256/);
});

test('FR-P5 app activates and caches only the current route shard', async () => {
  const source = await readFile(path.join(root, 'assets', 'app.js'), 'utf8');
  const loaderSource = await readFile(path.join(root, 'assets', 'content-loader.js'), 'utf8');
  const a11ySource = await readFile(path.join(root, 'assets', 'a11y.js'), 'utf8');
  const scienceSource = await readFile(path.join(root, 'assets', 'science-companion.js'), 'utf8');
  const rendererSource = `${source}\n${scienceSource}`;
  const showLightbox = a11ySource.slice(
    a11ySource.indexOf('function show(index)'),
    a11ySource.indexOf('function close('),
  );
  const homePlan = source.slice(
    source.indexOf("if (route.view === 'home')"),
    source.indexOf("if (route.view === 'series')"),
  );

  assert.match(source, /createMediaResolver/);
  assert.match(homePlan, /contentLoader\.loadHome\(options\)/);
  assert.match(homePlan, /routeData\([\s\S]*context/);
  assert.match(source, /mediaResolver = createMediaResolver\(cached\.mediaShard, \{ sitePath \}\)/);
  assert.match(source, /mediaResolver = createMediaResolver\(next\.mediaShard, \{ sitePath \}\)/);
  assert.match(source, /if \(next\.mediaShard !== null\) routeModelCache\.set\(plan\.key, next\)/);
  assert.match(loaderSource, /Failing closed/);
  assert.doesNotMatch(`${source}\n${loaderSource}`, /loadMediaManifest/);
  assert.doesNotMatch(loaderSource, /loadResource\(MEDIA_MANIFEST_PATH/);
  assert.match(loaderSource, /public\/media\/media-shard-index\.json/);
  assert.match(loaderSource, /cache: 'no-store'/);
  assert.match(loaderSource, /\?sha256=\$\{record\.sha256\}/);
  assert.match(loaderSource, /crypto\.subtle\.digest/);
  assert.match(loaderSource, /bytes\.byteLength !== record\.bytes/);
  assert.match(loaderSource, /\?release=\$\{releaseSha256\}/);
  assert.match(loaderSource, /public\/media\/shards/);
  assert.match(loaderSource, /carmela-book\/\$\{ownerSlug\}\.json/);
  assert.match(loaderSource, /work-cells-topic\/\$\{ownerSlug\}\.json/);
  assert.match(source, /sizes: mediaSizes\(mediaRole, 'home-series-entry'\)/);
  assert.match(source, /error\.status = response\.status/);
  assert.match(source, /\.map\(\(segment\) => encodeURIComponent\(segment\)\)/);
  assert.match(source, /return query \? `\$\{encodedPathname\}\?\$\{query\}` : encodedPathname/);
  assert.match(a11ySource, /source\.removeAttribute\('srcset'\)/);
  assert.match(a11ySource, /source\.setAttribute\('srcset', srcset\)/);
  assert.match(a11ySource, /image\.setAttribute\('srcset', fallbackSrcset\)/);
  assert.match(a11ySource, /image\.setAttribute\('width', String\(item\.width\)\)/);
  assert.match(a11ySource, /image\.setAttribute\('height', String\(item\.height\)\)/);
  assert.match(a11ySource, /if \(picture\) picture\.hidden = true/);
  assert.match(a11ySource, /if \(picture\) picture\.hidden = false/);
  assert.match(a11ySource, /dialog\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(a11ySource, /图片暂时无法显示/);
  assert.ok(
    showLightbox.indexOf('clearResponsiveImageCandidates(picture ?? image)')
      < showLightbox.indexOf("source.setAttribute('srcset', srcset)"),
    'old source and image candidates must be cleared before any new source candidate is installed',
  );
  assert.ok(
    showLightbox.indexOf("image.addEventListener('error'")
      < showLightbox.indexOf("image.setAttribute('src', item.src)"),
    'load and error handlers must exist before the request candidate is installed',
  );
  assert.match(rendererSource, /aria-describedby="lightbox-caption" aria-busy="false"/);
  assert.match(rendererSource, /role="status" aria-live="polite" aria-atomic="true"/);
  for (const role of [
    'carmela-series-cover',
    'carmela-book-cover',
    'carmela-page-preview',
    'carmela-explanation-preview',
    'carmela-lightbox',
    'work-cells-series-thumbnail',
    'work-cells-topic-hero',
    'work-cells-station-preview',
    'work-cells-manga-preview',
    'work-cells-lightbox',
  ]) {
    assert.match(rendererSource, new RegExp(role));
  }
});
