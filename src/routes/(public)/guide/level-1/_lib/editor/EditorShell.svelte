<script lang="ts">
	import PageNav from './PageNav.svelte';
	import EditorTopBar from './EditorTopBar.svelte';
	import LibraryPanel from './LibraryPanel.svelte';
	import AssetInspector from './AssetInspector.svelte';
	import { editorPrefs, ZOOM_STEP } from './editor-prefs.svelte';

	interface Props {
		activePage: number;
		onJump: (n: number) => void;
		children?: import('svelte').Snippet;
	}
	let { activePage, onJump, children }: Props = $props();

	let canvasEl: HTMLElement | undefined = $state();

	// Ctrl+wheel must use a non-passive listener for preventDefault to block
	// the browser's default page-zoom. Attach via $effect so we can pass
	// { passive: false } explicitly (Svelte's onwheel defaults to passive).
	$effect(() => {
		const el = canvasEl;
		if (!el) return;
		const handler = (e: WheelEvent) => {
			if (!e.ctrlKey && !e.metaKey) return;
			e.preventDefault();
			const dir = e.deltaY > 0 ? -1 : 1;
			editorPrefs.setZoom(editorPrefs.zoom + dir * ZOOM_STEP);
		};
		el.addEventListener('wheel', handler, { passive: false });
		return () => el.removeEventListener('wheel', handler);
	});
</script>

<div class="editor-shell">
	<EditorTopBar />
	<div
		class="body"
		class:left-collapsed={editorPrefs.leftCollapsed}
		class:right-collapsed={editorPrefs.rightCollapsed}
	>
		{#if editorPrefs.leftCollapsed}
			<button
				type="button"
				class="reveal left-reveal"
				onclick={() => editorPrefs.toggleLeft()}
				title="Show page navigation"
				aria-label="Show page navigation"
			>
				›
			</button>
		{:else}
			<aside class="left">
				<div class="sidebar-head">
					<span>Pages</span>
					<button
						type="button"
						class="collapse"
						onclick={() => editorPrefs.toggleLeft()}
						title="Collapse page navigation"
						aria-label="Collapse page navigation"
					>
						‹
					</button>
				</div>
				<PageNav {activePage} {onJump} />
			</aside>
		{/if}

		<main class="canvas" bind:this={canvasEl}>
			<div class="page-stage" style:zoom={editorPrefs.zoom}>
				{@render children?.()}
			</div>
		</main>

		{#if editorPrefs.rightCollapsed}
			<button
				type="button"
				class="reveal right-reveal"
				onclick={() => editorPrefs.toggleRight()}
				title="Show library + inspector"
				aria-label="Show library + inspector"
			>
				‹
			</button>
		{:else}
			<aside class="right">
				<div class="sidebar-head">
					<button
						type="button"
						class="collapse"
						onclick={() => editorPrefs.toggleRight()}
						title="Collapse library + inspector"
						aria-label="Collapse library + inspector"
					>
						›
					</button>
					<span>Library</span>
				</div>
				<div class="right-stack">
					<div class="library-region"><LibraryPanel /></div>
					<AssetInspector />
				</div>
			</aside>
		{/if}
	</div>
</div>

<style>
	.editor-shell {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100vh;
		background: #0d1117;
		color: #e6e8ec;
	}
	.body {
		display: grid;
		grid-template-columns: 240px 1fr 320px;
		min-height: 0;
	}
	.body.left-collapsed {
		grid-template-columns: 24px 1fr 320px;
	}
	.body.right-collapsed {
		grid-template-columns: 240px 1fr 24px;
	}
	.body.left-collapsed.right-collapsed {
		grid-template-columns: 24px 1fr 24px;
	}
	.left {
		border-right: 1px solid #1f2530;
		min-height: 0;
		display: grid;
		grid-template-rows: auto 1fr;
	}
	.right {
		border-left: 1px solid #1f2530;
		min-height: 0;
		display: grid;
		grid-template-rows: auto 1fr;
	}
	.sidebar-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.4rem 0.75rem;
		background: #0b0e13;
		border-bottom: 1px solid #1f2530;
		font-family: system-ui, sans-serif;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6a7280;
	}
	.collapse {
		background: transparent;
		color: #cdd1d9;
		border: 1px solid #2a3344;
		border-radius: 3px;
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		cursor: pointer;
		font: inherit;
		line-height: 1;
		padding: 0;
	}
	.collapse:hover {
		background: #1c222d;
	}
	.reveal {
		width: 24px;
		background: #0b0e13;
		color: #6a7280;
		border: none;
		border-right: 1px solid #1f2530;
		cursor: pointer;
		font-size: 1rem;
		display: grid;
		place-items: center;
	}
	.reveal:hover {
		color: #cdd1d9;
		background: #11151c;
	}
	.right-reveal {
		border-right: none;
		border-left: 1px solid #1f2530;
	}
	.right-stack {
		display: grid;
		grid-template-rows: 1fr auto;
		height: 100%;
		min-height: 0;
	}
	.library-region {
		min-height: 0;
		overflow: hidden;
	}
	.canvas {
		background: #1c2230;
		overflow: auto;
		padding: 2rem 1rem;
	}
	.page-stage {
		display: flex;
		justify-content: center;
	}
	.canvas :global(.page) {
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
	}
</style>
