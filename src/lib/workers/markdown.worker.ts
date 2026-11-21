import { unified, type Plugin } from "unified";
import type { Root } from "mdast";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Root as HastRoot, Element } from "hast";
import { buildSectionTree } from "$lib/section-tree";
import { addGrammar, highlightBlocks } from "./code-blocks";
import { callouts } from "./callouts";

const BLOCKS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "pre",
  "ul",
  "ol",
  "li",
  "hr",
  "table",
  "blockquote",
]);

// plugin: (helper) removes YAML node so that it doesn't reach the HTML
const stripFrontmatter: Plugin<[], Root> = () => (tree) => {
  tree.children = tree.children.filter((n) => n.type !== "yaml");
};

// copy each block's starting sourc eline into a data attribute
// positions: relative to the whole file (we parse the whole file)
// frontmatter is included, so no offset
const addSourceLines: Plugin<[], HastRoot> = () => (tree) => {
  const walk = (node: HastRoot | Element) => {
    for (const child of node.children) {
      if (child.type !== "element") continue;
      if (BLOCKS.has(child.tagName) && child.position) {
        child.properties.dataSourceLine = child.position.start.line;
      }
      walk(child);
    }
  };
  walk(tree);
};

// same allow-list github uses, plus our attribute
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "dataSourceLine"],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      [
        "className",
        /^callout(-title|-body|-(note|tip|important|warning|caution))?$/,
      ] as [string, RegExp],
    ],
  },
};

// built once, when the worker starts
const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(stripFrontmatter)
  .use(remarkRehype)
  .use(addSourceLines)
  .use(callouts)
  .use(rehypeSanitize, schema)
  .use(highlightBlocks)
  .use(rehypeStringify);

type Request =
  | { id: number; text: string }
  | { type: "grammar"; name: string; json: string };

let queue: Promise<void> = Promise.resolve();

self.onmessage = async (e: MessageEvent<Request>) => {
  queue = queue.then(() => handle(e.data));
};

async function handle(msg: Request) {
  if ("type" in msg) {
    addGrammar(msg.name, msg.json);
    return;
  }
  try {
    const file = await processor.process(msg.text);
    self.postMessage({
      id: msg.id,
      html: String(file),
      tree: buildSectionTree(msg.text),
    });
  } catch (e) {
    self.postMessage({ id: msg.id, error: String(e) });
  }
}
