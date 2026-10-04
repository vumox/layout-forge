# Changelog

## 1.2.0

- Copy link with compressed, versioned state for layouts, palettes and generators.
- Ctrl+K / ⌘K command palette for all 36 tools.
- Installable PWA, offline precaching and an explicit update/reload prompt.
- Static SEO guides for mesh gradients, clip-path, glassmorphism and CSS Grid; sitemap, robots and JSON-LD.
- Six tool GIFs, reproducible media scripts, README comparison and dynamic badges.
- Roadmap and community feedback entry points.
- Playwright CI smoke tests for startup, sharing, search, offline usage, SEO and mobile actions.
- GitHub Pages deployment follows a successful CI run.
- Reduce the 3D tool bundle by importing only the Three.js exports used by its scene runtime.

## 1.1.0

- Deep links to every tool via the URL hash (`#grid`, `#flex`, `#palette`, `#tools/mesh`).
- New visitors land on the Generators tab instead of an empty grid.
- Faster first load: tools, palette and generators are loaded on demand (main bundle 1082 kB → 382 kB).
- Unit tests (Vitest) for color, palette and slug helpers, run in CI.
- OG meta tags export now escapes quotes in the title and description.
- Open Graph and Twitter meta tags, social preview image.
- Repository: protected `main`, demo GIF, tools table in the README.

## 1.0.0

- First public release.
