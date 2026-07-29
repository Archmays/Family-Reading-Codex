import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import { createCarmelaCompanionViewModel } from '../assets/carmela-companion.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = (relativePath) => readFileSync(path.join(rootDir, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readText(relativePath));
const appJs = readText(path.join('assets', 'app.js'));
const viewModelJs = readText(path.join('assets', 'carmela-companion.js'));
const styles = readText(path.join('assets', 'styles.css'));
const indexHtml = readText('index.html');
const packageJson = readJson('package.json');
const beforeInventory = readJson(
  path.join('reports', 'portfolio', 'fr-p3a', 'fr-p3a-carmela-content-inventory-before.json'),
);
const afterInventory = readJson(
  path.join('reports', 'portfolio', 'fr-p3a', 'fr-p3a-carmela-content-inventory-after.json'),
);
const series = readJson(path.join('public', 'books', '不一样的卡梅拉', 'series.json'));

const questionSources = [
  ['factual', '事实回忆', 'factualRecall'],
  ['comprehension', '理解故事', 'comprehension'],
  ['open', '开放表达', 'openExpression'],
];

function bookRecords() {
  return series.books.slice(0, 12).map((book) => {
    const assets = readJson(path.join(...book.folder.split('/'), book.assetFile));
    const companion = readJson(path.join(...book.folder.split('/'), book.companionFile));
    const rawBook = {
      ...book,
      seriesTitle: series.seriesTitle,
      assets,
      companion,
      cover: `${book.folder}/${assets.pageImages[0]}`,
      previewPages: assets.pageImages.slice(0, 4).map((page) => `${book.folder}/${page}`),
    };
    return { rawBook, assets, companion, view: createCarmelaCompanionViewModel(rawBook) };
  });
}

function mediaPathsForGroup(view, groupId) {
  const group = view.mediaGroups[groupId];
  return (group?.mediaIds ?? []).map((mediaId) => view.mediaRegistry[mediaId]?.path).filter(Boolean);
}

function pageImageRefs(view) {
  return [
    ...view.scenes.flatMap((scene) => mediaPathsForGroup(view, scene.mediaGroupId)),
    ...view.questionGroups.flatMap((group) => group.questions.flatMap((question) => (
      mediaPathsForGroup(view, question.mediaGroupId)
    ))),
    ...view.background.flatMap((entry) => mediaPathsForGroup(view, entry.pageMediaGroupId)),
    ...view.encyclopedia.flatMap((entry) => mediaPathsForGroup(view, entry.pageMediaGroupId)),
  ];
}

function explanationImageRefs(view) {
  return [
    ...view.background.flatMap((entry) => mediaPathsForGroup(view, entry.explanationMediaGroupId)),
    ...view.encyclopedia.flatMap((entry) => mediaPathsForGroup(view, entry.explanationMediaGroupId)),
  ];
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      keys.push(key);
      collectKeys(item, keys);
    }
  }
  return keys;
}

test('P3A adapter preserves all twelve Carmela content skeletons exactly', () => {
  const records = bookRecords();
  assert.equal(records.length, 12);
  assert.equal(beforeInventory.bookCount, 12);

  for (const { rawBook, companion, view } of records) {
    assert.deepEqual(view.identity, {
      order: rawBook.order,
      title: rawBook.title,
      slug: rawBook.slug,
      seriesTitle: series.seriesTitle,
      cover: rawBook.cover,
      mediaBase: rawBook.folder,
    });
    assert.equal(view.summary, companion.overview.oneLine);
    assert.deepEqual(view.facts, {
      characters: companion.overview.mainCharacters,
      places: companion.overview.importantPlaces,
      relationships: companion.overview.characterRelationships,
      conflict: companion.overview.keyConflict,
      emotionalArc: companion.overview.emotionalArc,
    });
    assert.deepEqual(view.storyReview, {
      introduction: companion.storyReview.shortReview,
      beats: companion.storyReview.mainPlot,
    });
    assert.deepEqual(view.scenes.map((scene) => ({
      sequence: scene.sequence,
      id: scene.id,
      title: scene.title,
      pageRange: scene.pageRange,
      summary: scene.summary,
      discussionFocus: scene.discussionFocus,
      pageImages: mediaPathsForGroup(view, scene.mediaGroupId),
    })), companion.scenes.map((scene, index) => ({
      sequence: index + 1,
      id: scene.id,
      title: scene.title,
      pageRange: scene.pageRange,
      summary: scene.summary,
      discussionFocus: scene.discussionFocus,
      pageImages: scene.imageRefs,
    })));

    for (const [index, [key, label, sourceKey]] of questionSources.entries()) {
      const group = view.questionGroups[index];
      assert.equal(group.key, key);
      assert.equal(group.label, label);
      assert.equal(group.questions.length, companion.questionCards[sourceKey].length);
      assert.deepEqual(
        group.questions.map((question) => ({
          prompt: question.prompt,
          pageRange: question.pageRange,
          talkingPoints: question.talkingPoints,
          evidenceImages: mediaPathsForGroup(view, question.mediaGroupId),
        })),
        companion.questionCards[sourceKey].map((question) => ({
          prompt: question.prompt,
          pageRange: question.pageRange,
          talkingPoints: question.talkingPoints,
          evidenceImages: question.evidenceImageRefs,
        })),
      );
    }

    assert.deepEqual(view.background.map((entry) => ({
      sequence: entry.sequence,
      title: entry.title,
      pageRange: entry.pageRange,
      note: entry.note,
      pageImages: mediaPathsForGroup(view, entry.pageMediaGroupId),
      explanationImages: mediaPathsForGroup(view, entry.explanationMediaGroupId),
    })), companion.backgroundNotes.map((entry, index) => ({
      sequence: index + 1,
      title: entry.title,
      pageRange: entry.pageRange,
      note: entry.note,
      pageImages: entry.imageRefs,
      explanationImages: entry.generatedImageRefs,
    })));
    assert.deepEqual(view.encyclopedia.map((entry) => ({
      sequence: entry.sequence,
      title: entry.title,
      pageRange: entry.pageRange,
      summary: entry.summary,
      facts: entry.facts,
      pageImages: mediaPathsForGroup(view, entry.pageMediaGroupId),
      explanationImages: mediaPathsForGroup(view, entry.explanationMediaGroupId),
    })), companion.encyclopediaEntries.map((entry, index) => ({
      sequence: index + 1,
      title: entry.title,
      pageRange: entry.pageRange,
      summary: entry.summary,
      facts: [
        { label: '故事中出现在哪里', value: entry.storyAppearance ?? entry.anchor },
        { label: '它是什么', value: entry.whatItIs },
        { label: '为什么和故事有关', value: entry.whyItMatters },
        { label: '一起讨论', value: entry.discussionQuestion },
      ],
      pageImages: entry.imageRefs,
      explanationImages: entry.generatedImageRefs,
    })));
    assert.deepEqual(view.audio, {
      title: companion.audio.title || rawBook.title,
      path: companion.audio.path || rawBook.audio?.path,
      markers: companion.audio.markers.map((marker) => ({
        time: Number(marker.time),
        label: marker.label,
      })),
    });
    assert.deepEqual(view.parentGuide, companion.parentGuide);
  }
});

test('P3A before inventory and rendered view-model totals remain in parity', () => {
  const records = bookRecords();
  const totals = {
    pages: 0,
    storyBeats: 0,
    characterRelationships: 0,
    scenes: 0,
    questions: 0,
    backgroundEntries: 0,
    encyclopediaEntries: 0,
    pageImageRefOccurrences: 0,
    bookLocalUniquePageImageRefs: 0,
    generatedImageRefOccurrences: 0,
    duplicateMediaRefs: 0,
    availableAudio: 0,
  };

  for (const { assets, view } of records) {
    const expected = beforeInventory.books.find((book) => book.order === view.identity.order);
    const pageRefs = pageImageRefs(view);
    const generatedRefs = explanationImageRefs(view);
    const allMediaRefs = [...pageRefs, ...generatedRefs];
    const questionCounts = Object.fromEntries(
      view.questionGroups.map((group, index) => [questionSources[index][2], group.questions.length]),
    );

    assert.ok(expected, `inventory entry ${view.identity.order} should exist`);
    assert.equal(assets.pageImages.length, expected.pageCount);
    assert.equal(view.storyReview.beats.length, expected.storyBeatCount);
    assert.equal(view.scenes.length, expected.sceneCount);
    assert.deepEqual(questionCounts, expected.questionCounts);
    assert.equal(view.background.length, expected.backgroundCount);
    assert.equal(view.encyclopedia.length, expected.encyclopediaCount);
    assert.equal(view.facts.characters.length, expected.characterCount);
    assert.equal(view.facts.relationships.length, expected.relationshipCount);
    assert.equal(view.facts.places.length, expected.placeCount);
    assert.equal(view.facts.emotionalArc.length, expected.emotionalArcCount);
    assert.equal(new Set(pageRefs).size, expected.uniquePageImageRefs);
    assert.equal(allMediaRefs.length - new Set(allMediaRefs).size, expected.duplicateMediaRefs);
    assert.equal(Boolean(view.audio.path), expected.audio.status === 'available');

    totals.pages += assets.pageImages.length;
    totals.storyBeats += view.storyReview.beats.length;
    totals.characterRelationships += view.facts.relationships.length;
    totals.scenes += view.scenes.length;
    totals.questions += Object.values(questionCounts).reduce((sum, count) => sum + count, 0);
    totals.backgroundEntries += view.background.length;
    totals.encyclopediaEntries += view.encyclopedia.length;
    totals.pageImageRefOccurrences += pageRefs.length;
    totals.bookLocalUniquePageImageRefs += new Set(pageRefs).size;
    totals.generatedImageRefOccurrences += generatedRefs.length;
    totals.duplicateMediaRefs += allMediaRefs.length - new Set(allMediaRefs).size;
    totals.availableAudio += Number(Boolean(view.audio.path));
  }

  for (const [key, value] of Object.entries(totals)) {
    assert.equal(value, beforeInventory.totals[key], `${key} should match the before inventory`);
  }
});

test('P3A before and after inventories preserve normalized content parity', () => {
  const contentFields = [
    'order',
    'title',
    'slug',
    'pageCount',
    'storyBeatCount',
    'sceneCount',
    'questionCounts',
    'backgroundCount',
    'encyclopediaCount',
    'characterCount',
    'relationshipCount',
    'placeCount',
    'emotionalArcCount',
    'parentGuideFields',
    'audio',
    'uniquePageImageRefs',
    'duplicateMediaRefs',
    'missingRefs',
    'emptyRequiredFields',
    'rawMetadataExposure',
    'companionSchemaVersion',
  ];
  const contentSnapshot = (book) => Object.fromEntries(
    contentFields.map((field) => [field, book[field]]),
  );

  assert.equal(afterInventory.snapshot, 'after');
  assert.equal(afterInventory.contentParity, 'PASS');
  assert.equal(afterInventory.sourceFilesModified, false);
  assert.equal(afterInventory.bookCount, beforeInventory.bookCount);
  assert.deepEqual(afterInventory.totals, beforeInventory.totals);
  assert.deepEqual(afterInventory.renderedSectionIds, [
    'overview',
    'review',
    'scenes',
    'questions',
    'background',
    'encyclopedia',
    'audio',
    'parents',
  ]);
  assert.deepEqual(
    afterInventory.books.map(contentSnapshot),
    beforeInventory.books.map(contentSnapshot),
  );
  for (const book of afterInventory.books) {
    assert.deepEqual(book.uiMetadataExposure, {
      sourcePathFields: 0,
      ocrPathRefs: 0,
      promptRefs: 0,
      localAbsoluteRefs: 0,
    });
  }
});

test('P3A adapter is an explicit allowlist with no authoring or source metadata', () => {
  const forbiddenKeys = new Set([
    'schemaVersion',
    'contentType',
    'assetFile',
    'companionFile',
    'assets',
    'previewPages',
    'sourceEvidence',
    'sourcePath',
    'sourcePdf',
    'ocrUse',
    'manualReview',
    'pageRefs',
    'evidencePageRefs',
    'imagePromptRefs',
    'generatedImagePromptId',
    'needsGeneratedImage',
    'status',
  ]);
  const allowedRootKeys = [
    'identity',
    'summary',
    'facts',
    'storyReview',
    'scenes',
    'questionGroups',
    'background',
    'encyclopedia',
    'mediaRegistry',
    'mediaGroups',
    'audio',
    'parentGuide',
  ];

  for (const { rawBook, assets, companion, view } of bookRecords()) {
    assert.deepEqual(Object.keys(view), allowedRootKeys);
    const registryEntries = Object.values(view.mediaRegistry);
    assert.equal(
      new Set(registryEntries.map((entry) => entry.path)).size,
      registryEntries.length,
      `${rawBook.title} should register each media path once`,
    );
    for (const [groupId, group] of Object.entries(view.mediaGroups)) {
      assert.equal(group.id, groupId);
      assert.equal(new Set(group.mediaIds).size, group.mediaIds.length, `${groupId} should deduplicate media ids`);
      for (const mediaId of group.mediaIds) {
        assert.ok(view.mediaRegistry[mediaId], `${groupId} should resolve ${mediaId}`);
      }
    }
    const viewKeys = collectKeys(view);
    for (const key of forbiddenKeys) {
      assert.equal(viewKeys.includes(key), false, `${rawBook.title} should exclude ${key}`);
    }

    const serialized = JSON.stringify(view);
    for (const privateValue of [assets.sourcePdf, companion.audio?.sourcePath]) {
      if (typeof privateValue === 'string' && privateValue.length > 0) {
        assert.equal(serialized.includes(privateValue), false, `${rawBook.title} should exclude ${privateValue}`);
      }
    }
    assert.equal(/[A-Za-z]:\\|\/Users\/|\\Users\\/.test(serialized), false);
  }
});

test('P3A question and answer ids are stable, unique, and fully associated', () => {
  const ids = [];
  for (const { view } of bookRecords()) {
    for (const group of view.questionGroups) {
      for (const question of group.questions) {
        ids.push(question.id, question.answerId, question.toggleId);
        assert.match(question.id, new RegExp(view.identity.slug));
        assert.equal(question.openEnded, group.key === 'open');
      }
    }
  }
  assert.equal(ids.length, 12 * 9 * 3);
  assert.equal(new Set(ids).size, ids.length);
});

test('P3A Carmela renderer exposes the requested long-page and accessible interactions', () => {
  const detailStart = appJs.indexOf('function companionSectionHeading');
  const detailEnd = appJs.indexOf('function scienceTopicPage');
  const detail = appJs.slice(detailStart, detailEnd);
  assert.ok(detailStart >= 0 && detailEnd > detailStart);
  assert.match(appJs, /import \{ createCarmelaCompanionViewModel \} from/);
  assert.match(detail, /const companionBook = createCarmelaCompanionViewModel\(book\)/);
  assert.equal((detail.match(/class="carmela-hero"/g) ?? []).length, 1);
  assert.equal((detail.match(/<h1\b/g) ?? []).length, 1);
  assert.match(detail, /class="carmela-hero"[\s\S]*class="companion-body"/);
  assert.match(detail, /<details data-companion-nav open>/);
  assert.match(detail, /aria-label="这本书的伴读路线"/);
  assert.match(appJs, /aria-current', 'location'/);

  for (const [id, label] of [
    ['overview', '快速了解'],
    ['review', '故事回顾'],
    ['scenes', '故事路线'],
    ['questions', '一起聊一聊'],
    ['background', '背景发现'],
    ['encyclopedia', '剧情百科'],
    ['audio', '听一听'],
    ['parents', '家长共读'],
  ]) {
    assert.match(detail, new RegExp(`id="${id}"`));
    assert.match(appJs, new RegExp(label));
  }

  assert.match(detail, /<ol class="story-trail">/);
  assert.match(detail, />从故事总览开始<\/a>/);
  assert.match(detail, />听音频<\/a>/);
  assert.match(detail, /data-label-collapsed="\$\{collapsedLabel\}"/);
  assert.match(detail, /data-label-expanded="\$\{expandedLabel\}"/);
  assert.match(detail, /aria-controls="\$\{question\.answerId\}"/);
  assert.match(detail, /role="region"[\s\S]*aria-labelledby="\$\{question\.toggleId\}"/);
  assert.match(detail, /没有唯一答案/);
  assert.match(appJs, /<details class="evidence-disclosure" data-media-disclosure data-media-group-id=/);
  assert.match(appJs, /<div class="media-group-mount" data-media-mount[^>]*><\/div>[\s\S]*<template data-media-template>/);
  assert.match(appJs, /template\.content\.cloneNode\(true\)/);
  assert.match(appJs, /disclosure\.addEventListener\('toggle'/);
  assert.match(
    appJs,
    /mediaResolver\.picture\(media\.absolutePath,[\s\S]*?role:\s*previewRole,[\s\S]*?loading:\s*'lazy'/,
  );
  assert.match(
    appJs,
    /mediaResolver\.picture\(media\.absolutePath,[\s\S]*?alt:\s*contextAlt,[\s\S]*?decoding:\s*'async'/,
  );
  assert.doesNotMatch(appJs, /\bpreviewSrc\b|src="\$\{html\(media\.absolutePath\)\}"/);
  assert.match(detail, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(detail, /aria-label="调整音频播放位置"/);
  assert.match(detail, /preload="none"[\s\S]*data-audio-src="\$\{html\(source\)\}"/);
  const idleAudioTag = detail.match(/<audio[\s\S]*?>/)?.[0] ?? '';
  assert.ok(idleAudioTag, 'audio element should exist');
  assert.equal(/\ssrc=/.test(idleAudioTag), false, 'idle audio element must not have src');
  assert.match(appJs, /audio\.src = sourcePath/);
  assert.match(appJs, /audio\.addEventListener\('error', handleAudioError/);
  assert.equal(detail.includes('<main'), false);

  for (const forbiddenCopy of [
    'Factual recall',
    'Comprehension',
    'Open expression',
    '折叠式页面图片核对区',
    '待补充解释图',
    '参考答案默认隐藏',
    '音频 marker',
    '不显示 marker',
  ]) {
    assert.equal(`${appJs}\n${viewModelJs}`.includes(forbiddenCopy), false, `${forbiddenCopy} should not remain`);
  }

  for (const rawField of [
    'sourceEvidence',
    'manualReview',
    'sourcePath',
    'sourcePdf',
    'generatedImagePromptId',
    'imagePromptRefs',
    'needsGeneratedImage',
    'previewPages',
  ]) {
    assert.equal(detail.includes(rawField), false, `detail renderer should not read ${rawField}`);
  }
});

test('P3A styles cover responsive, forced-color, print, and code budget gates', () => {
  for (const selector of [
    '.companion-view--carmela',
    '.carmela-hero',
    '.companion-route-rail',
    '.companion-section',
    '.story-trail::before',
    '.question-card',
    '.evidence-disclosure',
  ]) {
    assert.match(styles, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.carmela-hero/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.carmela-hero\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  const shortLandscapeStart = styles.indexOf('@media (max-height: 500px) and (orientation: landscape)');
  const shortLandscapeEnd = styles.indexOf('@media (prefers-reduced-motion: reduce)', shortLandscapeStart);
  const shortLandscape = styles.slice(shortLandscapeStart, shortLandscapeEnd);
  assert.ok(shortLandscapeStart >= 0 && shortLandscapeEnd > shortLandscapeStart);
  assert.match(shortLandscape, /\.companion-route-rail\s*\{[\s\S]*?position:\s*static;[\s\S]*?max-height:\s*none;[\s\S]*?overflow:\s*visible/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*?\.carmela-hero/);
  assert.match(styles, /@media print[\s\S]*?\.companion-route-rail[\s\S]*?\.answer\[hidden\]/);
  assert.match(styles, /--touch-target:\s*44px/);

  const assetScripts = readdirSync(path.join(rootDir, 'assets')).filter((name) => name.endsWith('.js'));
  const jsBytes = assetScripts.reduce(
    (sum, name) => sum + statSync(path.join(rootDir, 'assets', name)).size,
    0,
  );
  const cssBytes = statSync(path.join(rootDir, 'assets', 'styles.css')).size;
  assert.ok(jsBytes <= 155 * 1024, `all JS is ${jsBytes} bytes`);
  assert.ok(cssBytes <= 70 * 1024, `CSS is ${cssBytes} bytes`);
  assert.ok(
    assetScripts.length <= 6,
    `FR-P5 should contain at most 6 JavaScript files, found ${assetScripts.length}`,
  );
  assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0);
  assert.equal(/@import|https?:\/\/.+\.(?:js|css|woff2?)/i.test(`${indexHtml}\n${styles}`), false);
  assert.match(indexHtml, /assets\/styles\.css\?v=fr-maint-single-tier-20260729/);
  assert.match(indexHtml, /assets\/app\.js\?v=fr-maint-single-tier-20260729/);
});

test('P3A keeps the startup JSON closure at the P2 baseline', () => {
  const contentIndex = readJson(path.join('public', 'books', 'index.json'));
  const carmelaEntry = contentIndex.series.find((entry) => entry.seriesSlug === 'carmela-season-1');
  const workCellsEntry = contentIndex.series.find((entry) => entry.seriesSlug === 'work-cells');
  const carmelaSeries = readJson(carmelaEntry.manifestPath);
  const workCellsManifest = readJson(workCellsEntry.manifestPath);
  const startupPaths = new Set([
    'public/books/index.json',
    carmelaEntry.manifestPath,
    workCellsEntry.manifestPath,
    workCellsManifest.pageMapPath,
  ]);
  for (const book of carmelaSeries.books.slice(0, 12)) {
    startupPaths.add(`${book.folder}/${book.assetFile}`);
    startupPaths.add(`${book.folder}/${book.companionFile}`);
  }

  const startupBytes = [...startupPaths].reduce(
    (sum, relativePath) => sum + statSync(path.join(rootDir, ...relativePath.split('/'))).size,
    0,
  );
  assert.equal(startupPaths.size, 28);
  assert.ok(startupBytes <= Math.ceil(2_810_496 * 1.01), `startup JSON is ${startupBytes} bytes`);
});

test('P3A child-facing code keeps the project product boundaries', () => {
  const childFacingCode = `${indexHtml}\n${appJs}\n${viewModelJs}`;
  for (const blocked of [
    'progress',
    'currentChapter',
    'lastRead',
    'completed',
    'streak',
    'duration',
    'checkIn',
    'readingStatus',
  ]) {
    assert.equal(childFacingCode.includes(blocked), false, `${blocked} must stay out of child-facing code`);
  }
  for (const persistedStore of ['localStorage', 'sessionStorage', 'indexedDB']) {
    assert.equal(childFacingCode.includes(persistedStore), false, `${persistedStore} must not be used`);
  }
});
