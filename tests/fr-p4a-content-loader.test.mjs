import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { createContentLoader } from '../assets/content-loader.js';

const paths = {
  index: 'public/runtime/index.json',
  carmela: 'public/runtime/carmela/books.json',
  carmelaAssets: 'public/books/不一样的卡梅拉/我想去看海/book-assets.json',
  carmelaCompanion: 'public/books/不一样的卡梅拉/我想去看海/companion.json',
  homeMedia: 'public/media/shards/home.json',
  carmelaSeriesMedia: 'public/media/shards/carmela-series.json',
  carmelaBookMedia: 'public/media/shards/carmela-book/carmela-s1-01.json',
  workCells: 'public/runtime/work-cells/topics.json',
  workCellsTopic: 'public/runtime/work-cells/topics/streptococcus-pneumoniae.json',
  workCellsSeriesMedia: 'public/media/shards/work-cells-series.json',
  workCellsTopicMedia: 'public/media/shards/work-cells-topic/streptococcus-pneumoniae.json',
  mediaIndex: 'public/media/media-shard-index.json',
};

const canonicalManifestSha256 = 'a'.repeat(64);
const policyHash = 'b'.repeat(64);
const generatorVersion = 'fr-p5-media-shards/1';
const canonicalManifest = Object.freeze({
  path: 'public/media/media-manifest.json',
  bytes: 3540144,
  sha256: canonicalManifestSha256,
  policyHash,
  sources: 778,
  variants: 2666,
});

const mediaSources = {
  carmelaCover: 'public/books/不一样的卡梅拉/我想去看海/pages/001.png',
  workCellsThumbnail: 'public/assets/cells-at-work/page-thumbnails/pneumococcus.webp',
};

function mediaEntry(sourcePath, roles, stem) {
  const derivativePath = `public/media/derived/${stem}-480.webp`;
  return {
    sourcePath,
    sourceWidth: 1200,
    sourceHeight: 900,
    sourceFormat: sourcePath.split('.').at(-1),
    roles,
    fallbackPath: derivativePath,
    fallbacksByRole: Object.fromEntries(roles.map((role) => [role, derivativePath])),
    variants: [{
      profileId: `${stem}-480`,
      path: derivativePath,
      width: 480,
      height: 360,
      format: 'webp',
      roles,
    }],
  };
}

function mediaShard(route, media) {
  return {
    schemaVersion: 1,
    generatorVersion,
    policyHash,
    canonicalManifestPath: 'public/media/media-manifest.json',
    canonicalManifest,
    route,
    media,
    totals: {
      sources: media.length,
      variants: media.reduce((total, entry) => total + entry.variants.length, 0),
    },
  };
}

const mediaEntries = {
  homeCarmela: mediaEntry(mediaSources.carmelaCover, ['carmela-series-cover'], 'home-carmela'),
  homeWorkCells: mediaEntry(mediaSources.workCellsThumbnail, ['work-cells-series-thumbnail'], 'home-work-cells'),
  carmelaSeries: mediaEntry(mediaSources.carmelaCover, ['carmela-series-cover'], 'carmela-series'),
  carmelaBook: mediaEntry(mediaSources.carmelaCover, ['carmela-book-cover'], 'carmela-book'),
  workCellsSeries: mediaEntry(mediaSources.workCellsThumbnail, ['work-cells-series-thumbnail'], 'work-cells-series'),
  workCellsTopic: mediaEntry(mediaSources.workCellsThumbnail, ['work-cells-topic-hero'], 'work-cells-topic'),
};

const fixtures = {
  [paths.index]: {
    schemaVersion: 1,
    series: [
      {
        seriesSlug: 'carmela-season-1',
        seriesTitle: '不一样的卡梅拉',
        coverImage: mediaSources.carmelaCover,
        indexPath: paths.carmela,
      },
      {
        seriesSlug: 'work-cells',
        seriesTitle: '工作细胞',
        coverImage: mediaSources.workCellsThumbnail,
        indexPath: paths.workCells,
      },
    ],
  },
  [paths.carmela]: {
    schemaVersion: 1,
    seriesTitle: '不一样的卡梅拉',
    books: [
      {
        order: 1,
        title: '我想去看海',
        slug: 'carmela-s1-01',
        folder: 'public/books/不一样的卡梅拉/我想去看海',
        cover: mediaSources.carmelaCover,
        hasAudio: true,
        assetPath: paths.carmelaAssets,
        companionPath: paths.carmelaCompanion,
      },
    ],
  },
  [paths.carmelaAssets]: { pageImages: ['pages/001.png'] },
  [paths.carmelaCompanion]: { overview: { oneLine: '去看大海。' } },
  [paths.homeMedia]: mediaShard(
    { id: 'home', kind: 'home' },
    [mediaEntries.homeCarmela, mediaEntries.homeWorkCells],
  ),
  [paths.carmelaSeriesMedia]: mediaShard(
    { id: 'carmela-series', kind: 'carmela-series' },
    [mediaEntries.carmelaSeries],
  ),
  [paths.carmelaBookMedia]: mediaShard(
    { id: 'carmela-book/carmela-s1-01', kind: 'carmela-book', ownerId: 'carmela-s1-01' },
    [mediaEntries.carmelaBook],
  ),
  [paths.workCells]: {
    schemaVersion: 1,
    seriesTitle: '工作细胞',
    categories: ['病原体与免疫'],
    topics: [
      {
        order: 1,
        topicId: 'pneumococcus',
        slug: 'streptococcus-pneumoniae',
        title: '肺炎链球菌',
        displayTitle: '肺炎链球菌',
        category: '病原体与免疫',
        sourceLabel: '第1卷 第1话',
        thumbnailPath: mediaSources.workCellsThumbnail,
        detailPath: paths.workCellsTopic,
      },
    ],
  },
  [paths.workCellsTopic]: {
    schemaVersion: 1,
    seriesSlug: 'work-cells',
    slug: 'streptococcus-pneumoniae',
    source: { sourceLabel: '第1卷 第1话' },
    topicOverview: { summary: '身体里的防御反应。' },
    pageRefs: {
      unused: { imagePath: 'public/assets/cells-at-work/pages-by-volume/not-rendered.webp' },
    },
  },
  [paths.workCellsSeriesMedia]: mediaShard(
    { id: 'work-cells-series', kind: 'work-cells-series' },
    [mediaEntries.workCellsSeries],
  ),
  [paths.workCellsTopicMedia]: mediaShard(
    {
      id: 'work-cells-topic/streptococcus-pneumoniae',
      kind: 'work-cells-topic',
      ownerId: 'streptococcus-pneumoniae',
    },
    [mediaEntries.workCellsTopic],
  ),
};

function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fixtureMediaIndex(resources) {
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
        sha256: sha256(bytes),
        bytes: bytes.byteLength,
        sources: shard.totals.sources,
        variants: shard.totals.variants,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path, 'en'));
  return {
    schemaVersion: 1,
    generatorVersion,
    policyHash,
    canonicalManifest,
    shards,
    totals: {
      shards: shards.length,
      sourcesAcrossShards: shards.reduce((sum, shard) => sum + shard.sources, 0),
      variantsAcrossShards: shards.reduce((sum, shard) => sum + shard.variants, 0),
    },
  };
}

function cleanRequestPath(resourcePath) {
  return resourcePath.split('?')[0];
}

function createFetchMock(overrides = {}) {
  const calls = [];
  const resources = { ...fixtures, ...overrides };
  resources[paths.mediaIndex] = fixtureMediaIndex(fixtures);
  const attempts = new Map();
  const fetchJson = async (resourcePath, options = {}) => {
    const cleanPath = cleanRequestPath(resourcePath);
    calls.push({ resourcePath: cleanPath, requestPath: resourcePath, signal: options.signal });
    const attempt = (attempts.get(cleanPath) ?? 0) + 1;
    attempts.set(cleanPath, attempt);
    const value = resources[cleanPath];
    if (typeof value === 'function') {
      return value({ resourcePath: cleanPath, signal: options.signal, attempt });
    }
    if (value instanceof Error) throw value;
    if (value === undefined) throw new Error(`Unexpected request: ${cleanPath}`);
    return value;
  };
  const fetchBytes = async (resourcePath, options = {}) => {
    const cleanPath = cleanRequestPath(resourcePath);
    calls.push({ resourcePath: cleanPath, requestPath: resourcePath, signal: options.signal });
    const value = resources[cleanPath];
    if (value instanceof Error) throw value;
    if (value === undefined) throw new Error(`Unexpected request: ${cleanPath}`);
    return jsonBytes(value);
  };
  return {
    calls,
    fetchJson,
    fetchBytes,
    expectedCanonicalManifestSha256: canonicalManifestSha256,
  };
}

function requestedPaths(mock) {
  return mock.calls.map((call) => call.resourcePath);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('P4A cold route loaders request only their exact JSON closure', async (t) => {
  await t.test('home', async () => {
    const mock = createFetchMock();
    const context = await createContentLoader(mock).loadHome();
    assert.deepEqual(requestedPaths(mock), [paths.index, paths.mediaIndex, paths.homeMedia]);
    assert.equal(context.series.length, 2);
    assert.deepEqual(context.mediaShard, fixtures[paths.homeMedia]);
  });

  await t.test('Carmela series', async () => {
    const mock = createFetchMock();
    const context = await createContentLoader(mock).loadCarmelaSeries();
    assert.deepEqual(requestedPaths(mock), [
      paths.index,
      paths.carmela,
      paths.mediaIndex,
      paths.carmelaSeriesMedia,
    ]);
    assert.equal(context.books.length, 1);
    assert.equal(context.mediaShardPath, paths.carmelaSeriesMedia);
    assert.equal(requestedPaths(mock).some((item) => item.includes('work-cells')), false);
  });

  await t.test('selected Carmela book', async () => {
    const mock = createFetchMock();
    const context = await createContentLoader(mock).loadCarmelaBook('carmela-s1-01');
    assert.deepEqual(requestedPaths(mock), [
      paths.index,
      paths.carmela,
      paths.carmelaAssets,
      paths.carmelaCompanion,
      paths.mediaIndex,
      paths.carmelaBookMedia,
    ]);
    assert.equal(context.book.slug, 'carmela-s1-01');
    assert.equal(context.book.seriesTitle, '不一样的卡梅拉');
    assert.equal(context.book.assets, fixtures[paths.carmelaAssets]);
    assert.equal(context.book.companion, fixtures[paths.carmelaCompanion]);
    assert.equal(context.mediaShardPath, paths.carmelaBookMedia);
    assert.equal(requestedPaths(mock).some((item) => item.includes('work-cells')), false);
  });

  await t.test('Work Cells series', async () => {
    const mock = createFetchMock();
    const context = await createContentLoader(mock).loadWorkCellsSeries();
    assert.deepEqual(requestedPaths(mock), [
      paths.index,
      paths.workCells,
      paths.mediaIndex,
      paths.workCellsSeriesMedia,
    ]);
    assert.deepEqual(context.categories, ['病原体与免疫']);
    assert.equal(context.mediaShardPath, paths.workCellsSeriesMedia);
    assert.equal(requestedPaths(mock).some((item) => item.includes('book-assets')), false);
  });

  await t.test('selected Work Cells topic', async () => {
    const mock = createFetchMock();
    const context = await createContentLoader(mock).loadWorkCellsTopic('streptococcus-pneumoniae');
    assert.deepEqual(requestedPaths(mock), [
      paths.index,
      paths.workCells,
      paths.workCellsTopic,
      paths.mediaIndex,
      paths.workCellsTopicMedia,
    ]);
    assert.equal(context.topic.slug, 'streptococcus-pneumoniae');
    assert.equal(context.topic.thumbnailPath, fixtures[paths.workCells].topics[0].thumbnailPath);
    assert.deepEqual(context.topic.topicOverview, fixtures[paths.workCellsTopic].topicOverview);
    assert.equal(context.mediaShardPath, paths.workCellsTopicMedia);
    assert.equal(requestedPaths(mock).some((item) => item.includes('book-assets')), false);
  });

  await t.test('no route reads a global or unrelated media document', async () => {
    const mock = createFetchMock();
    await createContentLoader(mock).loadWorkCellsTopic('streptococcus-pneumoniae');
    const requested = requestedPaths(mock);
    assert.equal(requested.filter((item) => item.startsWith('public/media/shards/')).length, 1);
    assert.equal(requested.includes('public/media/media-manifest.json'), false);
    assert.equal(requested.includes(paths.mediaIndex), true);
    assert.equal(requested.includes(paths.homeMedia), false);
    assert.equal(requested.includes(paths.workCellsSeriesMedia), false);
  });
});

test('P4A coalesces concurrent subscribers for the same resource', async () => {
  const pending = deferred();
  const mock = createFetchMock({ [paths.index]: () => pending.promise });
  const loader = createContentLoader(mock);
  const first = loader.loadHome();
  const second = loader.loadHome();

  await Promise.resolve();
  assert.equal(requestedPaths(mock).filter((item) => item === paths.index).length, 1);
  assert.equal(requestedPaths(mock).filter((item) => item === paths.mediaIndex).length, 1);
  pending.resolve(fixtures[paths.index]);
  const [firstContext, secondContext] = await Promise.all([first, second]);
  assert.equal(firstContext.index, secondContext.index);
  assert.deepEqual(requestedPaths(mock), [paths.index, paths.mediaIndex, paths.homeMedia]);
});

test('P4A evicts failures so retry fetches only the failed resource again', async () => {
  const retryError = new Error('temporary topic failure');
  const mock = createFetchMock({
    [paths.workCellsTopic]: ({ attempt }) => {
      if (attempt === 1) throw retryError;
      return fixtures[paths.workCellsTopic];
    },
  });
  const loader = createContentLoader(mock);

  await assert.rejects(
    loader.loadWorkCellsTopic('streptococcus-pneumoniae'),
    /temporary topic failure/,
  );
  const context = await loader.loadWorkCellsTopic('streptococcus-pneumoniae');
  assert.equal(context.topic.slug, 'streptococcus-pneumoniae');
  assert.deepEqual(requestedPaths(mock), [
    paths.index,
    paths.workCells,
    paths.workCellsTopic,
    paths.mediaIndex,
    paths.workCellsTopicMedia,
    paths.workCellsTopic,
  ]);
});

test('invalid runtime structures remain retryable without clearing valid caches', async (t) => {
  const cases = [
    ['home index', paths.index, { series: {} }, (loader) => loader.loadHome()],
    ['index series entry', paths.index, { series: [null] }, (loader) => loader.loadHome()],
    ['index path', paths.index, {
      series: fixtures[paths.index].series.map((series) => ({ ...series, indexPath: null })),
    }, (loader) => loader.loadCarmelaSeries()],
    ['book catalog', paths.carmela, { books: {} }, (loader) => loader.loadCarmelaSeries()],
    ['book entry', paths.carmela, { books: [null] }, (loader) => loader.loadCarmelaBook('carmela-s1-01')],
    ['book detail path', paths.carmela, {
      books: [{ ...fixtures[paths.carmela].books[0], companionPath: null }],
    }, (loader) => loader.loadCarmelaBook('carmela-s1-01')],
    ['book assets', paths.carmelaAssets, null, (loader) => loader.loadCarmelaBook('carmela-s1-01')],
    ['book page images', paths.carmelaAssets, { pageImages: {} }, (loader) => loader.loadCarmelaBook('carmela-s1-01')],
    ['companion image refs', paths.carmelaCompanion, { review: [{ imageRefs: {} }] }, (loader) => loader.loadCarmelaBook('carmela-s1-01')],
    ...['scenes', 'backgroundNotes', 'encyclopediaEntries'].map((key) => [
      `companion ${key} entry`, paths.carmelaCompanion, { [key]: [null] },
      (loader) => loader.loadCarmelaBook('carmela-s1-01'),
    ]),
    ...['factualRecall', 'comprehension', 'openExpression'].map((key) => [
      `companion ${key} entry`, paths.carmelaCompanion, { questionCards: { [key]: [null] } },
      (loader) => loader.loadCarmelaBook('carmela-s1-01'),
    ]),
    ['topic catalog', paths.workCells, { topics: {} }, (loader) => loader.loadWorkCellsSeries()],
    ['topic categories', paths.workCells, { ...fixtures[paths.workCells], categories: {} }, (loader) => loader.loadWorkCellsSeries()],
    ['topic entry', paths.workCells, { topics: [null] }, (loader) => loader.loadWorkCellsTopic('streptococcus-pneumoniae')],
    ['topic detail', paths.workCellsTopic, null, (loader) => loader.loadWorkCellsTopic('streptococcus-pneumoniae')],
    ['topic stations', paths.workCellsTopic, { bodyScienceStations: {} }, (loader) => loader.loadWorkCellsTopic('streptococcus-pneumoniae')],
    ['topic question cards', paths.workCellsTopic, { parentQuestionCards: {} }, (loader) => loader.loadWorkCellsTopic('streptococcus-pneumoniae')],
    ['topic page ids', paths.workCellsTopic, { bodyScienceStations: [{ relatedPageIds: {} }] }, (loader) => loader.loadWorkCellsTopic('streptococcus-pneumoniae')],
    ['topic page reference', paths.workCellsTopic, { parentQuestionCards: [{ relatedPageIds: ['missing'] }] }, (loader) => loader.loadWorkCellsTopic('streptococcus-pneumoniae')],
  ];

  for (const [label, resourcePath, malformed, load] of cases) {
    await t.test(label, async () => {
      const firstResponse = deferred();
      const mock = createFetchMock({
        [resourcePath]: ({ attempt }) => attempt === 1 ? firstResponse.promise : fixtures[resourcePath],
      });
      const loader = createContentLoader(mock);
      const failures = Promise.allSettled([load(loader), load(loader)]);
      firstResponse.resolve(malformed);
      const results = await failures;
      assert.deepEqual(results.map((result) => result.status), ['rejected', 'rejected']);
      const [first, second] = await Promise.all([load(loader), load(loader)]);
      assert.equal(first.index, second.index);
      assert.equal(first.mediaShard, second.mediaShard);
      assert.equal(mock.calls.filter((call) => call.resourcePath === resourcePath).length, 2);
      for (const cachedPath of new Set(requestedPaths(mock))) {
        if (cachedPath === resourcePath) continue;
        assert.equal(mock.calls.filter((call) => call.resourcePath === cachedPath).length, 1, cachedPath);
      }
      const requestsAfterRecovery = mock.calls.length;
      await load(loader);
      assert.equal(mock.calls.length, requestsAfterRecovery, 'successful recovery stays cached');
    });
  }
});

test('P4A aborting one subscriber does not cancel another coalesced subscriber', async () => {
  const pending = deferred();
  let sharedSignal;
  const mock = createFetchMock({
    [paths.index]: ({ signal }) => {
      sharedSignal = signal;
      return pending.promise;
    },
  });
  const loader = createContentLoader(mock);
  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = loader.loadHome({ signal: firstController.signal });
  const second = loader.loadHome({ signal: secondController.signal });

  await Promise.resolve();
  firstController.abort();
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal(sharedSignal.aborted, false);
  pending.resolve(fixtures[paths.index]);
  assert.equal((await second).series.length, 2);
  assert.deepEqual(requestedPaths(mock), [paths.index, paths.mediaIndex, paths.homeMedia]);
});

test('P4A fully aborted work is evicted and a later call starts a fresh request', async () => {
  const pendingByAttempt = [deferred(), deferred()];
  const observedSignals = [];
  const mock = createFetchMock({
    [paths.index]: ({ signal, attempt }) => {
      observedSignals.push(signal);
      return pendingByAttempt[attempt - 1].promise;
    },
  });
  const loader = createContentLoader(mock);
  const controller = new AbortController();
  const first = loader.loadHome({ signal: controller.signal });

  await Promise.resolve();
  controller.abort();
  await assert.rejects(first, { name: 'AbortError' });
  await Promise.resolve();
  assert.equal(observedSignals[0].aborted, true);

  const retry = loader.loadHome();
  await Promise.resolve();
  pendingByAttempt[1].resolve(fixtures[paths.index]);
  assert.equal((await retry).series.length, 2);
  assert.equal(requestedPaths(mock).filter((item) => item === paths.index).length, 2);
  assert.equal(requestedPaths(mock).filter((item) => item === paths.mediaIndex).length, 2);
  assert.equal(requestedPaths(mock).filter((item) => item === paths.homeMedia).length, 1);
  pendingByAttempt[0].resolve(fixtures[paths.index]);
});

test('P4A invalid slugs stop after the relevant summary index', async () => {
  const carmelaMock = createFetchMock();
  const carmela = await createContentLoader(carmelaMock).loadCarmelaBook('missing-book');
  assert.equal(carmela.summary, null);
  assert.equal(carmela.book, null);
  assert.deepEqual(requestedPaths(carmelaMock), [paths.index, paths.carmela]);

  const workCellsMock = createFetchMock();
  const workCells = await createContentLoader(workCellsMock).loadWorkCellsTopic('missing-topic');
  assert.equal(workCells.summary, null);
  assert.equal(workCells.topic, null);
  assert.deepEqual(requestedPaths(workCellsMock), [paths.index, paths.workCells]);
});

test('P4A cache reuse avoids requests for a section-like repeat and clear refetches', async () => {
  const mock = createFetchMock();
  const loader = createContentLoader(mock);
  const first = await loader.loadCarmelaBook('carmela-s1-01');
  const firstRequests = requestedPaths(mock);
  const second = await loader.loadCarmelaBook('carmela-s1-01');

  assert.deepEqual(requestedPaths(mock), firstRequests);
  assert.equal(first.book.assets, second.book.assets);
  assert.equal(first.book.companion, second.book.companion);

  loader.clear();
  await loader.loadHome();
  assert.equal(requestedPaths(mock).filter((item) => item === paths.index).length, 2);
  assert.equal(requestedPaths(mock).filter((item) => item === paths.homeMedia).length, 1);
});

test('P4A clear aborts in-flight work and removes it from the request cache', async () => {
  const pending = deferred();
  let requestSignal;
  const mock = createFetchMock({
    [paths.index]: ({ signal }) => {
      requestSignal = signal;
      return pending.promise;
    },
  });
  const loader = createContentLoader(mock);
  const loading = loader.loadHome();

  await Promise.resolve();
  loader.clear();
  assert.equal(requestSignal.aborted, true);
  pending.resolve(fixtures[paths.index]);
  await assert.rejects(loading, { name: 'AbortError' });
});

test('P4A rejects a pre-aborted call without issuing a request', async () => {
  const mock = createFetchMock();
  const loader = createContentLoader(mock);
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(loader.loadHome({ signal: controller.signal }), { name: 'AbortError' });
  assert.deepEqual(requestedPaths(mock), []);
});
