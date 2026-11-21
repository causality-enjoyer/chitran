import { configDir, join } from "@tauri-apps/api/path";
import { readFile } from "$lib/rust-handlers";

export type Config = {
  fonts: { prose: string[]; mono: string[] };
  remoteImages: boolean;
  languages: string[];
};

const DEFAULTS: Config = {
  fonts: { prose: [], mono: [] },
  remoteImages: true,
  languages: [],
};

// Accept "Name" or ["Name", "Other"]; ignore anything else
function families(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
  return list
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/["\\]/g, "").trim())
    .filter(Boolean);
}

// Names become file names, so allow only safe characters (no "../")
function langNames(v: unknown): string[] {
  return (Array.isArray(v) ? v : []).filter(
    (x): x is string => typeof x === "string" && /^[a-z0-9_+-]{1,32}$/i.test(x),
  );
}

// picking only known keys, validating each; not trusting the file
function parse(raw: string): Config {
  try {
    const j = JSON.parse(raw);
    return {
      fonts: {
        prose: families(j?.fonts?.prose),
        mono: families(j?.fonts?.mono),
      },
      remoteImages:
        typeof j?.remoteImages === "boolean" ? j.remoteImages : true,
      languages: langNames(j?.languages),
    };
  } catch (e) {
    console.error("config.json is invalid, using defaults:", e);
    return DEFAULTS;
  }
}

function applyFont(cssVar: string, baseVar: string, names: string[]) {
  const root = document.documentElement.style;
  if (names.length === 0) {
    root.removeProperty(cssVar); // fallback to css default
    return;
  }
  const quoted = names.map((n) => `"${n}"`).join(", ");
  root.setProperty(cssVar, `${quoted}, var(${baseVar})`);
}

class ConfigStore {
  value = $state.raw<Config>(DEFAULTS);

  /** Reads ~/.config/chitran/grammars/<name>.json for each configured language */
  async grammars(): Promise<{ name: string; json: string }[]> {
    const out: { name: string; json: string }[] = [];
    for (const name of this.value.languages) {
      try {
        const p = await join(
          await configDir(),
          "chitran",
          "grammars",
          `${name}.json`,
        );
        const json = await readFile(p);
        if (json === null)
          console.warn(`No grammar file for "${name}", using plain text`);
        else out.push({ name, json });
      } catch (e) {
        console.warn(`Could not read grammar "${name}":`, e);
      }
    }
    return out;
  }

  async load() {
    try {
      const path = await join(await configDir(), "chitran", "config.json");
      const raw = await readFile(path);
      this.value = raw === null ? DEFAULTS : parse(raw);
    } catch (e) {
      console.error("Could not read config:", e);
      this.value = DEFAULTS;
    }
    this.apply();
  }

  apply() {
    applyFont("--font-prose", "--font-prose-base", this.value.fonts.prose);
    applyFont("--font-mono", "--font-prose-base", this.value.fonts.mono);
  }
}

export const config = new ConfigStore();
