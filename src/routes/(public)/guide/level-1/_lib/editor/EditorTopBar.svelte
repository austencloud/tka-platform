<script lang="ts">
	import { useEditorContext } from '../EditorContext.svelte';
	import SaveIndicator from './SaveIndicator.svelte';
	import { pages } from '../page-manifest';
	import { editorPrefs } from './editor-prefs.svelte';

	const ctx = useEditorContext();
	const label = $derived(
		pages.find((p) => p.pageNumber === ctx.pageNumber)?.label ?? ''
	);
	const zoomPct = $derived(Math.round(editorPrefs.zoom * 100));
</script>

<header class="topbar">
	<div class="left">
		<strong>Page {ctx.pageNumber}</strong>
		<span class="page-label">{label}</span>
	</div>
	<div class="actions">
		<div class="view-toggle" role="tablist" aria-label="View mode">
			<button
				type="button"
				role="tab"
				aria-selected={editorPrefs.viewMode === 'single'}
				class:active={editorPrefs.viewMode === 'single'}
				onclick={() => editorPrefs.setViewMode('single')}
				title="Single page"
			>
				◻ Single
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={editorPrefs.viewMode === 'spread'}
				class:active={editorPrefs.viewMode === 'spread'}
				onclick={() => editorPrefs.setViewMode('spread')}
				title="Book spread (facing pages)"
			>
				◫ Spread
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={editorPrefs.viewMode === 'compare'}
				class:active={editorPrefs.viewMode === 'compare'}
				onclick={() => editorPrefs.setViewMode('compare')}
				title="Original artboard vs reconstructed page"
			>
				⇆ Compare
			</button>
		</div>

		<div class="zoom-cluster" aria-label="Zoom">
			<button
				type="button"
				onclick={() => editorPrefs.zoomOut()}
				title="Zoom out (Ctrl+-)"
				aria-label="Zoom out"
			>
				−
			</button>
			<button
				type="button"
				class="zoom-pct"
				onclick={() => editorPrefs.resetZoom()}
				title="Reset zoom to 100% (Ctrl+0)"
			>
				{zoomPct}%
			</button>
			<button
				type="button"
				onclick={() => editorPrefs.zoomIn()}
				title="Zoom in (Ctrl+=)"
				aria-label="Zoom in"
			>
				+
			</button>
		</div>

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
	.actions > button {
		background: transparent;
		color: inherit;
		border: 1px solid #2a3344;
		border-radius: 4px;
		padding: 0.25rem 0.55rem;
		cursor: pointer;
		font: inherit;
	}
	.actions > button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.view-toggle {
		display: flex;
		border: 1px solid #2a3344;
		border-radius: 4px;
		overflow: hidden;
	}
	.view-toggle button {
		background: transparent;
		color: #8a93a4;
		border: none;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
		font: inherit;
		font-size: 0.78rem;
	}
	.view-toggle button:hover {
		color: #e6e8ec;
	}
	.view-toggle button.active {
		background: #2b3650;
		color: #e6e8ec;
	}
	.view-toggle button + button {
		border-left: 1px solid #2a3344;
	}

	.zoom-cluster {
		display: flex;
		border: 1px solid #2a3344;
		border-radius: 4px;
		overflow: hidden;
	}
	.zoom-cluster button {
		background: transparent;
		color: #cdd1d9;
		border: none;
		padding: 0.25rem 0.55rem;
		cursor: pointer;
		font: inherit;
		line-height: 1;
		min-width: 1.9rem;
	}
	.zoom-cluster button:hover {
		background: #1c222d;
		color: #e6e8ec;
	}
	.zoom-cluster button + button {
		border-left: 1px solid #2a3344;
	}
	.zoom-pct {
		font-variant-numeric: tabular-nums;
		min-width: 3.3rem;
	}
</style>
