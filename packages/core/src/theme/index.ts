// ---------------------------------------------------------------------------
// Built-in default theme + document wrapper
// ---------------------------------------------------------------------------
//
// The HTML renderer emits semantic HTML with CSS classes and no styling of its
// own, so a report only looks like a report once a stylesheet is applied.
// Shipping a default theme means `rst-render x.rst -s -o x.html` produces a
// complete, presentable, single-file document out of the box.
//

import { escapeHtml } from '../renderer/base'

export const DEFAULT_THEME_CSS = `/* rst-renderer default theme */
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  padding: 40px 20px 80px;
  background: #eef2f1;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.85;
  color: #2b2b2b;
  letter-spacing: 0.3px;
  -webkit-font-smoothing: antialiased;
}

.rst-report {
  max-width: 860px;
  margin: 0 auto;
  padding: 48px 44px 64px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 24px rgba(16, 24, 40, 0.07);
  overflow-wrap: break-word;
}

/* --- Headings ----------------------------------------------------------- */
.rst-report h1 {
  font-size: 28px;
  font-weight: 700;
  color: #101828;
  line-height: 1.35;
  margin: 0 0 32px;
  padding-bottom: 16px;
  border-bottom: 3px solid #0e7c66;
}
.rst-report h2 {
  font-size: 20px;
  font-weight: 700;
  color: #0e7c66;
  line-height: 1.4;
  margin: 40px 0 18px;
  padding-left: 12px;
  border-left: 4px solid #0e7c66;
}
.rst-report h3 {
  font-size: 17px;
  font-weight: 700;
  color: #101828;
  line-height: 1.5;
  margin: 30px 0 14px;
}
.rst-report h4,
.rst-report h5,
.rst-report h6 {
  font-size: 16px;
  font-weight: 700;
  color: #344054;
  margin: 24px 0 12px;
}

/* --- Text -------------------------------------------------------------- */
.rst-report p { margin: 0 0 18px; }
.rst-report strong { color: #101828; font-weight: 600; }
.rst-report a { color: #0e7c66; text-decoration: none; border-bottom: 1px solid rgba(14, 124, 102, 0.35); }
.rst-report a:hover { border-bottom-color: #0e7c66; }
.rst-report hr { border: 0; border-top: 1px solid #e4e9e7; margin: 36px 0; }

.rst-report code {
  background: #f1f3f6;
  color: #c7254e;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: Menlo, Consolas, Monaco, "Liberation Mono", monospace;
  font-size: 0.9em;
}

/* --- Lists ------------------------------------------------------------- */
.rst-report ul,
.rst-report ol { margin: 0 0 20px; padding-left: 26px; }
.rst-report li { margin: 0 0 8px; }
.rst-report li > p { margin: 0; }
.rst-report dl { margin: 0 0 22px; }
.rst-report dt { font-weight: 600; color: #101828; margin-top: 12px; }
.rst-report dd { margin: 4px 0 0 20px; color: #475467; }

/* --- Field lists ( :name: value ) -------------------------------------- */
.rst-report dl.field-list {
  display: grid;
  grid-template-columns: minmax(120px, auto) 1fr;
  gap: 0;
  border: 1px solid #e4e9e7;
  border-radius: 6px;
  overflow: hidden;
}
.rst-report dl.field-list dt {
  margin: 0;
  padding: 10px 14px;
  background: #f7faf9;
  border-bottom: 1px solid #e4e9e7;
  font-size: 14px;
}
.rst-report dl.field-list dd {
  margin: 0;
  padding: 10px 14px;
  border-bottom: 1px solid #e4e9e7;
  color: #2b2b2b;
}
.rst-report dl.field-list dt:last-of-type,
.rst-report dl.field-list dd:last-of-type { border-bottom: 0; }

/* --- Tables ------------------------------------------------------------ */
.rst-report table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 28px;
  font-size: 15px;
}
.rst-report table caption {
  caption-side: top;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: #475467;
  padding: 0 0 10px;
}
.rst-report table th {
  background: #0e7c66;
  color: #fff;
  font-weight: 600;
  text-align: left;
  padding: 11px 14px;
  border: 1px solid #0e7c66;
}
.rst-report table td {
  padding: 10px 14px;
  border: 1px solid #e4e9e7;
  vertical-align: top;
}
.rst-report table tbody tr:nth-child(even) td { background: #f7faf9; }

/* --- Code blocks ------------------------------------------------------- */
.rst-report pre {
  background: #f7f8fa;
  border-left: 4px solid #0e7c66;
  border-radius: 0 6px 6px 0;
  padding: 16px 18px;
  margin: 0 0 26px;
  overflow-x: auto;
  font-family: Menlo, Consolas, Monaco, "Liberation Mono", monospace;
  font-size: 13.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.rst-report pre code { background: none; color: #24292f; padding: 0; font-size: inherit; }
.rst-report pre.shiki { background: #f7f8fa !important; }

/* --- Admonitions ------------------------------------------------------- */
.rst-report .admonition {
  margin: 0 0 26px;
  padding: 16px 20px;
  border-radius: 0 6px 6px 0;
  border-left: 5px solid #94a3b8;
  background: #f6f8fa;
}
.rst-report .admonition-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #64748b;
}
.rst-report .admonition p:last-child { margin-bottom: 0; }

.rst-report .admonition-note    { border-left-color: #3b82f6; background: #eff6ff; }
.rst-report .admonition-note .admonition-title    { color: #1d4ed8; }
.rst-report .admonition-tip,
.rst-report .admonition-hint     { border-left-color: #10b981; background: #ecfdf5; }
.rst-report .admonition-tip .admonition-title,
.rst-report .admonition-hint .admonition-title    { color: #047857; }
.rst-report .admonition-warning,
.rst-report .admonition-attention,
.rst-report .admonition-caution  { border-left-color: #f59e0b; background: #fffbeb; }
.rst-report .admonition-warning .admonition-title,
.rst-report .admonition-attention .admonition-title,
.rst-report .admonition-caution .admonition-title { color: #b45309; }
.rst-report .admonition-danger,
.rst-report .admonition-error    { border-left-color: #ef4444; background: #fef2f2; }
.rst-report .admonition-danger .admonition-title,
.rst-report .admonition-error .admonition-title   { color: #b91c1c; }
.rst-report .admonition-important { border-left-color: #8b5cf6; background: #f5f3ff; }
.rst-report .admonition-important .admonition-title { color: #6d28d9; }

/* --- Images & figures -------------------------------------------------- */
.rst-report img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}
.rst-report figure {
  margin: 0 0 28px;
}
.rst-report figure img {
  display: block;
  border: 1px solid #e6ebe9;
}
.rst-report figcaption {
  margin-top: 8px;
  font-size: 13.5px;
  color: #667085;
  text-align: center;
}
.rst-report figcaption p { margin: 0; }

/* --- Math -------------------------------------------------------------- */
.rst-report .math { margin: 0 0 24px; overflow-x: auto; }
.rst-report .math-inline { display: inline; margin: 0; }
.rst-report .katex-display { margin: 0; }

/* --- Containers, blockquote, TOC --------------------------------------- */
.rst-report blockquote {
  margin: 0 0 24px;
  padding: 4px 0 4px 18px;
  border-left: 3px solid #d0d5dd;
  color: #475467;
}
.rst-report blockquote footer { font-size: 13px; color: #98a2b3; }
.rst-report .line-block { margin: 0 0 20px; }
.rst-report .line-block .line { margin: 0; }

.rst-report nav.rst-contents-card,
.rst-report nav.rst-toctree-card {
  margin: 0 0 28px;
  padding: 16px 20px;
  background: #f7faf9;
  border: 1px solid #e4e9e7;
  border-radius: 8px;
}
.rst-report .rst-contents-title,
.rst-report .rst-toctree-title {
  margin: 0 0 10px;
  font-weight: 700;
  color: #0e7c66;
}
.rst-report .rst-contents-list { margin: 0; padding-left: 20px; }
.rst-report .rst-toctree-grid { display: flex; flex-direction: column; gap: 6px; }
.rst-report .rst-toctree-link { display: flex; gap: 10px; border-bottom: 0; }
.rst-report .rst-toctree-link-path { color: #98a2b3; font-size: 13px; }

/* --- Footnotes --------------------------------------------------------- */
.rst-report .footnotes { margin-top: 40px; font-size: 14px; color: #475467; }
.rst-report .footnotes-sep { border-top: 1px solid #e4e9e7; }
.rst-report .footnotes-list { padding-left: 22px; }

/* --- Print ------------------------------------------------------------- */
@media print {
  body { background: #fff; padding: 0; }
  .rst-report { box-shadow: none; border-radius: 0; padding: 0; max-width: none; }
  .rst-report h2 { break-after: avoid; }
  .rst-report pre,
  .rst-report table,
  .rst-report .admonition { break-inside: avoid; }
}
`

export interface WrapHtmlDocumentOptions {
  /** Document `<title>`. Defaults to the first `<h1>`/`<h2>` found in the body. */
  title?: string
  /** `lang` attribute of `<html>`. Defaults to `zh-CN`. */
  lang?: string
  /** Additional CSS appended after the default theme. */
  extraCss?: string
  /** Replace the built-in theme entirely. */
  css?: string
  /** Class applied to the wrapper element. Defaults to `rst-report`. */
  bodyClass?: string
}

/** Extract the text of the first `<h1>` (or `<h2>`) in an HTML fragment. */
function firstHeadingText(html: string): string {
  const match = html.match(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/i)
  if (!match) return ''
  return match[2]!
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

/**
 * Wrap a rendered RST body fragment into a complete, styled HTML document.
 *
 * ```ts
 * const html = wrapHtmlDocument(renderRst(source), { title: 'QC Report' })
 * ```
 */
export function wrapHtmlDocument(
  bodyHtml: string,
  options: WrapHtmlDocumentOptions = {},
): string {
  const lang = options.lang ?? 'zh-CN'
  const bodyClass = options.bodyClass ?? 'rst-report'
  const title = options.title?.trim() || firstHeadingText(bodyHtml) || 'RST Document'
  const css = options.css ?? DEFAULT_THEME_CSS
  const extraCss = options.extraCss ? `\n${options.extraCss}` : ''

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${css}${extraCss}
</style>
</head>
<body>
<article class="${escapeHtml(bodyClass)}">
${bodyHtml.trim()}
</article>
</body>
</html>
`
}
