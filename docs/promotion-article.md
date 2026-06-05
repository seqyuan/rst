# rst-renderer：填补 JS/TS 生态十年空白的 RST 渲染引擎

> 一套为 JavaScript/TypeScript 生态打造的 reStructuredText 解析与多端渲染工具链。

---

## 一、背景：被遗忘的 RST，被锁住的报告

如果你做过生物信息学、写过 Sphinx 文档、或者维护过 Python 项目，你一定见过 `.rst` 文件——那个用 `====` 画标题、用 `.. note::` 写提示框的标记语言。

reStructuredText（RST）是 Python 生态的"官配"文档格式。Read the Docs 上数十万个项目、Sphinx 生成的数百万页文档、生物信息学领域成百上千的分析报告——底层全是 RST。

但有一个尴尬的现实：

| 对比维度 | Markdown | RST (reStructuredText) |
|---------|----------|------------------------|
| JS 生态工具链 | remark, rehype, MDX, unified... **丰富** | ❌ 几乎没有 |
| React 渲染 | MDX, next-mdx-remote... **成熟** | ❌ 不存在 |
| 浏览器端解析 | micromark, marked... **轻量** | ❌ 不可用 |
| Vue/Next.js 集成 | 原生支持 .md 导入 | ❌ 无法 import |
| CLI 工具 | 数十个成熟方案 | ❌ 只有 Python docutils |
| 模板引擎 | 无数选择 | ❌ 仅 Jinja2 (Python) |

**RST 被锁在 Python 的世界里。** 任何一个想把 RST 内容搬到 Web 上的需求，都绕不开 Python 运行时 + Sphinx 重型工具链。

**rst-renderer** 就是来解决这个问题的。

---

## 二、rst-renderer 是什么

一个**纯 TypeScript** 的 RST 全链路工具包：

```bash
pnpm add @seqyuan/rst-renderer
```

```
RST Source ──→ Parser ──→ Unified AST ──→ HTML / React / Markdown
                         │
                         └── Jinja2 模板引擎
                         └── Vite 热更新插件
                         └── CLI 命令行工具
```

### 三个包，完整工具链

| 包名 | 功能 | 安装 |
|------|------|------|
| `@seqyuan/rst-renderer` | 核心：解析器 + HTML/React/Markdown 渲染器 + 模板引擎 | `pnpm add @seqyuan/rst-renderer` |
| `@seqyuan/rst-cli` | 命令行：`rst-render input.rst -o out.html --standalone` | `pnpm add -g @seqyuan/rst-cli` |
| `@seqyuan/vite-plugin-rst` | Vite 插件：`import html from './doc.rst'` | `pnpm add -D @seqyuan/vite-plugin-rst` |

---

## 三、它能做什么

### 1. RST → HTML：11 个指令插件，开箱即用

```ts
import { renderRst } from '@seqyuan/rst-renderer'

const html = renderRst(`Hello
=====
This is **bold** text.
.. note:: This is important.
.. code:: typescript
   const x = 42
`)
```

内置指令：图片、代码高亮（Shiki 自动检测）、数学公式（KaTeX 自动检测）、警告框（note/warning/tip 等 10 种）、CSV 表格、原始 HTML、容器样式、文件引用。

**没有 Python、没有 Sphinx、不需要 docutils。** 一个 npm install 搞定。

### 2. RST → React：任意自定义组件

```tsx
import { ReactRenderer } from '@seqyuan/rst-renderer/react'

const renderer = new ReactRenderer({
  components: {
    Section: ({ node, children }) => (
      <section className="my-section">
        <h2>{node.title}</h2>
        {children}
      </section>
    ),
    Code: ({ node }) => <MyCodeBlock language={node.language} code={node.text} />,
  },
})
```

每个 RST 节点类型都可以映射到自定义 React 组件。**RST 版的 MDX**。

### 3. RST → Markdown：打通生态

```ts
import { MarkdownRenderer } from '@seqyuan/rst-renderer/markdown'

const md = new MarkdownRenderer({ headingOffset: 1 }).render(document)
// → ## Hello\n\nThis is **bold** text.\n
```

GFM 表格、代码块、图片、警告框全部映射为标准 Markdown。

### 4. Jinja2 模板引擎：兼容 annopi

内置 Jinja2 兼容模板引擎，支持嵌套 for/if/else、12 个 filter、loop 变量。

```jinja2
{% for sample in samples %}
{{ sample.name }}
{{ '=' * sample.name.length }}
- 细胞数：{{ sample.cells }}
{% endfor %}
```

可以直接复用 annopi 的生信报告模板。

### 5. Vite 插件：import .rst 就像 import .md

```ts
// vite.config.ts
import rst from '@seqyuan/vite-plugin-rst'
export default { plugins: [rst()] }

// 你的组件中
import { html } from './report.rst'       // HTML 字符串
import md from './report.rst?md'          // Markdown 字符串
import RstPage from './report.rst?react'  // React 组件
```

### 6. CLI：一行命令生成独立 HTML

```bash
rst-render report.rst.j2 -t -d data.json -o report.html --standalone
# → report.html ← 单文件，CSS + 图片全部内联，可直接发给客户
```

---

## 四、技术对比：为什么不用现有的？

| 方案 | 语言 | 问题 |
|------|------|------|
| Python docutils | Python | 需要 Python 运行时，无法浏览器端 |
| Sphinx | Python | 重型，构建慢，无法嵌入 JS 应用 |
| rst-compiler | TS (v0.5.9) | ★10，社区极小，React/模板不支持 |
| tree-sitter-rst | C/WASM | 仅解析不渲染，需要自研渲染层 |
| @nousdev/parser-rst | TS (v0.2.0) | 2026 年新项目，功能有限 |

**rst-renderer 是目前唯一一个同时提供 HTML + React + Markdown 三种渲染、Jinja2 模板、Vite 插件、CLI 工具、CJK 中文支持的完整方案。**

---

## 五、应用场景

- **生信报告自动化**：RST 模板 + 数据注入 → 一键 HTML，发邮件给客户
- **技术文档站**：RST 源码 → VitePress/Fumadocs 网站
- **React 应用嵌入**：RST 内容直接渲染为 React 组件树
- **LLM 输出渲染**：大模型生成 RST → 浏览器端直接渲染给用户
- **命令行报告**：CI/CD 中 `rst-render report.rst --standalone` 生成独立 HTML

---

## 六、开源 & 路线图

> GitHub: [github.com/seqyuan/rst](https://github.com/seqyuan/rst)  
> 文档站: [rst-xi.vercel.app](https://rst-xi.vercel.app)  
> License: MIT

- [x] HTML / React / Markdown 三端渲染
- [x] Jinja2 模板引擎（嵌套 for/if、12 filter）
- [x] Vite 插件 + CLI 工具
- [x] Shiki 代码高亮 + KaTeX 数学公式
- [x] CJK 中文全链路支持
- [x] `--standalone` 独立 HTML 输出
- [ ] unified/remark 生态插件
- [ ] WASM tree-sitter 高性能解析后端
- [ ] npm 包公开发布

---

*本文由 rst-renderer 团队撰写。欢迎 Star、PR 和反馈。*
