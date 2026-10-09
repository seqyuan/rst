# Changelog

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
