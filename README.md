<div align="center">

# Chitran

**A lightweight native Markdown editor and previewer, scoped to one file at a time.**

[![GPLv3 license](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-24C8D8?logo=tauri&logoColor=white)](https://tauri.app)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-thin%20host-000000?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![CodeMirror 6](https://img.shields.io/badge/CodeMirror-6-D30707)](https://codemirror.net)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux-FCC624?logo=linux&logoColor=black)](#platform-support)
[![Status: early development](https://img.shields.io/badge/Status-early%20development-orange)](#status)

*One file in. One editable, navigable, foldable, well-designed page out.*

</div>

---

## Why this exists

I write long, hierarchical study notes: topics, subtopics, sub-subtopics. Reading
them back should feel designed, not like a README on GitHub, and the tools I tried
each missed:

- Most previewers default to a GitHub-style look. Theme packs change colors, but
  the type scale, layout and components stay the same.
- Obsidian-class apps do far more than I need and ship a whole browser engine.

A different feel needs different typography, layout and components, not just a new
palette. Chitran is a single light native window: an editor with vim bindings on
one side, a rendered preview on the other. Everything is a view over one document.

It is not a knowledge base. There is no vault, no backlinks, no graph and no
global search. If a feature needs data beyond the current file, it is out of scope.

## What works today

- **Editor:** CodeMirror 6 with Markdown support and vim bindings, including
  visual mode, undo/redo and custom insert-mode mappings.
- **Ex commands:** `:w`, `:w name.md`, `:w!`, `:o file`, `:e file`, `:q`, `:q!`.
  `:q` on a file returns to a blank scratch buffer, and `:q` on a scratch buffer
  quits the app.
- **Safe saving:** debounced autosave (about 1 s) through an atomic write
  (temp file, `fsync`, rename), so a crash mid-save never leaves a half-written file.
- **Scratch buffers:** launch without an argument to get an in-memory buffer.
  Save it as a real file with `:w name.md`.
- **Four layouts:** side-by-side, stacked, editor-only and preview-only. Cycle with
  `Ctrl+\`. The last layout is remembered.
- **Live preview:** unified/remark/rehype running in a Web Worker, so typing stays
  smooth. Supports GFM (tables, task lists, footnotes) and frontmatter.
- **Sanitized output:** `rehype-sanitize` removes scripts, event handlers and
  `javascript:` links. Raw HTML in Markdown is disabled by design.
- **Cursor sync:** the preview follows and highlights the block under the editor cursor.
- **System theme:** light and dark follow the OS preference.

Not done yet: the design system, section-tree navigation, folding, indent guides,
focus mode, config and frontmatter options. Measured sizes and startup notes are in
[`docs/perf.md`](docs/perf.md).

## Install and run

### Requirements

- [Rust](https://rustup.rs) toolchain
- [pnpm](https://pnpm.io)
- Tauri's Linux dependencies (WebKitGTK and friends). See the
  [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

### Develop

```bash
git clone https://github.com/causality-enjoyer/chitran.git
cd chitran
pnpm install
pnpm tauri dev
```

To open a file in dev, pass an absolute path:

```bash
pnpm tauri dev -- -- /absolute/path/to/notes.md
```

### Build

```bash
pnpm tauri build
```

Output is in `src-tauri/target/release/`, with `.deb` and `.rpm` packages under
`bundle/`.

### Use

```bash
chitran notes.md     # open notes.md (created on first save if missing)
chitran              # scratch buffer, held in memory
```

## Project structure

```
chitran/
├── docs/
│   └── perf.md                    # size and startup log, per version
├── src/
│   ├── app.css                    # global styles and theme tokens
│   ├── routes/
│   │   ├── +layout.svelte         # imports app.css
│   │   ├── +layout.ts             # SPA mode (ssr = false)
│   │   └── +page.svelte           # layout, wiring and styles
│   └── lib/
│       ├── components/
│       │   ├── Editor.svelte      # CodeMirror 6 + vim + ex commands
│       │   └── Preview.svelte     # rendered HTML + cursor sync
│       ├── stores/
│       │   ├── buffer.svelte.ts   # file state, save, open, quit, autosave
│       │   ├── layout.svelte.ts   # four layouts, persisted
│       │   └── markdown.svelte.ts # talks to the worker
│       ├── workers/
│       │   └── markdown.worker.ts # unified/remark/rehype pipeline
│       ├── rust-handlers.ts       # the only place that calls Rust
│       ├── helpers.ts
│       └── types/
│           └── index.ts # unified/remark/rehype pipeline
├── src-tauri/
│   ├── src/lib.rs                 # read_file, write_file_atomic, get_cli_path
│   ├── capabilities/default.json  # permissions granted to the webview
│   └── tauri.conf.json
└── vite.config.js
```

The Rust side stays thin on purpose (file I/O and the CLI argument). All logic
lives in TypeScript.

## Platform support

Linux first (developed on Arch with Hyprland/Wayland). Paths go through Tauri's
APIs so Windows should be feasible later, but Windows and macOS are untested and
not promised yet. (Although I'll push msi build into **Releases** as well)

On some Wayland setups WebKitGTK can render glitchy. If the window flickers or
stays blank, try:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 chitran notes.md
```

## Status

Early development. Versions v0 to v2 are done (file I/O, editor and layouts,
Markdown pipeline with cursor sync). Expect rough edges and breaking changes.

## License

Chitran is free software under the [GNU General Public License v3.0](LICENSE).

