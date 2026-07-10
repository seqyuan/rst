// @ts-nocheck
import * as __fd_glob_12 from "../content/docs/getting-started/index.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/getting-started/bioinformatics-report.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/vite-plugin.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/template-engine.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/rst-rules.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/react-rendering.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/markdown-rendering.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/html-rendering.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/gallery.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/cli.mdx?collection=docs"
import { default as __fd_glob_1 } from "../content/docs/getting-started/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, "getting-started/meta.json": __fd_glob_1, }, {"cli.mdx": __fd_glob_2, "gallery.mdx": __fd_glob_3, "html-rendering.mdx": __fd_glob_4, "index.mdx": __fd_glob_5, "markdown-rendering.mdx": __fd_glob_6, "react-rendering.mdx": __fd_glob_7, "rst-rules.mdx": __fd_glob_8, "template-engine.mdx": __fd_glob_9, "vite-plugin.mdx": __fd_glob_10, "getting-started/bioinformatics-report.mdx": __fd_glob_11, "getting-started/index.mdx": __fd_glob_12, });