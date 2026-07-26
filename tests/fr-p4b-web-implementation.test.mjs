import assert from 'node:assert/strict';
import {
  access,
  readFile,
  readdir,
  stat,
} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  createScienceTopicViewModel,
  renderScienceTopicAtlas,
} from '../assets/science-companion.js';

const root = path.resolve(import.meta.dirname, '..');
const topicDir = path.join(root, 'public', 'runtime', 'work-cells', 'topics');
const canonicalQuestionTypes = [
  'observation',
  'understanding',
  'life-connection',
  'science-concept',
];
const canonicalSections = [
  ['science-overview', '先认识这个主题'],
  ['science-station', '身体科学小站'],
  ['science-questions', '一起聊一聊'],
  ['science-parent-guidance', '家长共读'],
  ['source', '来源线索'],
];

async function loadTopics() {
  const files = (await readdir(topicDir)).filter((name) => name.endsWith('.json')).sort();
  const summaryIndex = JSON.parse(await readFile(
    path.join(root, 'public', 'runtime', 'work-cells', 'topics.json'),
    'utf8',
  ));
  const summaries = new Map(summaryIndex.topics.map((topic) => [topic.slug, topic]));
  return Promise.all(files.map(async (name) => ({
    name,
    topic: {
      ...summaries.get(name.replace(/\.json$/, '')),
      ...JSON.parse(await readFile(path.join(topicDir, name), 'utf8')),
    },
  })));
}

function occurrences(value, pattern) {
  return value.match(pattern)?.length ?? 0;
}

function markupWithoutTemplates(markup) {
  return markup.replace(/<template\b[\s\S]*?<\/template>/g, '');
}

function markupIds(markup) {
  return [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
}

function assertNoNestedInteractiveControls(markup, label) {
  const stack = [];
  const interactive = new Set(['a', 'button', 'summary']);
  const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  for (const token of markup.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
    const tag = token[1].toLowerCase();
    const closing = token[0].startsWith('</');
    if (closing) {
      const index = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (index >= 0) stack.splice(index);
      continue;
    }
    if (interactive.has(tag)) {
      const ancestor = stack.find((entry) => interactive.has(entry.tag));
      assert.equal(ancestor, undefined, `${label}: nested ${tag} inside ${ancestor?.tag}`);
    }
    if (!voidElements.has(tag) && !token[0].endsWith('/>')) stack.push({ tag });
  }
}

test('P4B view model preserves all Work Cells runtime topics and content counts', async () => {
  const topics = await loadTopics();
  assert.equal(topics.length, 27);

  let stationCount = 0;
  let questionCount = 0;
  let pageRefCount = 0;
  const categories = new Set();

  for (const { topic } of topics) {
    const model = createScienceTopicViewModel(topic);
    categories.add(model.identity.category);
    stationCount += model.stations.length;
    questionCount += model.questionGroups.reduce((sum, group) => sum + group.questions.length, 0);
    pageRefCount += Object.keys(topic.pageRefs).length;
    assert.equal(model.identity.hasAudio, false);
    assert.equal(model.stations.length, 4, topic.slug);
    assert.equal(model.questionGroups.reduce((sum, group) => sum + group.questions.length, 0), 6, topic.slug);
    assert.ok(model.overview.summary, topic.slug);
    assert.ok(model.identity.sourceLabel, topic.slug);
  }

  assert.equal(categories.size, 24);
  assert.equal(stationCount, 108);
  assert.equal(questionCount, 162);
  assert.equal(pageRefCount, 286);
});

test('P4B preserves topic identity and child-facing scientific copy without rewriting facts', async () => {
  const topics = await loadTopics();
  const bySlug = new Map(topics.map(({ topic }) => [topic.slug, topic]));
  assert.equal(bySlug.get('cancer-cell').displayTitle, '癌细胞');
  assert.equal(bySlug.get('cancer-cell-ii').displayTitle, '癌细胞Ⅱ');
  assert.notEqual(bySlug.get('cancer-cell').topicId, bySlug.get('cancer-cell-ii').topicId);
  assert.equal([...bySlug.values()].filter((topic) => topic.slug === 'hemorrhagic-shock').length, 1);

  for (const { topic } of topics) {
    const model = createScienceTopicViewModel(topic);
    assert.equal(model.identity.topicId, topic.topicId);
    assert.equal(model.identity.slug, topic.slug);
    assert.equal(model.identity.title, topic.displayTitle);
    assert.equal(model.identity.category, topic.category);
    assert.deepEqual(
      model.stations.map(({ title, coreQuestion, explanation, parentNote }) => ({
        title,
        coreQuestion,
        explanation,
        parentNote,
      })),
      topic.bodyScienceStations.map(({ title, coreQuestion, explanation, parentNote }) => ({
        title,
        coreQuestion,
        explanation,
        parentNote,
      })),
      topic.slug,
    );
    assert.deepEqual(
      model.questionGroups.flatMap((group) => group.questions)
        .sort((left, right) => left.sequence - right.sequence)
        .map(({ title, question, answer, parentHint }) => ({
          title,
          question,
          answer,
          parentHint,
        })),
      topic.parentQuestionCards.map(({ title, question, answer, parentHint }) => ({
        title,
        question,
        answer,
        parentHint,
      })),
      topic.slug,
    );
  }
});

test('P4B resolves exactly 400 existing runtime images and every media use site', async () => {
  const topics = await loadTopics();
  const summaryIndex = JSON.parse(await readFile(
    path.join(root, 'public', 'runtime', 'work-cells', 'topics.json'),
    'utf8',
  ));
  const imagePaths = new Set(summaryIndex.topics.map((topic) => topic.thumbnailPath));

  for (const { topic } of topics) {
    const model = createScienceTopicViewModel(topic);
    const expectedUseSites = topic.bodyScienceStations.length
      + topic.bodyScienceStations.reduce((sum, station) => sum + station.relatedPageIds.length, 0)
      + topic.parentQuestionCards.reduce((sum, card) => sum + card.relatedPageIds.length, 0);
    const actualUseSites = Object.values(model.mediaRegistry)
      .reduce((sum, media) => sum + media.uses.length, 0);
    assert.equal(actualUseSites, expectedUseSites, topic.slug);

    for (const station of topic.bodyScienceStations) {
      imagePaths.add(station.imageAsset);
      station.relatedPageIds.forEach((pageId) => {
        assert.ok(topic.pageRefs[pageId], `${topic.slug}:${pageId}`);
      });
    }
    for (const card of topic.parentQuestionCards) {
      card.relatedPageIds.forEach((pageId) => {
        assert.ok(topic.pageRefs[pageId], `${topic.slug}:${pageId}`);
      });
    }
    Object.values(topic.pageRefs).forEach((pageRef) => imagePaths.add(pageRef.imagePath));
  }

  assert.equal(imagePaths.size, 400);
  for (const imagePath of imagePaths) {
    await access(path.join(root, ...imagePath.split('/')));
  }
});

test('P4B media registries, ids and groups are deterministic and fully resolved', async () => {
  const topics = await loadTopics();
  for (const { topic } of topics) {
    const first = createScienceTopicViewModel(topic);
    const second = createScienceTopicViewModel(topic);
    assert.deepEqual(first.mediaRegistry, second.mediaRegistry, topic.slug);
    assert.deepEqual(first.mediaGroups, second.mediaGroups, topic.slug);

    const contentIds = [
      ...first.stations.map((station) => station.id),
      ...first.questionGroups.flatMap((group) => group.questions.map((question) => question.id)),
    ];
    assert.equal(new Set(contentIds).size, contentIds.length, topic.slug);

    for (const group of Object.values(first.mediaGroups)) {
      assert.equal(new Set(group.mediaIds).size, group.mediaIds.length, group.id);
      for (const mediaId of group.mediaIds) {
        assert.ok(first.mediaRegistry[mediaId], `${topic.slug}:${group.id}:${mediaId}`);
      }
    }

    for (const media of Object.values(first.mediaRegistry)) {
      assert.ok(media.path.startsWith('public/'), `${topic.slug}:${media.path}`);
      assert.ok(media.alt, `${topic.slug}:${media.id}`);
      assert.ok(media.uses.length > 0, `${topic.slug}:${media.id}`);
      assert.notEqual(media.kind, 'audio', topic.slug);
    }
  }
});

test('P4B question grouping uses four canonical groups in order and a safe unknown fallback', async () => {
  const topics = await loadTopics();
  for (const { topic } of topics) {
    const model = createScienceTopicViewModel(topic);
    const presentTypes = canonicalQuestionTypes.filter((type) => (
      topic.parentQuestionCards.some((card) => card.type === type)
    ));
    assert.deepEqual(model.questionGroups.map((group) => group.key), presentTypes, topic.slug);
  }

  const synthetic = structuredClone(topics[0].topic);
  synthetic.parentQuestionCards[0].type = 'future-discussion-type';
  const model = createScienceTopicViewModel(synthetic);
  assert.equal(model.questionGroups.at(-1).key, 'other');
  assert.equal(model.questionGroups.at(-1).label, '继续讨论');
  assert.equal(model.questionGroups.at(-1).questions[0].title, synthetic.parentQuestionCards[0].title);
});

test('P4B direct renderer emits one hero, five routes, all sections and exact topic card counts', async () => {
  const topics = await loadTopics();
  for (const { topic } of topics) {
    const model = createScienceTopicViewModel(topic);
    const markup = renderScienceTopicAtlas(model, { thumbnailPath: topic.thumbnailPath });
    assert.equal(occurrences(markup, /<h1\b/g), 1, topic.slug);
    assert.equal(occurrences(markup, /class="science-atlas-hero"/g), 1, topic.slug);
    assert.equal(occurrences(markup, /class="science-atlas-station"/g), 4, topic.slug);
    assert.equal(occurrences(markup, /class="science-question-card"/g), 6, topic.slug);
    for (const [sectionId, label] of canonicalSections) {
      assert.equal(occurrences(markup, new RegExp(`id="${sectionId}"`, 'g')), 1, `${topic.slug}:${sectionId}`);
      assert.match(
        markup,
        new RegExp(`<a href="#/science/work-cells/${topic.slug}/${sectionId}" data-companion-nav-link="${sectionId}">${label}</a>`),
        `${topic.slug}:${sectionId}`,
      );
    }
    assert.doesNotMatch(markup, /\bbook-layout\b|\bcontent-section\b/, topic.slug);
  }
});

test('P4B direct renderer has no duplicate ids or nested interactive controls', async () => {
  const topics = await loadTopics();
  for (const { topic } of topics) {
    const markup = renderScienceTopicAtlas(createScienceTopicViewModel(topic), {
      thumbnailPath: topic.thumbnailPath,
    });
    const ids = markupIds(markup);
    assert.equal(new Set(ids).size, ids.length, topic.slug);
    assertNoNestedInteractiveControls(markup, topic.slug);
  }
});

test('P4B closed media remains inert without a validated route resolver and stores each exact group in a template', async () => {
  const topics = await loadTopics();
  for (const { topic } of topics) {
    const model = createScienceTopicViewModel(topic);
    const markup = renderScienceTopicAtlas(model, { thumbnailPath: topic.thumbnailPath });
    const activeMarkup = markupWithoutTemplates(markup);
    assert.equal(occurrences(activeMarkup, /<img\b[^>]*\ssrc=/g), 0, topic.slug);
    assert.match(activeMarkup, /data-lightbox-image[^>]*hidden/);
    assert.equal(occurrences(activeMarkup, /data-lightbox-src=/g), 0, topic.slug);
    assert.equal(occurrences(markup, /<template data-media-template>/g), Object.keys(model.mediaGroups).length);
    assert.equal(occurrences(markup, /data-media-disclosure/g), Object.keys(model.mediaGroups).length);
    assert.equal(occurrences(markup, /\b(?:audio|source)\b[^>]*src=/gi), 0, topic.slug);
  }
});

test('P4B answers and parent hints are hidden, labelled and free of scoring semantics', async () => {
  const topics = await loadTopics();
  for (const { topic } of topics) {
    const markup = renderScienceTopicAtlas(createScienceTopicViewModel(topic), {
      thumbnailPath: topic.thumbnailPath,
    });
    assert.equal(occurrences(markup, /data-answer-toggle=/g), 6, topic.slug);
    assert.equal(occurrences(markup, /aria-expanded="false"/g), 6, topic.slug);
    assert.equal(occurrences(markup, /class="answer science-answer"[^>]*\shidden/g), 6, topic.slug);
    assert.equal(occurrences(markup, /<h5>家长提示<\/h5>/g), 6, topic.slug);
    for (const answerId of [...markup.matchAll(/data-answer-toggle="([^"]+)"/g)].map((match) => match[1])) {
      assert.match(markup, new RegExp(`aria-controls="${answerId}"`), `${topic.slug}:${answerId}`);
      assert.match(markup, new RegExp(`id="${answerId}"[^>]*role="region"`), `${topic.slug}:${answerId}`);
    }
    assert.doesNotMatch(
      markup,
      /\b(?:progress|currentChapter|lastRead|completed|streak|duration|checkIn|readingStatus|score)\b|data-(?:progress|score|checkin)|>(?:答对|答错|得分|完成状态|学习进度|打卡)</i,
    );
  }
});

test('P4B output does not expose publication, authoring, prompt or rights fields', async () => {
  const topics = await loadTopics();
  const forbidden = [
    'manifestStatus',
    'verificationStatus',
    'contentVersion',
    'imagePrompt',
    'licenseBasis',
    'copyrightMode',
    'publication',
    'authoring',
  ];
  for (const { topic } of topics) {
    const markup = renderScienceTopicAtlas(createScienceTopicViewModel(topic), {
      thumbnailPath: topic.thumbnailPath,
    });
    for (const field of forbidden) {
      assert.doesNotMatch(markup, new RegExp(field, 'i'), `${topic.slug}:${field}`);
    }
  }
});

test('P4B app directly imports and renders the science module with the five-section route allowlist', async () => {
  const appSource = await readFile(path.join(root, 'assets', 'app.js'), 'utf8');
  const moduleSource = await readFile(path.join(root, 'assets', 'science-companion.js'), 'utf8');
  assert.match(appSource, /from '\.\/science-companion\.js\?v=fr-p5-20260724';/);
  assert.match(appSource, /const viewModel = createScienceTopicViewModel\(topic\);/);
  assert.match(appSource, /return renderScienceTopicAtlas\(viewModel,\s*\{\s*thumbnailPath: topic\.thumbnailPath,/);
  for (const [sectionId, label] of canonicalSections) {
    assert.match(appSource, new RegExp(`\\['${sectionId}', '${label}'\\]`));
  }
  assert.doesNotMatch(moduleSource, /installScienceCompanionEnhancer|__frScience|globalThis\.fetch|Object\.defineProperty\(app,\s*'innerHTML'/);
  assert.doesNotMatch(moduleSource, /data-science-jump/);
});

test('P4B browser entry loads only app.js while retaining the science stylesheet', async () => {
  const index = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.equal(occurrences(index, /<script type="module"/g), 1);
  assert.match(index, /<script type="module" src="assets\/app\.js\?v=fr-p5-20260724/);
  assert.doesNotMatch(index, /<script[^>]+src="assets\/science-companion\.js/);
  assert.match(index, /assets\/science-companion\.css/);
});

test('P4B shared media and answer lifecycles remain the only active wiring path', async () => {
  const appSource = await readFile(path.join(root, 'assets', 'app.js'), 'utf8');
  const a11ySource = await readFile(path.join(root, 'assets', 'a11y.js'), 'utf8');
  assert.equal(occurrences(appSource, /function wireEvidenceDisclosures\(/g), 1);
  assert.equal(occurrences(appSource, /function wireAnswers\(/g), 1);
  assert.equal(occurrences(appSource, /function wireLightbox\(/g), 1);
  assert.match(appSource, /wireImageLightbox\(lightbox, document\)/);
  assert.match(appSource, /template\.content\.cloneNode\(true\)/);
  assert.match(appSource, /matchMedia\('print'\)\.matches/);
  assert.match(appSource, /replaceChildren\(\)/);
  assert.match(a11ySource, /data-lightbox-group/);
  assert.match(a11ySource, /event\.key === 'Escape'/);
  assert.match(a11ySource, /event\.key === 'ArrowLeft'/);
  assert.match(a11ySource, /event\.key === 'ArrowRight'/);
});

test('P4B styles cover responsive, short-landscape, forced-color, reduced-motion and print gates', async () => {
  const css = await readFile(path.join(root, 'assets', 'science-companion.css'), 'utf8');
  const sharedCss = await readFile(path.join(root, 'assets', 'styles.css'), 'utf8');
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(min-width: 68\.0625rem\) and \(max-height: 480px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /@media print/);
  assert.match(css, /\.science-answer\[hidden\]\s*\{\s*display: block !important;/);
  assert.match(css, /\.science-media-disclosure[^}]*display: none !important;/s);
  assert.match(css, /\.science-question-list\s*\{\s*display: block;/);
  assert.match(css, /\.science-question-card \+ \.science-question-card\s*\{\s*margin-top:/);
  assert.match(css, /\.science-question-card\s*\{[^}]*break-inside: avoid-page;[^}]*page-break-inside: avoid;/s);
  assert.match(sharedCss, /@media print[\s\S]*\*:focus-visible\s*\{\s*outline: 0 !important;/);

  const assetFiles = await readdir(path.join(root, 'assets'));
  const jsBytes = (await Promise.all(
    assetFiles.filter((file) => file.endsWith('.js'))
      .map(async (file) => (await stat(path.join(root, 'assets', file))).size),
  )).reduce((sum, bytes) => sum + bytes, 0);
  const cssBytes = (await Promise.all(
    assetFiles.filter((file) => file.endsWith('.css'))
      .map(async (file) => (await stat(path.join(root, 'assets', file))).size),
  )).reduce((sum, bytes) => sum + bytes, 0);
  assert.ok(jsBytes <= 155 * 1024, `JS hard budget exceeded: ${jsBytes}`);
  assert.ok(cssBytes <= 80 * 1024, `CSS hard budget exceeded: ${cssBytes}`);
});

test('P4B is part of the canonical full test suite', async () => {
  const runner = await readFile(path.join(root, 'scripts', 'run-tests.mjs'), 'utf8');
  assert.match(runner, /'tests\/fr-p4b-web-implementation\.test\.mjs'/);
  assert.match(runner, /'tests\/fr-p4b-r1-responsive-layout\.test\.mjs'/);
});
