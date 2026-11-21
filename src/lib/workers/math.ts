import type { Plugin } from "unified";
import type { Root, Element, ElementContent } from "hast";

type Hit = {
  parent: Root | Element;
  index: number;
  el: Element;
  display: boolean;
  source: string;
};

const isMathCode = (n: ElementContent): n is Element =>
  n.type === "element" &&
  n.tagName === "code" &&
  Array.isArray(n.properties.className) &&
  n.properties.className?.includes("language-math");

function textOf(node: Element): string {
  let out = "";
  for (const c of node.children) {
    if (c.type === "text") out += c.value;
    else if (c.type === "element") out += textOf(c);
  }
  return out;
}

function collect(node: Root | Element, hits: Hit[]) {
  node.children.forEach((c, index) => {
    if (c.type !== "element") return;
    const code = c.tagName === "pre" ? c.children.find(isMathCode) : undefined;
    if (code) {
      // $$ blocks and ```math fences: display mode
      hits.push({
        parent: node,
        index,
        el: c,
        display: true,
        source: textOf(code),
      });
    } else if (isMathCode(c)) {
      hits.push({
        parent: node,
        index,
        el: c,
        display: false,
        source: textOf(c),
      });
    } else {
      collect(c, hits);
    }
  });
}

export const renderMath: Plugin<[], Root> = () => async (tree) => {
  const hits: Hit[] = [];
  collect(tree, hits);
  if (hits.length === 0) return; // no math: no katex import

  const katex = (await import("katex")).default;

  for (const { parent, index, el, display, source } of hits) {
    const html = katex.renderToString(source.trim(), {
      displayMode: display,
      throwOnError: false, // bad KaTeX renders as red source text, no exception thrown
      strict: "ignore", // no console warning when typing
    });

    // "raw" nodes are written out as-is by rehype-stringify
    const raw = { type: "raw", value: html } as unknown as ElementContent;
    parent.children[index] = display
      ? {
          type: "element",
          tagName: "div",
          // keep the source line so cursor sync still finds this block
          properties: {
            className: ["math-block"],
            dataSourceLine: el.properties.dataSourceLine,
          },
          children: [raw],
        }
      : raw;
  }
};
