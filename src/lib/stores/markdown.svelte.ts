import MarkdownWorker from "$lib/workers/markdown.worker?worker";
import type { Section } from "$lib/section-tree";

type Reply = { id: number; html?: string; tree?: Section; error?: string };

class MarkdownRenderer {
  html = $state("");
  tree = $state.raw<Section | null>(null);
  #requestId = 0;
  #worker: Worker | null = null;
  #lastTest = "";

  /** getText is read inside an effect, so changes to it trigger re-renders */
  start(getText: () => string): () => void {
    const worker = new MarkdownWorker();
    this.#worker = worker;

    worker.onmessage = (e: MessageEvent<Reply>) => {
      if (e.data.id !== this.#requestId) return;
      if (e.data.html !== undefined) {
        this.html = e.data.html;
        this.tree = e.data.tree ?? null;
      } else console.error("Markdown render failed:", e.data.error);
    };

    const stop = $effect.root(() => {
      $effect(() => {
        const current = getText(); // tracked: re-runs when the text changes
        this.#lastTest = current;
        const timer = setTimeout(() => {
          worker.postMessage({ id: ++this.#requestId, text: current });
        }, 120);
        return () => clearTimeout(timer);
      });
    });

    return () => {
      stop();
      worker.terminate();
      this.#worker = null;
    };
  }

  loadGrammars(list: { name: string; json: string }[]) {
    const w = this.#worker;
    if (!w || list.length === 0) return;

    for (const g of list)
      w.postMessage({ type: "grammar", name: g.name, json: g.json });
    w.postMessage({ id: ++this.#requestId, text: this.#lastTest });
  }
}

export const renderer = new MarkdownRenderer();
