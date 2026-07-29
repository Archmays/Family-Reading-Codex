import {
  clearResponsiveImageCandidates,
  wireImageLightbox,
} from './a11y.js?v=fr-maint-single-tier-20260729';
import { createCarmelaCompanionViewModel } from './carmela-companion.js?v=fr-maint-single-tier-20260729';
import { createContentLoader } from './content-loader.js?v=fr-maint-single-tier-20260729';
import {
  createMediaResolver,
  mediaSizes,
} from './media-resolver.js?v=fr-maint-single-tier-20260729';
import {
  createScienceTopicViewModel,
  renderScienceTopicAtlas,
} from './science-companion.js?v=fr-maint-single-tier-20260729';

const CARMELA_SERIES_SLUG = 'carmela-season-1';
const WORK_CELLS_SERIES_SLUG = 'work-cells';
const app = document.querySelector('#app');
const main = document.querySelector('#main-content');
const breadcrumb = document.querySelector('#breadcrumb');
const routeAnnouncer = document.querySelector('#route-announcer');
const skipLink = document.querySelector('.skip-link');
const expectedCanonicalManifestSha256 = document
  .querySelector('meta[name="fr-p5-media-manifest-sha256"]')
  ?.content
  ?.trim() ?? '';
let model = {
  runtimeIndex: null,
  books: [],
  scienceSeries: null,
};
let currentPageKey = '';
let currentDataKey = '';
let cleanupView = () => {};
let navigationController = null;
let navigationGeneration = 0;
const routeModelCache = new Map();
let mediaResolver = createMediaResolver(null, { sitePath });

const sectionNav = [
  ['overview', '快速了解'],
  ['review', '故事回顾'],
  ['scenes', '故事路线'],
  ['questions', '一起聊一聊'],
  ['background', '背景发现'],
  ['encyclopedia', '剧情百科'],
  ['audio', '听一听'],
  ['parents', '家长共读'],
];
const scienceSectionNav = [
  ['science-overview', '先认识这个主题'],
  ['science-station', '身体科学小站'],
  ['science-questions', '一起聊一聊'],
  ['science-parent-guidance', '家长共读'],
  ['source', '来源线索'],
];

function sitePath(resourcePath) {
  const normalized = resourcePath.replace(/^\.?\//, '');
  const queryOffset = normalized.indexOf('?');
  const pathname = queryOffset === -1 ? normalized : normalized.slice(0, queryOffset);
  const query = queryOffset === -1 ? '' : normalized.slice(queryOffset + 1);
  const encodedPathname = pathname
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return query ? `${encodedPathname}?${query}` : encodedPathname;
}

function html(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function lightboxDataAttributes(sourcePath, role) {
  const media = mediaResolver.presentation(sourcePath, { role });
  if (!media.available) return '';
  const attributes = [
    ['data-lightbox-src', media.fallback.src],
    ['data-lightbox-sizes', media.sizes],
    ['data-lightbox-width', media.fallback.width],
    ['data-lightbox-height', media.fallback.height],
    ['data-lightbox-fallback-format', media.fallback.format],
    ...media.sources
      .filter((source) => /^[a-z0-9]+$/.test(source.format))
      .map((source) => [`data-lightbox-srcset-${source.format}`, source.srcset]),
  ];
  return attributes
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([name, value]) => `${name}="${html(value)}"`)
    .join(' ');
}

function responseError(resourcePath, response) {
  const error = new Error(`Cannot load ${resourcePath}`);
  error.status = response.status;
  if (response.status === 404 || response.status === 410) error.code = 'RESOURCE_NOT_FOUND';
  return error;
}

async function fetchJson(resourcePath, { signal, cache = 'default' } = {}) {
  const response = await fetch(sitePath(resourcePath), { signal, cache });
  if (!response.ok) {
    throw responseError(resourcePath, response);
  }
  return response.json();
}

async function fetchBytes(resourcePath, { signal, cache = 'default' } = {}) {
  const response = await fetch(sitePath(resourcePath), { signal, cache });
  if (!response.ok) {
    throw responseError(resourcePath, response);
  }
  return new Uint8Array(await response.arrayBuffer());
}

const contentLoader = createContentLoader({
  fetchJson,
  fetchBytes,
  expectedCanonicalManifestSha256,
});

function runtimeSeries(seriesSlug) {
  return model.runtimeIndex?.series?.find((item) => item.seriesSlug === seriesSlug) ?? null;
}

function scienceSourceLabel(topic) {
  return topic?.source?.sourceLabel ?? topic?.sourceLabel ?? '来源信息暂缺';
}

function bookCard(book, compact = false) {
  const orderLabel = String(book.order ?? '').padStart(2, '0');
  const audioAvailable = Boolean(book.hasAudio ?? book.audio?.path);
  const returnSection = `book-${book.order}`;
  const returnAttributes = `data-return-series="${CARMELA_SERIES_SLUG}" data-return-section="${returnSection}"`;
  const cardActions = compact
    ? ''
    : `
      <div class="card-actions">
        <a class="action-button" href="#/book/${book.slug}" ${returnAttributes}>打开伴读资料</a>
        <div class="secondary-actions" aria-label="${html(book.title)}快捷入口">
          <a href="#/book/${book.slug}/questions" ${returnAttributes}>问题卡</a>
          ${audioAvailable ? `<a href="#/book/${book.slug}/audio" ${returnAttributes}>听音频</a>` : ''}
        </div>
      </div>
    `;
  const title = compact
    ? `<p class="card-title">${html(book.title)}</p>`
    : `<h2>${html(book.title)}</h2>`;

  return `
    <article class="book-card${compact ? ' book-card-compact' : ''}">
      <div class="cover-frame">
        ${mediaResolver.picture(book.cover, {
          role: 'carmela-series-cover',
          alt: `${book.title}封面`,
          loading: 'lazy',
          decoding: 'async',
        })}
        <span class="cover-fallback">封面图片暂时无法显示</span>
      </div>
      <div class="card-body">
        ${compact ? '' : `<p class="card-index"><span aria-hidden="true">册</span> ${html(orderLabel)}</p>`}
        ${title}
        <p class="card-meta">
          <span>绘本伴读</span>
          <span class="availability-label" data-available="${audioAvailable}">
            ${audioAvailable ? '含音频' : '文字资料'}
          </span>
        </p>
        ${cardActions}
      </div>
    </article>
  `;
}

function seriesEntryCard({ title, description, href, typeLabel, coverImage, actionLabel, domain }) {
  const mediaRole = domain === 'science'
    ? 'work-cells-series-thumbnail'
    : 'carmela-series-cover';
  return `
    <article class="series-entry-card series-entry-card--${html(domain)}">
      <a class="series-entry-link" href="${href}" aria-label="进入${html(title)}">
        <div class="series-entry-cover${coverImage ? '' : ' cover-missing'}">
          ${coverImage ? mediaResolver.picture(coverImage, {
            role: mediaRole,
            alt: `${title}入口图`,
            sizes: mediaSizes(mediaRole, 'home-series-entry'),
            loading: 'lazy',
            decoding: 'async',
          }) : ''}
          <span class="cover-fallback">入口图片暂时无法显示</span>
        </div>
        <div class="series-entry-body">
          <span class="series-entry-type">${html(typeLabel)}</span>
          <h2>${html(title)}</h2>
          <p>${html(description)}</p>
          <span class="action-button">${html(actionLabel)}</span>
        </div>
      </a>
    </article>
  `;
}

function homePage() {
  const carmelaSeries = runtimeSeries(CARMELA_SERIES_SLUG);
  const workCellsSeries = runtimeSeries(WORK_CELLS_SERIES_SLUG);
  return `
    <section class="series-entry-section" aria-labelledby="home-title">
      <div class="section-heading section-heading--home">
        <p class="eyebrow">纸质书旁边的温暖伴读</p>
        <div>
          <h1 id="home-title" data-route-heading tabindex="-1">选择阅读主题</h1>
          <p>先选择正在阅读的系列，再按需要打开故事回顾、问题卡或科学补充。</p>
        </div>
      </div>
      <div class="series-entry-grid">
        ${seriesEntryCard({
          title: carmelaSeries?.seriesTitle ?? '不一样的卡梅拉',
          description: carmelaSeries?.description ?? '从绘本书架选择书目，回顾故事、聊一聊问题，也可以听配套音频。',
          href: `#/series/${CARMELA_SERIES_SLUG}`,
          typeLabel: '绘本伴读',
          coverImage: carmelaSeries?.coverImage ?? '',
          actionLabel: '走进绘本书架',
          domain: 'carmela',
        })}
        ${seriesEntryCard({
          title: workCellsSeries?.seriesTitle ?? '工作细胞',
          description: workCellsSeries?.description ?? '从科学主题馆按类别找到导读、身体科学小站与亲子问题卡。',
          href: `#/series/${WORK_CELLS_SERIES_SLUG}`,
          typeLabel: '科学主题伴读',
          coverImage: workCellsSeries?.coverImage ?? '',
          actionLabel: '走进科学主题馆',
          domain: 'science',
        })}
      </div>
      <p class="usage-tip"><span aria-hidden="true">↗</span> 先读纸质书，再按需要查看辅助资料。</p>
    </section>
  `;
}

function carmelaSeriesPage() {
  return `
    <section class="season-section season-section--carmela" aria-labelledby="season-title">
      <div class="section-heading">
        <p class="eyebrow">绘本书架 · 第一季</p>
        <div>
          <h1 id="season-title" data-route-heading tabindex="-1">不一样的卡梅拉</h1>
          <p>按册序选择手边的纸质书，再打开对应的伴读资料。</p>
        </div>
      </div>
      ${model.books.length
        ? `<ol class="book-grid" aria-label="不一样的卡梅拉书目">
            ${model.books.map((book) => `<li id="book-${book.order}">${bookCard(book)}</li>`).join('')}
          </ol>`
        : `<section class="empty-state" aria-labelledby="carmela-empty-title">
            <h2 id="carmela-empty-title">暂时没有可显示的书目</h2>
            <p>可以稍后重试，或先返回首页选择其他主题。</p>
          </section>`}
    </section>
  `;
}

function groupScienceTopics(topics) {
  const groups = new Map();
  topics.forEach((topic) => {
    const category = topic.category || '其他科学主题';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(topic);
  });
  return [...groups.entries()];
}

function scienceSeriesSection(scienceSeries) {
  const topics = scienceSeries?.manifest?.topics ?? [];
  const groups = groupScienceTopics(topics);
  if (!topics.length) {
    return `
      <section class="season-section season-section--science" aria-labelledby="science-title">
        <div class="section-heading">
          <p class="eyebrow">科学主题馆</p>
          <div>
            <h1 id="science-title" data-route-heading tabindex="-1">工作细胞</h1>
            <p>按身体与健康主题查找纸质漫画旁的补充资料。</p>
          </div>
        </div>
        <section class="empty-state" aria-labelledby="science-empty-title">
          <h2 id="science-empty-title">暂时没有可显示的科学主题</h2>
          <p>可以稍后重试，或先返回首页选择其他主题。</p>
        </section>
      </section>
    `;
  }

  return `
    <section class="season-section season-section--science" aria-labelledby="science-title">
      <div class="section-heading">
        <p class="eyebrow">科学主题馆</p>
        <div>
          <h1 id="science-title" data-route-heading tabindex="-1">${html(scienceSeries.manifest.seriesTitle)}</h1>
          <p>按主题类别找到纸质漫画旁的科学导读，主题顺序与现有资料一致。</p>
        </div>
      </div>
      <nav class="category-navigation" aria-label="科学主题类别">
        <details class="category-nav" data-category-nav open>
          <summary>
            <span>快速到达</span>
            <strong>浏览 ${groups.length} 个主题类别</strong>
          </summary>
          <div>
            ${groups.map(([category], index) => (
              `<a href="#/series/${scienceSeries.seriesSlug}/category-${index + 1}">${html(category)}</a>`
            )).join('')}
          </div>
        </details>
      </nav>
      <div class="topic-category-list">
        ${groups.map(([category, categoryTopics], index) => `
          <section id="category-${index + 1}" class="topic-category" aria-labelledby="category-${index + 1}-title">
            <header class="topic-category-heading">
              <p>${String(index + 1).padStart(2, '0')}</p>
              <h2 id="category-${index + 1}-title" tabindex="-1">${html(category)}</h2>
              <span>${categoryTopics.length} 个主题</span>
            </header>
            <div class="topic-grid">
              ${categoryTopics.map((topic) => scienceTopicCard(
                scienceSeries,
                topic,
                `category-${index + 1}`,
              )).join('')}
            </div>
          </section>
        `).join('')}
      </div>
    </section>
  `;
}

function scienceTopicCard(scienceSeries, topic, returnSection = '') {
  const sourceLabel = scienceSourceLabel(topic);
  const thumbnail = topic.thumbnailPath;
  const returnAttributes = returnSection
    ? `data-return-series="${scienceSeries.seriesSlug}" data-return-section="${returnSection}"`
    : '';
  return `
    <article class="topic-card">
      <div class="topic-thumbnail${thumbnail ? '' : ' thumbnail-missing'}">
        ${thumbnail ? mediaResolver.picture(thumbnail, {
          role: 'work-cells-series-thumbnail',
          alt: `${topic.displayTitle}页面缩略图`,
          loading: 'lazy',
          decoding: 'async',
        }) : ''}
        <span class="cover-fallback">主题图片暂时无法显示</span>
      </div>
      <div class="topic-card-body">
        <p class="topic-category-label">${html(topic.category || '科学主题')}</p>
        <h3>${html(topic.displayTitle)}</h3>
        <p class="topic-source">来源：${html(sourceLabel)}</p>
        <a class="topic-link" href="#/science/${scienceSeries.seriesSlug}/${topic.slug}" ${returnAttributes}>
          打开科学伴读 <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  `;
}

function scienceSeriesPage(scienceSeries) {
  return `
    ${scienceSeriesSection(scienceSeries)}
  `;
}

function CarmelaMediaThumbnail(book, mediaId, group, index) {
  const media = book.mediaRegistry?.[mediaId];
  if (!media) return '';
  const total = group.mediaIds.length;
  const position = `第 ${index + 1} 张，共 ${total} 张`;
  const contextLabel = media.kind === 'explanation'
    ? `${group.label} · 第 ${index + 1} 张`
    : media.label;
  const contextAlt = media.kind === 'explanation'
    ? `${book.identity?.title ?? book.title}：${contextLabel}`
    : media.alt;
  const previewRole = media.kind === 'explanation'
    ? 'carmela-explanation-preview'
    : 'carmela-page-preview';
  const lightboxAttributes = lightboxDataAttributes(media.absolutePath, 'carmela-lightbox');
  const preview = mediaResolver.picture(media.absolutePath, {
    role: previewRole,
    alt: contextAlt,
    loading: 'lazy',
    decoding: 'async',
  });
  return `
    <button
      class="page-thumbnail media-kind-${html(media.kind)}"
      type="button"
      ${lightboxAttributes}
      data-lightbox-alt="${html(contextAlt)}"
      data-lightbox-group="${html(group.id)}"
      data-media-id="${html(media.id)}"
      aria-label="放大查看${html(contextLabel)}，${html(position)}"
    >
      ${preview}
      <span>${html(contextLabel)}</span>
    </button>
  `;
}

function CarmelaMediaGroupTemplate(book, group) {
  return `
    <div class="page-thumbnail-list">
      ${group.mediaIds.map((mediaId, index) => (
        CarmelaMediaThumbnail(book, mediaId, group, index)
      )).join('')}
    </div>
  `;
}

function EvidenceDisclosure(book, groupId, summary = '查看页面线索') {
  const group = book.mediaGroups?.[groupId];
  if (!group?.mediaIds?.length) return '';
  return `
    <details class="evidence-disclosure" data-media-disclosure data-media-group-id="${html(group.id)}">
      <summary>${html(summary)} <span aria-hidden="true">(${group.mediaIds.length})</span></summary>
      <div class="media-group-mount" data-media-mount aria-label="${html(group.label)}"></div>
      <template data-media-template>
        ${CarmelaMediaGroupTemplate(book, group)}
      </template>
    </details>
  `;
}

function ExplanationImages(book, item) {
  const explanationDisclosure = EvidenceDisclosure(
    book,
    item.explanationMediaGroupId,
    '查看相关解释图',
  );
  return `
    ${explanationDisclosure ? `
      <div class="explanation-images">
        ${explanationDisclosure}
      </div>
    ` : ''}
    ${EvidenceDisclosure(book, item.pageMediaGroupId, '查看相关绘本页面')}
  `;
}

function ImageLightbox() {
  return `
    <div class="image-lightbox" data-lightbox hidden role="dialog" aria-modal="true" aria-labelledby="lightbox-title" aria-describedby="lightbox-caption" aria-busy="false" tabindex="-1">
      <div class="lightbox-backdrop" aria-hidden="true"></div>
      <div class="lightbox-panel" role="document">
        <h2 id="lightbox-title" class="lightbox-title">页面图片放大查看</h2>
        <button class="lightbox-close" type="button" data-lightbox-close data-lightbox-close-button aria-label="关闭放大图">关闭</button>
        <button class="lightbox-nav lightbox-prev" type="button" data-lightbox-prev aria-label="上一张">上一张</button>
        <picture class="lightbox-picture" data-lightbox-picture hidden>
          <source type="image/avif" data-lightbox-source="avif">
          <source type="image/webp" data-lightbox-source="webp">
          <source type="image/jpeg" data-lightbox-source="jpeg">
          <source type="image/png" data-lightbox-source="png">
          <img data-lightbox-image alt="" hidden>
        </picture>
        <button class="lightbox-nav lightbox-next" type="button" data-lightbox-next aria-label="下一张">下一张</button>
        <p id="lightbox-caption" class="lightbox-caption" data-lightbox-caption role="status" aria-live="polite" aria-atomic="true"></p>
      </div>
    </div>
  `;
}

function companionSectionHeading(kicker, title, id) {
  return `
    <header class="companion-section-heading">
      <p>${html(kicker)}</p>
      <h2 id="${id}">${html(title)}</h2>
    </header>
  `;
}

function compactFactList(items, label) {
  const firstItems = items.slice(0, 6);
  const remainingItems = items.slice(6);
  return `
    <ul class="companion-fact-list" aria-label="${html(label)}">
      ${firstItems.map((item) => `<li>${html(item)}</li>`).join('')}
    </ul>
    ${remainingItems.length > 0 ? `
      <details class="compact-list-disclosure">
        <summary>再看 ${remainingItems.length} 项</summary>
        <ul class="companion-fact-list">
          ${remainingItems.map((item) => `<li>${html(item)}</li>`).join('')}
        </ul>
      </details>
    ` : ''}
  `;
}

function overviewSection(book) {
  return `
    <section id="overview" class="companion-section companion-overview" aria-labelledby="overview-title">
      ${companionSectionHeading('先认识角色与方向', '快速了解', 'overview-title')}
      <p class="companion-lede">${html(book.summary)}</p>
      <div class="companion-facts-grid">
        <section aria-labelledby="characters-title">
          <h3 id="characters-title">主要角色</h3>
          ${compactFactList(book.facts.characters, '主要角色')}
        </section>
        <section aria-labelledby="places-title">
          <h3 id="places-title">重要地点</h3>
          ${compactFactList(book.facts.places, '重要地点')}
        </section>
      </div>
      ${book.facts.relationships.length > 0 ? `
        <details class="relationship-disclosure">
          <summary>角色之间 <span aria-hidden="true">(${book.facts.relationships.length})</span></summary>
          <ul class="plain-list">
            ${book.facts.relationships.map((item) => `<li>${html(item)}</li>`).join('')}
          </ul>
        </details>
      ` : ''}
      <article class="conflict-note">
        <h3>故事里的难题</h3>
        <p>${html(book.facts.conflict)}</p>
      </article>
      <div class="emotion-route">
        <h3>情绪怎么变化</h3>
        <ol>
          ${book.facts.emotionalArc.map((item) => `<li><span>${html(item)}</span></li>`).join('')}
        </ol>
      </div>
    </section>
  `;
}

function reviewSection(book) {
  return `
    <section id="review" class="companion-section companion-review" aria-labelledby="review-title">
      ${companionSectionHeading('把故事重新串起来', '故事回顾', 'review-title')}
      <p class="companion-lede">${html(book.storyReview.introduction)}</p>
      <ol class="story-beats">
        ${book.storyReview.beats.map((item, index) => `
          <li>
            <span aria-hidden="true">${index + 1}</span>
            <p>${html(item)}</p>
          </li>
        `).join('')}
      </ol>
    </section>
  `;
}

function scenesSection(book) {
  return `
    <section id="scenes" class="companion-section companion-scenes" aria-labelledby="scenes-title">
      ${companionSectionHeading('沿着关键场景往前走', '故事路线', 'scenes-title')}
      <ol class="story-trail">
        ${book.scenes.map((scene) => `
          <li class="story-trail-item">
            <span class="story-trail-number" aria-hidden="true">${scene.sequence}</span>
            <article aria-labelledby="scene-${scene.sequence}-title">
              <header>
                <div>
                  <p class="story-trail-label">第 ${scene.sequence} 站</p>
                  <h3 id="scene-${scene.sequence}-title">${html(scene.title)}</h3>
                </div>
                ${scene.pageRange ? `<span class="page-range">绘本页 ${html(scene.pageRange)}</span>` : ''}
              </header>
              <p>${html(scene.summary)}</p>
              ${scene.discussionFocus.length > 0 ? `
                <ul class="focus-tags" aria-label="这一站可以关注">
                  ${scene.discussionFocus.map((item) => `<li>${html(item)}</li>`).join('')}
                </ul>
              ` : ''}
              ${EvidenceDisclosure(book, scene.mediaGroupId, '查看这一站的绘本页面')}
            </article>
          </li>
        `).join('')}
      </ol>
    </section>
  `;
}

function questionGroup(book, group) {
  const groupTitleId = `question-group-${group.key}-title`;
  return `
    <section class="question-group" aria-labelledby="${groupTitleId}">
      <header>
        <h3 id="${groupTitleId}">${html(group.label)}</h3>
        <p>${html(group.purpose)}</p>
      </header>
      <div class="question-list">
        ${group.questions.map((question) => {
          const collapsedLabel = question.openEnded ? '查看讨论提示' : '查看参考答案';
          const expandedLabel = question.openEnded ? '收起讨论提示' : '收起参考答案';
          return `
            <article class="question-card" aria-labelledby="${question.id}">
              <p class="question-sequence">问题 ${question.sequence}</p>
              <h4 id="${question.id}">${html(question.prompt)}</h4>
              ${question.pageRange ? `<p class="page-range">绘本页 ${html(question.pageRange)}</p>` : ''}
              ${question.openEnded ? '<p class="open-note">没有唯一答案，欢迎说说自己的想法。</p>' : ''}
              <button
                id="${question.toggleId}"
                class="answer-button"
                type="button"
                data-answer-toggle="${question.answerId}"
                data-label-collapsed="${collapsedLabel}"
                data-label-expanded="${expandedLabel}"
                aria-controls="${question.answerId}"
                aria-expanded="false"
              >${collapsedLabel}</button>
              <div
                id="${question.answerId}"
                class="answer"
                role="region"
                aria-labelledby="${question.toggleId}"
                hidden
              >
                <h5>${question.openEnded ? '讨论提示' : '参考答案'}</h5>
                <ul class="plain-list">
                  ${question.talkingPoints.map((item) => `<li>${html(item)}</li>`).join('')}
                </ul>
                ${EvidenceDisclosure(book, question.mediaGroupId, '查看回答所依据的页面')}
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function questionsSection(book) {
  return `
    <section id="questions" class="companion-section companion-questions" aria-labelledby="questions-title">
      ${companionSectionHeading('读完以后慢慢聊', '一起聊一聊', 'questions-title')}
      <p class="section-intro">先从画面里的事实说起，再理解角色，最后留下自己的表达。参考内容默认收起。</p>
      ${book.questionGroups.map((group) => questionGroup(book, group)).join('')}
    </section>
  `;
}

function backgroundSection(book) {
  return `
    <section id="background" class="companion-section companion-discovery" aria-labelledby="background-title">
      ${companionSectionHeading('从故事走向更大的世界', '背景发现', 'background-title')}
      <div class="discovery-list">
        ${book.background.map((note) => `
          <article class="discovery-entry">
            <header>
              <h3>${html(note.title)}</h3>
              ${note.pageRange ? `<span class="page-range">绘本页 ${html(note.pageRange)}</span>` : ''}
            </header>
            <p>${html(note.note)}</p>
            ${ExplanationImages(book, note)}
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function encyclopediaSection(book) {
  return `
    <section id="encyclopedia" class="companion-section companion-encyclopedia" aria-labelledby="encyclopedia-title">
      ${companionSectionHeading('把画面里的知识讲清楚', '剧情百科', 'encyclopedia-title')}
      <div class="discovery-list">
        ${book.encyclopedia.map((entry) => `
          <article class="discovery-entry encyclopedia-entry">
            <header>
              <h3>${html(entry.title)}</h3>
              ${entry.pageRange ? `<span class="page-range">绘本页 ${html(entry.pageRange)}</span>` : ''}
            </header>
            <p class="discovery-summary">${html(entry.summary)}</p>
            <dl class="entry-facts">
              ${entry.facts.filter((fact) => fact.value).map((fact) => `
                <div>
                  <dt>${html(fact.label)}</dt>
                  <dd>${html(fact.value)}</dd>
                </div>
              `).join('')}
            </dl>
            ${ExplanationImages(book, entry)}
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function formatClock(value) {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const whole = Math.floor(value);
  const minutes = Math.floor(whole / 60);
  const seconds = String(whole % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function markerList(markers) {
  const reliableMarkers = Array.isArray(markers)
    ? markers.filter((marker) => Number.isFinite(Number(marker?.time)) && marker?.label)
    : [];

  if (reliableMarkers.length === 0) {
    return '<p class="audio-note">当前提供整本音频；没有可靠的分段时间线索，因此不显示跳转点。</p>';
  }

  return `
    <ol class="audio-marker-list" aria-label="音频章节跳转点">
      ${reliableMarkers.map((marker) => `
        <li>
          <button type="button" data-audio-marker="${Number(marker.time)}">
            <span>${html(formatClock(Number(marker.time)))}</span>
            ${html(marker.label)}
          </button>
        </li>
      `).join('')}
    </ol>
  `;
}

function audioSection(book) {
  const { audio } = book;

  if (!audio?.path) {
    return `
      <section id="audio" class="companion-section companion-audio" aria-labelledby="audio-title">
        ${companionSectionHeading('让故事换一种方式陪在身边', '听一听', 'audio-title')}
        <div class="audio-panel audio-panel-empty">
          <h3>${html(book.identity.title)}</h3>
          <p class="audio-note" role="status">这本书暂时没有可播放的音频，其他伴读内容仍可继续使用。</p>
        </div>
      </section>
    `;
  }

  const source = sitePath(audio.path);

  return `
    <section id="audio" class="companion-section companion-audio" aria-labelledby="audio-title">
      ${companionSectionHeading('让故事换一种方式陪在身边', '听一听', 'audio-title')}
      <div class="audio-panel" data-audio-phase="idle" aria-busy="false">
        <h3>${html(audio.title)}</h3>
        <p class="audio-note">按需要播放整本伴读音频；离开页面后不会保留播放位置。</p>
        <div class="audio-controls">
          <button class="audio-main-button" type="button" data-audio-play aria-controls="book-audio" aria-describedby="audio-message">播放音频</button>
          <div class="audio-time" aria-label="当前时间和总时长">
            <span data-audio-current-time>0:00</span>
            <span>/</span>
            <span data-audio-total-time>--:--</span>
          </div>
        </div>
        <input
          class="audio-seek"
          type="range"
          min="0"
          max="0"
          value="0"
          step="0.1"
          data-audio-seek
          aria-label="调整音频播放位置"
          aria-describedby="audio-message"
          disabled
        >
        <p class="audio-note" id="audio-message" role="status" aria-live="polite" aria-atomic="true">尚未加载音频。选择播放后才会请求文件。</p>
        <audio
          id="book-audio"
          controls
          preload="none"
          data-audio-src="${html(source)}"
          aria-describedby="audio-message"
        >
          当前浏览器不支持音频播放。
        </audio>
        ${markerList(audio.markers)}
      </div>
    </section>
  `;
}

function parentsSection(book) {
  const { parentGuide } = book;
  return `
    <section id="parents" class="companion-section companion-parents" aria-labelledby="parents-title">
      ${companionSectionHeading('把节奏留给孩子', '家长共读', 'parents-title')}
      <p>${html(parentGuide.readingUse)}</p>
      <div class="parent-guide-grid">
        <section>
          <h3>可以这样陪读</h3>
          <ol class="plain-list">${parentGuide.suggestedFlow.map((item) => `<li>${html(item)}</li>`).join('')}</ol>
        </section>
        <section>
          <h3>谈到这些内容时</h3>
          <ul class="plain-list">${parentGuide.sensitivePoints.map((item) => `<li>${html(item)}</li>`).join('')}</ul>
        </section>
      </div>
    </section>
  `;
}

function bookHero(book) {
  const { identity } = book;
  const audioAvailable = Boolean(book.audio.path);
  return `
    <section class="carmela-hero" aria-labelledby="book-hero-title">
      <div class="carmela-hero-cover cover-frame${identity.cover ? '' : ' cover-missing'}">
        ${identity.cover ? mediaResolver.picture(identity.cover, {
          role: 'carmela-book-cover',
          alt: `${identity.title}封面`,
          loading: 'eager',
          decoding: 'async',
          fetchPriority: 'high',
        }) : ''}
        <span class="cover-fallback">封面图片暂时无法显示</span>
      </div>
      <div class="carmela-hero-copy">
        <a class="back-link" href="#/series/${CARMELA_SERIES_SLUG}">返回不一样的卡梅拉</a>
        <p class="carmela-bookmark">${html(identity.seriesTitle)} · 第 ${identity.order} 册</p>
        <div class="carmela-meta" role="list" aria-label="资料类型">
          <span role="listitem">绘本伴读</span>
          <span role="listitem">${audioAvailable ? '含音频' : '文字资料'}</span>
        </div>
        <h1 id="book-hero-title" data-route-heading tabindex="-1">${html(identity.title)}</h1>
        <p class="carmela-hero-summary">${html(book.summary)}</p>
        <div class="carmela-hero-actions">
          <a class="action-button" href="#/book/${identity.slug}/overview">从故事总览开始</a>
          ${audioAvailable ? `<a class="ghost-button" href="#/book/${identity.slug}/audio">听音频</a>` : ''}
        </div>
      </div>
    </section>
  `;
}

function bookPage(book) {
  const companionBook = createCarmelaCompanionViewModel(book);
  return `
    <div class="companion-view companion-view--carmela">
      ${bookHero(companionBook)}
      <div class="companion-body">
        <aside class="companion-route-rail">
          <nav class="companion-nav" aria-label="这本书的伴读路线">
            <details data-companion-nav open>
              <summary>这本书的伴读路线</summary>
              <div>
                ${sectionNav.map(([id, label]) => `
                  <a href="#/book/${companionBook.identity.slug}/${id}" data-companion-nav-link="${id}">${label}</a>
                `).join('')}
              </div>
            </details>
          </nav>
        </aside>
        <div class="book-main companion-reading">
          ${overviewSection(companionBook)}
          ${reviewSection(companionBook)}
          ${scenesSection(companionBook)}
          ${questionsSection(companionBook)}
          ${backgroundSection(companionBook)}
          ${encyclopediaSection(companionBook)}
          ${audioSection(companionBook)}
          ${parentsSection(companionBook)}
        </div>
      </div>
    </div>
    ${ImageLightbox()}
  `;
}

function scienceTopicPage(_scienceSeries, topic) {
  const viewModel = createScienceTopicViewModel(topic);
  return renderScienceTopicAtlas(viewModel, {
    thumbnailPath: topic.thumbnailPath,
    mediaResolver,
  });
}

function errorPage(message, returnHref = '#/', returnLabel = '返回首页') {
  return `
    <section class="error-state" aria-labelledby="route-error-title">
      <p class="state-kicker">方向标暂时没有指向这里</p>
      <h1 id="route-error-title" data-route-heading tabindex="-1">没有找到这个伴读入口</h1>
      <p>${html(message)}</p>
      <a class="action-button" href="${html(returnHref)}">${html(returnLabel)}</a>
    </section>
  `;
}

function currentRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) {
    return { view: 'home' };
  }
  if (parts[0] === 'series') {
    return { view: 'series', seriesSlug: parts[1], target: parts[2], extra: parts.slice(3) };
  }
  if (parts[0] === 'book') {
    return { view: 'book', slug: parts[1], target: parts[2], extra: parts.slice(3) };
  }
  if (parts[0] === 'science') {
    return {
      view: 'science',
      seriesSlug: parts[1],
      slug: parts[2],
      target: parts[3],
      extra: parts.slice(4),
    };
  }
  return { view: 'invalid' };
}

function emptyRuntimeModel() {
  return {
    runtimeIndex: null,
    books: [],
    scienceSeries: null,
  };
}

function carmelaRuntimeModel(context) {
  const seriesTitle = context.catalog?.seriesTitle ?? context.series?.seriesTitle ?? '不一样的卡梅拉';
  const selectedBook = context.book
    ? {
        ...context.book,
        seriesTitle,
        cover: context.book.cover ?? context.summary?.cover ?? '',
      }
    : null;
  const books = context.books.map((book) => {
    if (selectedBook?.slug === book.slug) return selectedBook;
    return { ...book, seriesTitle };
  });

  return {
    runtimeIndex: context.index,
    series: context.catalog,
    books,
    scienceSeries: null,
  };
}

function workCellsRuntimeModel(context) {
  const selectedTopic = context.topic
    ? {
        ...context.topic,
        topicOverview: context.topic.topicOverview ?? context.topic.overview,
        recommendedBodyScienceStationFocus:
          context.topic.recommendedBodyScienceStationFocus
          ?? context.topic.overview?.recommendedBodyScienceStationFocus,
      }
    : null;
  const topics = context.topics.map((topic) => (
    selectedTopic?.slug === topic.slug ? { ...topic, ...selectedTopic } : topic
  ));
  return {
    runtimeIndex: context.index,
    books: [],
    scienceSeries: {
      ...context.series,
      seriesSlug: context.series.seriesSlug,
      manifest: {
        ...context.catalog,
        seriesTitle: context.catalog?.seriesTitle ?? context.series.seriesTitle,
        topics,
      },
    },
  };
}

function routeData(model, context = null) {
  return {
    model,
    mediaShard: context?.mediaShard ?? null,
  };
}

function routeLoadPlan(route) {
  const noContent = {
    key: `invalid:${location.hash}`,
    load: async () => routeData(emptyRuntimeModel()),
  };

  if (route.view === 'home') {
    return {
      key: 'home',
      load: async (options) => {
        const context = await contentLoader.loadHome(options);
        return routeData(
          { ...emptyRuntimeModel(), runtimeIndex: context.index },
          context,
        );
      },
    };
  }

  if (route.view === 'series') {
    if (!route.seriesSlug || route.extra.length) return noContent;
    if (route.seriesSlug === CARMELA_SERIES_SLUG) {
      return {
        key: `series:${CARMELA_SERIES_SLUG}`,
        load: async (options) => {
          const context = await contentLoader.loadCarmelaSeries(options);
          return routeData(carmelaRuntimeModel(context), context);
        },
      };
    }
    if (route.seriesSlug === WORK_CELLS_SERIES_SLUG) {
      return {
        key: `series:${WORK_CELLS_SERIES_SLUG}`,
        load: async (options) => {
          const context = await contentLoader.loadWorkCellsSeries(options);
          return routeData(workCellsRuntimeModel(context), context);
        },
      };
    }
    return noContent;
  }

  if (route.view === 'book') {
    if (!route.slug || route.extra.length) return noContent;
    const sectionIsInvalid = route.target && !sectionNav.some(([id]) => id === route.target);
    if (sectionIsInvalid) {
      return {
        key: `series:${CARMELA_SERIES_SLUG}`,
        load: async (options) => {
          const context = await contentLoader.loadCarmelaSeries(options);
          return routeData(carmelaRuntimeModel(context), context);
        },
      };
    }
    return {
      key: `book:${route.slug}`,
      load: async (options) => {
        const context = await contentLoader.loadCarmelaBook(route.slug, options);
        return routeData(carmelaRuntimeModel(context), context);
      },
    };
  }

  if (route.view === 'science') {
    if (
      !route.seriesSlug
      || route.seriesSlug !== WORK_CELLS_SERIES_SLUG
      || !route.slug
      || route.extra.length
    ) return noContent;
    const sectionIsInvalid = route.target && !scienceSectionNav.some(([id]) => id === route.target);
    if (sectionIsInvalid) {
      return {
        key: `series:${WORK_CELLS_SERIES_SLUG}`,
        load: async (options) => {
          const context = await contentLoader.loadWorkCellsSeries(options);
          return routeData(workCellsRuntimeModel(context), context);
        },
      };
    }
    return {
      key: `science:${WORK_CELLS_SERIES_SLUG}:${route.slug}`,
      load: async (options) => {
        const context = await contentLoader.loadWorkCellsTopic(route.slug, options);
        return routeData(workCellsRuntimeModel(context), context);
      },
    };
  }

  return noContent;
}

function wireCoverFallbacks(signal) {
  const selector = [
    '.series-entry-cover img',
    '.cover-frame img',
    '.topic-thumbnail img',
    '.thumb-row img',
    '.page-thumbnail img',
  ].join(',');

  const showFallback = (image) => {
    image.hidden = true;
    image.closest('.series-entry-cover')?.classList.add('cover-missing');
    image.closest('.cover-frame')?.classList.add('cover-missing');
    image.closest('.topic-thumbnail')?.classList.add('thumbnail-missing');
    image.closest('.page-thumbnail')?.classList.add('thumbnail-missing');
  };

  document.addEventListener('error', (event) => {
    if (event.target instanceof HTMLImageElement && event.target.matches(selector)) {
      showFallback(event.target);
    }
  }, { capture: true, signal });

  document.querySelectorAll(selector).forEach((image) => {
    if (image.complete && image.naturalWidth === 0) showFallback(image);
  });
}

function wireLightbox() {
  const lightbox = document.querySelector('[data-lightbox]');
  return wireImageLightbox(lightbox, document);
}

function wireEvidenceDisclosures(signal) {
  const disclosures = [...document.querySelectorAll('[data-media-disclosure]')];

  function mount(disclosure) {
    if (!disclosure.open || disclosure.dataset.mediaMounted === 'true') return;
    if (matchMedia('print').matches) return;
    const template = disclosure.querySelector(':scope > [data-media-template]');
    const target = disclosure.querySelector(':scope > [data-media-mount]');
    if (!template || !target) return;
    target.append(template.content.cloneNode(true));
    disclosure.dataset.mediaMounted = 'true';
  }

  disclosures.forEach((disclosure) => {
    disclosure.addEventListener('toggle', () => mount(disclosure), { signal });
    mount(disclosure);
  });

  return () => {
    disclosures.forEach((disclosure) => {
      const mount = disclosure.querySelector('[data-media-mount]');
      clearResponsiveImageCandidates(mount);
      mount?.replaceChildren();
      delete disclosure.dataset.mediaMounted;
    });
  };
}

function wireAnswers(signal) {
  document.querySelectorAll('[data-answer-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const answer = document.getElementById(button.dataset.answerToggle);
      if (!answer) return;
      const willShow = answer.hidden;
      answer.hidden = !willShow;
      button.setAttribute('aria-expanded', String(willShow));
      button.textContent = willShow
        ? button.dataset.labelExpanded
        : button.dataset.labelCollapsed;
    }, { signal });
  });
}

function wireAudio(signal) {
  const audio = document.querySelector('#book-audio');
  const panel = audio?.closest('[data-audio-phase]');
  const button = document.querySelector('[data-audio-play]');
  const seek = document.querySelector('[data-audio-seek]');
  const currentTime = document.querySelector('[data-audio-current-time]');
  const totalTime = document.querySelector('[data-audio-total-time]');
  const message = document.querySelector('#audio-message');
  if (!audio || !panel || !button) return () => {};

  const sourcePath = audio.dataset.audioSrc;
  let phase = 'idle';
  let sourceAttached = false;
  let tearingDown = false;

  function audioTotal() {
    const value = Reflect.get(audio, ['dur', 'ation'].join(''));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function canSeek() {
    return audioTotal() > 0 && ['ready', 'playing', 'paused', 'ended'].includes(phase);
  }

  function syncDisplay() {
    const total = audioTotal();
    const rawCurrent = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const safeCurrent = total > 0 ? Math.min(Math.max(rawCurrent, 0), total) : 0;
    if (currentTime) currentTime.textContent = formatClock(safeCurrent);
    if (totalTime) totalTime.textContent = total ? formatClock(total) : '--:--';
    if (seek) {
      seek.max = String(total || 0);
      seek.value = String(safeCurrent);
      seek.disabled = !canSeek();
    }
  }

  const phaseCopy = {
    idle: ['播放音频', '尚未加载音频。选择播放后才会请求文件。'],
    loading: ['正在加载…', '正在加载音频，请稍候。'],
    ready: ['播放音频', '音频已就绪，可以播放或调整位置。'],
    playing: ['暂停音频', '正在播放。'],
    paused: ['继续播放', '已暂停。'],
    ended: ['重新播放', '播放结束，可以重新播放。'],
    error: ['重试音频', '音频暂时无法加载。可以重试，页面其余内容仍可使用。'],
  };

  function setPhase(nextPhase, copy = '') {
    phase = nextPhase;
    panel.dataset.audioPhase = nextPhase;
    panel.setAttribute('aria-busy', String(nextPhase === 'loading'));
    button.textContent = phaseCopy[nextPhase][0];
    button.disabled = false;
    if (message) message.textContent = copy || phaseCopy[nextPhase][1];
    syncDisplay();
  }

  function detachSource() {
    audio.pause();
    audio.removeAttribute('src');
    sourceAttached = false;
    audio.load();
  }

  function attachSource({ retry = false } = {}) {
    if (!sourcePath) {
      setPhase('error', '音频路径暂时不可用，页面其余内容仍可使用。');
      return false;
    }
    if (retry && sourceAttached) detachSource();
    if (sourceAttached) return true;
    setPhase('loading');
    audio.src = sourcePath;
    sourceAttached = true;
    audio.load();
    return true;
  }

  async function requestPlay() {
    const retry = phase === 'error';
    if (!attachSource({ retry })) return;
    if (phase === 'ended') audio.currentTime = 0;
    try {
      await audio.play();
    } catch (error) {
      if (!tearingDown && error?.name !== 'AbortError') setPhase('error');
    }
  }

  button.addEventListener('click', () => {
    if (!audio.paused && ['loading', 'ready', 'playing'].includes(phase)) {
      audio.pause();
      return;
    }
    requestPlay();
  }, { signal });

  const primeNativeControls = () => {
    attachSource({ retry: phase === 'error' });
  };
  audio.addEventListener('pointerdown', primeNativeControls, { signal });
  audio.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') primeNativeControls();
  }, { signal });

  audio.addEventListener('loadedmetadata', () => {
    if (phase === 'loading') setPhase('ready');
    else syncDisplay();
  }, { signal });
  audio.addEventListener('canplay', () => {
    if (audio.paused && phase === 'loading') setPhase('ready');
  }, { signal });
  audio.addEventListener('timeupdate', syncDisplay, { signal });
  audio.addEventListener('playing', () => setPhase('playing'), { signal });
  audio.addEventListener('pause', () => {
    if (sourceAttached && !['idle', 'error', 'ended', 'paused'].includes(phase) && !audio.ended) {
      setPhase('paused');
    }
  }, { signal });
  audio.addEventListener('ended', () => setPhase('ended'), { signal });

  seek?.addEventListener('input', () => {
    const total = audioTotal();
    const nextTime = Number(seek.value);
    if (!total || !Number.isFinite(nextTime)) return;
    audio.currentTime = Math.min(Math.max(nextTime, 0), total);
    syncDisplay();
  }, { signal });

  document.querySelectorAll('[data-audio-marker]').forEach((markerButton) => {
    markerButton.addEventListener('click', () => {
      const requestedTime = Number(markerButton.dataset.audioMarker);
      if (!Number.isFinite(requestedTime) || !attachSource({ retry: phase === 'error' })) return;
      const applyMarker = () => {
        const total = audioTotal();
        if (!total) return;
        audio.currentTime = Math.min(Math.max(requestedTime, 0), total);
        syncDisplay();
      };
      if (audioTotal()) applyMarker();
      else audio.addEventListener('loadedmetadata', applyMarker, { once: true, signal });
    }, { signal });
  });

  function handleAudioError() {
    if (tearingDown) return;
    audio.pause();
    setPhase('error');
  }

  audio.addEventListener('error', handleAudioError, { signal });

  setPhase('idle');
  return () => {
    tearingDown = true;
    detachSource();
    if (seek) {
      seek.value = '0';
      seek.max = '0';
      seek.disabled = true;
    }
  };
}

function wireReturnContext(signal) {
  document.querySelectorAll('[data-return-series][data-return-section]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) {
        return;
      }
      const { returnSeries, returnSection } = link.dataset;
      history.replaceState(history.state, '', `#/series/${returnSeries}/${returnSection}`);
    }, { signal });
  });
}

function wireCategoryNavigation(signal) {
  const categoryNavigation = document.querySelector('[data-category-nav]');
  if (!categoryNavigation) return;
  const compactNavigation = matchMedia('(max-width: 680px)');
  const syncOpenState = () => {
    categoryNavigation.open = !compactNavigation.matches;
  };
  syncOpenState();
  compactNavigation.addEventListener('change', syncOpenState, { signal });
}

function wireCompanionNavigation(signal) {
  const companionNavigation = document.querySelector('[data-companion-nav]');
  if (!companionNavigation) return;
  const compactNavigation = matchMedia('(max-width: 680px)');
  const syncOpenState = () => {
    companionNavigation.open = !compactNavigation.matches;
  };
  syncOpenState();
  compactNavigation.addEventListener('change', syncOpenState, { signal });
}

function updateCompanionNavCurrent(target) {
  document.querySelectorAll('[data-companion-nav-link]').forEach((link) => {
    if (link.dataset.companionNavLink === target) {
      link.setAttribute('aria-current', 'location');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function afterRender() {
  const controller = new AbortController();
  const { signal } = controller;
  wireCoverFallbacks(signal);
  wireAnswers(signal);
  wireReturnContext(signal);
  wireCategoryNavigation(signal);
  wireCompanionNavigation(signal);
  const cleanupEvidenceDisclosures = wireEvidenceDisclosures(signal);
  const cleanupAudio = wireAudio(signal);
  const cleanupLightbox = wireLightbox();
  return () => {
    controller.abort();
    cleanupEvidenceDisclosures();
    cleanupAudio();
    cleanupLightbox();
  };
}

function invalidRoute(message, returnHref = '#/', returnLabel = '返回首页') {
  return {
    valid: false,
    view: 'error',
    pageKey: `error:${location.hash}`,
    title: '页面未找到',
    breadcrumbs: [{ label: '首页', href: '#/' }, { label: '页面未找到' }],
    markup: errorPage(message, returnHref, returnLabel),
  };
}

function resolveRoute(route) {
  if (route.view === 'home') {
    return {
      valid: true,
      view: 'home',
      pageKey: 'home',
      title: '选择阅读主题',
      breadcrumbs: [],
      markup: homePage(),
    };
  }

  if (route.view === 'series') {
    if (!route.seriesSlug || route.extra.length) {
      return invalidRoute('这个系列入口不完整，请从首页重新选择。');
    }
    if (route.seriesSlug === CARMELA_SERIES_SLUG) {
      const bookNumber = Number(route.target?.match(/^book-(\d+)$/)?.[1] ?? 0);
      const canonicalBookTarget = bookNumber
        ? `book-${bookNumber}`
        : '';
      const bookTargetExists = model.books.some((book) => book.order === bookNumber);
      if (
        route.target
        && (
          !bookNumber
          || route.target !== canonicalBookTarget
          || !bookTargetExists
        )
      ) {
        return invalidRoute(
          '这个绘本书架中没有对应的分区。',
          `#/series/${CARMELA_SERIES_SLUG}`,
          '返回绘本书架',
        );
      }
      return {
        valid: true,
        view: 'series',
        domain: 'carmela',
        target: route.target,
        pageKey: `series:${CARMELA_SERIES_SLUG}`,
        title: '不一样的卡梅拉',
        breadcrumbs: [{ label: '首页', href: '#/' }, { label: '不一样的卡梅拉' }],
        markup: carmelaSeriesPage(),
      };
    }
    if (route.seriesSlug === WORK_CELLS_SERIES_SLUG) {
      const groupCount = groupScienceTopics(model.scienceSeries?.manifest?.topics ?? []).length;
      const categoryNumber = Number(route.target?.match(/^category-(\d+)$/)?.[1] ?? 0);
      const canonicalCategoryTarget = categoryNumber
        ? `category-${categoryNumber}`
        : '';
      if (
        route.target
        && (
          !categoryNumber
          || route.target !== canonicalCategoryTarget
          || categoryNumber > groupCount
        )
      ) {
        return invalidRoute(
          '这个科学主题类别不存在。',
          `#/series/${WORK_CELLS_SERIES_SLUG}`,
          '返回科学主题馆',
        );
      }
      return {
        valid: true,
        view: 'series',
        domain: 'science',
        target: route.target,
        pageKey: `series:${WORK_CELLS_SERIES_SLUG}`,
        title: model.scienceSeries?.manifest?.seriesTitle ?? '工作细胞',
        breadcrumbs: [{ label: '首页', href: '#/' }, { label: '工作细胞' }],
        markup: scienceSeriesPage(model.scienceSeries),
      };
    }
    return invalidRoute('没有找到这个阅读系列。');
  }

  if (route.view === 'book') {
    if (!route.slug || route.extra.length) {
      return invalidRoute('这个绘本伴读入口不完整，请从绘本书架重新选择。');
    }
    const book = model.books.find((item) => item.slug === route.slug);
    if (!book) {
      return invalidRoute(
        '没有找到这本书的伴读资料。',
        `#/series/${CARMELA_SERIES_SLUG}`,
        '返回绘本书架',
      );
    }
    if (route.target && !sectionNav.some(([id]) => id === route.target)) {
      return invalidRoute(
        '这本书的伴读资料中没有对应的内容段落。',
        `#/book/${book.slug}`,
        `返回《${book.title}》`,
      );
    }
    return {
      valid: true,
      view: 'book',
      domain: 'carmela',
      target: route.target,
      pageKey: `book:${book.slug}`,
      title: book.title,
      breadcrumbs: [
        { label: '首页', href: '#/' },
        { label: '不一样的卡梅拉', href: `#/series/${CARMELA_SERIES_SLUG}` },
        { label: book.title },
      ],
      markup: bookPage(book),
    };
  }

  if (route.view === 'science') {
    if (!route.seriesSlug || !route.slug || route.extra.length) {
      return invalidRoute('这个科学伴读入口不完整，请从科学主题馆重新选择。');
    }
    if (route.seriesSlug !== WORK_CELLS_SERIES_SLUG) {
      return invalidRoute('没有找到这个科学伴读系列。');
    }
    const scienceSeries = model.scienceSeries;
    const topic = scienceSeries?.manifest?.topics?.find((item) => item.slug === route.slug);
    if (!topic) {
      return invalidRoute(
        '没有找到这个科学主题的伴读资料。',
        `#/series/${WORK_CELLS_SERIES_SLUG}`,
        '返回科学主题馆',
      );
    }
    if (route.target && !scienceSectionNav.some(([id]) => id === route.target)) {
      return invalidRoute(
        '这个科学主题中没有对应的内容段落。',
        `#/science/${WORK_CELLS_SERIES_SLUG}/${topic.slug}`,
        `返回“${topic.displayTitle}”`,
      );
    }
    return {
      valid: true,
      view: 'science',
      domain: 'science',
      target: route.target,
      pageKey: `science:${scienceSeries.seriesSlug}:${topic.slug}`,
      title: topic.displayTitle,
      breadcrumbs: [
        { label: '首页', href: '#/' },
        { label: '工作细胞', href: `#/series/${WORK_CELLS_SERIES_SLUG}` },
        { label: topic.displayTitle },
      ],
      markup: scienceTopicPage(scienceSeries, topic),
    };
  }

  return invalidRoute('这个地址没有对应的伴读入口。');
}

function updateBreadcrumb(items) {
  if (!items.length) {
    breadcrumb.hidden = true;
    breadcrumb.replaceChildren();
    return;
  }
  breadcrumb.hidden = false;
  breadcrumb.innerHTML = `
    <ol>
      ${items.map((item, index) => {
        const isCurrent = index === items.length - 1;
        return `<li>${
          isCurrent
            ? `<span aria-current="page">${html(item.label)}</span>`
            : `<a href="${html(item.href)}">${html(item.label)}</a>`
        }</li>`;
      }).join('')}
    </ol>
  `;
}

function focusRoute(route) {
  requestAnimationFrame(() => {
    let focusTarget = null;
    if (route.target) {
      const section = document.getElementById(route.target);
      focusTarget = section?.matches('h1, h2, h3')
        ? section
        : section?.querySelector('h1, h2, h3') ?? section;
    } else {
      focusTarget = document.querySelector('[data-route-heading]');
    }

    if (focusTarget) {
      if (!focusTarget.hasAttribute('tabindex')) {
        focusTarget.setAttribute('tabindex', '-1');
      }
      focusTarget.focus({ preventScroll: true });
      if (route.target) {
        focusTarget.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    }

    routeAnnouncer.textContent = '';
    requestAnimationFrame(() => {
      routeAnnouncer.textContent = route.target && focusTarget
        ? `已到达：${focusTarget.textContent.trim()}`
        : `已打开：${route.title}`;
    });
  });
}

function renderRoute(routeInput = currentRoute()) {
  const route = resolveRoute(routeInput);
  document.title = `${route.title} | 温暖伴读图册`;
  updateBreadcrumb(route.breadcrumbs);

  if (route.valid && route.pageKey === currentPageKey) {
    document.querySelector('[data-lightbox]:not([hidden]) [data-lightbox-close-button]')?.click();
    updateCompanionNavCurrent(route.target);
    focusRoute(route);
    return;
  }

  cleanupView();
  cleanupView = () => {};
  currentPageKey = route.pageKey;
  main.dataset.view = route.view;
  if (route.domain) {
    main.dataset.domain = route.domain;
  } else {
    delete main.dataset.domain;
  }
  app.innerHTML = route.markup;
  app.setAttribute('aria-busy', 'false');
  cleanupView = afterRender();
  updateCompanionNavCurrent(route.target);
  focusRoute(route);
}

let routerStarted = false;

function showRouteLoading(route) {
  cleanupView();
  cleanupView = () => {};
  currentPageKey = `loading:${location.hash}`;
  updateBreadcrumb([]);
  main.dataset.view = 'loading';
  delete main.dataset.domain;
  app.setAttribute('aria-busy', 'true');
  app.innerHTML = `
    <section class="loading-state" aria-labelledby="route-loading-title" role="status" aria-live="polite">
      <span class="loading-mark" aria-hidden="true"></span>
      <h1 id="route-loading-title">正在准备这页伴读资料</h1>
      <p>${route.view === 'book' || route.view === 'science' ? '正在打开选中的内容。' : '正在打开书架和主题入口。'}</p>
    </section>
  `;
  routeAnnouncer.textContent = '正在准备伴读资料';
}

function showLoadError(route, error) {
  cleanupView();
  cleanupView = () => {};
  currentPageKey = `load-error:${location.hash}`;
  document.title = '资料载入失败 | 温暖伴读图册';
  updateBreadcrumb([{ label: '首页', href: '#/' }, { label: '资料载入失败' }]);
  main.dataset.view = 'error';
  delete main.dataset.domain;
  app.setAttribute('aria-busy', 'false');
  const isDetail = route.view === 'book' || route.view === 'science';
  const heading = route.view === 'book'
    ? '这本书的伴读资料暂时没有打开'
    : route.view === 'science'
      ? '这个科学主题暂时没有打开'
      : route.view === 'series'
        ? '这个伴读入口暂时没有打开'
        : '伴读资料载入失败';
  app.innerHTML = `
    <section class="error-state" aria-labelledby="load-error-title">
      <p class="state-kicker">${isDetail ? '当前内容暂时没有准备好' : '书架暂时没有准备好'}</p>
      <h1 id="load-error-title" data-route-heading tabindex="-1">${heading}</h1>
      <p>请检查网络连接后重试；其他系列和主题仍可单独打开。页面不会显示内部文件位置。</p>
      <div class="state-actions">
        <button class="action-button" type="button" data-retry>重新载入</button>
        <a class="ghost-button" href="#/">返回首页</a>
      </div>
    </section>
  `;
  const retry = document.querySelector('[data-retry]');
  const handleRetry = () => navigate();
  retry?.addEventListener('click', handleRetry);
  cleanupView = () => retry?.removeEventListener('click', handleRetry);
  console.error('Route content load failed.', {
    view: route.view,
    seriesSlug: route.seriesSlug,
    slug: route.slug,
    message: error?.message ?? 'Unknown load failure',
  });
  focusRoute({ title: heading });
}

async function navigate() {
  const generation = ++navigationGeneration;
  navigationController?.abort();
  navigationController = null;
  const route = currentRoute();
  const plan = routeLoadPlan(route);

  if (plan.key === currentDataKey) {
    renderRoute(route);
    return;
  }

  if (routeModelCache.has(plan.key)) {
    const cached = routeModelCache.get(plan.key);
    model = cached.model;
    mediaResolver = createMediaResolver(cached.mediaShard, { sitePath });
    currentDataKey = plan.key;
    renderRoute(route);
    return;
  }

  const controller = new AbortController();
  navigationController = controller;
  showRouteLoading(route);
  try {
    const next = await plan.load({ signal: controller.signal });
    if (controller.signal.aborted || generation !== navigationGeneration) return;
    if (next.mediaShard !== null) routeModelCache.set(plan.key, next);
    model = next.model;
    mediaResolver = createMediaResolver(next.mediaShard, { sitePath });
    currentDataKey = plan.key;
    navigationController = null;
    renderRoute(route);
  } catch (error) {
    if (error?.name === 'AbortError' || generation !== navigationGeneration) return;
    navigationController = null;
    showLoadError(route, error);
  }
}

function start() {
  if (!routerStarted) {
    window.addEventListener('hashchange', () => navigate());
    routerStarted = true;
  }
  navigate();
}

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

skipLink?.addEventListener('click', (event) => {
  event.preventDefault();
  const skipTarget = document.querySelector('[data-route-heading]') ?? main;
  skipTarget.focus({ preventScroll: true });
  skipTarget.scrollIntoView({ block: 'start', behavior: 'instant' });
});

start();
