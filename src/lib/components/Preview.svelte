<script lang="ts">
	import { convertFileSrc } from "@tauri-apps/api/core";
	import { dirname } from "@tauri-apps/api/path";
	import { onMount } from "svelte";
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

<style>
	.preview {
		height: 100%;
		overflow: auto;
		padding: 2rem 1.5rem 4rem;
		box-sizing: border-box;
	}

	/* Reading column;
	68ch is ~ 65-75 characters per line;
	{@html} content isn't scobed by Svelte, so everything inside uses :global
	*/
	.prose {
		--shiki-foreground: var(--fg);
		--shiki-background: transparent;
		--shiki-token-comment: var(--muted);
		--shiki-token-keyword: var(--accent);
		--shiki-token-string: var(--syn-string);
		--shiki-token-string-expression: var(--syn-string);
		--shiki-token-function: var(--syn-function);
		--shiki-token-constant: var(--syn-constant);
		--shiki-token-parameter: var(--syn-param);
		--shiki-token-punctuation: var(--muted);
		--shiki-token-link: var(--accent);
	}
	.prose :global(> :first-child) {
		margin-top: 0;
	}

	/* Vertical rhythm: blocks get space below;
	headings get more above than below so heading belongs to the text below */
	.prose :global(p),
	.prose :global(ul),
	.prose :global(ol),
	.prose :global(blockquote),
	.prose :global(pre),
	.prose :global(pre),
	.prose :global(table) {
		margin: 0 0 1.1em;
	}

	/* Headings: no underline rules, softer hierarchy through size and weight (ratio about 1.25),
	with the small ones distinguished by color and case */
	.prose :global(h1),
	.prose :global(h2),
	.prose :global(h3),
	.prose :global(h4),
	.prose :global(h5),
	.prose :global(h6) {
		line-height: 1.25;
		font-weight: 600;
		letter-spacing: -0.01em;
		margin: 2em 0 0.55em;
		text-wrap: pretty;
	}

	.prose :global(h1) {
		font-size: 2.05em;
		font-weight: 700;
		margin-top: 1.4em;
	}
	.prose :global(h2) {
		font-size: 1.6em;
	}
	.prose :global(h3) {
		font-size: 1.28em;
	}
	.prose :global(h4) {
		font-size: 1.08em;
	}
	.prose :global(h5),
	.prose :global(h6) {
		font-size: 0.85em;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	/* Links */
	.prose :global(a) {
		color: var(--accent);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
		text-decoration-color: color-mix(in srgb, var(--accent) 45%, transparent);
	}
	.prose :global(a:hover) {
		text-decoration-color: var(--accent);
	}

	/* Lists */
	.prose :global(ul),
	.prose :global(ol) {
		padding-left: 1.5em;
	}
	.prose :global(li) {
		margin: 0.25em 0;
	}
	.prose :global(li > ul),
	.prose :global(li > ol) {
		margin: 0.25em 0 0;
	}
	.prose :global(li::marker) {
		color: var(--muted);
	}

	/* Task lists from GFM (drop the bullet, checkboxs are aligned) */
	.prose :global(.contains-task-list) {
		list-style: none;
		padding-left: 0.25em;
	}
	.prose :global(.task-list-item input) {
		margin: 0 0 0.5em 0 0;
		accent-color: var(--accent);
		vertical-align: -0.1em;
	}

	/* Blockquote: quiet bar instead of box, not italic */
	.prose :global(blockquote) {
		padding: 0.1em 0 0.1em 1.1em;
		border-left: 3px solid var(--border);
		color: color-mix(in s, var(--fg) 78%, var(--bg));
	}
	.prose :global(blockquote > :last-child) {
		margin-bottom: 0;
	}

	/* Inline code and code blocks. Shiki (a later slice) colors the token and adds the header;
	these rules only set the surface */
	.prose :global(code) {
		font-family: var(--font-mono);
		font-size: 0.88em;
	}
	.prose :global(:not(pre) > code) {
		background: var(--code-bg);
		padding: 0.12em 0.4em;
		border-radius: 4px;
	}
	.prose :global(pre) {
		background: var(--code-bg);
		border-radius: 8px;
		padding: 1em 1.15rem;
		overflow-x: auto;
		line-height: 1.55;
		hyphens: none;
	}
	.prose :global(pre code) {
		font-size: 0.85em;
		background: none;
		padding: 0;
	}

	/* Tables: can't wrap then in a scroll div element without a rehype plugin
	so the table itself becomes the scroller when its wider than the column */
	.prose :global(table) {
		display: block;
		width: max-content;
		max-width: 100%;
		overflow-x: auto;
		border-collapse: collapse;
		font-size: 0.94em;
		line-height: 1.5;
		hyphens: none;
	}
	.prose :global(th),
	.prose :global(td) {
		padding: 0.55em 0.9em;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}
	.prose :global(th) {
		border-bottom: 2px solid var(--border);
		font-weight: 600;
	}
	.prose :global(tbody tr:nth-child(even)) {
		background: var(--stripe);
	}

	/* Rule, emphasis, images */
	.prose :global(hr) {
		border: none;
		border-top: 1px solid var(--border);
		margin: 2.2em 0;
	}
	.prose :global(strong) {
		font-weight: 700;
	}
	.prose :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 6px;
		border: none;
	}

	/* Footnotes: smaller, separated, muted */
	.prose :global(section[data-footnotes]) {
		margin-top: 3em;
		padding-top: 1em;
		border-top: 1px solid var(--border);
		font-size: 0.88em;
		color: var(--muted);
	}
	.prose :global(section[data-footnotes] h2) {
		/* the "Footnotes" heading remark generates is visually hidden */
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.prose :global(sup) {
		line-height: 0;
	}

	/* Cursor-sync marker: a soft tint instead of hard bar so that its easy on the eyes */
	.prose :global(.active-source) {
		background: var(--accent-soft);
		box-shadow: -0.5em 0 0 var(--accent-soft);
		border-radius: 3px;
	}

	.prose :global(.code-block) {
		margin: 0 0 1.1em;
		background: var(--code-bg);
		border-radius: 8px;
		overflow: hidden;
	}
	.prose :global(.code-header) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.3rem 0.8rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--muted);
		border-bottom: 1px solid var(--border);
		user-select: none;
	}
	.prose :global(.code-copy) {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		cursor: pointer;
		opacity: 0.3;
		transition: opacity 120ms ease;
	}
	.prose :global(.code-block:hover .code-copy),
	.prose :global(.code-copy:focus-visible) {
		opacity: 1;
	}
	.prose :global(.code-block pre) {
		margin: 0;
		background: none;
		border-radius: 0;
	}

	.prose :global(.callout) {
		--c: var(--accent);
		margin: 0 0 1.1em;
		padding: 0.8em 1em;
		border-left: 3px solid var(--c);
		border-radius: 0 6px 6px 0;
		background: color-mix(in srgb, var(--c) 9%, transparent);
	}
	.prose :global(.callout-note) {
		--c: var(--callout-note);
	}
	.prose :global(.callout-tip) {
		--c: var(--callout-tip);
	}
	.prose :global(.callout-important) {
		--c: var(--callout-important);
	}
	.prose :global(.callout-warning) {
		--c: var(--callout-warning);
	}
	.prose :global(.callout-caution) {
		--c: var(--callout-caution);
	}
	.prose :global(.callout-title) {
		font-weight: 600;
		font-size: 0.85em;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c);
		margin-bottom: 0.35em;
	}
	.prose :global(.callout-body > :last-child) {
		margin-bottom: 0;
	}
</style>
