<script lang="ts">
	import "./preview.css";
	import { convertFileSrc } from "@tauri-apps/api/core";
	import { dirname } from "@tauri-apps/api/path";
	import { onMount } from "svelte";
	import { renderMermaid, resetMermaidTheme } from "$lib/mermaid";

	let {
		html,
		cursorLine,
		path,
		remoteImages,
	}: {
		html: string;
		cursorLine: number;
		path: string | null;
		remoteImages: boolean;
	} = $props();

	// KaTeX's stylesheet and fonts are fetched only once a note actually has math
	let mathCss = false;
	$effect(() => {
		if (!mathCss && shown.includes('class="katex')) {
			mathCss = true;
			import("katex/dist/katex.min.css");
		}
	});

	// Mermaid: only when a diagram fence exists. **Keep** this effect BEFORE the cursor-sync effect
	// so that the highlight sees the swapped-in diagrams
	$effect(() => {
		void shown;
		if (!el || !shown.includes("language-mermaid")) return;
		void renderMermaid(el);
	});

	onMount(() => {
		const mq = matchMedia("(prefers-color-schema: dark)");
		const onTheme = () => resetMermaidTheme();
		mq.addEventListener("change", onTheme);
		return () => mq.removeEventListener("change", onTheme);
	});

	let el: HTMLDivElement | undefined;

	// Folder of the open file; null for a scratch buffer
	let baseDir = $state<string | null>(null);
	$effect(() => {
		const p = path;
		if (p === null) {
			baseDir = null;
			return;
		}
		dirname(p)
			.then((d) => {
				if (path === p) baseDir = d;
			})
			.catch(() => (baseDir = null));
	});

	// Anything with a scheme (http:, data:, asset:...), "//host" or "#" is left alone
	const SKIP = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
	// http:, https:, and protocol-relative
	const REMOTE = /^(?:https?:)\/\//i;

	const shown = $derived.by(() => {
		if (!html.includes("<img")) return html;
		// nothing to rewrite or block: no folder to resolve against, remote allowed
		if (!baseDir && remoteImages) return html;
		const doc = new DOMParser().parseFromString(html, "text/html");
		for (const img of doc.querySelectorAll("img[src]")) {
			const src = img.getAttribute("src")!;
			if (REMOTE.test(src)) {
				if (!remoteImages) {
					img.removeAttribute("src");
					img.setAttribute(
						"alt",
						img.getAttribute("alt") || "[remote image blocked]",
					);
				}
				continue;
			}
			if (SKIP.test(src) || !baseDir) continue;
			try {
				const url = new URL(src, "file://" + baseDir + "/");
				img.setAttribute(
					"src",
					convertFileSrc(decodeURIComponent(url.pathname)),
				);
			} catch {
				/*leave the image as written */
			}
		}
		return doc.body.innerHTML;
	});

	// Highlight and scroll to the block at or above the cursor line
	$effect(() => {
		void shown; // re-run after each re-render, which replaces the DOM
		const line = cursorLine;
		if (!el) return;

		let best: HTMLElement | null = null;
		for (const node of el.querySelectorAll<HTMLElement>("[data-source-line]")) {
			if (Number(node.dataset.sourceLine) <= line) best = node;
			else break; // document order means lines only increase
		}

		el.querySelector(".active-source")?.classList.remove("active-source");

		if (best) {
			best.classList.add("active-source");
			best.scrollIntoView({ block: "nearest" });
		}
	});

	onMount(() => {
		async function onClick(e: MouseEvent) {
			const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
				".code-copy",
			);
			if (!btn) return;
			const text =
				btn.closest(".code-block")?.querySelector("pre")?.textContent ?? "";
			try {
				await navigator.clipboard.writeText(text);
				btn.textContent = "Copied";
				setTimeout(() => (btn.textContent = "Copy"), 1200);
			} catch (e) {
				console.error("Copy failed:", e);
			}
		}
		el?.addEventListener("click", onClick);
		return () => el?.removeEventListener("click", onClick);
	});
</script>

<div class="preview" bind:this={el}>
	<div class="prose">
		{@html shown}
	</div>
</div>
