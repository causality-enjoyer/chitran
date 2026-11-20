<script lang="ts">
	import { onMount } from "svelte";
	import { EditorState } from "@codemirror/state";
	import { drawSelection, EditorView, keymap } from "@codemirror/view";
	import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
	import { markdown } from "@codemirror/lang-markdown";
	import { Vim, vim } from "@replit/codemirror-vim";
	import { parse } from "$lib/helpers";

	let {
		value = $bindable(""),
		onWrite,
		onQuit,
		onOpen,
		onCursor,
	}: {
		value?: string;
		onWrite?: (name?: string, force?: boolean) => void;
		onQuit?: (force?: boolean) => void;
		onOpen?: (name?: string, force?: boolean) => void;
		onCursor?: (line: number) => void;
	} = $props();

	let host: HTMLDivElement | undefined;
	let view: EditorView | undefined;
	let lastLine = 0;

	onMount(() => {
		Vim.map("<C-h>", "<Left>", "insert");
		Vim.map("<C-j>", "<Down>", "insert");
		Vim.map("<C-k>", "<Up>", "insert");
		Vim.map("<C-l>", "<Right>", "insert");
		Vim.map("<C-o>", "<Esc>o", "insert");
		Vim.defineEx("quit", "q", (_cm: unknown, p: any) =>
			onQuit?.(parse(p).force),
		);
		Vim.defineEx("open", "o", (_cm: unknown, p: any) => {
			const { arg, force } = parse(p);
			if (arg) onOpen?.(arg, force);
		});
		Vim.defineEx("edit", "e", (_cm: unknown, p: any) => {
			const { arg, force } = parse(p);
			if (arg) onOpen?.(arg, force);
		});
		Vim.defineEx("write", "w", (_cm: unknown, params: any) => {
			const raw: string = (
				params.argString ??
				params.args?.join(" ") ??
				""
			).trim();
			const force = raw.startsWith("!") || params.bang === true;
			const name = raw.replace(/^!/, "").trim() || undefined;
			onWrite?.(name, force);
		});
		view = new EditorView({
			parent: host,
			state: makeState(value),
		});

		return () => view?.destroy();
	});

	function makeState(doc: string) {
		return EditorState.create({
			doc,
			extensions: [
				vim(),
				drawSelection(),
				history(),
				keymap.of([...defaultKeymap, ...historyKeymap]),
				markdown(),
				EditorView.lineWrapping,
				EditorView.updateListener.of((u) => {
					if (u.docChanged) value = u.state.doc.toString();
					if (u.selectionSet || u.docChanged) {
						const line = u.state.doc.lineAt(u.state.selection.main.head).number;
						if (line !== lastLine) {
							lastLine = line;
							onCursor?.(line);
						}
					}
				}),
			],
		});
	}

	$effect(() => {
		const incoming = value;
		if (!view) return;
		if (incoming !== view.state.doc.toString()) {
			view.setState(makeState(incoming));
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
		font-family: var(--font-mono);
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

	.editor :global(.cm-panels) {
		background: var(--bg);
		color: var(--fg);
		border-color: var(--border);
	}
	.editor :global(.cm-panels-bottom) {
		border-top: 1px solid var(--border);
	}
	.editor :global(.cm-vim-panel) {
		padding: 2px 8px;
		font-family: monospace;
		font-size: 14px;
		color: var(--fg);
	}
	.editor :global(.cm-vim-panel input) {
		background: transparent;
		color: var(--fg);
		border: none;
		outline: none;
		font: inherit;
		caret-color: var(--cursor);
	}
</style>
