# Changelog

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
