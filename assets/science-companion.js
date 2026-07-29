import { responsiveMediaFallback } from './media-resolver.js?v=fr-maint-single-tier-20260729';

const WORK_CELLS_SERIES_SLUG = 'work-cells';

const QUESTION_GROUPS = [
  ['observation', '观察画面', '先从漫画里的角色、位置和变化找线索。'],
  ['understanding', '理解身体机制', '把漫画表现转回身体里真实发生的过程。'],
  ['life-connection', '联系生活', '把科学概念和日常卫生、健康习惯联系起来。'],
  ['science-concept', '说清科学概念', '尝试用自己的话解释关键生物概念。'],
].map(([key, label, purpose]) => ({ key, label, purpose }));

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const list = (value) => (Array.isArray(value) ? value : []);
const textList = (value) => list(value).map(text).filter(Boolean);

function html(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function lightboxDataAttributes(mediaResolver, sourcePath, role) {
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

function safeId(value) {
  return text(value)
    .normalize('NFKD')
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'science-item';
}

function registerMedia(state, { path, kind, alt, label, use }) {
  const canonicalPath = text(path).replace(/^\.?\//, '');
  if (!canonicalPath) return null;
  let media = state.byPath.get(canonicalPath);
  if (!media) {
    const id = `science-media-${String(state.next).padStart(3, '0')}`;
    state.next += 1;
    media = {
      id,
      kind,
      path: canonicalPath,
      alt: text(alt) || text(label) || '科学主题图片',
      label: text(label) || text(alt) || '科学主题图片',
      uses: [],
    };
    state.byPath.set(canonicalPath, media);
    state.registry[id] = media;
  }
  if (use) media.uses.push(use);
  return media.id;
}

function registerGroup(state, { id, label, kind, mediaIds, ownerId, section }) {
  const seen = new Set();
  const ordered = mediaIds.filter(Boolean).filter((mediaId) => {
    if (seen.has(mediaId)) return false;
    seen.add(mediaId);
    return true;
  });
  if (!ordered.length) return null;
  state.groups[id] = { id, label, kind, mediaIds: ordered, ownerId, section };
  return id;
}

function pageMedia(topic, pageId, state, use) {
  const page = topic.pageRefs?.[pageId];
  if (!page) return null;
  return registerMedia(state, {
    path: page.imagePath,
    kind: 'manga-page',
    alt: page.label || `${topic.displayTitle || topic.title} 漫画页面`,
    label: page.label || pageId,
    use,
  });
}

function stationView(topic, station, index, state) {
  const id = safeId(station.stationId || `${topic.slug}-station-${index + 1}`);
  const illustrationId = registerMedia(state, {
    path: station.imageAsset,
    kind: 'station-illustration',
    alt: station.imageAlt || station.title,
    label: `${station.title}解释图`,
    use: { section: 'science-station', ownerId: id, role: 'illustration' },
  });
  const illustrationMediaGroupId = registerGroup(state, {
    id: `science-group-${id}-illustration`,
    label: `${station.title}科学解释图`,
    kind: 'station-illustration',
    mediaIds: [illustrationId],
    ownerId: id,
    section: 'science-station',
  });
  const mangaMediaGroupId = registerGroup(state, {
    id: `science-group-${id}-manga`,
    label: `${station.title}关联漫画页面`,
    kind: 'manga-page',
    mediaIds: textList(station.relatedPageIds).map((pageId) => pageMedia(topic, pageId, state, {
      section: 'science-station', ownerId: id, role: 'manga-evidence',
    })),
    ownerId: id,
    section: 'science-station',
  });
  return {
    sequence: index + 1,
    id,
    title: text(station.title),
    coreQuestion: text(station.coreQuestion),
    explanation: text(station.explanation),
    biologyConcepts: textList(station.biologyConcepts),
    encyclopediaTags: textList(station.encyclopediaTags),
    parentNote: text(station.parentNote),
    illustrationMediaGroupId,
    mangaMediaGroupId,
  };
}

function questionView(topic, card, index, state) {
  const id = safeId(card.cardId || `${topic.slug}-question-${index + 1}`);
  const type = QUESTION_GROUPS.some((group) => group.key === text(card.type)) ? text(card.type) : 'other';
  const mangaMediaGroupId = registerGroup(state, {
    id: `science-group-${id}-manga`,
    label: `${card.title || `问题 ${index + 1}`}关联漫画页面`,
    kind: 'manga-page',
    mediaIds: textList(card.relatedPageIds).map((pageId) => pageMedia(topic, pageId, state, {
      section: 'science-questions', ownerId: id, role: 'manga-evidence',
    })),
    ownerId: id,
    section: 'science-questions',
  });
  return {
    sequence: index + 1,
    id,
    type,
    category: text(card.category),
    title: text(card.title),
    question: text(card.question),
    answer: text(card.answer),
    parentHint: text(card.parentHint),
    biologyConcepts: textList(card.biologyConcepts),
    mangaMediaGroupId,
    toggleId: `science-answer-toggle-${id}`,
    answerId: `science-answer-${id}`,
  };
}

function questionGroups(questions) {
  const groups = QUESTION_GROUPS.map((definition) => ({
    ...definition,
    questions: questions.filter((question) => question.type === definition.key),
  })).filter((group) => group.questions.length);
  const other = questions.filter((question) => question.type === 'other');
  if (other.length) groups.push({
    key: 'other', label: '继续讨论', purpose: '保留原资料中的其他问题类型，一起慢慢讨论。', questions: other,
  });
  return groups;
}

export function createScienceTopicViewModel(topic = {}) {
  const state = { byPath: new Map(), registry: {}, groups: {}, next: 1 };
  const source = topic.overview ?? topic.topicOverview ?? {};
  const stations = list(topic.bodyScienceStations).map((station, index) => stationView(topic, station, index, state));
  const questions = list(topic.parentQuestionCards).map((card, index) => questionView(topic, card, index, state));
  return {
    identity: {
      order: Number.isFinite(Number(topic.order)) ? Number(topic.order) : 0,
      topicId: text(topic.topicId),
      slug: text(topic.slug),
      title: text(topic.displayTitle) || text(topic.title),
      category: text(topic.category) || '科学主题',
      sourceLabel: text(topic.source?.sourceLabel) || text(topic.sourceLabel) || '来源信息暂缺',
      hasAudio: false,
    },
    overview: {
      summary: text(source.summary) || text(topic.topicSummary),
      readingFocus: text(source.readingFocus),
      keyBiologyConcepts: textList(source.keyBiologyConcepts ?? topic.keyBiologyConcepts),
      recommendedFocus: text(source.recommendedBodyScienceStationFocus ?? topic.recommendedBodyScienceStationFocus),
    },
    stations,
    questionGroups: questionGroups(questions),
    parentGuidance: [text(topic.parentReadingNote), text(topic.sensitiveContentGuidance)]
      .filter((item, index, items) => item && items.indexOf(item) === index),
    sourceNotes: textList(topic.sourceNotes),
    mediaRegistry: state.registry,
    mediaGroups: state.groups,
    counts: {
      stations: stations.length,
      questions: questions.length,
      media: Object.keys(state.registry).length,
      groups: Object.keys(state.groups).length,
    },
  };
}

function tags(items, label = '核心概念') {
  if (!items.length) return '';
  return `<ul class="science-atlas-tags" aria-label="${html(label)}">${items.map((item) => `<li>${html(item)}</li>`).join('')}</ul>`;
}

function mediaThumbnail(model, mediaId, group, index, mediaResolver) {
  const media = model.mediaRegistry[mediaId];
  if (!media) return '';
  const position = `第 ${index + 1} 张，共 ${group.mediaIds.length} 张`;
  const previewRole = media.kind === 'station-illustration'
    ? 'work-cells-station-preview'
    : 'work-cells-manga-preview';
  const lightboxAttributes = lightboxDataAttributes(
    mediaResolver,
    media.path,
    'work-cells-lightbox',
  );
  return `
    <button class="page-thumbnail science-media-thumbnail media-kind-${html(media.kind)}" type="button"
      ${lightboxAttributes} data-lightbox-alt="${html(media.alt)}"
      data-lightbox-group="${html(group.id)}" data-media-id="${html(media.id)}"
      aria-label="放大查看${html(media.label)}，${html(position)}">
      ${mediaResolver.picture(media.path, {
        role: previewRole,
        alt: media.alt,
        loading: 'lazy',
        decoding: 'async',
      })}
      <span>${html(media.label)}</span>
    </button>`;
}

function mediaDisclosure(model, groupId, summary, mediaResolver) {
  const group = model.mediaGroups[groupId];
  if (!group?.mediaIds?.length) return '';
  return `
    <details class="evidence-disclosure science-media-disclosure" data-media-disclosure data-media-group-id="${html(group.id)}">
      <summary>${html(summary)} <span aria-hidden="true">(${group.mediaIds.length})</span></summary>
      <div class="media-group-mount" data-media-mount aria-label="${html(group.label)}"></div>
      <template data-media-template><div class="page-thumbnail-list science-media-grid">
        ${group.mediaIds.map((mediaId, index) => mediaThumbnail(model, mediaId, group, index, mediaResolver)).join('')}
      </div></template>
    </details>`;
}

function hero(model, thumbnailPath, mediaResolver) {
  const { identity, overview } = model;
  return `
    <section class="science-atlas-hero" aria-labelledby="science-atlas-title">
      <div class="science-atlas-hero-media topic-thumbnail${thumbnailPath ? '' : ' thumbnail-missing'}">
        ${thumbnailPath ? mediaResolver.picture(thumbnailPath, {
          role: 'work-cells-topic-hero',
          alt: `${identity.title}主题缩略图`,
          loading: 'eager',
          decoding: 'async',
          fetchPriority: 'high',
        }) : ''}
        <span class="cover-fallback">主题图片暂时无法显示</span>
      </div>
      <div class="science-atlas-hero-copy">
        <a class="back-link" href="#/series/${WORK_CELLS_SERIES_SLUG}">返回工作细胞</a>
        <p class="science-atlas-eyebrow">${html(identity.category)} · ${html(identity.sourceLabel)}</p>
        <h1 id="science-atlas-title" data-route-heading tabindex="-1">${html(identity.title)}</h1>
        <p class="science-atlas-summary">${html(overview.summary)}</p>
        ${overview.readingFocus ? `<p class="science-reading-focus"><strong>阅读时重点：</strong>${html(overview.readingFocus)}</p>` : ''}
        ${tags(overview.keyBiologyConcepts.slice(0, 8))}
        <div class="science-atlas-actions">
          <a class="action-button" href="#/science/${WORK_CELLS_SERIES_SLUG}/${html(identity.slug)}/science-overview">先认识这个主题</a>
          <a class="ghost-button" href="#/science/${WORK_CELLS_SERIES_SLUG}/${html(identity.slug)}/science-station">进入身体科学小站</a>
        </div>
      </div>
    </section>`;
}

function navigation(model) {
  const prefix = `#/science/${WORK_CELLS_SERIES_SLUG}/${html(model.identity.slug)}/`;
  return `
    <aside class="companion-route-rail science-route-rail">
      <nav class="companion-nav science-atlas-nav" aria-label="这个科学主题的伴读路线">
        <details data-companion-nav open><summary>这个科学主题的伴读路线</summary><div>
          <a href="${prefix}science-overview" data-companion-nav-link="science-overview">先认识这个主题</a>
          <a href="${prefix}science-station" data-companion-nav-link="science-station">身体科学小站</a>
          <a href="${prefix}science-questions" data-companion-nav-link="science-questions">一起聊一聊</a>
          <a href="${prefix}science-parent-guidance" data-companion-nav-link="science-parent-guidance">家长共读</a>
          <a href="${prefix}source" data-companion-nav-link="source">来源线索</a>
        </div></details>
      </nav>
    </aside>`;
}

function heading(kicker, title, id) {
  return `<header class="companion-section-heading"><p>${html(kicker)}</p><h2 id="${html(id)}">${html(title)}</h2></header>`;
}

function overview(model) {
  const data = model.overview;
  return `
    <section id="science-overview" class="science-atlas-section science-atlas-overview" aria-labelledby="science-overview-title">
      ${heading('先把漫画线索转回身体机制', '先认识这个主题', 'science-overview-title')}
      <p class="companion-lede">${html(data.summary)}</p>
      <div class="science-overview-grid">
        ${data.readingFocus ? `<section><h3>阅读时重点看什么</h3><p>${html(data.readingFocus)}</p></section>` : ''}
        <section><h3>核心生物概念</h3>${tags(data.keyBiologyConcepts)}</section>
      </div>
      ${data.recommendedFocus ? `<article class="science-focus-note"><h3>接下来可以怎样理解</h3><p>${html(data.recommendedFocus)}</p></article>` : ''}
    </section>`;
}

function station(model, item, mediaResolver) {
  const concepts = [...item.biologyConcepts, ...item.encyclopediaTags]
    .filter((value, index, items) => items.indexOf(value) === index);
  return `
    <li class="science-station-route-item">
      <span class="science-station-number" aria-hidden="true">${item.sequence}</span>
      <article class="science-atlas-station" aria-labelledby="science-station-${html(item.id)}-title">
        <header><p>第 ${item.sequence} 个理解角度</p><h3 id="science-station-${html(item.id)}-title">${html(item.title)}</h3></header>
        <p class="science-core-question">${html(item.coreQuestion)}</p>
        <p class="science-explanation">${html(item.explanation)}</p>
        ${tags(concepts)}
        ${item.parentNote ? `<aside class="science-parent-note"><h4>给家长的讲法</h4><p>${html(item.parentNote)}</p></aside>` : ''}
        <div class="science-station-media-actions">
          ${mediaDisclosure(model, item.illustrationMediaGroupId, '查看科学解释图', mediaResolver)}
          ${mediaDisclosure(model, item.mangaMediaGroupId, '查看关联漫画页面', mediaResolver)}
        </div>
      </article>
    </li>`;
}

function stations(model, mediaResolver) {
  return `
    <section id="science-station" class="science-atlas-section science-atlas-stations" aria-labelledby="science-station-title">
      ${heading('从四个角度理解身体怎样工作', '身体科学小站', 'science-station-title')}
      <ol class="science-station-route">${model.stations.map((item) => station(model, item, mediaResolver)).join('')}</ol>
    </section>`;
}

function question(model, item, mediaResolver) {
  const collapsed = '显示参考答案与家长提示';
  const expanded = '隐藏参考答案与家长提示';
  return `
    <article class="science-question-card" aria-labelledby="science-question-${html(item.id)}-title">
      <p class="science-question-sequence">问题 ${item.sequence}</p>
      <h4 id="science-question-${html(item.id)}-title">${html(item.title)}</h4>
      <p class="science-question-copy">${html(item.question)}</p>
      ${tags(item.biologyConcepts, '这个问题涉及的概念')}
      <button id="${html(item.toggleId)}" class="answer-button" type="button"
        data-answer-toggle="${html(item.answerId)}" data-label-collapsed="${html(collapsed)}"
        data-label-expanded="${html(expanded)}" aria-controls="${html(item.answerId)}" aria-expanded="false">${html(collapsed)}</button>
      <div id="${html(item.answerId)}" class="answer science-answer" role="region" aria-labelledby="${html(item.toggleId)}" hidden>
        <h5>参考答案</h5><p>${html(item.answer)}</p>
        ${item.parentHint ? `<div class="science-question-parent-hint"><h5>家长提示</h5><p>${html(item.parentHint)}</p></div>` : ''}
        ${mediaDisclosure(model, item.mangaMediaGroupId, '查看相应漫画页面', mediaResolver)}
      </div>
    </article>`;
}

function questions(model, mediaResolver) {
  const groups = model.questionGroups.map((group) => `
    <section class="science-question-group" aria-labelledby="science-question-group-${html(group.key)}">
      <header><h3 id="science-question-group-${html(group.key)}">${html(group.label)}</h3><p>${html(group.purpose)}</p></header>
      <div class="science-question-list">${group.questions.map((item) => question(model, item, mediaResolver)).join('')}</div>
    </section>`).join('');
  return `
    <section id="science-questions" class="science-atlas-section science-atlas-questions" aria-labelledby="science-questions-title">
      ${heading('先观察，再理解，最后联系生活', '一起聊一聊', 'science-questions-title')}
      <p class="section-intro">答案是亲子共读参考，只用于打开讨论，不用于评分或判定对错。</p>${groups}
    </section>`;
}

function parentGuidance(model) {
  const stationNotes = model.stations.map((item) => item.parentNote)
    .filter((item, index, items) => item && items.indexOf(item) === index);
  if (!model.parentGuidance.length && !stationNotes.length) return '';
  return `
    <section id="science-parent-guidance" class="science-atlas-section science-parent-guidance" aria-labelledby="science-parent-guidance-title">
      ${heading('把漫画表现温和地转回科学理解', '家长共读', 'science-parent-guidance-title')}
      ${model.parentGuidance.map((note) => `<p>${html(note)}</p>`).join('')}
      ${stationNotes.length ? `<details class="science-parent-notes-disclosure"><summary>查看各科学小站的讲解提示 <span aria-hidden="true">(${stationNotes.length})</span></summary><ul class="plain-list">${stationNotes.map((note) => `<li>${html(note)}</li>`).join('')}</ul></details>` : ''}
    </section>`;
}

function source(model) {
  return `
    <section id="source" class="science-atlas-section science-source-section" aria-labelledby="source-title">
      ${heading('回到纸质漫画中的对应话次', '来源线索', 'source-title')}
      <p><strong>来源：</strong>${html(model.identity.sourceLabel)}</p>
      ${model.sourceNotes.length ? `<ul class="plain-list">${model.sourceNotes.map((note) => `<li>${html(note)}</li>`).join('')}</ul>` : ''}
      <p class="science-source-note">本页是纸质漫画旁的辅助资料；关联漫画页面只在需要核对画面线索时按需打开。</p>
    </section>`;
}

function lightbox() {
  return `
    <div class="image-lightbox" data-lightbox hidden role="dialog" aria-modal="true" aria-labelledby="lightbox-title" aria-describedby="lightbox-caption" aria-busy="false" tabindex="-1">
      <div class="lightbox-backdrop" aria-hidden="true"></div><div class="lightbox-panel" role="document">
        <h2 id="lightbox-title" class="lightbox-title">科学图片放大查看</h2>
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
    </div>`;
}

export function renderScienceTopicAtlas(model, {
  thumbnailPath = '',
  mediaResolver = responsiveMediaFallback(),
} = {}) {
  return `
    <div class="companion-view companion-view--science science-atlas" data-science-atlas>
      ${hero(model, thumbnailPath, mediaResolver)}
      <div class="companion-body science-atlas-body">${navigation(model)}
        <div class="book-main companion-reading science-atlas-reading">
          ${overview(model)}${stations(model, mediaResolver)}${questions(model, mediaResolver)}${parentGuidance(model)}${source(model)}
        </div>
      </div>
    </div>${lightbox()}`;
}
