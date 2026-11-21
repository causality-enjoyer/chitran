import type { HighlighterCore, LanguageInput } from "shiki/core";
import { createCssVariablesTheme, createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { Element, Root, ElementContent } from "hast";
import type { Plugin } from "unified";

const BUNDLED: Record<string, () => Promise<{ default: LanguageInput }>> = {
  // anybody ever watched/read One Piece? Shiki sounds funny to me as one piece fan lol
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  bash: () => import("shiki/langs/python.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
};

// prettier-ignore
const ALIASES: Record<string, string> = {
	js: "javascript",	mjs: "javascript",	ts: "typescript",
	sh: "bash",				shell: "bash",			zsh: "zsh",
	py: "python",			rs: "rust",					"c++": "cpp",
	h: "c",						hpp: "cpp",					c: "c",
	cpp: "cpp",				yml: "yaml",				htm: "html"
};

// User gramms: config name -> raw JSON, registered lazily on first use
const grammars = new Map<string, string>();
const userIds = new Map<string, string>();
export function addGrammar(name: string, json: string) {
  grammars.set(name.toLowerCase(), json);
}

// Created on the first fence that needs it, so plain-text notes never load Shiki
let highlighter: Promise<HighlighterCore> | null = null;
function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [
      createCssVariablesTheme({
        name: "chitran",
        variablePrefix: "--shiki-",
        variableDefaults: {},
        fontStyle: true,
      }),
    ],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return highlighter;
}

/** Returns the Shiki language id for a fence name, or null for plain text */
async function load(lang: string): Promise<string | null> {
  const key = ALIASES[lang] ?? lang;
  const bundled = Object.hasOwn(BUNDLED, key);

  if (!bundled && !grammars.has(key)) return null; // cheap check before loading Shiki

  const hl = await getHighlighter();
  if (bundled) {
    if (!hl.getLoadedLanguages().includes(key)) {
      await hl.loadLanguage((await BUNDLED[key]()).default);
    }
    return key;
  }

  let id = userIds.get(key);
  if (!id) {
    const g = JSON.parse(grammars.get(key)!);
    id = (g.name as string | undefined) ?? key;
    await hl.loadLanguage({ ...g, name: id });
    userIds.set(key, id);
  }
  return id;
}

function textOf(node: Element): string {
  let out = "";
  for (const c of node.children) {
    if (c.type === "text") out += c.value;
    else if (c.type === "element") out += textOf(c);
  }
  return out;
}

function langOf(code: Element): string {
  const cls = code.properties.className;
  const list = Array.isArray(cls) ? cls : [];
  const hit = list.find(
    (c) => typeof c === "string" && c.startsWith("language-"),
  );
  return typeof hit === "string" ? hit.slice("language-".length) : "";
}

type Hit = {
  parent: Root | Element;
  index: number;
  pre: Element;
  code: Element;
};

function collect(node: Root | Element, hits: Hit[]) {
  node.children.forEach((c, index) => {
    if (c.type !== "element") return;
    if (c.tagName === "pre") {
      const code = c.children.find(
        (n): n is Element => n.type === "element" && n.tagName === "code",
      );
      if (code) hits.push({ parent: node, index, pre: c, code });
      return;
    }
    collect(c, hits);
  });
}

function header(label: string): Element {
  return {
    type: "element",
    tagName: "div",
    properties: { className: ["code-header"] },
    children: [
      {
        type: "element",
        tagName: "span",
        properties: { className: ["code-lang"] },
        children: [{ type: "text", value: label }],
      },
      {
        type: "element",
        tagName: "button",
        properties: {
          type: "button",
          className: ["code-copy"],
          ariaLabel: "Copy code",
        },
        children: [{ type: "text", value: "Copy" }],
      },
    ],
  };
}

export const highlightBlocks: Plugin<[], Root> = () => async (tree) => {
  const hits: Hit[] = [];
  collect(tree, hits);

  for (const { parent, index, pre, code } of hits) {
    const lang = langOf(code).toLowerCase();
    if (lang === "mermaid") continue; // its own renderer

    const source = textOf(code).replace(/\n$/, "");
    let shown: Element = pre; // fallback: the plain block
    try {
      const id = lang ? await load(lang) : null;
      if (id) {
        const hl = await getHighlighter();
        const root = hl.codeToHast(source, { lang: id, theme: "chitran" });
        const first = root.children[0];
        if (first?.type === "element") shown = first;
      }
    } catch (e) {
      console.warn(`Highlighting "${lang}" failed, using plain text:`, e);
    }

    const wrapper: Element = {
      type: "element",
      tagName: "div",
      // keep the source lines os cursor sync still finds this block
      properties: {
        className: ["code-block"],
        dataSourceLine: pre.properties.dataSourceLine,
      },
      children: [header(lang || "text"), shown] as ElementContent[],
    };
    parent.children[index] = wrapper; // 1:1 swap, so later indexes stay valid
  }
};
