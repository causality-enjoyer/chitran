import {
  closeApp,
  getCliPath,
  readFile,
  resolvePath,
  writeFileAtomic,
} from "$lib/rust-handlers";

class BufferStore {
  text = $state("");
  path = $state<string | null>(null); // null = scratch buffer
  ready = $state(false); // autosave must not run before the initial load
  lastSaved = $state(""); // content known to be on disk

  async init() {
    try {
      this.path = await getCliPath();
      if (this.path !== null) {
        this.text = (await readFile(this.path)) ?? "";
      }
    } catch (e) {
      console.error("Failed to open file:", e);
    } finally {
      this.ready = true;
    }
    this.lastSaved = this.text;
  }

  load(newPath: string | null, newText: string) {
    this.path = newPath;
    this.text = newText;
    this.lastSaved = newText;
  }

  async write(name?: string, force = false) {
    const contents = this.text;
    let target: string;

    if (name?.trim()) {
      try {
        target = await resolvePath(name);
        // new path: refuse to clobber an existing files unless forced
        if (target !== this.path && !force) {
          if ((await readFile(target)) !== null) {
            console.error(`'${target}' already exists, not overwriting`);
            return;
          }
        }
      } catch (e) {
        console.error("Could not check target:", e);
        return;
      }
    } else if (this.path) {
      target = this.path;
    } else {
      return; // scratch: bare :w is ignored
    }

    try {
      await writeFileAtomic(target, contents);
      this.path = target;
      this.lastSaved = contents;
    } catch (e) {
      console.error("Write failed:", e);
    }
  }

  async flush(): Promise<boolean> {
    if (this.path === null || this.text === this.lastSaved) return true;
    const target = this.path;
    const contents = this.text;
    try {
      await writeFileAtomic(target, contents);
      this.lastSaved = contents;
      return true;
    } catch (e) {
      console.error("Couldn't flush the buffer:", e);
      return false;
    }
  }

  async quit(force = false) {
    if (this.path !== null) {
      // layer 1: leave the file, land on a blank scratch
      if (!(await this.flush())) return;
      this.load(null, "");
      return;
    }
    // layer 2: scratch quits the app
    if (this.text !== "" && !force) {
      console.warn("Unsaved scratch, use :q!");
      return;
    }
    await closeApp();
  }

  async open(name?: string, force = false) {
    if (!name) return;
    if (this.path === null && this.text !== "" && !force) {
      console.warn("Unsaved scratch, use :o!");
      return;
    }
    if (!(await this.flush())) return;
    try {
      const target = await resolvePath(name);
      this.load(target, (await readFile(target)) ?? "");
    } catch (e) {
      console.error("Open failed:", e);
    }
  }

  /** loads the initla file and starts autosave. Returns a cleanup function */
  start(): () => void {
    void this.init();
    // $effect needs an owner; outside a compoennt, $effect.root provides one
    return $effect.root(() => {
      $effect(() => {
        const current = this.text;
        const target = this.path;
        if (!this.ready || target === null || current === this.lastSaved)
          return;

        const timer = setTimeout(async () => {
          try {
            await writeFileAtomic(target, current);
            this.lastSaved = current;
          } catch (e) {
            console.error("Autosave failed:", e);
          }
        }, 1000);

        return () => clearTimeout(timer);
      });
    });
  }
}

export const buffer = new BufferStore();
