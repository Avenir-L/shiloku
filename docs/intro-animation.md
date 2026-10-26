# SVG opening animation

The homepage uses the approved code intro instead of requesting either watermark MP4. The local comparison workbench is separate and is not deployed.

- `scripts/intro/intro-motion-20261026.js`: SVG layers and deterministic motion. Production defaults are 5.76 seconds, sweep 1, glow 1, with the original SHILOKU/Chinese glyphs.
- `scripts/intro/intro-data-20261026.js`: original glyph contours; unused sampled motion data is omitted from production.
- `index.html`: starts the animation, handles click-to-skip, keeps the existing exit fade, and releases the homepage. Reduced-motion visitors skip the intro without downloading its modules. Module-load or render failure also releases the homepage.

At sweep 1, all horizontal sweeps use standard easeOutCubic. The opening frame is empty: the vertical line unfolds first, then the cone/halo appears. The final diagonal segment uses one shared eased progress for both axes.

The user's manually selected 5.76-second duration is intentional; do not reset it to the original video's 7.36 seconds. The comparison page's browser settings are not read by production.

Versioned module filenames avoid stale code under the site's immutable asset cache headers. When changing a published renderer or glyph file, update the corresponding filename and import together.

Runtime verification covers natural completion and homepage visibility, click skip, mobile composition, reduced-motion bypass, failed-module fallback, and zero watermark video requests. The source MP4 files remain in the repository for reference but are no longer loaded by the opening animation.
