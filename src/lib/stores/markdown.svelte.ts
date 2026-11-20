import MarkdownWorker from "$lib/workers/markdown.worker?worker";
import type { Section } from "$lib/section-tree";

type Reply = { id: number; html?: string; tree?: Section; error?: string };

class MarkdownRenderer {
  html = $state("");
  tree = $state.raw<Section | null>(null);
  #requestId = 0;

  /** getText is read inside an effect, so changes to it trigger re-renders */
  start(getText: () => string): () => void {
    const worker = new MarkdownWorker();

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
        const timer = setTimeout(() => {
          worker.postMessage({ id: ++this.#requestId, text: current });
        }, 120);
        return () => clearTimeout(timer);
      });
    });

    return () => {
      stop();
      worker.terminate();
    };
  }
}

export const renderer = new MarkdownRenderer();
