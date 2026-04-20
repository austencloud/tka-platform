<script lang="ts">
	import PageNav from './PageNav.svelte';
	import EditorTopBar from './EditorTopBar.svelte';
	import LibraryPanel from './LibraryPanel.svelte';

	interface Props {
		activePage: number;
		onJump: (n: number) => void;
		children?: import('svelte').Snippet;
	}
	let { activePage, onJump, children }: Props = $props();
</script>

<div class="editor-shell">
	<EditorTopBar />
	<div class="body">
		<aside class="left"><PageNav {activePage} {onJump} /></aside>
		<main class="canvas">
			<div class="page-stage">
				{@render children?.()}
			</div>
		</main>
		<aside class="right"><LibraryPanel /></aside>
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
	.left {
		border-right: 1px solid #1f2530;
		min-height: 0;
	}
	.right {
		border-left: 1px solid #1f2530;
		min-height: 0;
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
