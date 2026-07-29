# FR-MAINT-MEDIA-SLIM-01

## Outcome

This maintenance correction reduces the public Git working set and exact GitHub Pages release without reopening the sealed FR-P5 or FR-P6 history.

- Pages contains 900 files: the application, current runtime JSON, 43 media index/shard files, 12 audio files, one media manifest and 778 WebP derivatives.
- Every one of the 778 logical image sources publishes exactly one `640px` WebP at `q88`; there are no alternate DPR or high-resolution tiers.
- Derivative bytes fall from the sealed 612,770,984-byte baseline to 75,947,528 bytes: 536,823,456 bytes, or 87.61%.
- Exact Pages bytes fall from the sealed 706,990,045-byte baseline to 166,689,221 bytes: 540,300,824 bytes, or 76.42%.
- The quality target is intentionally companion-grade rather than ebook-grade because the original paper books remain the family's reading surface.

## Mobile lightbox correction

The reported tall white lightbox was not caused by white margins in the source images.

The browser already exposes density-corrected CSS dimensions through `naturalWidth` and `naturalHeight`. The lightbox JavaScript divided `naturalWidth` by `devicePixelRatio` a second time and applied the smaller result as `max-width`. On a high-DPR phone this reduced the displayed image to roughly one third of the intended CSS width.

At the same time, the image element was forced to `width: 100%` and `height: 100%` inside the tall lightbox grid cell. Its white background therefore painted the entire grid cell and made the correctly proportioned source look like a narrow long image.

The correction removes the second DPR calculation and does not assign a JavaScript `max-width`. The centering container keeps the available lightbox area, while the image keeps its intrinsic aspect ratio with `width: auto`, `height: auto`, `max-width: 100%` and `max-height: 100%`. The white background now belongs only to the actual image rectangle.

## Single-tier visual decision

Two fixtures matching the phone report were encoded and inspected at `640px`, WebP `q88` with the pinned Pillow 10.4.0 / libwebp 1.3.2 environment:

- Carmela book 1, page 4: a color two-page spread;
- Work Cells pneumococcus, volume 1 page 8: dense black-and-white manga line work and labels.

Both are suitable for locating and discussing content beside the original book. Small printed text is not treated as a substitute for reading the paper original. Publishing only one derivative per source also prevents the browser from selecting a larger DPR tier and keeps future companion additions predictable.

## GitHub boundary

`operations/github-sync/public-github-sync-policy.json` is default-deny. Git keeps the application, tests, governance, compact evidence, current runtime JSON, audio, media manifest/shards and the exact one-tier WebP release closure.

The following rebuild-only inputs remain on the local machine and are ignored by Git:

- Carmela `pages/` and `generated/` image trees;
- `public/assets/cells-at-work/`;
- `data/cells-at-work/source-assets/`;
- `public/books/工作细胞/`;
- archived OCR experiments;
- raw Source, private data, scratch, browser output and build output.

Removing these paths from the current Git index does not delete their local files and does not rewrite existing Git history.

## Verification boundary

`npm run verify:release` remains the local authoring gate and validates the complete authoring-to-derivative chain. GitHub Actions uses `npm run verify:public-release`, which must pass from a tracked-only checkout and validates shards, the exact release plan, the sealed history plus maintenance overlay, tracked-only tests, public privacy/sync rules, build copying and the dist audit.

The maintenance report records exact manifest, policy and release-plan hashes plus mobile-browser acceptance. This record is local release-ready evidence only. No commit, push, GitHub Pages deployment or history rewrite is claimed.
