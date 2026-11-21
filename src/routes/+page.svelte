<script lang="ts">
	import { onMount } from "svelte";
	import Editor from "$lib/components/Editor.svelte";
	import Preview from "$lib/components/Preview.svelte";
	import { buffer } from "$lib/stores/buffer.svelte";
	import { renderer } from "$lib/stores/markdown.svelte";
	import { layoutStore } from "$lib/stores/layout.svelte";
	import { config } from "$lib/stores/config.svelte";

	let cursorLine = $state(1);

	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.altKey) return;
		if (e.ctrlKey && e.code === "Backslash") {
			e.preventDefault();
			layoutStore.cycle();
		}
	}

	// each start() returns its own cleanup, which onMount runs on unmount
	onMount(() => buffer.start());
	onMount(() => renderer.start(() => buffer.text));
	onMount(() => {
		// capture phase: runs before vim can swallow the key
		window.addEventListener("keydown", onkeydown, true);
		return () => window.removeEventListener("keydown", onkeydown, true);
	});
	onMount(async () => {
		await config.load();
		renderer.loadGrammars(await config.grammars());
	});
</script>

<main data-layout={layoutStore.id}>
	<div class="status">
		<span> {buffer.path ?? "[scratch]"} </span>
		<span> {renderer.tree?.children.length ?? 0} top-level sections </span>

		<button onclick={() => layoutStore.cycle()}>{layoutStore.id}</button>
	</div>

	<div class="pane-editor">
		<Editor
			bind:value={buffer.text}
			onWrite={(name, force) => buffer.write(name, force)}
			onOpen={(name, force) => buffer.open(name, force)}
			onQuit={(force) => buffer.quit(force)}
			onCursor={(l) => (cursorLine = l)}
		/>
	</div>

	<div class="pane-preview">
		<Preview
			html={renderer.html}
			{cursorLine}
			path={buffer.path}
			remoteImages={config.value.remoteImages}
		/>
	</div>
</main>

<style>
	/* Root grid: one status row on top, panes below. Columns/rows per layout */
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
	main[data-layout="editor"],
	main[data-layout="preview"] {
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr;
	}

	/* Status bar spans every column; path on the left, layout button on the right */
	.status {
		grid-column: 1 / -1;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem 1rem;
		font-size: 14px;
		color: var(--muted);
		border-bottom: 1px solid var(--border);
	}

	/* min-* 0 lets grid items shrink so inner content scrolls instead of stretching the grid */
	.pane-editor,
	.pane-preview {
		min-width: 0;
		min-height: 0;
	}

	/* Divider between the panes: left edge in side-by-side, top edge when stacked */
	.pane-preview {
		border-left: 1px solid var(--border);
	}

	/* Single-pane layouts: hide with display:none (not {#if})
	so the editor keeps its undo history,	cursor and vim mode */
	main[data-layout="editor"] .pane-preview {
		display: none;
	}
	main[data-layout="stacked"] .pane-preview {
		border-left: none;
		border-top: 1px solid var(--border);
	}
	main[data-layout="preview"] .pane-editor {
		display: none;
	}
</style>
