<script lang="ts">
	import { useEditorContext } from '../_lib/EditorContext.svelte';
	import SaveIndicator from './SaveIndicator.svelte';
	import { pages } from '../_lib/page-manifest';

	const ctx = useEditorContext();
	const label = $derived(
		pages.find((p) => p.pageNumber === ctx.pageNumber)?.label ?? ''
	);
</script>

<header class="topbar">
	<div class="left">
		<strong>Page {ctx.pageNumber}</strong>
		<span class="page-label">{label}</span>
	</div>
	<div class="actions">
		<button
			type="button"
			onclick={() => ctx.performUndo()}
			disabled={!ctx.undo.canUndo}
			title="Undo (Ctrl+Z)"
		>
			↶
		</button>
		<button
			type="button"
			onclick={() => ctx.performRedo()}
			disabled={!ctx.undo.canRedo}
			title="Redo (Ctrl+Shift+Z)"
		>
			↷
		</button>
		<SaveIndicator />
		<a href="/guide/level-1/compare" class="exit">Exit ›</a>
	</div>
</header>

<style>
	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 1rem;
		background: #11151c;
		color: #e6e8ec;
		border-bottom: 1px solid #1f2530;
		font-family: system-ui, sans-serif;
		font-size: 0.85rem;
	}
	.left {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
	}
	.page-label {
		color: #cdd1d9;
	}
	.actions {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}
	.actions button {
		background: transparent;
		color: inherit;
		border: 1px solid #2a3344;
		border-radius: 4px;
		padding: 0.25rem 0.55rem;
		cursor: pointer;
		font: inherit;
	}
	.actions button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.exit {
		color: #6cb6f0;
		text-decoration: none;
	}
</style>
