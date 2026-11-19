import { type Layout } from "$lib/types";
export const LAYOUTS = [
  { id: "side", key: "s" },
  { id: "stacked", key: "t" },
  { id: "editor", key: "e" },
  { id: "preview", key: "p" },
] as const satisfies {
  id: Layout;
  key: string;
}[];

export const Layouts = LAYOUTS.map((l) => l.id);
const LAYOUT_KEY = "chitran.layout";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not persisted, still works for this session
  }
}

class LayoutStore {
  id = $state<Layout>(
    LAYOUTS.find((l) => l.id === read(LAYOUT_KEY))?.id ?? "side",
  );

  set(l: Layout) {
    this.id = l;
    write(LAYOUT_KEY, l);
  }

  cycle() {
    const i = LAYOUTS.findIndex((l) => l.id === this.id);
    const next = LAYOUTS[(i + 1) % LAYOUTS.length];
    this.set(next.id);
  }
}

export const layoutStore = new LayoutStore();
