import type { HTML } from "mermaid/dist/diagram-api/types.js";

type Mermaid = typeof import("mermaid").default;

let loading: Promise<Mermaid> | null = null;
let initialized = false;
const svgCache = new Map<string, string>(); // diagram source -> svg
const bad = new Set<string>(); // sources that failed to parse
const inflight = new Map<string, Promise<string | null>>();
let counter = 0;

const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Call when the OS theme changes. Applies to diagrams on their next render */
export function resetMermaidTheme() {
  initialized = false;
  svgCache.clear();
  bad.clear();
}

async function ready(): Promise<Mermaid> {
  loading ??= import("mermaid").then((m) => m.default);
  const mermaid = await loading;
  if (!initialized) {
    const fg = cssVar("--fg"),
      bg = cssVar("--bg"),
      border = cssVar("--border");
    const muted = cssVar("--muted"),
      accent = cssVar("--accent"),
      code = cssVar("--code-bg");

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict", // mermaid sanitizes labes itself
      theme: "base", // base is the one theme that honors themeVariables
      fontFamily: cssVar("--font-prose"),
      themeVariables: {
        background: bg,
        textColor: fg,
        primaryColor: code,
        primaryTextColor: fg,
        primaryBorderColor: accent,
        secondaryColor: bg,
        tertiaryColor: bg,
        lineColor: muted,
        nodeBorder: border,
        clusterBkg: bg,
        clusterBorder: border,
        edgeLabelBackground: bg,
        noteBkgColor: code,
        noteTextColor: fg,
      },
    });
    initialized = true;
  }
  return mermaid;
}

async function compile(src: string): Promise<string | null> {
  const mermaid = await ready();
  try {
    if (!(await mermaid.parse(src, { suppressErrors: true }))) {
      bad.add(src);
      return null;
    }
    const { svg } = await mermaid.render(`mmd-${++counter}`, src);
    svgCache.set(src, svg);
    return svg;
  } catch (e) {
    bad.add(src);
    console.warn("Mermaid render failed:", e);
    return null;
  }
}

// One render per distinct source, even if the preview re-renders meanwhile
function getSvg(src: string): Promsie<string | null> {
  const hit = svgCache.get(src);
  if (hit) return Promise.resolve(hit);
  if (bad.has(src)) return Promise.resolve(null);
  let p = inflight.get(src);
  if (!p) {
    p = compile(src).finally(() => inflight.delete(src));
    inflight.set(src, p);
  }
  return p;
}

function swap(pre: HTMLElement, svg: string) {
  const div = document.createElement("div");
  div.className = "mermaid-diagram";
  if (pre.dataset.sourceLine) div.dataset.sourceLine = pre.dataset.sourceLine;
  if (pre.classList.contains("active-source"))
    div.classList.add("active-source");
  div.innerHTML = svg;
  pre.replaceWith(div);
}

export async function renderMermaid(root: HTMLElement) {
  const codes = [
    ...root.querySelectorAll<HTMLElement>("pre > code.language-mermaid"),
  ];

  // Pass 1, synchronous: diagrams already rendered are swapped in at once
  // so re-rendering the preview doesn't flash the source text
  const todo: HTMLElement[] = [];
  for (const code of codes) {
    const pre = code.parentElement as HTMLElement;
    const hit = svgCache.get((code.textContent ?? "").trim());
    if (hit) swap(pre, hit);
    else todo.push(code);
  }

  // Pass 2: new or changed diagrams
  for (const code of todo) {
    const pre = code.parentElement as HTMLElement;
    const src = (code.textContent ?? "").trim();
    const svg = await getSvg(src);
    if (!pre.isConnected) continue; // a newer render replaced this DOM meanwhile
    if (svg) swap(pre, svg);
    else pre.classList.add("mermaid-invalid"); // keep the source visible
  }
}
