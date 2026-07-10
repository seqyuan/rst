# Changelog

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
