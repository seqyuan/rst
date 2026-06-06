// @ts-nocheck
import * as __fd_glob_7 from "../content/docs/template-engine.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/rst-rules.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/react-rendering.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/html-rendering.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/gallery.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/cli.mdx?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, }, {"cli.mdx": __fd_glob_1, "gallery.mdx": __fd_glob_2, "html-rendering.mdx": __fd_glob_3, "index.mdx": __fd_glob_4, "react-rendering.mdx": __fd_glob_5, "rst-rules.mdx": __fd_glob_6, "template-engine.mdx": __fd_glob_7, });