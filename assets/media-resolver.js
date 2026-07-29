export const MEDIA_ROLE_SIZES = Object.freeze({
  'carmela-series-cover': '(max-width: 680px) min(calc(34vw - 2.15rem), 168px), (max-width: 920px) 168px, (max-width: 1072px) 96px, min(calc(11.65vw - 1.82rem), 107px)',
  'carmela-book-cover': '(max-width: 680px) 102px, 184px',
  'carmela-page-preview': '(max-width: 680px) calc(50vw - 2.5rem), 160px',
  'carmela-explanation-preview': '(max-width: 680px) calc(50vw - 2.5rem), min(64vw, 640px)',
  'carmela-lightbox': '(max-width: 680px) calc(100vw - 2.25rem), min(calc(100vw - 7rem), 640px)',
  'work-cells-series-thumbnail': '(max-width: 680px) min(calc(34vw - 1.5rem), 160px), min(calc(17vw - 1.5rem), 160px)',
  'work-cells-topic-hero': '(max-width: 1088px) min(88vw, 448px), 320px',
  'work-cells-station-preview': '(max-width: 680px) calc(33vw - 2rem), 160px',
  'work-cells-manga-preview': '(max-width: 680px) calc(33vw - 2rem), 160px',
  'work-cells-lightbox': '(max-width: 680px) calc(100vw - 2.25rem), min(calc(100vw - 7rem), 640px)',
});

export const MEDIA_USE_SITE_SIZES = Object.freeze({
  'home-series-entry': '176px',
});

export function mediaSizes(role, useSite = '') {
  return MEDIA_USE_SITE_SIZES[useSite] ?? MEDIA_ROLE_SIZES[role] ?? '100vw';
}

const FORMAT_MIME = Object.freeze({
  avif: 'image/avif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
});

function html(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizePath(value) {
  return String(value ?? '').trim().replace(/^\.?\//, '').replaceAll('\\', '/');
}

function ordinal(left, right) {
  const a = String(left);
  const b = String(right);
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function roleVariants(entry, role) {
  return (entry?.variants ?? [])
    .filter((variant) => variant.roles?.includes(role))
    .sort((left, right) => left.width - right.width || ordinal(left.format, right.format) || ordinal(left.path, right.path));
}

function groupedByFormat(variants) {
  const groups = new Map();
  for (const variant of variants) {
    const format = String(variant.format ?? '').toLowerCase();
    if (!groups.has(format)) groups.set(format, []);
    groups.get(format).push(variant);
  }
  return [...groups.entries()]
    .map(([format, items]) => ({ format, items: items.sort((left, right) => left.width - right.width) }))
    .sort((left, right) => {
      const priority = { avif: 0, webp: 1, jpeg: 2, jpg: 2, png: 3 };
      return (priority[left.format] ?? 9) - (priority[right.format] ?? 9) || ordinal(left.format, right.format);
    });
}

function chooseFallback(entry, variants, role) {
  if (!entry) return null;
  const roleFallbackPath = entry.fallbacksByRole?.[role];
  const declared = variants.find((variant) => (
    variant.path === roleFallbackPath
    || (!roleFallbackPath && variant.path === entry.fallbackPath)
  ));
  if (declared) return declared;
  const preferred = [...variants]
    .filter((variant) => ['webp', 'jpeg', 'jpg', 'png'].includes(variant.format))
    .sort((left, right) => left.width - right.width || ordinal(left.path, right.path))[0];
  return preferred ?? null;
}

function renderAttributes(attributes) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined && value !== false && value !== '')
    .map(([name, value]) => value === true ? name : `${name}="${html(value)}"`)
    .join(' ');
}

export function createMediaResolver(manifest, { sitePath = (value) => value } = {}) {
  const manifestEntries = Array.isArray(manifest?.media) ? manifest.media : [];
  const entries = new Map(manifestEntries
    .filter((entry) => entry && typeof entry === 'object' && normalizePath(entry.sourcePath))
    .map((entry) => [normalizePath(entry.sourcePath), entry]));

  function entryFor(sourcePath) {
    return entries.get(normalizePath(sourcePath)) ?? null;
  }

  function resolve(sourcePath, role) {
    const normalizedSource = normalizePath(sourcePath);
    const entry = entryFor(normalizedSource);
    if (!entry || !role) {
      return {
        sourcePath: normalizedSource,
        role,
        manifestEntry: null,
        variants: [],
        fallback: null,
      };
    }
    const variants = roleVariants(entry, role);
    return {
      sourcePath: normalizedSource,
      role,
      manifestEntry: entry,
      variants,
      fallback: chooseFallback(entry, variants, role),
    };
  }

  function presentation(sourcePath, {
    role,
    sizes = mediaSizes(role),
  } = {}) {
    const resolved = resolve(sourcePath, role);
    const sources = groupedByFormat(resolved.variants)
      .map(({ format, items }) => ({
        format,
        mime: FORMAT_MIME[format] ?? '',
        sizes,
        srcset: items.map((variant) => `${sitePath(variant.path)} ${variant.width}w`).join(', '),
      }))
      .filter((source) => source.mime && source.srcset);
    const fallback = resolved.fallback && sources.length > 0
      ? {
          ...resolved.fallback,
          src: sitePath(resolved.fallback.path),
        }
      : null;
    return {
      sourcePath: resolved.sourcePath,
      role,
      sizes,
      sources,
      fallback,
      available: Boolean(fallback),
    };
  }

  function largestPath(sourcePath, role) {
    const resolved = resolve(sourcePath, role);
    const largest = [...resolved.variants].sort((left, right) => right.width - left.width || ordinal(left.path, right.path))[0];
    return largest?.path ? sitePath(largest.path) : '';
  }

  function picture(sourcePath, {
    role,
    alt = '',
    sizes = mediaSizes(role),
    className = '',
    pictureClassName = '',
    loading = 'lazy',
    decoding = 'async',
    fetchPriority = '',
    hidden = false,
    data = {},
  } = {}) {
    const media = presentation(sourcePath, { role, sizes });
    if (!media.available) return '';
    const sourceMarkup = media.sources.map((source) => {
      return `<source type="${source.mime}" srcset="${html(source.srcset)}" sizes="${html(source.sizes)}">`;
    }).join('');
    const fallback = media.fallback;
    const fallbackSource = media.sources.find((source) => source.format === fallback.format);
    const dataAttributes = Object.fromEntries(Object.entries(data).map(([key, value]) => [`data-${key}`, value]));
    const imageAttributes = renderAttributes({
      src: fallback.src,
      srcset: fallbackSource?.srcset,
      sizes: fallbackSource?.sizes,
      alt,
      class: className,
      width: fallback.width,
      height: fallback.height,
      loading,
      decoding,
      fetchpriority: fetchPriority,
      hidden,
      ...dataAttributes,
    });
    const pictureAttributes = renderAttributes({ class: pictureClassName, 'data-responsive-media': role || true });
    return `<picture ${pictureAttributes}>${sourceMarkup}<img ${imageAttributes}></picture>`;
  }

  return {
    entryFor,
    resolve,
    presentation,
    largestPath,
    picture,
    has(sourcePath) {
      return entries.has(normalizePath(sourcePath));
    },
    hasRole(sourcePath, role) {
      return Boolean(resolve(sourcePath, role).fallback);
    },
    count: entries.size,
  };
}

export function responsiveMediaFallback(sourcePath, options = {}) {
  return createMediaResolver(null, options);
}
