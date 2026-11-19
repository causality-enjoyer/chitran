import type { Heading, PhrasingContent } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

export type Section = {
  id: string;
  level: number; // 0 = synthetic root, 1-6 = real headings
  title: string;
  source_line_start: number; // heading line (1 for the root)
  source_line_end: number; // last line of the section, children included
  own_content: string; // text between this heading and its first child
  children: Section[];
};

// Plain text of a heading, ignoring emphasis, links and so on
function textOf(nodes: PhrasingContent[]): string {
  let out = "";
  for (const n of nodes) {
    if ("value" in n) out += n.value;
    else if ("children" in n) out += textOf(n.children as PhrasingContent[]);
  }
  return out;
}

export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
  return s || "section";
}

const parser = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm);

export function buildSectionTree(text: string): Section {
  const lines = text.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  const totalLines = Math.max(lines.length, 1);
  const tree = parser.parse(text);

  const root: Section = {
    id: "root",
    level: 0,
    title: "",
    source_line_start: 1,
    source_line_end: totalLines,
    own_content: "",
    children: [],
  };

  const seen = new Map<string, number>();
  const uniqueId = (title: string) => {
    const base = slugify(title);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };

  // Only top-level headings count;
  // Headings inside blockquotes or lists are part of that block's content
  // and code fences never produce heading nodes
  const headings = tree.children.filter(
    (n): n is Heading => n.type === "heading" && !!n.position,
  );

  const stack: Section[] = [root];
  const sections: Section[] = [];

  for (const h of headings) {
    const title = textOf(h.children).trim();
    const node: Section = {
      id: uniqueId(title),
      level: h.depth,
      title,
      source_line_start: h.position!.start.line,
      source_line_end: totalLines, // tightened below
      own_content: "",
      children: [],
    };

    // Close every open section that is not an ancestor of this heading
    while (stack[stack.length - 1].level >= node.level) {
      const closed = stack.pop()!;
      closed.source_line_end = node.source_line_start - 1;
    }

    stack[stack.length - 1].children.push(node);
    stack.push(node);
    sections.push(node);
  }

  // Own content: from the line after the heading to the line before the next heading
  // of any level; the first child, or the next sibling
  const root_first = sections[0]?.source_line_start ?? totalLines + 1;
  root.own_content = lines.slice(0, root_first - 1).join("\n");

  sections.forEach((node, i) => {
    const next = sections[i + 1];
    const stop = next ? next.source_line_start - 1 : totalLines;
    node.own_content = lines.slice(node.source_line_start, stop).join("\n");
  });

  return root;
}
