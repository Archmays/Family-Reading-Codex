import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import './work-cells-epub-import.test.mjs';
import './work-cells-visual-annotations.test.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seriesPath = path.join(rootDir, 'public', 'books', '不一样的卡梅拉', 'series.json');
const bookIndexPath = path.join(rootDir, 'public', 'books', 'index.json');
const contentTypesPath = path.join(rootDir, 'public', 'books', 'content-types.json');
const workCellsDraftPath = path.join(rootDir, 'public', 'books', '工作细胞', 'draft-manifest.json');
const workCellsPageMapPath = path.join(rootDir, 'data', 'cells-at-work', 'page-map.json');
const workCellsTerminologyPath = path.join(rootDir, 'docs', 'work-cells-terminology-review.md');
const workCellsImportReportPath = path.join(rootDir, 'docs', 'work-cells-import-report.md');
const workCellsV2ContentStandardPath = path.join(rootDir, 'docs', 'work-cells-v2-content-standard.md');
const workCellsV2ImageWorkflowPath = path.join(rootDir, 'docs', 'work-cells-v2-image-workflow.md');
const workCellsAnimationProcessingPlanPath = path.join(rootDir, 'docs', 'work-cells-animation-processing-plan.md');
const workCellsAnimationPilotReportPath = path.join(rootDir, 'docs', 'work-cells-animation-scene-notes-pilot-report.md');
const requiredTitles = [
  '我想去看海',
  '我想有颗星星',
  '我想有个弟弟',
  '我去找回太阳',
  '我爱小黑猫',
  '我能打败怪兽',
  '我要找到朗朗',
  '我不要被吃掉',
  '我好喜欢她',
  '我要救出贝里奥',
  '我不是胆小鬼',
  '我爱平底锅',
];
const publishedTitles = requiredTitles.slice(0, 12);
const expectedAudio = new Map([
  ['我想去看海', {
    source: 'source/不一样的卡梅拉/01-我想去看海.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-01.mp3',
  }],
  ['我想有颗星星', {
    source: 'source/不一样的卡梅拉/02-我想有颗星星.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-02.mp3',
  }],
  ['我想有个弟弟', {
    source: 'source/不一样的卡梅拉/03-我想有个弟弟.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-03.mp3',
  }],
  ['我去找回太阳', {
    source: 'source/不一样的卡梅拉/04-我去找回太阳.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-04.mp3',
  }],
  ['我爱小黑猫', {
    source: 'source/不一样的卡梅拉/05-我爱小黑猫.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-05.mp3',
  }],
  ['我能打败怪兽', {
    source: 'source/不一样的卡梅拉/06-我能打败怪兽.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-06.mp3',
  }],
  ['我要找到朗朗', {
    source: 'source/不一样的卡梅拉/07-我要找到朗朗.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-07.mp3',
  }],
  ['我不要被吃掉', {
    source: 'source/不一样的卡梅拉/08-我不要被吃掉.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-08.mp3',
  }],
  ['我好喜欢她', {
    source: 'source/不一样的卡梅拉/09-我好喜欢她.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-09.mp3',
  }],
  ['我要救出贝里奥', {
    source: 'source/不一样的卡梅拉/10-我要救出贝里奥.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-10.mp3',
  }],
  ['我不是胆小鬼', {
    source: 'source/不一样的卡梅拉/11-我不是胆小鬼.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-11.mp3',
  }],
  ['我爱平底锅', {
    source: 'source/不一样的卡梅拉/12-我爱平底锅.mp3',
    publicPath: 'public/audio/carmela-s1/carmela-s1-12.mp3',
  }],
]);
const requiredUiText = [
  '温暖伴读图册',
  'Warm Companion Atlas',
  '纸质书旁边的伴读工具',
  '选择阅读主题',
  '走进绘本书架',
  '走进科学主题馆',
  '不一样的卡梅拉',
  '打开伴读资料',
  '含音频',
  '问题卡',
  '听音频',
  '快速了解',
  '故事回顾',
  '故事路线',
  '一起聊一聊',
  '背景发现',
  '剧情百科',
  '听一听',
  'data-audio-play',
  'data-audio-seek',
  'data-audio-current-time',
  'data-audio-total-time',
  'preload="none"',
  'data-audio-src',
  'audio.src = sourcePath',
  '暂时没有可播放的音频',
  '音频路径暂时不可用',
  '家长共读',
  'CarmelaMediaThumbnail',
  'ImageLightbox',
  'EvidenceDisclosure',
  '解释图',
  '查看相关绘本页面',
  '查看参考答案',
  '查看讨论提示',
  '没有唯一答案',
  '故事中出现在哪里',
  '它是什么',
  '为什么和故事有关',
  '一起讨论',
];
const blockedTerms = [
  'progress',
  'currentChapter',
  'lastRead',
  'completed',
  'streak',
  'duration',
  'checkIn',
  'readingStatus',
  'readingProgress',
  'continueReading',
];
const removedHomeText = [
  'Book Companion Panel / 家庭纸质书阅读辅助面板',
  '为家里的纸质绘本阅读准备的辅助面板。孩子读实体书，家长在旁边查看内容回顾、问题卡、背景补充、百科条目和音频入口。',
  '不一样的卡梅拉 第一季',
  '首页只做书籍资料入口。选择一本书后，进入对应的 companion 页面，再按需要打开问答、背景、百科或音频。',
];
const childAddressBlockedPhrases = [
  '可以告诉孩子',
  '家长可以说',
  '你可以这样讲给孩子听',
  '适合告诉孩子的是',
  'parent can tell',
  'parent can tell the child',
  'tell your child',
  'explain to the child',
];
const requiredWorkCellsTopics = [
  ['肺炎链球菌', '第1卷 第1话'],
  ['杉树花粉过敏', '第1卷 第2话'],
  ['流行性感冒', '第1卷 第3话'],
  ['擦伤', '第1卷 第4话'],
  ['食物中毒', '第2卷 第5话'],
  ['中暑', '第2卷 第6话'],
  ['红血球母细胞与骨髓细胞', '第2卷 第7话'],
  ['癌细胞', '第2卷 第8-9话'],
  ['血液循环', '第3卷 第10话'],
  ['感冒症候群', '第3卷 第11话'],
  ['胸腺细胞', '第3卷 第12话'],
  ['获得性免疫', '第3卷 第13话'],
  ['痤疮', '第3卷 第14话'],
  ['金黄色葡萄球菌', '第4卷 第15话'],
  ['登革热', '第4卷 第16话'],
  ['出血性休克', '第4卷 第17-18话'],
  ['派尔斑', '第4卷 第19话'],
  ['幽门螺杆菌', '第5卷 第20话'],
  ['抗原变异', '第5卷 第21话'],
  ['细胞因子', '第5卷 第22话'],
  ['肠道菌群', '第5卷 第23话'],
  ['癌细胞Ⅱ', '第5卷 第24-25话'],
  ['撞出肿包', '第6卷 第26话'],
  ['白细胞左移', '第6卷 第27话'],
  ['iPS细胞', '第6卷 第28话'],
  ['银屑病', '第6卷 特别篇'],
  ['新型冠状病毒', '第6卷 第29话'],
];
const requiredParentGuidanceTopicIds = [
  'influenza',
  'abrasion',
  'cancer-cell',
  'cancer-cell-ii',
  'hemorrhagic-shock',
  'dengue-fever',
  'covid-19',
  'heatstroke',
  'staphylococcus-aureus',
  'bump-on-head',
  'psoriasis',
];
const requiredBodyScienceStationFields = [
  'stationId',
  'topicId',
  'title',
  'coreQuestion',
  'explanation',
  'imagePromptId',
  'imagePrompt',
  'imageAsset',
  'imageAlt',
  'relatedPageIds',
  'biologyConcepts',
  'encyclopediaTags',
  'parentNote',
  'status',
  'priority',
];
const requiredParentQuestionFields = [
  'cardId',
  'topicId',
  'type',
  'title',
  'question',
  'answer',
  'relatedPageIds',
  'parentHint',
  'biologyConcepts',
];
const workCellsV2TopicIds = [
  'cedar-pollen-allergy',
  'influenza',
  'pneumococcus',
  'abrasion',
  'food-poisoning',
  'heatstroke',
  'common-cold-syndrome',
  'blood-circulation',
  'staphylococcus-aureus',
  'hemorrhagic-shock',
  'gut-microbiota',
  'bump-on-head',
  'erythroblast-and-bone-marrow-cell',
  'cancer-cell',
  'thymocyte',
  'acquired-immunity',
  'dengue-fever',
  'acne',
  'peyers-patches',
  'helicobacter-pylori',
  'antigenic-variation',
  'cytokines',
  'cancer-cell-ii',
  'left-shift',
  'ips-cells',
  'psoriasis',
  'covid-19',
];
const workCellsNoReliableAnimationTopicIds = new Set([
  'left-shift',
  'ips-cells',
  'psoriasis',
  'covid-19',
]);
const workCellsV2QuestionCounts = new Map([
  ['cedar-pollen-allergy', 6],
  ['influenza', 6],
  ['pneumococcus', 6],
  ['abrasion', 6],
  ['food-poisoning', 6],
  ['heatstroke', 6],
  ['common-cold-syndrome', 6],
  ['blood-circulation', 6],
  ['staphylococcus-aureus', 6],
  ['hemorrhagic-shock', 6],
  ['gut-microbiota', 6],
  ['bump-on-head', 6],
  ['erythroblast-and-bone-marrow-cell', 6],
  ['cancer-cell', 6],
  ['thymocyte', 6],
  ['acquired-immunity', 6],
  ['dengue-fever', 6],
  ['acne', 6],
  ['peyers-patches', 6],
  ['helicobacter-pylori', 6],
  ['antigenic-variation', 6],
  ['cytokines', 6],
  ['cancer-cell-ii', 6],
  ['left-shift', 6],
  ['ips-cells', 6],
  ['psoriasis', 6],
  ['covid-19', 6],
]);
const workCellsParentQuestionCategoryByType = new Map([
  ['observation', '\u89c2\u5bdf\u95ee\u9898'],
  ['understanding', '\u7406\u89e3\u95ee\u9898'],
  ['life-connection', '\u8054\u7cfb\u751f\u6d3b\u95ee\u9898'],
  ['science-concept', '\u79d1\u5b66\u6982\u5ff5\u95ee\u9898'],
]);
const workCellsParentQuestionPrefixes = [
  '\u89c2\u5bdf\uff1a',
  '\u7406\u89e3\uff1a',
  '\u8054\u7cfb\u751f\u6d3b\uff1a',
  '\u79d1\u5b66\u6982\u5ff5\uff1a',
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function parentQuestionQuestionWithoutPrefix(question) {
  const text = String(question ?? '').trim();
  const prefix = workCellsParentQuestionPrefixes.find((item) => text.startsWith(item));
  return prefix ? text.slice(prefix.length).trim() : text;
}

function normalizedParentQuestionText(value) {
  return String(value ?? '').replace(/[\s\u201c\u201d"'？?：:，,。！!、]/g, '');
}

function appText() {
  return [
    'index.html',
    path.join('assets', 'app.js'),
    path.join('assets', 'carmela-companion.js'),
    path.join('assets', 'science-companion.js'),
    path.join('assets', 'styles.css'),
  ]
    .map((file) => readFileSync(path.join(rootDir, file), 'utf8'))
    .join('\n');
}

function publishedBookRecords() {
  const series = readJson(seriesPath);
  return publishedTitles.map((title) => {
    const book = series.books.find((item) => item.title === title);
    assert.ok(book, `${title} should be listed`);
    const folder = path.join(rootDir, ...book.folder.split('/'));
    return {
      book,
      title,
      folder,
      assets: readJson(path.join(folder, book.assetFile)),
      companion: readJson(path.join(folder, book.companionFile)),
    };
  });
}

function assertImageRefsExist(folder, imageRefs, context) {
  assert.ok(Array.isArray(imageRefs), `${context} should have image refs`);
  assert.equal(imageRefs.length > 0, true, `${context} should have at least one image ref`);
  for (const imageRef of imageRefs) {
    assert.match(imageRef, /^pages\/\d{3}\.png$/, `${context} should use page image refs`);
    assert.equal(existsSync(path.join(folder, ...imageRef.split('/'))), true, `${context} image should exist`);
  }
}

function assertGeneratedRefsExist(folder, item, context) {
  const generatedImageRefs = item.generatedImageRefs ?? [];

  assert.equal(generatedImageRefs.length > 0, true, `${context} should have generated images`);

  for (const imageRef of generatedImageRefs) {
    assert.match(imageRef, /^generated\/[a-z0-9-]+\.png$/, `${context} should use generated image refs`);
    assert.equal(existsSync(path.join(folder, ...imageRef.split('/'))), true, `${context} generated image should exist`);
  }
}

function assertVisualWorkflow(folder, item, promptDoc, context) {
  const imageRefs = item.imageRefs ?? item.pageImageRefs ?? [];
  const generatedImageRefs = item.generatedImageRefs ?? [];
  const promptId = item.generatedImagePromptId;
  const hasPageImages = Array.isArray(imageRefs) && imageRefs.length > 0;
  const hasGeneratedImages = Array.isArray(generatedImageRefs) && generatedImageRefs.length > 0;

  if (hasPageImages) {
    assertImageRefsExist(folder, imageRefs, `${context} page images`);
  }

  if (hasGeneratedImages) {
    assertGeneratedRefsExist(folder, item, context);
    assert.equal(item.needsGeneratedImage, false, `${context} should not be marked as missing generated art`);
    assert.equal(typeof promptId, 'string', `${context} should link to the reusable image prompt`);
    assert.match(promptDoc, new RegExp(`prompt-id: ${promptId}\\b`), `${context} prompt id should be documented`);
    return;
  }

  assert.equal(item.needsGeneratedImage, true, `${context} without generated art should be marked for image generation`);
  assert.equal(typeof promptId, 'string', `${context} should include a prompt id`);
  assert.match(promptDoc, new RegExp(`prompt-id: ${promptId}\\b`), `${context} prompt id should be documented`);
  assert.match(promptDoc, new RegExp(`建议保存文件名：[^\\n]+\\.png[\\s\\S]*prompt-id: ${promptId}\\b`), `${context} should document a suggested PNG filename`);
}

test('global series index uses the final 12 book titles', () => {
  const series = readJson(seriesPath);
  assert.deepEqual(
    series.books.map((book) => book.title),
    requiredTitles,
  );
});

test('content index supports picture books and science manga companions', () => {
  const contentTypes = readJson(contentTypesPath);
  const typeNames = contentTypes.types.map((item) => item.type);
  assert.ok(typeNames.includes('picture-book-companion'), 'picture-book-companion should remain supported');
  assert.ok(typeNames.includes('science-manga-companion'), 'science-manga-companion should be supported');

  const scienceType = contentTypes.types.find((item) => item.type === 'science-manga-companion');
  assert.equal(scienceType.navigationMode, 'science-topic');
  assert.equal(scienceType.defaultHasAudio, false);
  assert.equal(scienceType.copyrightMode, 'licensed-media-except-full-epub');
  assert.equal(scienceType.licenseBasis, 'user_confirmed_authorization');
  assert.equal(scienceType.fullEpubPublicRelease, 'forbidden');
  assert.ok(scienceType.allowedPublicAssetTypes.includes('converted manga page images'));
  assert.ok(scienceType.allowedPublicAssetTypes.includes('thumbnails'));
  assert.ok(scienceType.allowedPublicAssetTypes.includes('cropped images'));

  const bookIndex = readJson(bookIndexPath);
  const carmela = bookIndex.series.find((item) => item.seriesTitle === '不一样的卡梅拉');
  const workCells = bookIndex.series.find((item) => item.seriesTitle === '工作细胞');
  assert.equal(carmela.type, 'picture-book-companion');
  assert.equal(carmela.navigationMode, 'book');
  assert.equal(workCells.type, 'science-manga-companion');
  assert.equal(workCells.navigationMode, 'science-topic');
  assert.equal(workCells.hasAudio, false);
  assert.equal(workCells.verificationStatus, 'from_user_reference_only');
});

test('Work Cells draft manifest is topic-based and source-only verified', () => {
  const manifest = readJson(workCellsDraftPath);
  assert.equal(manifest.type, 'science-manga-companion');
  assert.equal(manifest.contentType, 'science-manga-companion');
  assert.equal(manifest.displayMode, 'science-topic');
  assert.equal(manifest.navigationMode, 'science-topic');
  assert.equal(manifest.verificationStatus, 'from_user_reference_only');
  assert.equal(manifest.hasAudio, false);
  assert.equal(manifest.audioPolicy.displayAudioModule, false);
  assert.equal(manifest.copyrightMode, 'licensed-media-except-full-epub');
  assert.equal(manifest.licenseBasis, 'user_confirmed_authorization');
  assert.equal(Object.hasOwn(manifest, 'volumes'), false, 'Work Cells should not use volume-based navigation');

  assert.equal(manifest.topics.length, requiredWorkCellsTopics.length);
  assert.deepEqual(
    manifest.topics.map((topic) => [topic.title, topic.source.sourceLabel]),
    requiredWorkCellsTopics,
  );

  for (const topic of manifest.topics) {
    assert.equal(topic.verificationStatus, 'from_user_reference_only', `${topic.title} should be source-only verified`);
    assert.equal(topic.hasAudio, false, `${topic.title} should not have audio`);
    assert.deepEqual(topic.publicAssets.crops, [], `${topic.title} should not include crop paths yet`);
  }
});

test('Work Cells draft manifest reads the page map for topic media', () => {
  const manifest = readJson(workCellsDraftPath);
  const pageMap = readJson(workCellsPageMapPath);

  assert.equal(pageMap.sourceOfTruth, 'manual-topic-ranges');
  assert.equal(pageMap.validation.mergeRuleCheck.ok, true);
  assert.equal(manifest.pageMapPath, 'data/cells-at-work/page-map.json');
  assert.equal(pageMap.topics.length, manifest.topics.length);

  for (const [index, topic] of manifest.topics.entries()) {
    const pageMapTopic = pageMap.topics[index];
    assert.equal(topic.order, pageMapTopic.order, `${topic.title} should keep page-map order`);
    const expectedDisplayTitle = topic.topicId === 'psoriasis' ? '银屑病（干癣）' : topic.title;
    assert.equal(topic.displayTitle, expectedDisplayTitle, `${topic.title} should use the confirmed displayTitle`);
    assert.equal(topic.source.sourceLabel, pageMapTopic.sourceLabel, `${topic.title} should use page-map source note`);
    assert.equal(topic.mediaStatus, 'available', `${topic.title} should mark page media available`);
    assert.equal(topic.thumbnailPath, pageMapTopic.thumbnailPath, `${topic.title} should use page-map thumbnail`);
    assert.deepEqual(topic.pageImagePaths, pageMapTopic.pageImagePaths, `${topic.title} should use page-map images`);
    assert.equal(topic.publicAssets.status, 'available', `${topic.title} should expose mapped media status`);
    assert.deepEqual(topic.publicAssets.pageImages, pageMapTopic.pageImagePaths, `${topic.title} should expose page images`);
    assert.deepEqual(topic.publicAssets.thumbnails, [pageMapTopic.thumbnailPath], `${topic.title} should expose thumbnail`);
    assert.deepEqual(topic.publicAssets.crops, [], `${topic.title} should not invent crops`);
    assert.equal(existsSync(path.join(rootDir, ...topic.thumbnailPath.split('/'))), true, `${topic.title} thumbnail should exist`);

    for (const imagePath of topic.pageImagePaths) {
      assert.equal(existsSync(path.join(rootDir, ...imagePath.split('/'))), true, `${topic.title} image should exist: ${imagePath}`);
    }
  }
});

test('Work Cells Cedar pollen sample defines body science station data', () => {
  const manifest = readJson(workCellsDraftPath);
  const topic = manifest.topics.find((item) => item.topicId === 'cedar-pollen-allergy');

  assert.ok(topic, 'Cedar pollen allergy topic should exist');
  assert.equal(topic.title, '杉树花粉过敏');
  assert.equal(topic.bodyScienceStations.length, 4, 'Cedar pollen V2 sample should define exactly 4 stations');

  const stationIds = new Set();
  const promptIds = new Set();
  for (const station of topic.bodyScienceStations) {
    for (const field of requiredBodyScienceStationFields) {
      assert.equal(Object.hasOwn(station, field), true, `${station.stationId ?? 'station'} should include ${field}`);
    }
    assert.equal(station.topicId, topic.topicId);
    assert.equal(station.status, 'published');
    assert.match(station.priority, /^(high|medium|low)$/);
    assert.match(station.imagePromptId, /^work-cells-cedar-pollen-allergy-/);
    assert.match(station.imagePrompt, /原创/);
    assert.match(station.imagePrompt, /不要模仿《工作细胞》/);
    assert.match(station.imagePrompt, /Logo|水印/);
    assert.equal(station.imagePrompt.includes('对白'), true, `${station.stationId} prompt should forbid dialogue text`);
    assert.match(station.imageAsset, /^public\/assets\/cells-at-work\/science-station\/cedar-pollen-allergy\/.+\.webp$/);
    assert.equal(existsSync(path.join(rootDir, ...station.imageAsset.split('/'))), true, `${station.stationId} image asset should exist`);
    assert.ok(station.imageAlt.length > 8, `${station.stationId} should include usable alt text`);
    assert.ok(station.coreQuestion.length > 6, `${station.stationId} should include a child-facing question`);
    assert.ok(station.explanation.length > 20, `${station.stationId} should include a science explanation`);
    assert.equal(Array.isArray(station.relatedPageIds), true, `${station.stationId} should reference page ids only`);
    assert.ok(station.relatedPageIds.length > 0, `${station.stationId} should reference at least one page id`);
    assert.equal(station.relatedPageIds.every((pageId) => !pageId.includes('.webp')), true, `${station.stationId} should not store image paths as page ids`);
    assert.ok(station.biologyConcepts.length > 0, `${station.stationId} should include biology concepts`);
    assert.ok(station.encyclopediaTags.length > 0, `${station.stationId} should include encyclopedia tags`);
    assert.ok(station.parentNote.length > 0, `${station.stationId} should include a parent note`);
    stationIds.add(station.stationId);
    promptIds.add(station.imagePromptId);
  }

  assert.equal(stationIds.size, 4, 'stationId values should be unique');
  assert.equal(promptIds.size, 4, 'imagePromptId values should be unique');
});

test('Work Cells Cedar pollen sample defines refined parent question cards', () => {
  const manifest = readJson(workCellsDraftPath);
  const topic = manifest.topics.find((item) => item.topicId === 'cedar-pollen-allergy');
  const cards = topic.parentQuestionCards;

  assert.equal(cards.length, 6, 'Cedar pollen V2 sample should define 6 refined parent question cards');
  assert.deepEqual(
    [...new Set(cards.map((card) => card.type))],
    ['observation', 'understanding', 'life-connection'],
  );

  for (const card of cards) {
    for (const field of requiredParentQuestionFields) {
      assert.equal(Object.hasOwn(card, field), true, `${card.title ?? 'question card'} should include ${field}`);
    }
    assert.match(card.category, /^(观察问题|理解问题|联系生活问题|科学概念问题)$/);
    assert.ok(card.question.length > 8, `${card.title} should include a concrete question`);
    assert.ok(card.answer.length > 6, `${card.title} should include a concise answer`);
    assert.equal(card.answer.includes('对白'), false, `${card.title} should not ask children to repeat dialogue`);
    assert.equal(Array.isArray(card.relatedPageIds), true, `${card.title} should reference page ids`);
    assert.ok(card.relatedPageIds.length > 0, `${card.title} should reference at least one page`);
    assert.ok(card.parentHint.length > 6, `${card.title} should include a parent hint`);
    assert.ok(card.biologyConcepts.length > 0, `${card.title} should include biology concepts`);
  }
});

test('Work Cells V2 topics use approved WebP assets and metadata', () => {
  const manifest = readJson(workCellsDraftPath);

  assert.equal(workCellsV2TopicIds.length, 27, 'Work Cells should track 27 approved V2 topics');

  for (const topicId of workCellsV2TopicIds) {
    const topic = manifest.topics.find((item) => item.topicId === topicId);
    assert.ok(topic, `${topicId} topic should exist`);
    assert.equal(topic.contentVersion, 'work-cells-v2');
    assert.equal(topic.contentStatus?.text, 'approved-v2');
    assert.equal(topic.contentStatus?.imagePromptStatus, 'asset-ready');
    assert.equal(topic.contentStatus?.imageAssetStatus, 'ready');
    assert.equal(topic.qualityFlags?.noFullComicText, true);
    assert.equal(topic.qualityFlags?.noFullComicReader, true);
    assert.equal(topic.qualityFlags?.noFullAnimationDialogue, true);
    assert.equal(topic.qualityFlags?.noOriginalPngInPublic, true);
    assert.match(topic.parentReadingNote ?? '', /\S/, `${topicId} should include parentReadingNote`);
    assert.ok(topic.topicOverview?.summary?.length > 20, `${topicId} should include topicOverview`);
    assert.ok(topic.sourceNotes?.length >= 3, `${topicId} should include sourceNotes`);
    assert.ok(topic.relatedComicPages?.length > 0, `${topicId} should include relatedComicPages`);
    if (workCellsNoReliableAnimationTopicIds.has(topicId)) {
      assert.deepEqual(topic.relatedAnimationScenes, [], `${topicId} should not force unreliable animation matches`);
    } else {
      assert.ok(topic.relatedAnimationScenes?.length > 0, `${topicId} should include relatedAnimationScenes`);
    }
    assert.equal(topic.bodyScienceStations.length, 4, `${topicId} should define 4 V2 station cards`);
    assert.equal(topic.parentQuestionCards.length, workCellsV2QuestionCounts.get(topicId), `${topicId} should define the expected V2 parent question card count`);

    topic.bodyScienceStations.forEach((station, index) => {
      const expectedAsset = `public/assets/cells-at-work/science-station/${topicId}/${topicId}-v2-station-${String(index + 1).padStart(2, '0')}.webp`;
      assert.equal(station.contentVersion, 'work-cells-v2');
      assert.equal(station.imagePromptStatus, 'asset-ready');
      assert.equal(station.imageAssetStatus, 'ready');
      assert.equal(station.imageAsset, expectedAsset);
      assert.equal(existsSync(path.join(rootDir, ...expectedAsset.split('/'))), true, `${expectedAsset} should exist`);
    });
  }
});

test('Work Cells V2 user-visible fields do not contain replacement question-mark runs', () => {
  const manifest = readJson(workCellsDraftPath);
  const replacementRun = /\?{3,}/;
  const failures = [];
  const pushValue = (topicId, fieldPath, value) => {
    if (typeof value === 'string' && replacementRun.test(value)) {
      failures.push(`${topicId}.${fieldPath}`);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => pushValue(topicId, `${fieldPath}[${index}]`, item));
    }
  };

  for (const topicId of workCellsV2TopicIds) {
    const topic = manifest.topics.find((item) => item.topicId === topicId);
    assert.ok(topic, `${topicId} topic should exist`);

    pushValue(topicId, 'title', topic.title);
    pushValue(topicId, 'displayTitle', topic.displayTitle);
    pushValue(topicId, 'topicOverview.title', topic.topicOverview?.title);
    pushValue(topicId, 'topicOverview.summary', topic.topicOverview?.summary);
    pushValue(topicId, 'topicOverview.readingFocus', topic.topicOverview?.readingFocus);
    pushValue(topicId, 'topicOverview.keyBiologyConcepts', topic.topicOverview?.keyBiologyConcepts);
    pushValue(topicId, 'recommendedBodyScienceStationFocus', topic.recommendedBodyScienceStationFocus);
    pushValue(topicId, 'parentReadingNote', topic.parentReadingNote);
    pushValue(topicId, 'parentNote', topic.parentNote);
    pushValue(topicId, 'sensitiveContentGuidance', topic.sensitiveContentGuidance);
    pushValue(topicId, 'sourceNotes', topic.sourceNotes);
    pushValue(topicId, 'contentStatus.text', topic.contentStatus?.text);
    pushValue(topicId, 'contentStatus.imagePromptStatus', topic.contentStatus?.imagePromptStatus);
    pushValue(topicId, 'contentStatus.imageAssetStatus', topic.contentStatus?.imageAssetStatus);

    topic.bodyScienceStations.forEach((station, index) => {
      const stationPath = `bodyScienceStations[${index}]`;
      pushValue(topicId, `${stationPath}.title`, station.title);
      pushValue(topicId, `${stationPath}.coreQuestion`, station.coreQuestion);
      pushValue(topicId, `${stationPath}.explanation`, station.explanation);
      pushValue(topicId, `${stationPath}.imageAlt`, station.imageAlt);
      pushValue(topicId, `${stationPath}.biologyConcepts`, station.biologyConcepts);
      pushValue(topicId, `${stationPath}.encyclopediaTags`, station.encyclopediaTags);
      pushValue(topicId, `${stationPath}.parentNote`, station.parentNote);
    });

    topic.parentQuestionCards.forEach((card, index) => {
      const cardPath = `parentQuestionCards[${index}]`;
      pushValue(topicId, `${cardPath}.category`, card.category);
      pushValue(topicId, `${cardPath}.title`, card.title);
      pushValue(topicId, `${cardPath}.question`, card.question);
      pushValue(topicId, `${cardPath}.answer`, card.answer);
      pushValue(topicId, `${cardPath}.parentHint`, card.parentHint);
      pushValue(topicId, `${cardPath}.biologyConcepts`, card.biologyConcepts);
    });
  }

  assert.deepEqual(failures, []);
});

test('Work Cells V2 parent question card titles are concise non-duplicative labels', () => {
  const manifest = readJson(workCellsDraftPath);
  const failures = [];
  let cardCount = 0;

  for (const topicId of workCellsV2TopicIds) {
    const topic = manifest.topics.find((item) => item.topicId === topicId);
    assert.ok(topic, `${topicId} topic should exist`);

    topic.parentQuestionCards.forEach((card, index) => {
      cardCount += 1;
      const cardPath = `${topicId}.parentQuestionCards[${index}]`;
      const expectedCategory = workCellsParentQuestionCategoryByType.get(card.type);
      const title = String(card.title ?? '').trim();
      const questionWithoutPrefix = parentQuestionQuestionWithoutPrefix(card.question);
      const normalizedTitle = normalizedParentQuestionText(title);
      const normalizedQuestion = normalizedParentQuestionText(questionWithoutPrefix);

      if (card.category !== expectedCategory) {
        failures.push(`${cardPath}.category expected ${expectedCategory}, got ${card.category}`);
      }
      if (/^(observation|understanding|life-connection|science-concept)/.test(card.category ?? '')) {
        failures.push(`${cardPath}.category keeps an internal type label`);
      }
      if (title.length < 3) {
        failures.push(`${cardPath}.title should be a readable short label`);
      }
      if (workCellsParentQuestionPrefixes.some((prefix) => title.startsWith(prefix))) {
        failures.push(`${cardPath}.title keeps a question category prefix`);
      }
      if (normalizedTitle === normalizedQuestion) {
        failures.push(`${cardPath}.title duplicates the visible question text`);
      }
      if (normalizedQuestion.startsWith(normalizedTitle)) {
        failures.push(`${cardPath}.title is a truncated question prefix`);
      }
    });
  }

  assert.equal(cardCount, 162);
  assert.deepEqual(failures, []);
});

test('Work Cells batch one topics define formal science station and parent question data', () => {
  const manifest = readJson(workCellsDraftPath);
  const topics = ['pneumococcus', 'abrasion', 'heatstroke', 'blood-circulation', 'hemorrhagic-shock'].map((topicId) => {
    const topic = manifest.topics.find((item) => item.topicId === topicId);
    assert.ok(topic, `${topicId} topic should exist`);
    return topic;
  });
  const expectedQuestionTypes = ['observation', 'understanding', 'life-connection', 'science-concept'];

  for (const topic of topics) {
    assert.equal(topic.bodyScienceStations.length, 4, `${topic.topicId} should define exactly 4 stations`);
    assert.equal(topic.parentQuestionCards.length, workCellsV2QuestionCounts.get(topic.topicId), `${topic.topicId} should define the expected question card count`);
    assert.match(topic.parentNote ?? '', /\S/, `${topic.topicId} should include gentle parent co-reading guidance`);

    const stationIds = new Set();
    const promptIds = new Set();
    for (const station of topic.bodyScienceStations) {
      for (const field of requiredBodyScienceStationFields) {
        assert.equal(Object.hasOwn(station, field), true, `${station.stationId ?? 'station'} should include ${field}`);
      }
      assert.equal(station.topicId, topic.topicId);
      assert.equal(station.status, 'published');
      assert.match(station.priority, /^(high|medium|low)$/);
      assert.match(station.imagePromptId, new RegExp(`^work-cells-${topic.topicId}-`));
      assert.match(station.imagePrompt, /^【ChatGPT image】/);
      assert.match(station.imagePrompt, /原创儿童科普插图/);
      assert.match(station.imagePrompt, /不要模仿《工作细胞》/);
      assert.match(station.imagePrompt, /不(?:要)?出现漫画对白/);
      assert.match(station.imagePrompt, /Logo|水印|二维码/);
      assert.match(station.imageAsset, new RegExp(`^public/assets/cells-at-work/science-station/${topic.topicId}/.+\\.webp$`));
      assert.equal(existsSync(path.join(rootDir, ...station.imageAsset.split('/'))), true, `${station.stationId} webp image should exist`);
      assert.ok(station.imageAlt.length > 8, `${station.stationId} should include usable alt text`);
      assert.ok(station.coreQuestion.length > 6, `${station.stationId} should include a child-facing question`);
      assert.ok(station.explanation.length > 20, `${station.stationId} should include a science explanation`);
      assert.equal(Array.isArray(station.relatedPageIds), true, `${station.stationId} should reference page ids only`);
      assert.ok(station.relatedPageIds.length > 0, `${station.stationId} should reference at least one page id`);
      assert.equal(station.relatedPageIds.every((pageId) => !pageId.includes('.webp')), true, `${station.stationId} should not store image paths as page ids`);
      assert.ok(station.biologyConcepts.length > 0, `${station.stationId} should include biology concepts`);
      assert.ok(station.encyclopediaTags.length > 0, `${station.stationId} should include encyclopedia tags`);
      assert.ok(station.parentNote.length > 0, `${station.stationId} should include a parent note`);
      stationIds.add(station.stationId);
      promptIds.add(station.imagePromptId);
    }
    assert.equal(stationIds.size, 4, `${topic.topicId} stationId values should be unique`);
    assert.equal(promptIds.size, 4, `${topic.topicId} imagePromptId values should be unique`);

    const typeSet = new Set(topic.parentQuestionCards.map((card) => card.type));
    const requiredTypes = ['influenza', 'pneumococcus', 'blood-circulation', 'hemorrhagic-shock'].includes(topic.topicId)
      ? ['observation', 'understanding', 'life-connection']
      : expectedQuestionTypes;
    for (const type of requiredTypes) {
      assert.equal(typeSet.has(type), true, `${topic.topicId} should include ${type} question cards`);
    }
    for (const card of topic.parentQuestionCards) {
      for (const field of requiredParentQuestionFields) {
        assert.equal(Object.hasOwn(card, field), true, `${card.title ?? 'question card'} should include ${field}`);
      }
      assert.equal(card.topicId, topic.topicId);
      assert.match(card.type, /^(observation|understanding|life-connection|science-concept)$/);
      assert.ok(card.question.length > 8, `${card.title} should include a concrete question`);
      assert.ok(card.answer.length > 6, `${card.title} should include a concise answer`);
      assert.equal(card.answer.includes('对白'), false, `${card.title} should not ask children to repeat dialogue`);
      assert.equal(Array.isArray(card.relatedPageIds), true, `${card.title} should reference page ids`);
      assert.ok(card.relatedPageIds.length > 0, `${card.title} should reference at least one page`);
      assert.ok(card.parentHint.length > 6, `${card.title} should include a parent hint`);
      assert.ok(card.biologyConcepts.length > 0, `${card.title} should include biology concepts`);
    }
  }
});

test('Work Cells parent guidance remains limited to selected topics', () => {
  const manifest = readJson(workCellsDraftPath);
  const topicsById = new Map(manifest.topics.map((topic) => [topic.topicId, topic]));

  for (const topicId of requiredParentGuidanceTopicIds) {
    assert.match(
      topicsById.get(topicId)?.sensitiveContentGuidance ?? '',
      /\S/,
      `${topicId} should keep parent co-reading guidance`,
    );
  }
});

test('Work Cells front end renders the runtime science atlas and canonical parent-guidance route', () => {
  const appJs = readFileSync(path.join(rootDir, 'assets', 'app.js'), 'utf8');
  const scienceJs = readFileSync(path.join(rootDir, 'assets', 'science-companion.js'), 'utf8');

  assert.match(appJs, /from '\.\/science-companion\.js(?:\?[^']+)?'/);
  assert.match(appJs, /createScienceTopicViewModel\(topic\)/);
  assert.match(appJs, /renderScienceTopicAtlas\(viewModel/);
  assert.match(appJs, /\['science-parent-guidance', '家长共读'\]/);
  assert.match(scienceJs, /topic\.bodyScienceStations/);
  assert.match(scienceJs, /topic\.parentQuestionCards/);
  assert.match(scienceJs, /path: station\.imageAsset/);
  assert.match(scienceJs, /<template data-media-template>/);
  assert.match(scienceJs, /science-parent-guidance/);
  assert.doesNotMatch(scienceJs, /topic\.pageAnnotations|contentVersion|V2 内容制作中/);
});

test('Work Cells V2 standard and image workflow are frozen in docs', () => {
  const contentStandard = readFileSync(workCellsV2ContentStandardPath, 'utf8');
  const imageWorkflow = readFileSync(workCellsV2ImageWorkflowPath, 'utf8');

  for (const required of [
    'topicOverview',
    'bodyScienceStations',
    'parentQuestionCards',
    'parentReadingNote',
    'sourceNotes',
    'relatedComicPages',
    'relatedAnimationScenes',
    'contentStatus',
    'qualityFlags',
    '27 个主题',
    '不展示漫画全文',
    '不展示动画全文',
    '完整 OCR',
  ]) {
    assert.match(contentStandard, new RegExp(required), `content standard should mention ${required}`);
  }

  for (const required of [
    'Codex 不得自行生成身体科学小站配图',
    'recommendedFileName',
    'targetPath',
    'mustShow',
    'mustAvoid',
    'acceptanceCriteria',
    'png-originals',
    'public/assets/cells-at-work/science-station/<topicId>/',
    '只有 WebP',
    '不得进入 dist',
  ]) {
    assert.match(imageWorkflow, new RegExp(required), `image workflow should mention ${required}`);
  }
});

test('Work Cells animation rules use SRT first with audio fallback only for summary notes', () => {
  const processingPlan = readFileSync(workCellsAnimationProcessingPlanPath, 'utf8');
  const pilotReport = readFileSync(workCellsAnimationPilotReportPath, 'utf8');
  const contentStandard = readFileSync(workCellsV2ContentStandardPath, 'utf8');
  const imageWorkflow = readFileSync(workCellsV2ImageWorkflowPath, 'utf8');
  const combinedDocs = [processingPlan, pilotReport, contentStandard, imageWorkflow].join('\n');

  for (const required of [
    'Use same-base SRT files first',
    'If no same-base SRT exists',
    '优先使用同名 SRT',
    '如果没有同名 SRT',
    'summary-only',
    'timecoded scene notes',
    'sourceMode: srt',
    'sourceMode: audio-fallback',
    'doNotQuoteDialogue: true',
    '不输出完整音频转写',
    '不输出完整中文对白',
    '不输出完整英文字幕',
    '不做逐句翻译',
    '不生成可替代观看动画的完整剧情文本',
    '音频中间文件不得进入',
    '`public`',
    '`dist`',
    '不要安装重依赖',
    '不要上传到外部服务',
    '音频抽取文件',
    'transcript 临时文件',
  ]) {
    assert.match(combinedDocs, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `animation rules should mention ${required}`);
  }
});

test('Work Cells merged topics keep confirmed boundaries', () => {
  const manifest = readJson(workCellsDraftPath);
  const byTitle = new Map(manifest.topics.map((topic) => [topic.title, topic]));

  assert.equal(byTitle.get('癌细胞').source.sourceLabel, '第2卷 第8-9话');
  assert.equal(byTitle.get('出血性休克').source.sourceLabel, '第4卷 第17-18话');
  assert.equal(byTitle.get('癌细胞Ⅱ').source.sourceLabel, '第5卷 第24-25话');
  assert.equal(byTitle.get('新型冠状病毒').source.sourceLabel, '第6卷 第29话');
  assert.equal(byTitle.get('新型冠状病毒').mergeGroup, null);
  assert.notEqual(byTitle.get('癌细胞').slug, byTitle.get('癌细胞Ⅱ').slug, '癌细胞 and 癌细胞Ⅱ should remain separate topics');
  assert.deepEqual(byTitle.get('癌细胞').mustNotMergeWith, ['癌细胞Ⅱ']);
  assert.deepEqual(byTitle.get('癌细胞Ⅱ').mustNotMergeWith, ['癌细胞']);

  const mergeRules = new Map(manifest.topicMergeRules.map((rule) => [rule.topicTitle, rule.sourceLabel]));
  assert.deepEqual([...mergeRules.keys()], ['癌细胞', '出血性休克', '癌细胞Ⅱ']);
  assert.equal(mergeRules.get('癌细胞'), '第2卷 第8-9话');
  assert.equal(mergeRules.get('出血性休克'), '第4卷 第17-18话');
  assert.equal(mergeRules.get('癌细胞Ⅱ'), '第5卷 第24-25话');
});

test('Work Cells terminology and import report document manual review boundaries', () => {
  const terminology = readFileSync(workCellsTerminologyPath, 'utf8');
  const importReport = readFileSync(workCellsImportReportPath, 'utf8');

  for (const [title, sourceLabel] of requiredWorkCellsTopics) {
    assert.match(terminology, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `terminology should include ${title}`);
    assert.match(terminology, new RegExp(sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `terminology should include ${sourceLabel}`);
  }

  for (const phrase of [
    '不允许机械繁简转换',
    '生命科学、医学、健康教育术语必须核对大陆常用表达',
    '未解析 EPUB',
    '完整 EPUB 原文件禁止进入',
    'from_user_reference_only',
    '漫画页图片',
    '缩略图',
    '裁切图',
  ]) {
    assert.match(`${terminology}\n${importReport}`, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `docs should include ${phrase}`);
  }
});

test('static app files and required visible labels exist', () => {
  for (const file of [
    'index.html',
    path.join('assets', 'app.js'),
    path.join('assets', 'favicon.svg'),
    path.join('assets', 'styles.css'),
  ]) {
    assert.equal(existsSync(path.join(rootDir, file)), true, `${file} should exist`);
  }

  const text = appText();
  assert.match(readFileSync(path.join(rootDir, 'index.html'), 'utf8'), /href="assets\/favicon\.svg"/);
  for (const label of requiredUiText) {
    assert.match(text, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} should be present`);
  }

  for (const removed of removedHomeText) {
    assert.equal(text.includes(removed), false, `${removed} should be removed from the app UI`);
  }
});

test('home page shows series entrances before book or topic lists', () => {
  const appJs = readFileSync(path.join(rootDir, 'assets', 'app.js'), 'utf8');
  const homeBody = appJs.match(/function homePage\(\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction carmelaSeriesPage/)?.[0] ?? '';
  const carmelaSeriesBody = appJs.match(/function carmelaSeriesPage\(\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction scienceSeriesSection/)?.[0] ?? '';
  const scienceSeriesBody = appJs.match(/function scienceSeriesSection\(scienceSeries\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction scienceTopicCard/)?.[0] ?? '';

  assert.match(homeBody, /#\/series\/\$\{CARMELA_SERIES_SLUG\}/, 'home should link to the Carmela series entrance');
  assert.match(homeBody, /#\/series\/\$\{WORK_CELLS_SERIES_SLUG\}/, 'home should link to the Work Cells series entrance');
  assert.equal(homeBody.includes('model.books.map((book) => bookCard(book))'), false, 'home should not render all Carmela books directly');
  assert.equal(homeBody.includes('scienceSeriesSection(model.scienceSeries)'), false, 'home should not render all Work Cells topics directly');
  assert.match(
    carmelaSeriesBody,
    /model\.books\.map\(\(book\) => `<li id="book-\$\{book\.order\}">\$\{bookCard\(book\)\}<\/li>`\)/,
    'Carmela series page should render addressable book cards',
  );
  assert.match(
    scienceSeriesBody,
    /categoryTopics\.map\(\(topic\) => scienceTopicCard\([\s\S]*?scienceSeries,[\s\S]*?topic,[\s\S]*?`category-\$\{index \+ 1\}`/,
    'Work Cells category groups should render addressable topic cards',
  );
});

test('published books have companion data and usable media paths', () => {
  for (const { title, folder, assets, companion } of publishedBookRecords()) {
    const coverPath = path.join(folder, assets.pageImages[0]);
    const audioPath = path.join(rootDir, ...companion.audio.path.split('/'));

    assert.equal(existsSync(coverPath), true, `${title} cover image should exist`);
    assert.equal(existsSync(audioPath), true, `${title} audio should exist`);
    assert.equal(companion.overview.oneLine.length > 0, true, `${title} should have overview`);
    assert.equal(companion.storyReview.shortReview.length > 0, true, `${title} should have review`);
    assert.equal(companion.scenes.every((scene) => scene.pageRange), true, `${title} scenes should have page ranges`);
    assert.equal(companion.questionCards.factualRecall.length > 0, true, `${title} should have factual questions`);
    assert.equal(companion.questionCards.comprehension.length > 0, true, `${title} should have comprehension questions`);
    assert.equal(companion.questionCards.openExpression.length > 0, true, `${title} should have open questions`);
    assert.equal(companion.backgroundNotes.length > 0, true, `${title} should have background notes`);
    assert.equal(companion.encyclopediaEntries.length > 0, true, `${title} should have encyclopedia entries`);
    assert.equal(companion.parentGuide.suggestedFlow.length > 0, true, `${title} should have parent tips`);
    assert.deepEqual(companion.audio.markers, [], `${title} should not force audio markers`);
  }
});

test('published books publish audio through ASCII GitHub Pages paths', () => {
  const series = readJson(seriesPath);

  for (const { book, title, companion } of publishedBookRecords()) {
    const audio = expectedAudio.get(title);
    assert.ok(audio, `${title} should have expected audio mapping`);

    assert.equal(companion.audio.path, audio.publicPath, `${title} companion should use public audio path`);
    assert.equal(book.audio.path, audio.publicPath, `${title} series index should use public audio path`);
    assert.equal(companion.audio.sourcePath, audio.source, `${title} companion should document source mapping`);
    assert.equal(book.audio.sourcePath, audio.source, `${title} series index should document source mapping`);
    assert.match(companion.audio.path, /^public\/audio\/carmela-s1\/carmela-s1-\d{2}\.mp3$/, `${title} should use ASCII audio slug`);
    assert.match(companion.audio.sourcePath, /^source\/不一样的卡梅拉\/\d{2}-.+\.mp3$/, `${title} should document the original local source path`);

    const publicPath = path.join(rootDir, ...audio.publicPath.split('/'));
    assert.equal(existsSync(publicPath), true, `${title} public audio copy should exist`);
    assert.equal(statSync(publicPath).size > 0, true, `${title} public audio copy should not be empty`);
  }

  assert.equal(series.books.slice(0, 12).every((book) => book.audio?.path?.startsWith('public/audio/')), true);
});

test('Carmela audio onboarding doc documents maintenance and on-demand loading', () => {
  const docPath = path.join(rootDir, 'docs', 'how-to-add-carmela-audio.md');
  assert.equal(existsSync(docPath), true, 'audio onboarding doc should exist');
  const doc = readFileSync(docPath, 'utf8');

  for (const phrase of [
    '新增或替换音频',
    'source/不一样的卡梅拉',
    'public/audio/carmela-s1',
    'ASCII',
    'preload="none"',
    '不要添加播放历史',
    '不要编造 marker',
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `doc should include ${phrase}`);
  }
});

test('scene and question cards include existing page image references', () => {
  for (const { title, folder, companion } of publishedBookRecords()) {
    for (const scene of companion.scenes) {
      assert.ok(Array.isArray(scene.pageRefs), `${title} ${scene.id} should have page refs`);
      assertImageRefsExist(folder, scene.imageRefs, `${title} ${scene.id}`);
    }

    for (const groupName of ['factualRecall', 'comprehension', 'openExpression']) {
      for (const card of companion.questionCards[groupName]) {
        assert.ok(Array.isArray(card.evidencePageRefs), `${title} ${card.prompt} should have evidence page refs`);
        assertImageRefsExist(folder, card.evidenceImageRefs, `${title} ${card.prompt}`);
      }
    }
  }
});

test('background and encyclopedia copy is child-facing and prompt requests are documented', () => {
  const promptPath = path.join(rootDir, 'docs', 'image-prompts', 'carmela-needed-images.md');
  assert.equal(existsSync(promptPath), true, 'missing image prompt document should exist');
  const promptDoc = readFileSync(promptPath, 'utf8');

  for (const { title, companion } of publishedBookRecords()) {
    for (const item of [...companion.backgroundNotes, ...companion.encyclopediaEntries]) {
      const text = `${item.note ?? ''} ${item.summary ?? ''}`;
      for (const phrase of childAddressBlockedPhrases) {
        assert.equal(text.includes(phrase), false, `${title} ${item.title} should not contain ${phrase}`);
      }
    }
  }

  assert.match(promptDoc, /【ChatGPT image】/, 'prompt document should use ChatGPT image format');
  assert.match(promptDoc, /```md[\s\S]*【ChatGPT image】[\s\S]*```/, 'each prompt should be in a copyable Markdown code block');
});

test('background and encyclopedia entries have page evidence, explanation art, or prompt workflow', () => {
  const promptDoc = readFileSync(path.join(rootDir, 'docs', 'image-prompts', 'carmela-needed-images.md'), 'utf8');

  for (const { title, folder, companion } of publishedBookRecords()) {
    for (const item of companion.backgroundNotes) {
      assertVisualWorkflow(folder, item, promptDoc, `${title} background ${item.title}`);
    }

    for (const item of companion.encyclopediaEntries) {
      assertVisualWorkflow(folder, item, promptDoc, `${title} encyclopedia ${item.title}`);
      assert.equal(typeof item.storyAppearance, 'string', `${title} encyclopedia ${item.title} should say where it appears`);
      assert.equal(typeof item.whatItIs, 'string', `${title} encyclopedia ${item.title} should say what it is`);
      assert.equal(typeof item.whyItMatters, 'string', `${title} encyclopedia ${item.title} should say why it matters here`);
      assert.equal(typeof item.discussionQuestion, 'string', `${title} encyclopedia ${item.title} should include a discussion question`);
    }
  }
});

test('app files do not introduce blocked product fields', () => {
  const text = appText();
  for (const term of blockedTerms) {
    assert.equal(text.includes(term), false, `${term} should not appear in app files`);
  }
});

test('GitHub Pages deployment files and publishing rules are configured', () => {
  const packageJson = readJson(path.join(rootDir, 'package.json'));
  const buildScript = readFileSync(path.join(rootDir, 'scripts', 'build.mjs'), 'utf8');
  const releasePlanScript = readFileSync(path.join(rootDir, 'scripts', 'media-release-plan.mjs'), 'utf8');
  const releaseCopyScript = readFileSync(path.join(rootDir, 'scripts', 'copy-media-release-plan.mjs'), 'utf8');
  const workflowPath = path.join(rootDir, '.github', 'workflows', 'pages.yml');
  const readmePath = path.join(rootDir, 'README.md');
  const deploymentDocPath = path.join(rootDir, 'docs', 'github-pages-deployment.md');
  const releaseVerificationPath = path.join(rootDir, 'scripts', 'verify-release.mjs');
  const sharedTestRunnerPath = path.join(rootDir, 'scripts', 'run-tests.mjs');

  assert.equal(packageJson.scripts?.build, 'node scripts/build.mjs', 'build command should be configured');
  assert.equal(
    packageJson.scripts?.['generate:runtime'],
    'node scripts/generate-runtime-content.mjs --write',
    'runtime content should have one explicit tracked-output writer',
  );
  assert.equal(
    packageJson.scripts?.['validate:runtime'],
    'node scripts/generate-runtime-content.mjs --check',
    'runtime staleness validation should never rewrite tracked output',
  );
  assert.equal(
    packageJson.scripts?.test,
    'node scripts/run-tests.mjs',
    'package and Pages verification should share one full-test entrypoint',
  );
  assert.equal(
    packageJson.scripts?.['validate:public-repo'],
    'node scripts/validate-public-repository.mjs',
    'public repository validator should be configured',
  );
  assert.equal(
    packageJson.scripts?.['verify:release'],
    'node scripts/verify-release.mjs',
    'release verification should use the cross-platform orchestrator',
  );
  assert.equal(
    packageJson.scripts?.['verify:public-release'],
    'node scripts/verify-public-release.mjs',
    'Pages verification should use the tracked-only orchestrator',
  );
  assert.match(buildScript, /\bdist\b/, 'build script should declare dist as the output directory');
  assert.match(buildScript, /loadMediaReleasePlan/, 'build should load the validated exact release plan');
  assert.match(buildScript, /copyMediaReleasePlan/, 'build should copy only the exact release plan');
  assert.doesNotMatch(buildScript, /copyTree|readdir/, 'build should not recursively copy application or media directories');
  assert.match(
    releasePlanScript,
    /discoverRuntimeJsonClosure/,
    'release planning should discover the runtime and Carmela JSON reference closure',
  );
  assert.match(releasePlanScript, /discoverApplicationFiles/, 'release planning should discover referenced app assets');
  assert.match(releaseCopyScript, /source-private|data-private|task-scratch/, 'release plan validation should reject source, private and scratch roots');
  assert.equal(
    buildScript.indexOf("runNodeGate('scripts/validate-public-repository.mjs')")
      < buildScript.lastIndexOf('copyMediaReleasePlan({'),
    true,
    'public repository validation should fail before build copying starts',
  );
  assert.equal(
    buildScript.indexOf("runNodeGate('scripts/generate-runtime-content.mjs', ['--check'])")
      < buildScript.lastIndexOf('copyMediaReleasePlan({'),
    true,
    'runtime staleness validation should fail before build copying starts',
  );
  assert.equal(
    buildScript.indexOf("runNodeGate('scripts/audit-dist-assets.mjs', ['--validated-inputs'])")
      > buildScript.lastIndexOf('copyMediaReleasePlan({'),
    true,
    'dist audit should run after the static output and reuse the already completed media validation',
  );
  assert.doesNotMatch(buildScript, /--test/, 'build should not repeat the full test suite');

  assert.equal(existsSync(releaseVerificationPath), true, 'release verification orchestrator should exist');
  assert.equal(existsSync(sharedTestRunnerPath), true, 'shared full-test entrypoint should exist');
  const releaseVerification = readFileSync(releaseVerificationPath, 'utf8');
  assert.match(
    releaseVerification,
    /scripts\/run-tests\.mjs/,
    'release verification should invoke the shared full-test entrypoint once',
  );
  assert.match(
    releaseVerification,
    /scripts\/validate-public-repository\.mjs/,
    'release verification must run every precheck skipped by the validated build',
  );
  assert.equal(
    releaseVerification.indexOf('scripts/validate-public-repository.mjs')
      < releaseVerification.indexOf("scripts/build.mjs', '--validated-inputs"),
    true,
    'validated build reuse must occur only after the public repository gate',
  );
  assert.equal(
    (releaseVerification.match(/scripts\/validate-responsive-media\.mjs/g) ?? []).length,
    1,
    'release verification should perform the expensive responsive media validation once',
  );
  assert.equal(
    releaseVerification.indexOf('scripts/media-release-plan.mjs')
      < releaseVerification.indexOf('scripts/validate-portfolio-seal.mjs')
      && releaseVerification.indexOf('scripts/validate-portfolio-seal.mjs')
        < releaseVerification.indexOf('scripts/run-tests.mjs'),
    true,
    'historical seal and current maintenance overlay must run after media closure and before the one full test gate',
  );
  assert.equal(
    (releaseVerification.match(/scripts\/run-tests\.mjs/g) ?? []).length,
    1,
    'release verification should not duplicate the full test suite',
  );
  assert.match(
    releaseVerification,
    /scripts\/generate-runtime-content\.mjs['"],\s*['"]--check/,
    'release verification should fail closed on stale generated runtime content',
  );
  assert.doesNotMatch(
    releaseVerification,
    /tests\/.+\.test\.mjs/,
    'release verification should not duplicate the package test-file list',
  );

  assert.equal(existsSync(workflowPath), true, 'GitHub Pages workflow should exist');
  const workflow = readFileSync(workflowPath, 'utf8');
  for (const phrase of [
    'actions/configure-pages',
    'actions/upload-pages-artifact',
    'actions/deploy-pages',
    'npm run verify:public-release',
    'path: dist',
  ]) {
    assert.match(workflow, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `workflow should include ${phrase}`);
  }
  for (const action of [
    'actions/checkout@v5',
    'actions/setup-node@v5',
    'actions/configure-pages@v6',
    'actions/upload-pages-artifact@v5',
    'actions/deploy-pages@v5',
  ]) {
    assert.match(workflow, new RegExp(action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `workflow should use ${action}`);
  }
  assert.doesNotMatch(workflow, /actions\/setup-python|Pillow==/);
  assert.equal(
    workflow.indexOf('npm run verify:public-release') < workflow.indexOf('actions/upload-pages-artifact'),
    true,
    'Pages verification should fail before artifact upload',
  );

  for (const docPath of [readmePath, deploymentDocPath]) {
    assert.equal(existsSync(docPath), true, `${path.basename(docPath)} should exist`);
    const doc = readFileSync(docPath, 'utf8');
    for (const phrase of [
      'GitHub Pages',
      'npm run verify:release',
      'dist',
      'Actions',
      'source/',
      'OCR',
      'Book Companion / 家庭阅读助手',
      '不一样的卡梅拉',
    ]) {
      assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${path.basename(docPath)} should include ${phrase}`);
    }
  }
});

test('Work Cells publishable media uses thumbnails and webp science station images', () => {
  const manifest = readJson(workCellsDraftPath);
  const pageMap = readJson(workCellsPageMapPath);
  const cedarTopic = manifest.topics.find((topic) => topic.topicId === 'cedar-pollen-allergy');

  for (const topic of pageMap.topics) {
    assert.match(topic.thumbnailPath, /^public\/assets\/cells-at-work\/page-thumbnails\/.+\.webp$/);
    assert.equal(topic.thumbnailPath.includes('/pages-by-volume/'), false);

    for (const imagePath of topic.pageImagePaths) {
      assert.match(imagePath, /^public\/assets\/cells-at-work\/page-thumbnails\/.+\.webp$/);
      assert.equal(imagePath.includes('/pages-by-volume/'), false);
      assert.equal(existsSync(path.join(rootDir, ...imagePath.split('/'))), true, `${imagePath} should exist`);
    }

    for (const page of topic.pageAnnotations ?? []) {
      assert.match(page.sourcePath, /^public\/assets\/cells-at-work\/page-thumbnails\/.+\.webp$/);
      assert.equal(page.sourcePath.includes('/pages-by-volume/'), false);
    }
  }

  assert.ok(cedarTopic, 'Cedar pollen allergy topic should exist');
  for (const station of cedarTopic.bodyScienceStations) {
    assert.match(station.imageAsset, /^public\/assets\/cells-at-work\/science-station\/cedar-pollen-allergy\/.+\.webp$/);
    assert.equal(existsSync(path.join(rootDir, ...station.imageAsset.split('/'))), true, `${station.stationId} webp image should exist`);
  }
});

test('exact release planning excludes unreferenced Work Cells page images from dist', () => {
  const buildScript = readFileSync(path.join(rootDir, 'scripts', 'build.mjs'), 'utf8');
  const auditScript = readFileSync(path.join(rootDir, 'scripts', 'audit-dist-assets.mjs'), 'utf8');

  assert.match(buildScript, /copyMediaReleasePlan/);
  assert.doesNotMatch(buildScript, /copyTree|pages-by-volume|page-thumbnails|science-station/);
  assert.match(auditScript, /PAGES_BY_VOLUME/);
  assert.match(auditScript, /MEDIA_CLOSURE_ORPHAN/);
  assert.match(auditScript, /EXACT_RELEASE_PLAN_MISMATCH/);
});

test('dist asset audit script is available', () => {
  const packageJson = readJson(path.join(rootDir, 'package.json'));
  const auditScriptPath = path.join(rootDir, 'scripts', 'audit-dist-assets.mjs');

  assert.equal(packageJson.scripts?.['audit:dist'], 'node scripts/audit-dist-assets.mjs');
  assert.equal(existsSync(auditScriptPath), true, 'dist asset audit script should exist');

  const auditScript = readFileSync(auditScriptPath, 'utf8');
  assert.match(auditScript, /warningLimitBytes/);
  assert.match(auditScript, /FROZEN_DIST_BUDGET_BYTES/);
  assert.match(auditScript, /FROZEN_PAGES_ARTIFACT_BUDGET_BYTES/);
  assert.match(auditScript, /PAGES_ARTIFACT_PREUPLOAD_STATUS/);
  assert.match(auditScript, /validateResponsiveMedia/);
  assert.match(auditScript, /largest directories/i);
  assert.match(auditScript, /largest files/i);
});

test('Work Cells runtime manifest contains only reduced animation projections', () => {
  const manifest = readJson(workCellsDraftPath);
  const allowedSceneFields = new Set([
    'sceneId',
    'sourceLabel',
    'summary',
    'policy',
    'sourceMode',
    'reviewStatus',
  ]);

  assert.equal(manifest.topics.length, 27);
  assert.equal(
    manifest.topics.filter((topic) => topic.relatedAnimationScenes.length > 0).length,
    23,
  );

  for (const topic of manifest.topics) {
    assert.equal(Array.isArray(topic.relatedAnimationScenes), true);
    assert.equal(topic.qualityFlags.noFullAnimationDialogue, true);
    for (const scene of topic.relatedAnimationScenes) {
      assert.deepEqual(
        Object.keys(scene).filter((field) => !allowedSceneFields.has(field)),
        [],
        `${topic.topicId} exposes a private animation authoring field`,
      );
      assert.equal(scene.policy, 'no-video-no-subtitle-no-dialogue');
    }
  }

  const serialized = JSON.stringify(manifest);
  assert.equal(serialized.includes('data-private/'), false);
  assert.equal(serialized.includes('candidateScreenshotTimes'), false);
  assert.equal(serialized.includes('srtFile'), false);
  assert.equal(serialized.includes('animationFile'), false);
});

test('private authoring metadata and OCR processing outputs stay ignored', () => {
  const gitignore = readFileSync(path.join(rootDir, '.gitignore'), 'utf8');

  assert.match(gitignore, /^data-private\/$/m);
  assert.doesNotMatch(gitignore, /^!data-private\//m);
  assert.match(gitignore, /^\*\*\/ocr\/\*\*$/m);
  assert.match(gitignore, /^\*\*\/full-text\.txt$/m);
  assert.match(gitignore, /^\*\*\/ocr-report\.json$/m);
});

test('build and dist audit block animation source and private review assets', () => {
  const buildScript = readFileSync(path.join(rootDir, 'scripts', 'build.mjs'), 'utf8');
  const releaseCopyScript = readFileSync(path.join(rootDir, 'scripts', 'copy-media-release-plan.mjs'), 'utf8');
  const auditScript = readFileSync(path.join(rootDir, 'scripts', 'audit-dist-assets.mjs'), 'utf8');

  assert.match(buildScript, /copyMediaReleasePlan/, 'build should publish only the validated exact plan');
  assert.doesNotMatch(buildScript, /copyTree|readdir/, 'build should not recursively copy a denylisted tree');
  for (const extension of ['.mp4', '.srt', '.vtt', '.ass', '.ssa', '.mov', '.m4v', '.webm']) {
    assert.match(auditScript, new RegExp(extension.replace('.', '\\.')), `audit should detect ${extension}`);
  }

  for (const privateFolder of [
    'screenshot-candidates',
    'review-contact-sheets',
    'scene-notes',
    'audio-extracts',
    'extracted-audio',
    'audio-fallback',
    'transcript',
    'transcripts',
  ]) {
    assert.match(auditScript, new RegExp(privateFolder), `audit should reject ${privateFolder}`);
  }

  for (const forbiddenRoot of ['source/', 'source-private/', 'private/', 'data-private/', 'task-scratch/', 'reports/']) {
    assert.match(releaseCopyScript, new RegExp(forbiddenRoot.replace('/', '\\/')), `release plan should reject ${forbiddenRoot}`);
  }
  assert.match(auditScript, /forbiddenWorkCellsAudioPattern/, 'audit should detect Work Cells audio files without blocking all public audio');
  assert.match(auditScript, /topic-readable-transcripts/, 'audit should reject transcript review artifacts');
  assert.match(
    auditScript,
    /return totalBytes > warningLimitBytes \|\| forbiddenItems\.length > 0 \? 1 : 0/,
    'audit should return failure when a size or forbidden-path gate fails',
  );
  assert.match(
    auditScript,
    /process\.exitCode\s*=\s*await runDistAudit\(\{\s*inputsAlreadyValidated\s*\}\)/,
    'audit CLI should propagate the fail-closed result',
  );
});
