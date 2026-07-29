import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  assert.ok(match, `Missing CSS rule: ${selector}`);
  return match[1];
}

function selectorListRule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`^\\s*${escaped}\\s*(?:,\\s*[^,{]+)*\\{([^{}]*)\\}`, 'm'));
  assert.ok(match, `Missing CSS selector-list rule: ${selector}`);
  return match[1];
}

function atRuleBlock(css, marker) {
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, `Missing at-rule: ${marker}`);
  const open = css.indexOf('{', start + marker.length);
  assert.notEqual(open, -1, `Missing opening brace for: ${marker}`);

  let depth = 1;
  for (let index = open + 1; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, index);
  }

  assert.fail(`Missing closing brace for: ${marker}`);
}

test('P4B-R1 constrains the science hero grid and media intrinsic size', async () => {
  const css = await read('assets/science-companion.css');
  const hero = rule(css, '.science-atlas-hero');
  const media = rule(css, '.science-atlas-hero-media');
  const image = rule(css, '.science-atlas-hero-media img');

  assert.match(hero, /grid-template-columns:\s*minmax\(0,\s*20rem\)\s+minmax\(0,\s*1fr\)/);
  assert.match(hero, /width:\s*100%/);
  assert.match(hero, /min-width:\s*0/);

  assert.match(media, /width:\s*100%/);
  assert.match(media, /max-width:\s*20rem/);
  assert.match(media, /min-width:\s*0/);
  assert.match(media, /min-height:\s*0/);
  assert.match(media, /padding:\s*0/);
  assert.doesNotMatch(media, /min-height:\s*16rem/);

  assert.match(image, /max-height:\s*none/);
  assert.match(image, /min-width:\s*0/);
});

test('P4B-R1 switches to one column before the former collision interval', async () => {
  const css = await read('assets/science-companion.css');
  const compact = atRuleBlock(css, '@media (max-width: 68rem)');
  const compactHero = selectorListRule(compact, '.science-atlas-hero');
  const compactMedia = selectorListRule(compact, '.science-atlas-hero-media');
  assert.match(compactHero, /grid-template-columns:\s*1fr/);
  assert.match(compactMedia, /justify-self:\s*center/);

  assert.doesNotMatch(css, /@media\s*\(max-height:\s*480px\)\s*,/);
  const shortLandscape = atRuleBlock(css, '@media (min-width: 68.0625rem) and (max-height: 480px)');
  assert.match(selectorListRule(shortLandscape, '.science-atlas-hero'), /grid-template-columns:\s*minmax\(0,\s*15rem\)\s+minmax\(0,\s*1fr\)/);
});

test('P4B-R1 protects long science copy, tags and actions from widening the grid', async () => {
  const css = await read('assets/science-companion.css');
  assert.match(selectorListRule(css, '.science-atlas-hero-copy > *'), /overflow-wrap:\s*anywhere/);
  assert.match(selectorListRule(css, '.science-atlas-actions > *'), /max-width:\s*100%/);
  assert.match(selectorListRule(css, '.science-atlas-tags li'), /max-width:\s*100%/);
  assert.match(rule(css, '.science-atlas-hero-media.thumbnail-missing .cover-fallback'), /display:\s*block/);
});

test('P4B-R1 publishes a new stylesheet cache identity', async () => {
  const html = await read('index.html');
  assert.match(html, /science-companion\.css\?v=fr-maint-single-tier-20260729/);
  assert.equal((html.match(/science-companion\.css/g) ?? []).length, 1);
});
