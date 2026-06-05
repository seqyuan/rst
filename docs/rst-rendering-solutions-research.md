# RST (reStructuredText) 渲染方案调研报告

> 调研日期: 2026-06-05  
> 调研范围: JavaScript/TypeScript 生态、Python 参考实现、annopi 项目方案  
> 目标: 评估开发独立 TS 包做 RST 渲染的可行性

---

## 目录

1. [RST 格式简介](#1-rst-格式简介)
2. [Python 生态 (参考标准)](#2-python-生态-参考标准)
3. [JS/TS 生态全景](#3-jsts-生态全景)
4. [重点方案深度分析](#4-重点方案深度分析)
5. [annopi 的 RST 方案](#5-annopi-的-rst-方案)
6. [独立 TS 包开发评估](#6-独立-ts-包开发评估)
7. [推荐方案与路线图](#7-推荐方案与路线图)

---

## 1. RST 格式简介

reStructuredText (RST) 是 Python 社区广泛使用的轻量级标记语言，由 Docutils 项目定义。主要特点：

- **没有正式规范** — 参考实现即标准 (Python docutils)
- **可扩展** — 通过 directives 和 interpreted text roles 扩展
- **Sphinx 生态** — Python 文档生成的主流选择 (ReadTheDocs 等)
- **功能丰富** — 表格、图片、代码块、数学公式、交叉引用、警告框等

RST 的核心语法元素：

| 元素类型 | 示例 | 说明 |
|---------|------|------|
| 标题 | `=====` 下划线 | 章节标题 |
| 内联标记 | `**粗体**`, `*斜体*`, \`\`代码\`\` | 文本样式 |
| 指令 (Directives) | `.. image:: pic.png` | 块级扩展 (图片、代码、表格等) |
| 解释文本角色 | `:ref:\`标签\`` | 内联扩展 (引用、下载链接等) |
| 列表 | `-`, `*`, `1.`, `#.` | 无序/有序/自动编号列表 |
| 表格 | Grid/Simple 表格, csv-table, list-table | 多种表格格式 |
| 超链接 | \`文本 <url>\`\_ | 外部链接 |
| 替换引用 | `\|ref\|` | 图片/文本替换 |

---

## 2. Python 生态 (参考标准)

### 2.1 Docutils (v0.21.2)

**Python RST 的参考实现**，是判断其他实现完整度的基准。

```
核心能力:
├── 解析器 (Parser):  RST → AST (document tree)
├── 转换器 (Transformer):  AST 变换
├── 写入器 (Writers):     AST → HTML/LaTeX/XML/man/...
└── 43 个内置指令:        image, code, math, table, admonition...
```

**内置指令列表 (43个)**:
```
admonition, attention, caution, class, code, compound, container,
contents, csv-table, danger, date, default-role, epigraph, error,
figure, footer, header, highlights, hint, image, important,
include, line-block, list-table, math, meta, note, parsed-literal,
pull-quote, raw, replace, rubric, section-numbering, sidebar,
syntax-highlight, table, target-notes, tip, title, topic,
unicode, warning
```

**输出格式**:
- `html` / `html5` — HTML 输出
- `latex` / `xetex` — LaTeX 输出
- `man` — man page
- `xml` / `pseudoxml` — XML 调试
- `s5` — S5 幻灯片

### 2.2 Sphinx (v9.1.0)

在 Docutils 基础上增加：
- **交叉引用系统** (`:ref:`, `:doc:`, `:download:`)
- **域系统** (Python/C++/JS 等语言的文档域)
- **扩展机制** (大量第三方扩展)
- **主题系统** (pydata-sphinx-theme 等)
- **多输出格式** (HTML, PDF, ePub, man 等)

### 2.3 Python 方案优势与局限

✅ **优势**:
- 功能完整，是 RST 的事实标准
- Sphinx 生态成熟 (ReadTheDocs, JupyterBook)
- Jinja2 模板能力极强 (循环、条件、过滤器)

❌ **局限**:
- Python 运行时依赖 (无法浏览器端运行)
- 性能受限于 CPython 解释器
- 与现代 JS 前端生态隔离

---

## 3. JS/TS 生态全景

### 3.1 总览图

```
npm 搜索 "reStructuredText" / "rst" 结果分类:

🔴 已废弃 (< v1.0, 多年未更新)
├── restructured (v0.0.11, 2016)          — 纯 JS RST 解析器
├── @rst-js/* (v0.0.2, 2019)              — Webpack/RST/React 工具链
├── rst2mdown (v0.1.0, 2012)              — RST→Markdown 转换
├── gatsby-plugin-rst (v0.0.2, 2019)      — Gatsby RST 插件
├── rst-live-preview (v1.0.4, 2016)       — RST 实时预览
├── rest-simple-table (v1.0.1, 2015)      — RST 简单表格
└── @frantic1048/est (v0.0.4, 2017)       — RST 解析+渲染

🟡 有限维护
├── textlint-plugin-rst (v0.1.1, 2016)    — textlint RST 支持
├── gitbook-restructuredtext (v0.2.3, 2015)— GitBook RST
└── docutils-ts (v1.0.7)                  — Python Docutils 移植

🟢 活跃维护
├── rst-compiler (v0.5.9, 2024-2026)      — ★ 10, 活跃
├── tree-sitter-rst (v0.2.0, 2025)        — ★ 55, 活跃
├── @nousdev/parser-rst (v0.2.0, 2026)    — 新兴项目
└── @lumis-sh/wasm-rst (v0.26.0, 2025)    — tree-sitter WASM
```

### 3.2 关键缺失

| 能力 | Python | JS/TS |
|------|--------|-------|
| 完整的 RST → HTML 渲染 | ✅ docutils | ⚠️ 部分 (rst-compiler) |
| RST → React 组件 | ❌ | ❌ **不存在** |
| unified/remark 生态集成 | ❌ | ❌ **不存在** |
| RST → Markdown | ✅ pandoc | ⚠️ 部分 (rst-compiler) |
| Sphinx 扩展兼容 | ✅ | ❌ |
| Jinja2 模板 | ✅ | ⚠️ Nunjucks (社区) |
| 浏览器端渲染 | ❌ | ✅ (rst-compiler) |
| 性能 (WASM) | ❌ | ✅ (tree-sitter) |

**核心发现**: JS/TS 生态中**没有一个完整的、生产级的 RST → HTML/React 渲染方案**。最接近的是 `rst-compiler`，但仍在 v0.x 阶段。

---

## 4. 重点方案深度分析

### 4.1 `rst-compiler` (★10, 2024-2026 持续更新)

**GitHub**: https://github.com/Trinovantes/rst-compiler  
**npm**: `rst-compiler@0.5.9`  
**许可**: MIT | **语言**: 纯 TypeScript

#### 架构

```typescript
// 基本用法
const html = new RstToHtmlCompiler().compile(rst)
// html.header — <head> 内容
// html.body  — 主文档

// 多文档编译 (解决交叉引用)
const compiler = new RstToHtmlCompiler()
const doc1 = compiler.parse(':doc:`See Doc 2 <./foo>`')
const doc2 = compiler.parse('Document 2')
const html = compiler.generate({
    basePath: '/blog/',
    currentDocPath: 'index',
    docs: [{ docPath: 'index', parserOutput: doc1 }, ...]
})
```

#### 已支持的指令

| 指令 | 状态 | 备注 |
|------|------|------|
| 所有标准文本角色 | ✅ | docutils 标准 |
| `:ref:`, `:doc:`, `:download:` | ✅ | Sphinx 兼容 |
| attention/caution/danger/error/hint/important/note/tip/warning/admonition | ✅ | 警告框 |
| image, figure | ✅ | 图片 |
| only | ✅ | 条件输出 |
| code, highlight | ✅ | 基于 Shiki 语法高亮 |
| math | ✅ | 基于 KaTeX |
| tabs, tab, code-tab | ✅ | sphinx-tabs 兼容 |

#### 插件系统

```typescript
import { RstCompilerPlugin } from 'rst-compiler'

const plugin: RstCompilerPlugin = {
    onInstall: (compiler) => {
        compiler.useDirectiveGenerator({
            directives: ['custom-directive'],
            generate: (generatorState, node) => {
                generatorState.visitNodes(node.children)
            },
        })
    },
}
```

#### 局限性

1. ⚠️ **非正式规范** — RST 没有正式规范，行为可能与 Python docutils 有细微差异
2. ⚠️ **无 Sphinx 扩展** — 第三方 Sphinx 扩展和大部分 Python 实现的指令不可用
3. ⚠️ **安全风险** — 无 XSS 过滤；大量使用正则可能导致 ReDoS
4. ⚠️ **仅空格缩进** — 不支持 Tab 缩进
5. ⚠️ **v0.x 阶段** — API 可能变化

#### 依赖

```
katex (数学渲染), shiki (代码高亮)
```

#### 评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整度 | ⭐⭐⭐⭐ | 覆盖核心 RST 特性，支持插件扩展 |
| 代码质量 | ⭐⭐⭐⭐ | 纯 TypeScript，良好的架构 |
| 活跃度 | ⭐⭐⭐⭐ | 2024-2026 持续更新，30+ 版本 |
| 社区规模 | ⭐⭐ | 10 stars, 2 forks |
| 生产就绪 | ⭐⭐⭐ | v0.x 阶段，缺少大项目验证 |

**结论**: 当前 JS/TS 生态中**最完整、最适合作为基础**的方案。

---

### 4.2 `tree-sitter-rst` (★55, 2025)

**GitHub**: https://github.com/stsewd/tree-sitter-rst  
**npm**: `tree-sitter-rst@0.2.0`  
**许可**: MIT | **语言**: C (tree-sitter grammar) + Node binding

#### 特点

- **仅提供解析** — 输出语法树 (CST/AST)，不提供渲染
- **tree-sitter 生态** — 可与 Neovim、Zed、Helix 等编辑器集成
- **性能极高** — C 实现，增量解析
- **社区认可** — 55 stars, 10 forks, 来自 Read the Docs 维护者

#### 适用场景

- 为编辑器提供 RST 语法高亮/折叠
- 作为自定义 RST 渲染器的基础解析层
- 代码分析、linting 工具

#### 评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 解析准确度 | ⭐⭐⭐⭐ | C 实现，tree-sitter 社区维护 |
| 渲染能力 | ⭐ | 纯解析器，不提供渲染 |
| 活跃度 | ⭐⭐⭐⭐ | 活跃维护 |
| 社区规模 | ⭐⭐⭐ | 55 stars, 10 forks |

**结论**: 适合作为**底层解析器**，但需要自行实现完整的渲染层。

---

### 4.3 `@nousdev/parser-rst` (v0.2.0, 2026)

**GitHub**: https://github.com/salmad3/nousdev  
**npm**: `@nousdev/parser-rst@0.2.0`  
**许可**: MIT | **语言**: TypeScript

#### 特点

- 解析 RST → **Nous Document Model** (自定义 AST)
- 面向 "agent-readability" / 知识基础设施
- 新兴项目 (2026-03)，单一维护者
- 采用 ESM 模块格式

#### 评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整度 | ⭐⭐ | 早期项目，功能有限 |
| 渲染能力 | ⭐ | 解析到自定义模型，非标准输出 |
| 活跃度 | ⭐⭐ | 非常新，版本迭代快但不确定持续性 |
| 社区规模 | ⭐ | 1 个维护者，无社区 |

**结论**: 有潜力但过于早期，不适合作为生产方案的基础。

---

### 4.4 `docutils-ts` (v1.0.7)

**GitHub**: https://github.com/boltex/docutils-ts  
**npm**: `docutils-ts@1.0.7`  
**许可**: MIT | **语言**: TypeScript

#### 特点

- Python Docutils 到 TypeScript 的**直接移植**
- 使用 EJS 模板引擎进行 HTML 渲染
- 保留了 Docutils 的架构 (解析器/转换器/写入器)
- 依赖 Python 风格的库 (argparse-js, camelcase)
- 文档和社区极其有限

#### 评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整度 | ⭐⭐⭐ | 移植了 Docutils 核心架构 |
| 渲染能力 | ⭐⭐⭐ | EJS 模板渲染 |
| 活跃度 | ⭐⭐ | 更新不活跃 |
| 社区规模 | ⭐ | 几乎无社区 |

**结论**: 理论上最接近 Python Docutils 的完整度，但实际维护状态存疑。代码风格偏 Pythonic，与现代 TS 生态融合度低。

---

### 4.5 `@lumis-sh/wasm-rst` (v0.26.0)

**GitHub**: https://lumis.sh  
**npm**: `@lumis-sh/wasm-rst@0.26.0`  
**许可**: MIT

#### 特点

- tree-sitter RST 语法的 **WASM 编译版本**
- 零依赖，可在浏览器中运行
- 仅提供解析，无渲染

**结论**: 适合需要**浏览器端高性能解析**的场景，需配合自研渲染层。

---

### 4.6 其他相关包

| 包名 | 版本 | 功能 | 状态 |
|------|------|------|------|
| `myst-parser` | 1.7.3 | MyST (Markdown+RST) 解析器 | 🟢 活跃 |
| `myst-directives` | 1.7.3 | MyST 指令定义 | 🟢 活跃 |
| `markdown-it-docutils` | 0.1.6 | markdown-it 的 docutils 风格指令 | 🟡 停滞 |
| `typedoc-plugin-sphinx` | 0.1.0 | TypeDoc → RST (Sphinx) | 🟡 停滞 |
| `textlint-plugin-rst` | 0.1.1 | RST textlint 支持 | 🔴 废弃 |

---

## 5. annopi 的 RST 方案

### 5.1 架构概览

annopi 是一个生信流程编排框架，其报告系统采用 **Jinja2 模板 + Sphinx 构建** 的纯 Python 方案：

```
┌─────────────────────────────────────────────────┐
│                  annopi Report Pipeline          │
├─────────────────────────────────────────────────┤
│                                                  │
│  report.rst.j2 (Jinja2 模板)                     │
│       │                                          │
│       ├── 数据扫描 (--data upload/cellranger)     │
│       │   └── 提供: {tables, images, files}      │
│       │                                          │
│       ├── 外部变量 (--var key=value)              │
│       │   └── project_name, description...       │
│       │                                          │
│       ▼                                          │
│  annopi report 命令                               │
│       │  Jinja2 渲染                              │
│       ▼                                          │
│  output.rst (纯 RST 文件)                         │
│       │                                          │
│       ▼                                          │
│  sphinx-build                                    │
│       │  RST → HTML                              │
│       ▼                                          │
│  report/build/html/ (最终 HTML)                   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 5.2 核心组件

#### TemplateRenderer (Python)

```python
class TemplateRenderer:
    def scan_upload_dir(upload_path) -> Dict[str, Any]:
        """扫描 upload 目录，提取文件树结构"""
    
    def render_template(template_path, output_path, context):
        """Jinja2 模板 → RST 文件"""
    
    def render_string(template_string, context) -> str:
        """模板字符串渲染"""
```

#### RST 模板示例

```rst
Cellranger Report
=================

Summary
-------
.. csv-table::
   :file: {{ data.tables[0] }}

Results
-------
{% for img in data.images %}
.. image:: ../../upload/cellranger/{{ img }}
   :width: 600px
{% endfor %}
```

### 5.3 annopi 方案评价

✅ **优势**:
- Jinja2 模板能力强 (循环/条件/过滤器)
- Sphinx 输出质量高，支持多种主题
- 与 Python 分析工具链天然集成
- 模板随任务模块分发，可复用

❌ **局限**:
- 依赖 Python 运行时 (Sphinx + Jinja2)
- 无法在纯前端/Node.js 环境使用
- Sphinx 构建速度慢 (大型项目)
- 模板和数据扫描逻辑紧耦合

---

## 6. 独立 TS 包开发评估

### 6.1 为什么现在是一个好时机

1. **生态空白**: 没有一个生产级的 RST → HTML/React TS 包
2. **Web 化趋势**: 越来越多的工具需要浏览器端 RST 渲染 (在线文档、Notebook、报告平台)
3. **WASM 成熟**: tree-sitter + WASM 提供高性能解析基础
4. **AI 时代需求**: LLM 输出需要结构化渲染，RST 是候选格式之一
5. **现有方案不足**: `rst-compiler` 虽好但功能不完整、社区小

### 6.2 可能的三种技术路线

#### 路线 A: 在 `rst-compiler` 基础上扩展

```
rst-compiler (解析 + HTML)
    │
    ├── + React 渲染器 (RST → React 组件)
    ├── + Markdown 输出完善
    ├── + 更多 Sphinx 指令支持
    ├── + XSS 安全过滤
    └── + WASM 解析后端 (tree-sitter-rst)
```

| 优势 | 劣势 |
|------|------|
| 起点高 (已有完整解析+渲染) | 受限于上游设计决策 |
| 社区已有基础 | API 稳定性不保证 |
| 可贡献上游 | 定制灵活性受限 |

#### 路线 B: 基于 `tree-sitter-rst` 从零构建

```
tree-sitter-rst (CST 解析)
    │
    ├── CST → AST 转换
    │
    ├── AST → HTML 渲染器
    ├── AST → React 渲染器
    ├── AST → Markdown 渲染器
    └── AST → JSON 序列化
```

| 优势 | 劣势 |
|------|------|
| 完全控制架构 | 开发工作量大 |
| 解析性能最优 (C/WASM) | 需要实现所有 RST 语义 |
| 可与编辑器生态集成 | 长周期开发 |

#### 路线 C: 混合方案 (推荐)

```
┌──────────────────────────────────────────┐
│           @seqyuan/rst-renderer           │
├──────────────────────────────────────────┤
│                                           │
│  解析层 (可插拔)                           │
│  ├── tree-sitter-rst (WASM, 高性能)       │
│  └── rst-compiler (纯 TS, 降级方案)       │
│                                           │
│  中间层 (统一 AST)                         │
│  └── RstDocument AST                     │
│                                           │
│  渲染层 (多目标输出)                        │
│  ├── HTML 渲染器                          │
│  ├── React 组件渲染器                     │
│  ├── Markdown 渲染器                      │
│  └── JSON/MDX 序列化                     │
│                                           │
│  扩展层                                    │
│  ├── 自定义指令注册                        │
│  ├── 自定义角色注册                        │
│  ├── Jinja2 兼容模板引擎 (Nunjucks)       │
│  └── 插件系统                             │
│                                           │
└──────────────────────────────────────────┘
```

### 6.3 最小可行产品 (MVP) 范围

**Phase 1: 核心解析 + HTML 渲染**
- [ ] 基于 `rst-compiler` 或 `tree-sitter-rst` 的解析
- [ ] 核心 RST 语法支持 (标题、段落、列表、链接、图片)
- [ ] 基本指令 (code, image, table, note/warning)
- [ ] HTML 输出
- [ ] TypeScript 类型定义

**Phase 2: React 渲染 + 扩展**
- [ ] React 组件输出
- [ ] 指令插件系统
- [ ] 语法高亮 (Shiki/Prism)
- [ ] 数学公式 (KaTeX)
- [ ] 交叉引用支持

**Phase 3: 生态集成**
- [ ] unified/remark 兼容插件
- [ ] Vite/Next.js 集成
- [ ] Nunjucks/Jinja2 模板支持
- [ ] CLI 工具
- [ ] 浏览器端 WASM 解析

### 6.4 与 annopi 的协同

```
annopi (Python)                    @seqyuan/rst-renderer (TS)
┌─────────────────┐               ┌──────────────────────┐
│ Jinja2 模板      │               │ Nunjucks/EJS 模板     │
│ Sphinx 构建      │               │ React/HTML 渲染       │
│ 数据分析集成      │               │ Web 集成              │
└────────┬────────┘               └──────────┬───────────┘
         │                                    │
         └──────────┬─────────────────────────┘
                    │
                    ▼
           共同输出: HTML / PDF / 报告
```

**协同价值**:
- TS 包可以替代 Sphinx 做 HTML 渲染 (Web 场景)
- 复用 annopi 的 RST 模板生态
- annopi 可以调用 TS 包做 Web 预览

---

## 7. 推荐方案与路线图

### 7.1 推荐: 路线 C (混合方案)

**第一步** (1-2 周):
1. Fork `rst-compiler` 或基于其架构设计自己的包
2. 学习 `tree-sitter-rst` 的解析能力
3. 定义统一的 RST AST 接口

**第二步** (2-4 周):
4. 实现核心 RST → HTML 渲染
5. 实现指令注册系统
6. 编写测试用例 (对比 Python docutils 输出)

**第三步** (4-6 周):
7. 实现 React 组件渲染器
8. 支持 Nunjucks 模板
9. 提供 CLI 和 API 文档

**第四步** (持续):
10. 扩展指令支持
11. Vite/Next.js 插件
12. WASM 解析后端集成

### 7.2 技术选型建议

| 组件 | 推荐 | 备选 |
|------|------|------|
| 解析器 | `rst-compiler` (参考架构) | `tree-sitter-rst` (后期引入) |
| 语法高亮 | Shiki | Prism.js |
| 数学渲染 | KaTeX | MathJax |
| 模板引擎 | Nunjucks (Jinja2 兼容) | EJS |
| 构建工具 | tsup / unbuild | Rollup |
| 测试框架 | Vitest | Jest |
| 文档 | VitePress / Fumadocs | Docusaurus |

### 7.3 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| RST 无正式规范 | 行为差异 | 以 docutils 输出为基准做差异测试 |
| 生态碎片化 | 维护成本高 | 聚焦核心用例，插件化扩展 |
| 社区小 | 采纳率低 | 从 annopi 需求出发，解决实际问题 |
| v0.x API 不稳定 | 重构成本 | 明确定义稳定的 Public API |

---

## 附录

### A. 参考链接

| 项目 | 链接 |
|------|------|
| rst-compiler | https://github.com/Trinovantes/rst-compiler |
| tree-sitter-rst | https://github.com/stsewd/tree-sitter-rst |
| @nousdev/parser-rst | https://github.com/salmad3/nousdev |
| docutils-ts | https://github.com/boltex/docutils-ts |
| @lumis-sh/wasm-rst | https://lumis.sh |
| Python docutils | https://docutils.sourceforge.io |
| Sphinx | https://www.sphinx-doc.org |
| MyST Parser (JS) | https://github.com/jupyter-book/mystmd |
| annopi | https://github.com/seqyuan/annopi |

### B. npm 包清单

| 包名 | 版本 | 描述 | 状态 |
|------|------|------|------|
| `rst-compiler` | 0.5.9 | RST → HTML/Markdown 编译器 | 🟢 活跃 |
| `tree-sitter-rst` | 0.2.0 | tree-sitter RST 语法 | 🟢 活跃 |
| `@nousdev/parser-rst` | 0.2.0 | RST → Nous 文档模型 | 🟢 新兴 |
| `docutils-ts` | 1.0.7 | Python Docutils TS 移植 | 🟡 维护中 |
| `@lumis-sh/wasm-rst` | 0.26.0 | tree-sitter RST WASM | 🟢 活跃 |
| `restructured` | 0.0.11 | RST 解析器 (JS) | 🔴 已废弃 |
| `@rst-js/react` | 0.0.2 | RST React 组件 | 🔴 已废弃 |
| `@rst-js/writer` | 0.0.2 | RST 写入器 | 🔴 已废弃 |
| `textlint-plugin-rst` | 0.1.1 | textlint RST 支持 | 🔴 已废弃 |
| `myst-parser` | 1.7.3 | MyST Markdown 解析器 | 🟢 活跃 |
| `myst-directives` | 1.7.3 | MyST 指令定义 | 🟢 活跃 |
| `markdown-to-restructuredtext` | 2.0.1 | MD → RST 转换 | 🔴 已废弃 |
