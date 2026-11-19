import { unified, type Plugin } from "unified";
import type { Root } from "mdast";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

// plugin: (helper) removes YAML node so that it doesn't reach the HTML
const stripFrontmatter: Plugin<[], Root> = () => (tree) => {
  tree.children = tree.children.filter((n) => n.type !== "yaml");
};

// built once, when the worker starts
const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(stripFrontmatter)
  .use(remarkRehype)
  .use(rehypeStringify);

type Request = { id: number; text: string };

self.onmessage = async (e: MessageEvent<Request>) => {
  const { id, text } = e.data;
  try {
    console.log("message  received");
    const file = await processor.process(text);
    self.postMessage({ id, html: String(file) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
