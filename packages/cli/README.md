# @seqyuan/rst-cli

`rst-render` — render reStructuredText to HTML, Markdown or React from the
terminal, including data-driven, single-file reports.

Part of the [rst-renderer](../..) monorepo. See the
[main README](../../README.md) and the CLI docs in [`web/`](../../web) for
details.

## Install

```bash
pnpm add -g @seqyuan/rst-cli
```

## Usage

```bash
# HTML fragment
rst-render input.rst

# Self-contained single-file HTML report
rst-render input.rst -s -o report.html

# Markdown / React
rst-render input.rst --md
rst-render input.rst --react

# Template + project data + wildcard scans
rst-render report.rst.j2 \
  -t -d project.json \
  --scan plots=upload/plots/*_umap.png \
  --expand-includes \
  -o report.html -s
```

| Option | Description |
| ------ | ----------- |
| `-o, --output <path>` | Write output to a file (default: stdout) |
| `-s, --standalone` | Full HTML document + built-in theme + inlined images |
| `--title <text>` | Document `<title>` (default: first heading) |
| `--css <path>` | Extra CSS appended after the built-in theme |
| `--no-theme` | Do not inject the built-in theme |
| `--fragment` | With `-s`, keep a bare HTML fragment |
| `--md, --markdown` | Output Markdown |
| `--react` | Output React component code |
| `-t, --template` | Render input as a Jinja2 template first |
| `-d, --data <path>` | JSON file with template context |
| `-v, --var key=value` | Template variable (repeatable) |
| `--scan name=glob` | Inject wildcard-matched files into the context |
| `--expand-includes` | Resolve `.. include::` before parsing |
| `-h, --help` | Show help |

Requires Node.js >= 22.

## License

MIT
