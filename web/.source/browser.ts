// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"cli.mdx": () => import("../content/docs/cli.mdx?collection=docs"), "gallery.mdx": () => import("../content/docs/gallery.mdx?collection=docs"), "html-rendering.mdx": () => import("../content/docs/html-rendering.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "react-rendering.mdx": () => import("../content/docs/react-rendering.mdx?collection=docs"), "rst-rules.mdx": () => import("../content/docs/rst-rules.mdx?collection=docs"), "template-engine.mdx": () => import("../content/docs/template-engine.mdx?collection=docs"), }),
};
export default browserCollections;