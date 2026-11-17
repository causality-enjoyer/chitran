<script lang="ts">
	import { onMount } from "svelte";
	import { getCliPath, readFile, writeFileAtomic } from "../lib/rust-handlers";
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
	<Editor bind:value={text} />
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
