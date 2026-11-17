<script lang="ts">
	import { onMount } from "svelte";
	import { EditorState, Transaction } from "@codemirror/state";
	import { drawSelection, EditorView, keymap } from "@codemirror/view";
	import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
	import { markdown } from "@codemirror/lang-markdown";
	import { Vim, vim } from "@replit/codemirror-vim";

	let { value = $bindable(""), disabled = false } = $props();

	let host: HTMLDivElement | undefined;
	let view: EditorView | undefined;

	onMount(() => {
		Vim.map("<C-h>", "<Left>", "insert");
		Vim.map("<C-j>", "<Down>", "insert");
		Vim.map("<C-k>", "<Up>", "insert");
		Vim.map("<C-l>", "<Right>", "insert");
		Vim.map("<C-o>", "<Esc>o", "insert");
		view = new EditorView({
			parent: host,
			state: EditorState.create({
				doc: value,
				extensions: [
					vim(),
					drawSelection(),
					history(),
					keymap.of([...defaultKeymap, ...historyKeymap]),
					markdown(),
					EditorView.lineWrapping,
					EditorView.updateListener.of((u) => {
						if (u.docChanged) value = u.state.doc.toString();
					}),
				],
			}),
		});

		return () => view?.destroy();
	});

	$effect(() => {
		const incoming = value;
		if (!view) return;
		if (incoming !== view.state.doc.toString()) {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: incoming },
				annotations: Transaction.addToHistory.of(false),
			});
		}
	});
</script>

<div bind:this={host} class="editor"></div>

<style>
	.editor {
		height: 100%;
		overflow: hidden;
	}
	.editor :global(.cm-editor) {
		height: 100%;
	}
	.editor :global(.cm-scroller) {
		overflow: auto;
		font-family: monospace;
		font-size: 14px;
	}
	.editor :global(.cm-editor.cm-focused) {
		outline: none;
	}

	.editor :global(.cm-cursor) {
		border-left: 2px solid var(--cursor);
	}
	.editor :global(.cm-fat-cursor) {
		background: var(--cursor);
		color: var(--bg);
	}
	.editor :global(.cm-selectionBackground),
	.editor :global(.cm-focused .cm-selectionBackground) {
		background: var(--selection) !important;
	}
</style>
