# Changelog

## 0.1.5 - 2026-10-09

### Docs

- Document **npm** install commands alongside pnpm across the root README, all
  three package READMEs, and the documentation site (Quick Start, CLI, Vite
  plugin, index). Commands are equivalent: `pnpm add` ↔ `npm install`,
  `pnpm add -D` ↔ `npm install -D`, `pnpm add -g` ↔ `npm install -g`.
- Note the global-bin `PATH` check for `npm install -g` and the lockfile caveat
  (`pnpm-lock.yaml` vs `package-lock.json`).

No code changes in this release — it syncs the package READMEs, which npm only
refreshes on publish.

## 0.1.4 - 2026-10-09

### Fixed

- `@seqyuan/vite-plugin-rst` now loads the renderer with a dynamic `import()`;
  the previous `createRequire(...)('@seqyuan/rst-renderer')` failed with
  `ERR_PACKAGE_PATH_NOT_EXPORTED` because the package only declared the `import`
  export condition. The plugin's `transform` is now async.
- `renderRst({ parser: 'rst-compiler' })` works in published ESM builds. The
  adapter used a bare `require('rst-compiler')`, which the bundler rewrote into
  a shim that threw in ESM consumers (surfacing as a misleading
  "rst-compiler is not installed"). It now uses the ESM-safe `optionalRequire`.
  `renderRst` no longer wraps the parse call in a try/catch that masked the real
  error.
- The builtin parser now parses **simple** (`====  ====`) and **grid**
  (`+---+---+`) tables into real tables instead of a paragraph.
- The builtin parser no longer mis-detects an overline section when a paragraph
  immediately follows an underline (previously dropped the paragraph and
  rendered `<h2>=====</h2>`). Overline sections no longer emit a stray `<hr>`.
- The template engine resolves `.length` on strings/arrays, so the documented
  `{{ '=' * name.length }}` idiom works again (previously returned empty,
  breaking generated RST headings).
- `.. csv-table::` with `:file:` now reads and renders the referenced CSV
  relative to `baseDir` (set automatically by the CLI); it previously emitted an
  empty `<table data-file>` placeholder.
- `wrapHtmlDocument()` now inlines the KaTeX stylesheet when the body contains
  math, so standalone reports typeset correctly (font URLs point at the jsDelivr
  CDN to avoid bundling ~1 MB of base64 fonts).
- Markdown output no longer over-escapes punctuation (`Hello-world.` instead of
  `Hello\-world\.`).
- `HtmlRenderer` table headers now render as `<th>` (the `_inThead` flag was
  never set).

### Changed

- Removed the unused `react-dom` runtime dependency from `@seqyuan/rst-renderer`.
- Added `README.md`, `LICENSE` and package metadata (`repository`, `homepage`,
  `bugs`) to the repository and each published package.

### CI

- `test` workflow builds only `./packages/*` and runs the Vite plugin tests;
  the publish workflow runs the Vite plugin tests before releasing.

## 0.1.3 - 2026-10-09

### Fixed

- CLI: removed the duplicated shebang in `dist/cli.js` that made the globally
  installed `rst-render` command crash with `SyntaxError: Invalid or unexpected token`.
- CLI: the entry guard now normalises paths with `realpathSync`, so commands
  launched through npm/pnpm `.bin` symlinks no longer exit silently.
- `.. code::` / `.. math::` no longer double-escape their body, which also fixes
  KaTeX receiving HTML instead of LaTeX.
- `.. code-block::` / `.. sourcecode::` are now registered (previously they fell
  through and lost their language/highlighting).
- Shiki and KaTeX now load in the published ESM build (the old `require(...)`
  compiled to a shim that threw `Dynamic require ... is not supported`).
- Field lists (`:name: value`) are parsed and rendered as `<dl class="field-list">`.
- `csv-table` supports `:header:` and emits its caption; `list-table` emits its caption.
- `image` / `figure` normalise `:width:` / `:height:` to valid attributes; `src`,
  `alt`, admonition titles and container classes are HTML-escaped.
- Directive bodies no longer leak trailing blank lines, and multi-paragraph
  admonitions are split into separate paragraphs.
- `.. raw:: html` is emitted verbatim; substitution definitions
  (`.. |name| replace:: …` + `|name|`) are resolved.
- Built-in parser now also handles definition lists and option lists.

### Added

- `DEFAULT_THEME_CSS` and `wrapHtmlDocument()` — turn the rendered fragment into a
  complete, styled HTML document.
- `HtmlRenderer`/`renderRst` `headingOffset` option (default keeps `<h2>` start,
  pass `0` for an `<h1>` document title).
- `preloadRenderers()` to await Shiki/KaTeX before the first render.
- CLI: `--title`, `--css`, `--no-theme`, `--fragment`; `-s/--standalone` now emits
  a full document with the built-in theme and inlined images.

### Notes

- Default heading level is unchanged: level-1 RST sections still render as `<h2>`.

## 0.1.2 - 2026-07-10

### Added

- Fumadocs pages: Markdown Rendering, Vite Plugin, Quick Start, and Bioinformatics Report Tutorial
- `csv-table` inline CSV HTML rendering with escaped cell content and column widths
- Shiki singleton highlighter with lazy language loading for `.. code::` directives
- Core test coverage for inline `csv-table` rendering
- Separate CLI test step in CI workflow

### Changed

- `csv-table` plugin now renders real HTML tables instead of placeholders
- Consolidated `csv-table` directive registration through `directives.ts`
- Removed unused `csvTableDirectivePlugin` export from core package
- Docs cross-links updated across index, CLI, gallery, and React rendering pages

### Notes

- npm packages `@seqyuan/rst-renderer`, `@seqyuan/rst-cli`, and `@seqyuan/vite-plugin-rst` are version-aligned at 0.1.2.

## 0.1.1 - 2026-06-06

### Added

- CLI `--scan name=glob` support for project-level report generation from wildcard-matched files
- optional include expansion via core `includeResolver` and CLI `--expand-includes`
- report-oriented `list-table` HTML rendering
- lightweight `contents` and `toctree` rendering for in-document TOC and explicit related-page navigation
- dedicated RST writing rules page covering common RST plus project-specific template and CLI rules

### Changed

- CLI documentation now demonstrates template + JSON variables + wildcard scans instead of hardcoded image paths
- HTML and template docs now describe report-oriented scope and support boundaries more explicitly
- builtin parser now tracks section levels more accurately for TOC depth handling

### Notes

- This release expands report-generation capabilities without aiming for full Sphinx compatibility.
