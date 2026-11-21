import type { Plugin } from "unified";
import type { Root, Element, ElementContent } from "hast";
const TYPES = new Set(["note", "tip", "important", "warning", "caution"]);
const MARKER = /^\[!(\w+)\][ \t]*([^\n]*)\n?/;

const callouts: Plugin<[], Root> = () => (tree) => {
  const visit = (node: Root | Element) => {
    node.children.forEach((child, i) => {
      if (child.type !== "element") return;

      if (child.tagName === "blockquote") {
        const converted = convert(child);
        if (converted) {
          node.children[i] = converted;
          visit(converted);
          return;
        }
      }
      visit(child);
    });
  };
  visit(tree);
};

function convert(bq: Element): Element | null {
  const para = bq.children.find(
    (c): c is Element => c.type === "element" && c.tagName === "p",
  );
  const first = para?.children[0];
  if (!para || first?.type !== "text") return null;

  const m = MARKER.exec(first.value);
  const type = m?.[1].toLowerCase();
  if (!m || !type || !TYPES.has(type)) return null;

  first.value = first.value.slice(m[0].length); // drop the marker
  const title = m[2].trim() || type[0].toUpperCase() + type.slice(1);

  // an empty first paragraph (marker-only line) is removed
  const body = bq.children.filter(
    (c) =>
      !(
        c === para &&
        para.children.every((x) => x.type === "text" && !x.value.trim())
      ),
  );

  return {
    type: "element",
    tagName: "div",
    properties: {
      className: ["callout", `callout-${type}`],
      dataSourceLine: bq.properties.dataSourceLine,
    },
    children: [
      {
        type: "element",
        tagName: "div",
        properties: { className: ["callout-title"] },
        children: [{ type: "text", value: title }],
      },
      {
        type: "element",
        tagName: "div",
        properties: { className: ["callout-body"] },
        children: body as ElementContent[],
      },
    ],
  };
}

export { callouts };
