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

	let text = $state("");
	let path = $state<string | null>(null);
	let ready = $state(false);
	let lastSaved = $state("");

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
			console.log("ready at", performance.now());
		}
		lastSaved = text;
	}

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

	onMount(openInitial);
</script>

<main>
	<div class="status">{path ?? "[scratch]"}</div>
	<Editor
		bind:value={text}
		onWrite={handleWrite}
		onOpen={handleOpen}
		onQuit={handleQuit}
	/>
	<pre>{text}</pre>
</main>

<style>
	main {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: auto 1fr;
		height: 100vh;
	}

	.status {
		grid-column: 1 / -1;
		padding: 0.25rem 1rem;
		font-size: 14px;
		color: var(--muted);
		border-bottom: 1px solid var(--border);
	}

	pre {
		margin: 0;
		padding: 1rem;
		overflow: auto;
		font-family: monospace;
		font-size: 14px;
		box-sizing: border-box;
		border: none;
		outline: none;
		resize: none;
	}

	pre {
		border-left: 1px solid var(--border);
		white-space: pre-wrap;
	}
</style>
