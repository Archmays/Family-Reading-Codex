const RUNTIME_INDEX_PATH = 'public/runtime/index.json';
const MEDIA_SHARD_INDEX_PATH = 'public/media/media-shard-index.json';
const MEDIA_SHARD_ROOT = 'public/media/shards';
const HOME_MEDIA_SHARD_PATH = `${MEDIA_SHARD_ROOT}/home.json`;
const CARMELA_SERIES_MEDIA_SHARD_PATH = `${MEDIA_SHARD_ROOT}/carmela-series.json`;
const WORK_CELLS_SERIES_MEDIA_SHARD_PATH = `${MEDIA_SHARD_ROOT}/work-cells-series.json`;
const CARMELA_SERIES_SLUG = 'carmela-season-1';
const WORK_CELLS_SERIES_SLUG = 'work-cells';
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MEDIA_SHARD_SCHEMA_VERSION = 1;
const MEDIA_SHARD_GENERATOR_VERSION = 'fr-p5-media-shards/1';
const MEDIA_MANIFEST_PATH = 'public/media/media-manifest.json';
const DERIVATIVE_ROOT = 'public/media/derived/';
const DERIVATIVE_FORMATS = new Set(['avif', 'jpeg', 'jpg', 'png', 'webp']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function abortError() {
  const error = new Error('The content request was aborted.');
  error.name = 'AbortError';
  return error;
}

function requiredPath(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing runtime path: ${label}`);
  }
  return value;
}

function requiredSeries(index, seriesSlug) {
  const series = index?.series?.find((item) => item.seriesSlug === seriesSlug);
  if (!series) {
    throw new Error(`Missing runtime series: ${seriesSlug}`);
  }
  return series;
}

function requiredSlug(value, label) {
  const slug = String(value ?? '');
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`Invalid runtime slug: ${label}`);
  }
  return slug;
}

function requiredObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid runtime structure: ${label} must be an object.`);
  }
  return value;
}

function requiredArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid runtime structure: ${label} must be an array.`);
  }
  return value;
}

function validateRuntimeIndex(index) {
  requiredObject(index, 'index');
  for (const series of requiredArray(index.series, 'index.series')) {
    requiredObject(series, 'series');
    requiredSlug(series.seriesSlug, 'series');
    requiredPath(series.indexPath, 'series index');
  }
  homeMediaRequirements(index);
}

function validateCarmelaCatalog(catalog) {
  requiredObject(catalog, 'Carmela catalog');
  const books = requiredArray(catalog.books, 'Carmela books');
  for (const book of books) {
    requiredObject(book, 'Carmela book');
    requiredSlug(book.slug, 'Carmela book');
    requiredPath(book.folder, 'Carmela book folder');
    requiredPath(book.assetPath, 'Carmela asset detail');
    requiredPath(book.companionPath, 'Carmela companion detail');
  }
  carmelaSeriesMediaRequirements(books);
}

function validateWorkCellsCatalog(catalog) {
  requiredObject(catalog, 'Work Cells catalog');
  const topics = requiredArray(catalog.topics, 'Work Cells topics');
  if (catalog.categories !== undefined) requiredArray(catalog.categories, 'Work Cells categories');
  for (const topic of topics) {
    requiredObject(topic, 'Work Cells topic');
    requiredSlug(topic.slug, 'Work Cells topic');
    requiredPath(topic.detailPath, 'Work Cells topic detail');
  }
  workCellsSeriesMediaRequirements(topics);
}

function validateCarmelaAssets(assets) {
  requiredObject(assets, 'Carmela assets');
  for (const image of requiredArray(assets.pageImages, 'Carmela pageImages')) {
    requiredPath(image, 'Carmela page image');
  }
}

function validateCarmelaCompanion(summary, companion) {
  requiredObject(companion, 'Carmela companion');
  for (const key of ['scenes', 'backgroundNotes', 'encyclopediaEntries']) {
    if (companion[key] === undefined) continue;
    for (const item of requiredArray(companion[key], `Carmela ${key}`)) {
      requiredObject(item, `Carmela ${key} item`);
    }
  }
  if (companion.questionCards !== undefined) {
    requiredObject(companion.questionCards, 'Carmela questionCards');
    for (const key of ['factualRecall', 'comprehension', 'openExpression']) {
      if (companion.questionCards[key] === undefined) continue;
      for (const card of requiredArray(companion.questionCards[key], `Carmela ${key}`)) {
        requiredObject(card, `Carmela ${key} card`);
      }
    }
  }
  carmelaBookMediaRequirements(summary, companion);
}

function validateWorkCellsDetail(summary, detail) {
  requiredObject(detail, 'Work Cells detail');
  if (detail.pageRefs !== undefined) requiredObject(detail.pageRefs, 'Work Cells pageRefs');
  for (const key of ['bodyScienceStations', 'parentQuestionCards']) {
    if (detail[key] === undefined) continue;
    for (const item of requiredArray(detail[key], `Work Cells ${key}`)) {
      requiredObject(item, `Work Cells ${key} item`);
      if (item.relatedPageIds !== undefined) {
        requiredArray(item.relatedPageIds, 'Work Cells relatedPageIds');
      }
    }
  }
  workCellsTopicMediaRequirements(summary, detail);
}

function invalidMediaShard(reason) {
  const error = new Error(`Invalid route media shard: ${reason}`);
  error.code = 'INVALID_MEDIA_SHARD';
  return error;
}

function invalidMediaShardIndex(reason) {
  const error = new Error(`Invalid route media shard index: ${reason}`);
  error.code = 'INVALID_MEDIA_SHARD_INDEX';
  return error;
}

function requiredSha256(value, label, invalid = invalidMediaShardIndex) {
  const digest = String(value ?? '');
  if (!SHA256_PATTERN.test(digest)) {
    throw invalid(`${label} must be a lowercase 64-hex SHA-256.`);
  }
  return digest;
}

function requiredPositiveInteger(value, label, invalid = invalidMediaShardIndex) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw invalid(`${label} must be a positive safe integer.`);
  }
  return value;
}

function expectedShardPath(routeId) {
  if (routeId === 'home') return HOME_MEDIA_SHARD_PATH;
  if (routeId === 'carmela-series') return CARMELA_SERIES_MEDIA_SHARD_PATH;
  if (routeId === 'work-cells-series') return WORK_CELLS_SERIES_MEDIA_SHARD_PATH;
  const [kind, slug, extra] = String(routeId ?? '').split('/');
  if (extra !== undefined || !SLUG_PATTERN.test(slug ?? '')) return '';
  if (kind === 'carmela-book') return `${MEDIA_SHARD_ROOT}/carmela-book/${slug}.json`;
  if (kind === 'work-cells-topic') return `${MEDIA_SHARD_ROOT}/work-cells-topic/${slug}.json`;
  return '';
}

function bytesView(value, label) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError(`${label} must return bytes.`);
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) {
    throw invalidMediaShard('Web Crypto SHA-256 is unavailable.');
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function parseUtf8Json(bytes, label, invalid) {
  let text;
  try {
    text = UTF8_DECODER.decode(bytes);
  } catch {
    throw invalid(`${label} is not valid UTF-8.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw invalid(`${label} is not valid JSON.`);
  }
}

function normalizeMediaPath(value, label = 'media path') {
  if (typeof value !== 'string' || value.trim() === '') {
    throw invalidMediaShard(`${label} is missing.`);
  }
  const candidate = value.trim().replaceAll('\\', '/');
  if (candidate.startsWith('/') || /^[a-z][a-z0-9+.-]*:/iu.test(candidate)) {
    throw invalidMediaShard(`${label} must be repository-relative.`);
  }
  const segments = [];
  for (const segment of candidate.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) throw invalidMediaShard(`${label} escapes its route closure.`);
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  const normalized = segments.join('/');
  if (!normalized.startsWith('public/')) {
    throw invalidMediaShard(`${label} must stay under public/.`);
  }
  return normalized;
}

function joinedMediaPath(basePath, mediaPath, label) {
  const value = String(mediaPath ?? '').trim();
  return normalizeMediaPath(
    value.startsWith('public/') ? value : `${requiredPath(basePath, `${label} base`)}/${value}`,
    label,
  );
}

function addMediaRequirement(requirements, sourcePath, roles, label) {
  const normalized = normalizeMediaPath(sourcePath, label);
  const roleSet = requirements.get(normalized) ?? new Set();
  for (const role of roles) roleSet.add(role);
  requirements.set(normalized, roleSet);
}

function serializedRequirements(requirements) {
  return [...requirements.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([sourcePath, roles]) => ({
      sourcePath,
      roles: [...roles].sort((left, right) => left.localeCompare(right, 'en')),
    }));
}

function homeMediaRequirements(index) {
  const requirements = new Map();
  const carmela = requiredSeries(index, CARMELA_SERIES_SLUG);
  const workCells = requiredSeries(index, WORK_CELLS_SERIES_SLUG);
  addMediaRequirement(
    requirements,
    requiredPath(carmela.coverImage, 'Carmela home cover'),
    ['carmela-series-cover'],
    'Carmela home cover',
  );
  addMediaRequirement(
    requirements,
    requiredPath(workCells.coverImage, 'Work Cells home cover'),
    ['work-cells-series-thumbnail'],
    'Work Cells home cover',
  );
  return serializedRequirements(requirements);
}

function carmelaSeriesMediaRequirements(books) {
  const requirements = new Map();
  for (const [index, book] of books.entries()) {
    addMediaRequirement(
      requirements,
      requiredPath(book?.cover, `Carmela book ${index + 1} cover`),
      ['carmela-series-cover'],
      `Carmela book ${index + 1} cover`,
    );
  }
  return serializedRequirements(requirements);
}

function carmelaBookMediaRequirements(summary, companion) {
  const requirements = new Map();
  const folder = requiredPath(summary?.folder, 'Carmela book folder');
  addMediaRequirement(
    requirements,
    requiredPath(summary?.cover, 'Carmela book cover'),
    ['carmela-book-cover'],
    'Carmela book cover',
  );
  const referenceRoles = new Map([
    ['imageRefs', ['carmela-page-preview', 'carmela-lightbox']],
    ['evidenceImageRefs', ['carmela-page-preview', 'carmela-lightbox']],
    ['generatedImageRefs', ['carmela-explanation-preview', 'carmela-lightbox']],
  ]);

  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const roles = referenceRoles.get(key);
      if (!roles) {
        visit(child);
        continue;
      }
      if (!Array.isArray(child)) {
        throw invalidMediaShard(`Carmela ${key} must be an array.`);
      }
      child.forEach((mediaPath, index) => {
        addMediaRequirement(
          requirements,
          joinedMediaPath(folder, mediaPath, `Carmela ${key}[${index}]`),
          roles,
          `Carmela ${key}[${index}]`,
        );
      });
    }
  }

  visit(companion);
  return serializedRequirements(requirements);
}

function workCellsSeriesMediaRequirements(topics) {
  const requirements = new Map();
  for (const [index, topic] of topics.entries()) {
    addMediaRequirement(
      requirements,
      requiredPath(topic?.thumbnailPath, `Work Cells topic ${index + 1} thumbnail`),
      ['work-cells-series-thumbnail'],
      `Work Cells topic ${index + 1} thumbnail`,
    );
  }
  return serializedRequirements(requirements);
}

function workCellsTopicMediaRequirements(summary, detail) {
  const requirements = new Map();
  const referencedPageIds = new Set();
  addMediaRequirement(
    requirements,
    requiredPath(summary?.thumbnailPath, 'Work Cells topic hero'),
    ['work-cells-topic-hero'],
    'Work Cells topic hero',
  );
  for (const [index, station] of (detail?.bodyScienceStations ?? []).entries()) {
    if (station?.imageAsset) {
      addMediaRequirement(
        requirements,
        station.imageAsset,
        ['work-cells-station-preview', 'work-cells-lightbox'],
        `Work Cells station ${index + 1}`,
      );
    }
    for (const pageId of station?.relatedPageIds ?? []) referencedPageIds.add(pageId);
  }
  for (const card of detail?.parentQuestionCards ?? []) {
    for (const pageId of card?.relatedPageIds ?? []) referencedPageIds.add(pageId);
  }
  for (const pageId of referencedPageIds) {
    const page = detail?.pageRefs?.[pageId];
    addMediaRequirement(
      requirements,
      requiredPath(page?.imagePath, `Work Cells page ${pageId}`),
      ['work-cells-manga-preview', 'work-cells-lightbox'],
      `Work Cells page ${pageId}`,
    );
  }
  return serializedRequirements(requirements);
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateCanonicalManifestState(state, {
  expectedSha256,
  expectedPolicyHash = null,
  invalid = invalidMediaShardIndex,
  label = 'canonicalManifest',
} = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw invalid(`${label} must be an object.`);
  }
  if (state.path !== MEDIA_MANIFEST_PATH) {
    throw invalid(`${label}.path is not the release manifest.`);
  }
  requiredPositiveInteger(state.bytes, `${label}.bytes`, invalid);
  const sha256 = requiredSha256(state.sha256, `${label}.sha256`, invalid);
  const policyHash = requiredSha256(state.policyHash, `${label}.policyHash`, invalid);
  if (expectedSha256 !== undefined && sha256 !== expectedSha256) {
    throw invalid(`${label}.sha256 does not match the HTML release identity.`);
  }
  if (expectedPolicyHash !== null && policyHash !== expectedPolicyHash) {
    throw invalid(`${label}.policyHash does not match its parent release identity.`);
  }
  requiredPositiveInteger(state.sources, `${label}.sources`, invalid);
  requiredPositiveInteger(state.variants, `${label}.variants`, invalid);
  if (state.variants < state.sources) {
    throw invalid(`${label}.variants cannot be smaller than its source count.`);
  }
  return state;
}

export function validateMediaShardIndex(index, {
  expectedCanonicalManifestSha256,
} = {}) {
  const expectedSha256 = requiredSha256(
    expectedCanonicalManifestSha256,
    'expected canonical manifest SHA-256',
  );
  if (!index || typeof index !== 'object' || Array.isArray(index)) {
    throw invalidMediaShardIndex('document must be an object.');
  }
  if (index.schemaVersion !== MEDIA_SHARD_SCHEMA_VERSION) {
    throw invalidMediaShardIndex(`schemaVersion must be ${MEDIA_SHARD_SCHEMA_VERSION}.`);
  }
  if (index.generatorVersion !== MEDIA_SHARD_GENERATOR_VERSION) {
    throw invalidMediaShardIndex(`generatorVersion must be ${MEDIA_SHARD_GENERATOR_VERSION}.`);
  }
  const policyHash = requiredSha256(index.policyHash, 'policyHash');
  validateCanonicalManifestState(index.canonicalManifest, {
    expectedSha256,
    expectedPolicyHash: policyHash,
  });
  if (!Array.isArray(index.shards) || index.shards.length === 0) {
    throw invalidMediaShardIndex('shards must be a non-empty array.');
  }

  const routes = new Set();
  const paths = new Set();
  let sourcesAcrossShards = 0;
  let variantsAcrossShards = 0;
  for (const [recordIndex, record] of index.shards.entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw invalidMediaShardIndex(`shards[${recordIndex}] must be an object.`);
    }
    const routeId = String(record.routeId ?? '');
    const routePath = expectedShardPath(routeId);
    if (!routePath || record.path !== routePath) {
      throw invalidMediaShardIndex(`shards[${recordIndex}] routeId/path mapping is invalid.`);
    }
    if (routes.has(routeId) || paths.has(routePath)) {
      throw invalidMediaShardIndex('routeId and path values must be unique.');
    }
    routes.add(routeId);
    paths.add(routePath);
    requiredSha256(record.sha256, `shards[${recordIndex}].sha256`);
    requiredPositiveInteger(record.bytes, `shards[${recordIndex}].bytes`);
    requiredPositiveInteger(record.sources, `shards[${recordIndex}].sources`);
    requiredPositiveInteger(record.variants, `shards[${recordIndex}].variants`);
    if (record.variants < record.sources) {
      throw invalidMediaShardIndex(`shards[${recordIndex}].variants is smaller than sources.`);
    }
    sourcesAcrossShards += record.sources;
    variantsAcrossShards += record.variants;
  }

  if (
    !index.totals
    || index.totals.shards !== index.shards.length
    || index.totals.sourcesAcrossShards !== sourcesAcrossShards
    || index.totals.variantsAcrossShards !== variantsAcrossShards
  ) {
    throw invalidMediaShardIndex('totals do not match the indexed shard records.');
  }
  return index;
}

export function validateRouteMediaShard(shard, {
  routeId,
  kind,
  ownerId = null,
  requirements = [],
  canonicalManifest = null,
  policyHash = null,
} = {}) {
  if (!shard || typeof shard !== 'object' || Array.isArray(shard)) {
    throw invalidMediaShard('document must be an object.');
  }
  if (shard.schemaVersion !== MEDIA_SHARD_SCHEMA_VERSION) {
    throw invalidMediaShard(`schemaVersion must be ${MEDIA_SHARD_SCHEMA_VERSION}.`);
  }
  if (shard.generatorVersion !== MEDIA_SHARD_GENERATOR_VERSION) {
    throw invalidMediaShard(`generatorVersion must be ${MEDIA_SHARD_GENERATOR_VERSION}.`);
  }
  const shardPolicyHash = requiredSha256(shard.policyHash, 'policyHash', invalidMediaShard);
  if (policyHash !== null && shardPolicyHash !== policyHash) {
    throw invalidMediaShard('policyHash does not match the route index.');
  }
  if (shard.canonicalManifestPath !== MEDIA_MANIFEST_PATH) {
    throw invalidMediaShard('canonical manifest path is not the release manifest.');
  }
  const expectedCanonical = canonicalManifest ?? shard.canonicalManifest;
  validateCanonicalManifestState(shard.canonicalManifest, {
    expectedSha256: expectedCanonical?.sha256,
    expectedPolicyHash: shardPolicyHash,
    invalid: invalidMediaShard,
  });
  if (
    !expectedCanonical
    || shard.canonicalManifest.bytes !== expectedCanonical.bytes
    || shard.canonicalManifest.sha256 !== expectedCanonical.sha256
    || shard.canonicalManifest.policyHash !== expectedCanonical.policyHash
    || shard.canonicalManifest.sources !== expectedCanonical.sources
    || shard.canonicalManifest.variants !== expectedCanonical.variants
  ) {
    throw invalidMediaShard('canonical manifest state does not match the route index.');
  }
  if (
    !shard.route
    || typeof shard.route !== 'object'
    || Array.isArray(shard.route)
    || shard.route.id !== routeId
    || shard.route.kind !== kind
  ) {
    throw invalidMediaShard('route identity does not match the requested route.');
  }
  const actualOwnerId = Object.hasOwn(shard.route, 'ownerId') ? shard.route.ownerId : null;
  if (actualOwnerId !== ownerId) {
    throw invalidMediaShard('route owner does not match the requested route.');
  }
  if (!Array.isArray(shard.media)) throw invalidMediaShard('media must be an array.');
  if (
    !shard.totals
    || !Number.isSafeInteger(shard.totals.sources)
    || !Number.isSafeInteger(shard.totals.variants)
    || shard.totals.sources < 0
    || shard.totals.variants < 0
  ) {
    throw invalidMediaShard('totals must contain non-negative integer source and variant counts.');
  }

  const entries = new Map();
  const derivativePaths = new Set();
  let variantCount = 0;
  for (const [entryIndex, entry] of shard.media.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw invalidMediaShard(`media[${entryIndex}] must be an object.`);
    }
    const sourcePath = normalizeMediaPath(entry.sourcePath, `media[${entryIndex}].sourcePath`);
    if (sourcePath !== entry.sourcePath) {
      throw invalidMediaShard(`media[${entryIndex}].sourcePath is not canonical.`);
    }
    if (entries.has(sourcePath)) throw invalidMediaShard('source paths must be unique.');
    if (
      !Number.isSafeInteger(entry.sourceWidth)
      || entry.sourceWidth <= 0
      || !Number.isSafeInteger(entry.sourceHeight)
      || entry.sourceHeight <= 0
    ) {
      throw invalidMediaShard(`media[${entryIndex}] source dimensions are invalid.`);
    }
    if (
      !Array.isArray(entry.roles)
      || entry.roles.length === 0
      || entry.roles.some((role) => typeof role !== 'string' || role.length === 0)
      || new Set(entry.roles).size !== entry.roles.length
      || !Array.isArray(entry.variants)
      || entry.variants.length === 0
    ) {
      throw invalidMediaShard(`media[${entryIndex}] roles and variants must be arrays.`);
    }
    if (
      !entry.fallbacksByRole
      || typeof entry.fallbacksByRole !== 'object'
      || Array.isArray(entry.fallbacksByRole)
      || !sameValues(
        Object.keys(entry.fallbacksByRole).sort((left, right) => left.localeCompare(right, 'en')),
        [...entry.roles].sort((left, right) => left.localeCompare(right, 'en')),
      )
    ) {
      throw invalidMediaShard(`media[${entryIndex}] role fallbacks do not match its roles.`);
    }
    const variantPaths = new Set();
    for (const [variantIndex, variant] of entry.variants.entries()) {
      if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
        throw invalidMediaShard(`media[${entryIndex}].variants[${variantIndex}] must be an object.`);
      }
      const variantPath = normalizeMediaPath(
        variant.path,
        `media[${entryIndex}].variants[${variantIndex}].path`,
      );
      if (!variantPath.startsWith(DERIVATIVE_ROOT) || variantPath === sourcePath) {
        throw invalidMediaShard(`media[${entryIndex}] contains a non-derivative variant.`);
      }
      if (variantPath !== variant.path) {
        throw invalidMediaShard(`media[${entryIndex}] contains a non-canonical variant path.`);
      }
      if (variantPaths.has(variantPath) || derivativePaths.has(variantPath)) {
        throw invalidMediaShard('variant paths must be unique within the route shard.');
      }
      variantPaths.add(variantPath);
      derivativePaths.add(variantPath);
      if (
        !Number.isSafeInteger(variant.width)
        || variant.width <= 0
        || !Number.isSafeInteger(variant.height)
        || variant.height <= 0
        || !DERIVATIVE_FORMATS.has(variant.format)
        || !Array.isArray(variant.roles)
        || variant.roles.length === 0
        || variant.roles.some((role) => (
          typeof role !== 'string'
          || role.length === 0
          || !entry.roles.includes(role)
        ))
        || new Set(variant.roles).size !== variant.roles.length
      ) {
        throw invalidMediaShard(`media[${entryIndex}].variants[${variantIndex}] is malformed.`);
      }
    }
    for (const role of entry.roles) {
      const roleVariants = entry.variants.filter((variant) => variant.roles.includes(role));
      if (roleVariants.length === 0) {
        throw invalidMediaShard(`media[${entryIndex}] role ${role} has no derivative variant.`);
      }
      const fallbackPath = entry.fallbacksByRole[role];
      const fallback = roleVariants.find((variant) => variant.path === fallbackPath);
      if (!fallback || fallback.format === 'avif') {
        throw invalidMediaShard(`media[${entryIndex}] role ${role} has no compatible derivative fallback.`);
      }
    }
    if (!Object.values(entry.fallbacksByRole).includes(entry.fallbackPath)) {
      throw invalidMediaShard(`media[${entryIndex}] fallbackPath is not a role fallback.`);
    }
    variantCount += entry.variants.length;
    entries.set(sourcePath, entry);
  }

  if (shard.totals.sources !== shard.media.length || shard.totals.variants !== variantCount) {
    throw invalidMediaShard('totals do not match the media payload.');
  }
  const expectedPaths = requirements.map((requirement) => (
    normalizeMediaPath(requirement.sourcePath, 'expected route source')
  )).sort((left, right) => left.localeCompare(right, 'en'));
  const actualPaths = [...entries.keys()].sort((left, right) => left.localeCompare(right, 'en'));
  if (!sameValues(actualPaths, expectedPaths)) {
    throw invalidMediaShard('source closure does not match the requested route.');
  }

  for (const requirement of requirements) {
    const sourcePath = normalizeMediaPath(requirement.sourcePath, 'expected route source');
    const entry = entries.get(sourcePath);
    for (const role of requirement.roles ?? []) {
      if (!entry.roles.includes(role)) {
        throw invalidMediaShard(`required role ${role} is absent from its source entry.`);
      }
      const roleVariants = entry.variants.filter((variant) => variant.roles.includes(role));
      if (roleVariants.length === 0) {
        throw invalidMediaShard(`required role ${role} has no derivative variant.`);
      }
      const fallbackPath = entry.fallbacksByRole?.[role];
      if (!roleVariants.some((variant) => variant.path === fallbackPath)) {
        throw invalidMediaShard(`required role ${role} has no valid derivative fallback.`);
      }
    }
  }
  return shard;
}

export function createContentLoader({
  fetchJson,
  fetchBytes,
  expectedCanonicalManifestSha256,
} = {}) {
  if (typeof fetchJson !== 'function') {
    throw new TypeError('createContentLoader requires fetchJson');
  }
  if (typeof fetchBytes !== 'function') {
    throw new TypeError('createContentLoader requires fetchBytes');
  }
  const releaseSha256 = requiredSha256(
    expectedCanonicalManifestSha256,
    'expected canonical manifest SHA-256',
  );

  const cache = new Map();
  const inFlight = new Map();
  const mediaContractsByPath = new Map();
  const mediaIndexCacheKey = `verified-media-index:${releaseSha256}`;

  function createEntry(cacheKey, producer) {
    const controller = new AbortController();
    const entry = {
      controller,
      invalidated: false,
      settled: false,
      subscribers: new Set(),
      promise: null,
    };

    entry.promise = Promise.resolve()
      .then(() => producer(controller.signal))
      .then((value) => {
        if (entry.invalidated) throw abortError();
        cache.set(cacheKey, value);
        return value;
      })
      .finally(() => {
        entry.settled = true;
        if (inFlight.get(cacheKey) === entry) inFlight.delete(cacheKey);
      });

    inFlight.set(cacheKey, entry);
    return entry;
  }

  function abortIfUnobserved(cacheKey, entry) {
    queueMicrotask(() => {
      if (entry.settled || entry.subscribers.size > 0 || inFlight.get(cacheKey) !== entry) return;
      entry.invalidated = true;
      inFlight.delete(cacheKey);
      entry.controller.abort();
    });
  }

  function subscribe(cacheKey, entry, signal) {
    const subscriber = {};
    entry.subscribers.add(subscriber);

    return new Promise((resolve, reject) => {
      let subscriberSettled = false;

      const finish = (callback, value) => {
        if (subscriberSettled) return;
        subscriberSettled = true;
        signal?.removeEventListener('abort', onAbort);
        entry.subscribers.delete(subscriber);
        callback(value);
        abortIfUnobserved(cacheKey, entry);
      };

      const onAbort = () => finish(reject, abortError());
      signal?.addEventListener('abort', onAbort, { once: true });

      entry.promise.then(
        (value) => finish(resolve, value),
        (error) => finish(reject, error),
      );
    });
  }

  function loadCached(cacheKey, producer, { signal } = {}) {
    if (signal?.aborted) return Promise.reject(abortError());
    if (cache.has(cacheKey)) return Promise.resolve(cache.get(cacheKey));
    const entry = inFlight.get(cacheKey) ?? createEntry(cacheKey, producer);
    return subscribe(cacheKey, entry, signal);
  }

  function loadResource(resourcePath, { signal } = {}, validate) {
    const requestPath = `${resourcePath}?release=${releaseSha256}`;
    return loadCached(
      `runtime-json:${requestPath}`,
      async (sharedSignal) => {
        const document = await fetchJson(requestPath, {
          signal: sharedSignal,
          cache: 'no-cache',
        });
        // Validate in the shared producer so malformed JSON never becomes a
        // successful cache entry. Valid sibling resources remain reusable.
        validate(document);
        return document;
      },
      { signal },
    );
  }

  function loadMediaShardIndex({ signal } = {}) {
    const requestPath = `${MEDIA_SHARD_INDEX_PATH}?manifest=${releaseSha256}`;
    return loadCached(
      mediaIndexCacheKey,
      async (sharedSignal) => {
        const bytes = bytesView(
          await fetchBytes(requestPath, {
            signal: sharedSignal,
            cache: 'no-store',
          }),
          'fetchBytes',
        );
        const document = parseUtf8Json(
          bytes,
          'media shard index',
          invalidMediaShardIndex,
        );
        return validateMediaShardIndex(document, {
          expectedCanonicalManifestSha256: releaseSha256,
        });
      },
      { signal },
    );
  }

  async function loadMediaShard(resourcePath, routeContract, options = {}) {
    // A valid route's shard is part of the exact release closure. Failing closed
    // prevents an unavailable shard from silently requesting unpublished source
    // originals through the resolver fallback path. The no-store release index
    // pins an exact path/length/hash, and the shard is parsed only after Web
    // Crypto verifies those bytes. Route-specific source closure validation runs
    // after the runtime JSON needed to derive that closure arrives.
    const index = await loadMediaShardIndex(options);
    const record = index.shards.find((item) => item.routeId === routeContract.routeId);
    if (!record || record.path !== resourcePath) {
      cache.delete(mediaIndexCacheKey);
      throw invalidMediaShardIndex(`missing exact route record for ${routeContract.routeId}.`);
    }
    const requestPath = `${record.path}?sha256=${record.sha256}`;
    const cacheKey = `verified-media-shard:${requestPath}`;
    mediaContractsByPath.set(resourcePath, {
      cacheKey,
      canonicalManifest: index.canonicalManifest,
      policyHash: index.policyHash,
      ...routeContract,
    });
    return loadCached(
      cacheKey,
      async (sharedSignal) => {
        const bytes = bytesView(
          await fetchBytes(requestPath, {
            signal: sharedSignal,
            cache: 'no-cache',
          }),
          'fetchBytes',
        );
        if (bytes.byteLength !== record.bytes) {
          throw invalidMediaShard(
            `byte count mismatch for ${record.path}; expected ${record.bytes}, received ${bytes.byteLength}.`,
          );
        }
        const actualSha256 = await sha256Hex(bytes);
        if (actualSha256 !== record.sha256) {
          throw invalidMediaShard(`SHA-256 mismatch for ${record.path}.`);
        }
        const shard = parseUtf8Json(bytes, 'media shard', invalidMediaShard);
        return validateRouteMediaShard(shard, {
          ...routeContract,
          requirements: shard.media?.map((entry) => ({
            sourcePath: entry.sourcePath,
            roles: entry.roles,
          })) ?? [],
          canonicalManifest: index.canonicalManifest,
          policyHash: index.policyHash,
        });
      },
      options,
    );
  }

  function acceptMediaShard(resourcePath, shard, contract) {
    const indexedContract = mediaContractsByPath.get(resourcePath);
    if (!indexedContract) {
      throw invalidMediaShard('verified index contract is missing.');
    }
    try {
      return validateRouteMediaShard(shard, {
        ...contract,
        canonicalManifest: indexedContract.canonicalManifest,
        policyHash: indexedContract.policyHash,
      });
    } catch (error) {
      cache.delete(indexedContract.cacheKey);
      throw error;
    }
  }

  async function loadHome(options = {}) {
    const [index, mediaShard] = await Promise.all([
      loadResource(RUNTIME_INDEX_PATH, options, validateRuntimeIndex),
      loadMediaShard(HOME_MEDIA_SHARD_PATH, {
        routeId: 'home',
        kind: 'home',
      }, options),
    ]);
    const acceptedMediaShard = acceptMediaShard(HOME_MEDIA_SHARD_PATH, mediaShard, {
      routeId: 'home',
      kind: 'home',
      requirements: homeMediaRequirements(index),
    });
    return {
      index,
      series: Array.isArray(index?.series) ? index.series : [],
      mediaShard: acceptedMediaShard,
      mediaShardPath: HOME_MEDIA_SHARD_PATH,
    };
  }

  async function loadSeriesBase(seriesSlug, options) {
    const index = await loadResource(RUNTIME_INDEX_PATH, options, validateRuntimeIndex);
    return {
      index,
      series: requiredSeries(index, seriesSlug),
    };
  }

  async function loadCarmelaSeries(options = {}) {
    const base = await loadSeriesBase(CARMELA_SERIES_SLUG, options);
    const [catalog, mediaShard] = await Promise.all([
      loadResource(requiredPath(base.series.indexPath, 'Carmela index'), options, validateCarmelaCatalog),
      loadMediaShard(CARMELA_SERIES_MEDIA_SHARD_PATH, {
        routeId: 'carmela-series',
        kind: 'carmela-series',
      }, options),
    ]);
    const books = Array.isArray(catalog?.books) ? catalog.books : [];
    const acceptedMediaShard = acceptMediaShard(
      CARMELA_SERIES_MEDIA_SHARD_PATH,
      mediaShard,
      {
        routeId: 'carmela-series',
        kind: 'carmela-series',
        requirements: carmelaSeriesMediaRequirements(books),
      },
    );
    return {
      ...base,
      catalog,
      books,
      mediaShard: acceptedMediaShard,
      mediaShardPath: CARMELA_SERIES_MEDIA_SHARD_PATH,
    };
  }

  async function loadCarmelaBook(slug, options = {}) {
    const base = await loadSeriesBase(CARMELA_SERIES_SLUG, options);
    const catalog = await loadResource(requiredPath(base.series.indexPath, 'Carmela index'), options, validateCarmelaCatalog);
    const context = {
      ...base,
      catalog,
      books: Array.isArray(catalog?.books) ? catalog.books : [],
    };
    const summary = context.books.find((book) => book.slug === slug) ?? null;
    if (!summary) {
      return {
        ...context,
        summary: null,
        assets: null,
        companion: null,
        book: null,
        mediaShard: null,
        mediaShardPath: null,
      };
    }

    const ownerSlug = requiredSlug(summary.slug, 'Carmela book');
    const mediaShardPath = `${MEDIA_SHARD_ROOT}/carmela-book/${ownerSlug}.json`;
    const [assets, companion, mediaShard] = await Promise.all([
      loadResource(requiredPath(summary.assetPath, 'Carmela asset detail'), options, validateCarmelaAssets),
      loadResource(requiredPath(summary.companionPath, 'Carmela companion detail'), options, (companion) => validateCarmelaCompanion(summary, companion)),
      loadMediaShard(mediaShardPath, {
        routeId: `carmela-book/${ownerSlug}`,
        kind: 'carmela-book',
        ownerId: ownerSlug,
      }, options),
    ]);
    const acceptedMediaShard = acceptMediaShard(mediaShardPath, mediaShard, {
      routeId: `carmela-book/${ownerSlug}`,
      kind: 'carmela-book',
      ownerId: ownerSlug,
      requirements: carmelaBookMediaRequirements(summary, companion),
    });
    return {
      ...context,
      summary,
      assets,
      companion,
      book: {
        ...summary,
        seriesTitle: context.catalog?.seriesTitle ?? context.series.seriesTitle,
        assets,
        companion,
      },
      mediaShard: acceptedMediaShard,
      mediaShardPath,
    };
  }

  async function loadWorkCellsSeries(options = {}) {
    const base = await loadSeriesBase(WORK_CELLS_SERIES_SLUG, options);
    const [catalog, mediaShard] = await Promise.all([
      loadResource(requiredPath(base.series.indexPath, 'Work Cells index'), options, validateWorkCellsCatalog),
      loadMediaShard(WORK_CELLS_SERIES_MEDIA_SHARD_PATH, {
        routeId: 'work-cells-series',
        kind: 'work-cells-series',
      }, options),
    ]);
    const topics = Array.isArray(catalog?.topics) ? catalog.topics : [];
    const acceptedMediaShard = acceptMediaShard(
      WORK_CELLS_SERIES_MEDIA_SHARD_PATH,
      mediaShard,
      {
        routeId: 'work-cells-series',
        kind: 'work-cells-series',
        requirements: workCellsSeriesMediaRequirements(topics),
      },
    );
    return {
      ...base,
      catalog,
      categories: Array.isArray(catalog?.categories) ? catalog.categories : [],
      topics,
      mediaShard: acceptedMediaShard,
      mediaShardPath: WORK_CELLS_SERIES_MEDIA_SHARD_PATH,
    };
  }

  async function loadWorkCellsTopic(slug, options = {}) {
    const base = await loadSeriesBase(WORK_CELLS_SERIES_SLUG, options);
    const catalog = await loadResource(requiredPath(base.series.indexPath, 'Work Cells index'), options, validateWorkCellsCatalog);
    const context = {
      ...base,
      catalog,
      categories: Array.isArray(catalog?.categories) ? catalog.categories : [],
      topics: Array.isArray(catalog?.topics) ? catalog.topics : [],
    };
    const summary = context.topics.find((topic) => topic.slug === slug) ?? null;
    if (!summary) {
      return {
        ...context,
        summary: null,
        topic: null,
        mediaShard: null,
        mediaShardPath: null,
      };
    }

    const ownerSlug = requiredSlug(summary.slug, 'Work Cells topic');
    const mediaShardPath = `${MEDIA_SHARD_ROOT}/work-cells-topic/${ownerSlug}.json`;
    const [detail, mediaShard] = await Promise.all([
      loadResource(requiredPath(summary.detailPath, 'Work Cells topic detail'), options, (detail) => validateWorkCellsDetail(summary, detail)),
      loadMediaShard(mediaShardPath, {
        routeId: `work-cells-topic/${ownerSlug}`,
        kind: 'work-cells-topic',
        ownerId: ownerSlug,
      }, options),
    ]);
    const acceptedMediaShard = acceptMediaShard(mediaShardPath, mediaShard, {
      routeId: `work-cells-topic/${ownerSlug}`,
      kind: 'work-cells-topic',
      ownerId: ownerSlug,
      requirements: workCellsTopicMediaRequirements(summary, detail),
    });
    return {
      ...context,
      summary,
      topic: {
        ...summary,
        ...detail,
      },
      mediaShard: acceptedMediaShard,
      mediaShardPath,
    };
  }

  function clear() {
    cache.clear();
    mediaContractsByPath.clear();
    for (const [resourcePath, entry] of inFlight) {
      entry.invalidated = true;
      inFlight.delete(resourcePath);
      entry.controller.abort();
    }
  }

  return {
    loadHome,
    loadCarmelaSeries,
    loadCarmelaBook,
    loadWorkCellsSeries,
    loadWorkCellsTopic,
    clear,
  };
}
