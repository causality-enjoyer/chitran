<script lang="ts">
	import { onMount } from "svelte";
	import {
		closeApp,
		getCliPath,
		readFile,
		resolvePath,
		writeFileAtomic,
	} from "../lib/rust-handlers";
	import Editor from "$lib/components/Editor.svelte";
	import { layoutStore } from "$lib/stores/layout.svelte";
	import MarkdownWorker from "$lib/workers/markdown.worker?worker";

	let text = $state("");
	let path = $state<string | null>(null);
	let ready = $state(false);
	let lastSaved = $state("");

	// new states for remark plugins
	let html = $state("");
	let worker = $state.raw<Worker>();
	let requestId = 0;

	async function handleWrite(name?: string, force = false) {
		let contents = text; // snapshot, so typing during the write can't mismatch lastSaved

		let target: string;
		if (name?.trim()) {
			target = await resolvePath(name);

			// for new pathname, stop before writing over existing file
			if (target !== path && !force) {
				try {
					if ((await readFile(target)) !== null) {
						console.error(`'${target}' already exists, not overwriting`);
						return;
					}
				} catch (e) {
					console.error("Could not check target:", e);
					return;
				}
			}
		} else if (path) {
			target = path;
		} else {
			return; // scratch buffer, so `:w` is ignored
		}

		try {
			await writeFileAtomic(target, contents);
			path = target; // scratch becomes a real file, or we switch to the new path
			lastSaved = contents;
		} catch (e) {
			console.error("Write failed:", e);
		}
	}

	async function flush(): Promise<boolean> {
		if (path === null || text === lastSaved) return true;
		const target = path;
		const contents = text;
		try {
			await writeFileAtomic(target, contents);
			lastSaved = contents;
			return true;
		} catch (e) {
			console.error("Couldn't flush the buffer:", e);
			return false;
		}
	}

	function loadBuffer(newPath: string | null, newText: string) {
		path = newPath;
		text = newText;
		lastSaved = newText;
	}

	async function handleQuit(force = false) {
		let success: boolean;
		if (path !== null) {
			success = await flush();
			if (!success) {
				return;
			}
			loadBuffer(null, "");
		} else {
			if (text !== "" && !force) {
				console.warn("Unsaved scratch, use :q!");
				return;
			}
		}
		await closeApp();
	}

	async function handleOpen(name?: string, force = false) {
		if (!name) return;
		if (path === null && text !== "" && !force) {
			console.warn("Unsaved scratch, use :o!");
			return;
		}

		if (!(await flush())) return;

		try {
			const target = await resolvePath(name);
			const content = (await readFile(target)) ?? "";
			loadBuffer(target, content);
		} catch (e) {
			console.error("Open failed:", e);
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.altKey) return;
		if (e.ctrlKey && e.code === "Backslash") {
			console.log("key entered");
			e.preventDefault();
			layoutStore.cycle();
		}
	}

	async function openInitial() {
		try {
			path = await getCliPath();
			if (path !== null) {
				text = (await readFile(path)) ?? "";
			}
		} catch (e) {
			console.error("An error occurred: ", e instanceof Error ? e.message : e);
		} finally {
			ready = true;
		}
		lastSaved = text;
	}

	$effect(() => {
		const current = text;
		const target = path;
		if (!ready || target === null || current === lastSaved) return;

		const timer = setTimeout(async () => {
			try {
				await writeFileAtomic(target, current);
				lastSaved = current;
			} catch (e) {
				console.error("Autosave failed: ", e instanceof Error ? e.message : e);
			}
		}, 1000);

		return () => clearTimeout(timer);
	});

	$effect(() => {
		const current = text;
		const w = worker;
		if (!w) return; // worker not ready yet; effect re-runs when it is

		const timer = setTimeout(() => {
			w.postMessage({ id: ++requestId, text: current });
		}, 120);

		return () => clearTimeout(timer);
	});

	onMount(openInitial);
	onMount(() => {
		window.addEventListener("keydown", onkeydown, true);
		return () => window.removeEventListener("keydown", onkeydown, true);
	});
	onMount(() => {
		const w = new MarkdownWorker();
		w.onmessage = (
			e: MessageEvent<{ id: number; html?: string; error?: string }>,
		) => {
			if (e.data.id !== requestId) return; // reply to an outdated request, ignore it
			if (e.data.html !== undefined) html = e.data.html;
			else console.error("Markdown render failed:", e.data.error);
		};
		worker = w;
		return () => w.terminate();
	});
</script>

<main data-layout={layoutStore.id}>
	<div class="status">
		<span>
			{path ?? "[scratch]"}
		</span>

		<button onclick={() => layoutStore.cycle()}>{layoutStore.id}</button>
	</div>

	<div class="pane-editor">
		<Editor
			bind:value={text}
			onWrite={handleWrite}
			onOpen={handleOpen}
			onQuit={handleQuit}
		/>
	</div>

	<div class="preview">{@html html}</div>
</main>

<style>
	main {
		display: grid;
		height: 100vh;
	}
	main[data-layout="side"] {
		grid-template-columns: 1fr 1fr;
		grid-template-rows: auto 1fr;
	}
	main[data-layout="stacked"] {
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr 1fr;
	}
	main[data-layout="editor"] {
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr;
	}
	main[data-layout="preview"] {
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr;
	}

	.pane-editor {
		min-height: 0;
		min-width: 0;
	}

	.status {
		grid-column: 1 / -1;
		padding: 0.25rem 1rem;
		font-size: 14px;
		color: var(--muted);
		border-bottom: 1px solid var(--border);
	}

	main[data-layout="editor"] .preview {
		display: none;
	}
	main[data-layout="stacked"] .preview {
		border-left: none;
		border-top: 1px solid var(--border);
	}
	main[data-layout="preview"] .pane-editor {
		display: none;
	}

	.preview {
		margin: 0;
		padding: 1rem;
		overflow: auto;
		font-size: 14px;
		box-sizing: border-box;
		border: none;
		border-left: 1px solid var(--border);
	}
</style>
