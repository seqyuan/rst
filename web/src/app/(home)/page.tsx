import Link from 'next/link'

const modules = [
  {
    title: '@seqyuan/rst-renderer',
    desc: '核心包：RST 解析 + HTML / React / Markdown 三种渲染器，内置 11 个指令插件（图片、代码高亮、数学公式、警告框等），支持 Jinja2 模板引擎。',
    href: '/docs',
    icon: '📦',
  },
  {
    title: '@seqyuan/rst-cli',
    desc: '命令行工具：一行命令将 .rst 文件转为 HTML / Markdown / React，支持 Jinja2 模板变量、JSON 数据注入。',
    href: '/docs/cli',
    icon: '🖥️',
  },
  {
    title: '@seqyuan/vite-plugin-rst',
    desc: 'Vite 插件：在项目中直接 import .rst 文件，输出 HTML 字符串 / React 组件 / Markdown 文本，支持热更新。',
    href: '/docs/react-rendering',
    icon: '⚡',
  },
]

const highlights = [
  { title: 'HTML 渲染', desc: '11 个指令插件，Shiki 代码高亮，KaTeX 数学公式，CSS class 可定制', icon: '🎨' },
  { title: 'React 渲染', desc: 'RST → React 组件树，支持自定义组件覆盖每个节点类型', icon: '⚛️' },
  { title: 'Markdown', desc: 'RST → GFM 格式，heading offset 可配，支持表格/代码块/图片', icon: '📝' },
  { title: 'Jinja2 模板', desc: '嵌套 for/if/else，12 个 filter，loop 变量，兼容 annopi RST 模板', icon: '📋' },
  { title: 'CJK 中文', desc: '中文标题/段落/内联标记全链路支持，annopi 生信报告模板', icon: '🀄' },
  { title: 'TypeScript', desc: '完整的类型定义，ESM + DTS 双输出，可插拔解析器架构', icon: '🔷' },
]

export default function HomePage() {
  return (
    <div className="flex flex-col flex-1 max-w-5xl mx-auto px-6 py-16 gap-16">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-5xl font-bold mb-4">rst-renderer</h1>
        <p className="text-xl text-fd-muted-foreground mb-6">
          reStructuredText rendering for JavaScript / TypeScript
        </p>
        <p className="text-fd-muted-foreground max-w-2xl mx-auto mb-8">
          Parse RST to a unified AST, then render to HTML, React components, or
          Markdown. Built-in Jinja2-compatible template engine, Vite plugin, and
          CLI tool. Full CJK support for Chinese documentation and bioinformatics
          report generation.
        </p>
        <div className="flex flex-row gap-4 justify-center">
          <Link
            href="/docs"
            className="inline-flex items-center rounded-full px-8 py-3 bg-fd-primary text-fd-primary-foreground font-medium"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/seqyuan/rst"
            className="inline-flex items-center rounded-full px-8 py-3 border font-medium"
            target="_blank"
            rel="noreferrer"
          >
            GitHub →
          </a>
        </div>
      </section>

      {/* Modules */}
      <section>
        <h2 className="text-2xl font-semibold mb-6 text-center">Packages</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {modules.map((m) => (
            <Link
              key={m.title}
              href={m.href}
              className="block border rounded-xl p-6 hover:border-fd-primary transition-colors"
            >
              <div className="text-3xl mb-3">{m.icon}</div>
              <h3 className="font-semibold mb-2">{m.title}</h3>
              <p className="text-sm text-fd-muted-foreground">{m.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Highlights */}
      <section>
        <h2 className="text-2xl font-semibold mb-6 text-center">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {highlights.map((h) => (
            <div key={h.title} className="border rounded-xl p-5">
              <div className="text-2xl mb-2">{h.icon}</div>
              <h3 className="font-semibold mb-1">{h.title}</h3>
              <p className="text-sm text-fd-muted-foreground">{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Example */}
      <section className="border rounded-xl overflow-hidden">
        <div className="bg-fd-muted px-6 py-3 border-b text-sm font-medium">
          Quick Start
        </div>
        <pre className="p-6 text-sm overflow-x-auto">
          <code>{`pnpm add @seqyuan/rst-renderer

import { renderRst } from '@seqyuan/rst-renderer'

const html = renderRst(\`Hello
=====

This is **bold** and *italic* text.

- item 1
- item 2

.. note:: This will be rendered as an admonition box.
\`)

// → <h2 id="hello">Hello</h2>
//   <p>This is <strong>bold</strong> and <em>italic</em> text.</p>
//   <ul><li>item 1</li><li>item 2</li></ul>
//   <div class="admonition admonition-note">...</div>`}</code>
        </pre>
      </section>
    </div>
  )
}
