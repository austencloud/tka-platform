<!--
	CompositionMiniPreview.svelte

	Renders a CSS grid of mini pictograph thumbnails for a composition card.
	Each cell shows its first beat rendered via PreviewCellRenderer.
-->
<script lang="ts">
	import { onDestroy } from "svelte";
	import type { CellConfig, GridLayout } from "../../../compose/domain/types";
	import { previewCellRenderer } from "$lib/shared/sequence-viewer/services/implementations/PreviewCellRenderer";

	const {
		cells,
		layout,
	}: {
		cells: CellConfig[];
		layout: GridLayout;
	} = $props();

	let cellImages = $state<Map<string, string>>(new Map());
	let isRendering = $state(true);
	let destroyed = false;

	onDestroy(() => {
		destroyed = true;
		// Revoke blob URLs to free memory
		for (const url of cellImages.values()) {
			if (url.startsWith("blob:")) URL.revokeObjectURL(url);
		}
	});

	// Render all cell previews when cells change
	$effect(() => {
		renderPreviews(cells, layout);
	});

	async function renderPreviews(currentCells: CellConfig[], _layout: GridLayout): Promise<void> {
		isRendering = true;
		// Revoke old blob URLs before replacing
		for (const url of cellImages.values()) {
			if (url.startsWith("blob:")) URL.revokeObjectURL(url);
		}
		const newImages = new Map<string, string>();

		const renderPromises = currentCells.map(async (cell) => {
			const firstStep = cell.sequences[0]?.steps[0];
			if (!firstStep) return;

			try {
				const dataUrl = await previewCellRenderer.renderCell(
					firstStep,
					undefined,
					true,
					{
						size: 120,
						showStepNumbers: false,
						showTKA: true,
						showReversals: false,
						showNonRadialPoints: false,
						handPointVisibility: "active",
					}
				);
				if (!destroyed) {
					newImages.set(cell.id, dataUrl);
				}
			} catch (err) {
				console.warn(`Failed to render cell ${cell.id} preview:`, err);
			}
		});

		await Promise.allSettled(renderPromises);

		if (!destroyed) {
			cellImages = newImages;
			isRendering = false;
		}
	}
</script>

<div
	class="mini-grid"
	style="--cols: {layout.cols}; --rows: {layout.rows};"
>
	{#each cells as cell (cell.id)}
		<div class="mini-cell">
			{#if cellImages.has(cell.id)}
				<img
					src={cellImages.get(cell.id)}
					alt=""
					class="cell-img"
					aria-hidden="true"
				/>
			{:else if isRendering}
				<div class="cell-skeleton"></div>
			{:else}
				<div class="cell-empty"></div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.mini-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		grid-template-rows: repeat(var(--rows), 1fr);
		gap: 2px;
		width: 100%;
		height: 100%;
		padding: 4px;
		box-sizing: border-box;
	}

	.mini-cell {
		position: relative;
		overflow: hidden;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.03);
	}

	.cell-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.cell-skeleton {
		width: 100%;
		height: 100%;
		background: linear-gradient(
			110deg,
			rgba(255, 255, 255, 0.04) 30%,
			rgba(255, 255, 255, 0.08) 50%,
			rgba(255, 255, 255, 0.04) 70%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
	}

	.cell-empty {
		width: 100%;
		height: 100%;
		border: 1px dashed rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		box-sizing: border-box;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cell-skeleton {
			animation: none;
			background: rgba(255, 255, 255, 0.06);
		}
	}
</style>
