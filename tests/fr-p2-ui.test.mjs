import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const appJs = readFileSync(path.join(rootDir, 'assets', 'app.js'), 'utf8');
const a11yJs = readFileSync(path.join(rootDir, 'assets', 'a11y.js'), 'utf8');
const styles = readFileSync(path.join(rootDir, 'assets', 'styles.css'), 'utf8');
const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const workCellsManifest = JSON.parse(
  readFileSync(path.join(rootDir, 'public', 'books', '工作细胞', 'draft-manifest.json'), 'utf8'),
);

function functionBlock(name, nextName) {
  return appJs.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\r?\\n\\}\\r?\\n\\r?\\nfunction ${nextName}`))?.[0] ?? '';
}

function hexToLuminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => (
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrast(first, second) {
  const firstLuminance = hexToLuminance(first);
  const secondLuminance = hexToLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function tokenHex(name) {
  const value = styles.match(new RegExp(`--${name}:\\s*(#[a-f\\d]{6})`, 'i'))?.[1];
  assert.ok(value, `${name} should be a six-digit color token`);
  return value;
}

test('P2 shell exposes one stable main, skip link, breadcrumb, and route announcer', () => {
  assert.equal((indexHtml.match(/<main\b/g) ?? []).length, 1);
  assert.match(indexHtml, /<html lang="zh-CN">/);
  assert.match(indexHtml, /<a class="skip-link" href="#main-content">跳到主要内容<\/a>/);
  assert.match(indexHtml, /<nav id="breadcrumb" class="breadcrumb" aria-label="面包屑" hidden>/);
  assert.match(indexHtml, /id="route-announcer"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"/);
  assert.match(indexHtml, /<main id="main-content" class="route-main" tabindex="-1">/);
  assert.match(indexHtml, /class="loading-state"[\s\S]*role="status" aria-live="polite"/);
  assert.match(indexHtml, /name="description"/);
  assert.match(indexHtml, /name="theme-color"/);
});

test('P2 home remains a two-series entrance beside the paper book', () => {
  const home = functionBlock('homePage', 'carmelaSeriesPage');
  assert.match(home, /<h1 id="home-title" data-route-heading tabindex="-1">选择阅读主题<\/h1>/);
  assert.match(home, /seriesEntryCard\(\{/);
  assert.match(home, /CARMELA_SERIES_SLUG/);
  assert.match(home, /WORK_CELLS_SERIES_SLUG/);
  assert.match(home, /先读纸质书，再按需要查看辅助资料/);
  assert.equal(home.includes('book-grid'), false);
  assert.equal(home.includes('topic-card'), false);

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
    assert.equal(`${indexHtml}\n${appJs}`.includes(blocked), false, `${blocked} must not enter child-facing code`);
  }
});

test('P2 series primitives preserve Carmela and science domain semantics', () => {
  const topicCard = functionBlock('scienceTopicCard', 'scienceSeriesPage');
  const scienceSeries = functionBlock('scienceSeriesSection', 'scienceTopicCard');
  assert.match(appJs, /class="book-card\$\{compact \? ' book-card-compact' : ''\}"/);
  assert.match(appJs, /class="series-entry-card series-entry-card--\$\{html\(domain\)\}"/);
  assert.match(topicCard, /<article class="topic-card">/);
  assert.equal(topicCard.includes('book-card'), false, 'science topic card must not reuse book-card');
  assert.match(scienceSeries, /groupScienceTopics\(topics\)/);
  assert.match(scienceSeries, /<details class="category-nav" data-category-nav open>/);
  assert.match(scienceSeries, /<section id="category-\$\{index \+ 1\}" class="topic-category"/);
  assert.match(scienceSeries, /<h2 id="category-\$\{index \+ 1\}-title" tabindex="-1">/);
  assert.equal(topicCard.includes('prompt-id'), false);
  assert.equal(topicCard.includes('rights'), false);
  assert.equal(topicCard.includes('review'), false);

  const categoryOrder = [];
  for (const topic of workCellsManifest.topics) {
    if (!categoryOrder.includes(topic.category)) categoryOrder.push(topic.category);
  }
  assert.equal(categoryOrder.length, 24);
  assert.equal(workCellsManifest.topics.length, 27);
});

test('P2 router distinguishes namespaces and handles invalid routes and sections', () => {
  assert.match(appJs, /return \{ view: 'invalid' \};/);
  assert.match(appJs, /if \(route\.view === 'book'\)[\s\S]*model\.books\.find/);
  assert.match(appJs, /if \(route\.view === 'science'\)[\s\S]*manifest\?\.topics\?\.find/);
  assert.match(appJs, /sectionNav\.some\(\(\[id\]\) => id === route\.target\)/);
  assert.match(appJs, /scienceSectionNav\.some\(\(\[id\]\) => id === route\.target\)/);
  assert.match(appJs, /route\.target !== canonicalCategoryTarget/);
  assert.match(appJs, /route\.target !== canonicalBookTarget/);
  assert.match(appJs, /return invalidRoute\('这个地址没有对应的伴读入口。'\)/);
  assert.match(appJs, /route\.valid && route\.pageKey === currentPageKey/);
  assert.match(appJs, /focusTarget\.scrollIntoView\(\{ block: 'start', behavior: 'instant' \}\)/);
});

test('P2 route changes update title, focus, announcement, and semantic breadcrumb', () => {
  assert.match(appJs, /document\.title = `\$\{route\.title\} \| 温暖伴读图册`/);
  assert.match(appJs, /focusTarget\.focus\(\{ preventScroll: true \}\)/);
  assert.match(appJs, /routeAnnouncer\.textContent = route\.target/);
  assert.match(appJs, /aria-current="page"/);
  assert.match(appJs, /breadcrumbs: \[\s*\{ label: '首页', href: '#\/' \}/);
  assert.match(appJs, /data-route-heading tabindex="-1"/);
});

test('P2 answer and lightbox controls expose complete keyboard semantics', () => {
  assert.match(appJs, /data-answer-toggle="\$\{question\.answerId\}"[\s\S]*aria-controls="\$\{question\.answerId\}"[\s\S]*aria-expanded="false"/);
  assert.match(appJs, /role="region"[\s\S]*aria-labelledby="\$\{question\.toggleId\}"/);
  assert.match(appJs, /role="dialog" aria-modal="true" aria-labelledby="lightbox-title"/);
  assert.match(a11yJs, /event\.key !== 'Tab'/);
  assert.match(a11yJs, /event\.key === 'Escape'/);
  assert.match(a11yJs, /event\.key === 'ArrowLeft'/);
  assert.match(a11yJs, /activeOpener\.focus\(\{ preventScroll: true \}\)/);
  assert.match(a11yJs, /'inert' in element/);
  assert.match(a11yJs, /element\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(a11yJs, /new AbortController\(\)/);
  assert.match(appJs, /function afterRender\(\)[\s\S]*new AbortController\(\)/);
  assert.match(appJs, /controller\.abort\(\)/);
  assert.match(appJs, /cleanupView\(\)/);
  assert.equal(`${appJs}\n${a11yJs}`.includes('window.onkeydown ='), false);
  assert.equal(/<div[^>]+data-lightbox-close/.test(appJs), false, 'a div must not be clickable');
  assert.match(appJs, /<img data-lightbox-image alt="" hidden>/);
  assert.equal(/<img[^>]*data-lightbox-image[^>]*\bsrc=/.test(appJs), false, 'idle lightbox must not request an image');
  assert.match(a11yJs, /function collectGroupItems\(groupId\)/);
  assert.match(a11yJs, /root\.addEventListener\('click', onOpenerClick/);
  assert.match(a11yJs, /image\.removeAttribute\('src'\)/);
});

test('P2 tokens meet AA contrast and define a 44px focus system', () => {
  const white = '#ffffff';
  const page = tokenHex('color-page');
  assert.ok(contrast(tokenHex('color-primary'), white) >= 4.5);
  assert.ok(contrast(tokenHex('color-science'), white) >= 4.5);
  assert.ok(contrast(tokenHex('color-text-muted'), page) >= 4.5);
  assert.ok(contrast(tokenHex('color-focus'), page) >= 3);
  assert.match(styles, /--touch-target:\s*44px/);
  assert.match(styles, /min-height:\s*var\(--touch-target\)/);
  assert.match(styles, /outline:\s*3px solid var\(--color-focus\)/);
  assert.match(styles, /\.breadcrumb a[\s\S]*?min-width:\s*var\(--touch-target\)/);
  assert.match(styles, /\.audio-seek[\s\S]*?min-height:\s*var\(--touch-target\)/);
  assert.match(styles, /summary\s*\{[\s\S]*?min-height:\s*var\(--touch-target\)/);
  assert.match(styles, /input:focus-visible/);
});

test('P2 CSS includes reduced motion, forced colors, short landscape, and companion print', () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /scroll-behavior:\s*auto/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /outline:\s*3px solid Highlight/);
  assert.match(styles, /@media \(max-height: 500px\) and \(orientation: landscape\)/);
  assert.match(styles, /\.site-header\s*\{[\s\S]*?position:\s*static/);
  assert.match(styles, /@media print/);
  assert.match(styles, /\.series-entry-section,[\s\S]*?\.season-section,[\s\S]*?\.audio-panel,[\s\S]*?#audio/);
  assert.match(styles, /\.answer\[hidden\]\s*\{\s*display:\s*block/);
});

test('P2 foundations remain within the active P3B code and static deployment gates', () => {
  const assetScripts = readdirSync(path.join(rootDir, 'assets'))
    .filter((name) => name.endsWith('.js'));
  const jsBytes = assetScripts.reduce(
    (total, name) => total + statSync(path.join(rootDir, 'assets', name)).size,
    0,
  );
  const cssBytes = statSync(path.join(rootDir, 'assets', 'styles.css')).size;
  assert.ok(jsBytes <= 155 * 1024, `all JS is ${jsBytes} bytes`);
  assert.ok(cssBytes <= 70 * 1024, `all CSS is ${cssBytes} bytes`);
  assert.ok(
    assetScripts.length <= 6,
    'FR-P5 retains the P4B modules plus the dedicated responsive-media resolver',
  );
  assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0);
  assert.equal(/@import|https?:\/\/.+\.(?:js|css|woff2?)/i.test(`${indexHtml}\n${styles}`), false);
  assert.match(indexHtml, /assets\/app\.js\?v=fr-maint-single-tier-20260729/);
});

test('P2 loading and error states stay understandable and path-safe', () => {
  assert.match(indexHtml, /正在准备伴读资料/);
  assert.match(appJs, /伴读资料载入失败/);
  assert.match(appJs, /data-retry/);
  assert.match(appJs, /没有找到这个伴读入口/);
  assert.match(appJs, /页面不会显示内部文件位置/);
  assert.equal(appJs.includes('error.message'), false);
});

test('P2 fallback and return-context hooks close their runtime loops', () => {
  assert.match(appJs, /series-entry-cover\$\{coverImage \? '' : ' cover-missing'\}/);
  assert.match(appJs, /topic-thumbnail\$\{thumbnail \? '' : ' thumbnail-missing'\}/);
  for (const selector of [
    '.series-entry-cover img',
    '.cover-frame img',
    '.topic-thumbnail img',
    '.page-thumbnail img',
  ]) {
    assert.ok(appJs.includes(`'${selector}'`), `${selector} should use the delegated fallback loop`);
  }
  assert.match(appJs, /document\.addEventListener\('error',[\s\S]*capture: true, signal/);
  assert.match(appJs, /image\.closest\('\.page-thumbnail'\)\?\.classList\.add\('thumbnail-missing'\)/);
  assert.match(styles, /\.series-entry-cover\.cover-missing \.cover-fallback/);
  assert.match(styles, /\.topic-thumbnail\.thumbnail-missing \.cover-fallback/);
  assert.match(appJs, /data-return-series=/);
  assert.match(appJs, /history\.replaceState\(history\.state, '', `#\/series\/\$\{returnSeries\}\/\$\{returnSection\}`\)/);
  assert.match(appJs, /data-lightbox\]:not\(\[hidden\]\)/);
});
