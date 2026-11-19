<script lang="ts">
	let { html, cursorLine }: { html: string; cursorLine: number } = $props();
	let el: HTMLDivElement | undefined;

	// Highlight and scroll to the block at or above the cursor line
	$effect(() => {
		void html; // re-run after each re-render, which replaces the DOM
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
</script>

<div class="preview" bind:this={el}>{@html html}</div>

<style>
	.preview {
		height: 100%;
		overflow: auto;
		padding: 1rem;
		box-sizing: border-box;
		font-size: 14px;
	}

	/* {@html} content isn't scoped by svelte, hence :global */
	.preview :global(.active-source) {
		box-shadow: inset 2px 0 0 var(--muted);
	}
</style>
