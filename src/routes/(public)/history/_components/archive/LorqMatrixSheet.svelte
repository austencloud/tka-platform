<!--
  Lorq Nichols artifact: the enumeration itself, drawn.

  The catalog's sourced line is "patterns enumerated rather than described —
  driving styles crossed against each other ... until the grid is full", and
  his own sub-work is the "144 Shape Matrix: twelve driving styles against
  twelve". So the artifact is a twelve-by-twelve grid whose every cell is a
  REAL rendered pair of mandalas from this repo's shape-matrix data, instead of
  an abstract lattice standing in for one.

  What it is NOT: a reproduction of Lorq's sheet. These are TKA's own flowers,
  painted by the shared shape-matrix renderer. The tile shows the SHAPE of the
  work — crossed driving styles, filled in — and the entry's sources point to
  his site for his enumeration. No cell is labelled here.

  ShapeMatrixGrid (the interactive one) is deliberately not used: it holds a
  44px AAA touch floor per cell, so thirteen columns need 572px and would
  overflow a tile. These cells are non-interactive artwork, so they scale.
-->
<script lang="ts">
	import { onMount } from "svelte";
	import {
		loadShapeMatrix,
		type ShapeMatrixData,
	} from "$lib/shared/shape-matrix/services/shape-matrix-flowers";
	import { applyFilter } from "$lib/shared/shape-matrix/domain/filter-flower-axis";
	import { matrixFiltersForSize } from "$lib/shared/shape-matrix/domain/matrix-size-preset";
	import {
		flowerKey,
		flowerLabel,
		type Flower,
	} from "$lib/shared/shape-matrix/domain/flower-signature";
	import { renderCell } from "$lib/shared/shape-matrix/services/shape-matrix-render";

	let { active = false }: { active?: boolean } = $props();

	let data = $state<ShapeMatrixData | null>(null);

	// The builder computes mandala geometry across the whole flower axis. It is
	// memoized, so this tile and the public shape-matrix page share one build.
	onMount(async () => {
		try {
			data = await loadShapeMatrix();
		} catch {
			data = null;
		}
	});

	// "Large" is the 144-cell preset — twelve against twelve, the size Lorq's
	// own sub-work names.
	const rowAxis = $derived<Flower[]>(
		data
			? applyFilter(data.axis, matrixFiltersForSize("large").left, false)
			: []
	);
	const colAxis = $derived<Flower[]>(
		data ? applyFilter(data.axis, matrixFiltersForSize("large").right, false) : []
	);

	// Cells paint once into data URLs and are cached; CSS scales them to the
	// plate, so resizing never repaints.
	const CELL_PX = 72;
	const cache = new Map<string, string>();
	function cellSrc(left, right): string {
		const key = `${flowerKey(left)}__${flowerKey(right)}`;
		let url = cache.get(key);
		if (!url) {
			url = renderCell(
				data!.left.get(flowerKey(left))!,
				data!.right.get(flowerKey(right))!,
				CELL_PX,
				data!.clubTipDx
			);
			cache.set(key, url);
		}
		return url;
	}
</script>

<div class="lorq-sheet">
	<div
		class="sheet"
		class:lit={active}
		role="img"
		aria-label={data
			? `Twelve driving styles crossed against twelve: a filled grid of ${rowAxis.length * colAxis.length} pattern cells`
			: "The shape matrix, loading"}
	>
		{#if data && rowAxis.length && colAxis.length}
			<div class="matrix" style={`--cols: ${colAxis.length}`}>
				{#each rowAxis as left (flowerKey(left))}
					{#each colAxis as right (flowerKey(right))}
						<img
							class="cell"
							src={cellSrc(left, right)}
							alt=""
							decoding="async"
							title={`${flowerLabel(left)} × ${flowerLabel(right)}`}
						/>
					{/each}
				{/each}
			</div>
		{/if}
	</div>
	{#if data}
		<!-- His own sub-work's words for this grid. -->
		<p class="sheet-caption">
			<span class="count">{rowAxis.length * colAxis.length}</span>
			twelve driving styles against twelve
		</p>
	{/if}
</div>

<style>
	.lorq-sheet {
		width: 100%;
		height: 100%;
		max-height: 100%;
		overflow: hidden;
		display: grid;
		/* Definite column track. With an `auto` track, the sheet's
		   `min(100%, Ncqh)` has no resolvable percentage basis, so the cqh arm
		   wins and the track grows to it — the sheet then overflows a narrow
		   stage. Pinning the track to 1fr makes 100% mean the stage. */
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) auto;
		justify-items: center;
		align-content: center;
		gap: 0.7rem;
		padding: clamp(0.6rem, 3cqi, 1.6rem);
		box-sizing: border-box;
	}

	.sheet-caption {
		margin: 0;
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: clamp(var(--font-size-compact, 0.75rem), 2cqi, 0.9rem);
		font-style: italic;
		color: oklch(0.66 0.04 80);
	}

	.count {
		font-variant-numeric: tabular-nums;
		font-style: normal;
		font-weight: 700;
		color: oklch(0.84 0.13 80);
	}

	/* The sheet the enumeration is printed on. */
	.sheet {
		display: grid;
		place-items: center;
		/* The caption row shares the stage; 74cqh leaves it room on short
		   viewports instead of pushing the square past the tile. */
		width: min(100%, 74cqh);
		max-width: 100%;
		aspect-ratio: 1;
		padding: clamp(0.4rem, 2cqi, 1rem);
		border-radius: 14px;
		background: oklch(0.16 0.02 80 / 0.55);
		border: 1px solid oklch(0.75 0.12 80 / 0.28);
		box-shadow: 0 0 40px oklch(0.75 0.14 80 / 0.1);
		transition:
			border-color 400ms ease,
			box-shadow 400ms ease;
	}

	.sheet.lit {
		border-color: oklch(0.8 0.14 80 / 0.5);
		box-shadow: 0 0 60px oklch(0.8 0.15 80 / 0.18);
	}

	.matrix {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		width: 100%;
		gap: 1px;
	}

	/* The painter strokes thin lines on transparency; at ~42px a cell those
	   read as grey haze, so the sheet lifts them rather than tinting them. */
	.cell {
		width: 100%;
		aspect-ratio: 1;
		display: block;
		opacity: 0.9;
		filter: brightness(1.45) saturate(1.15);
		transition:
			opacity 400ms ease,
			filter 400ms ease;
	}

	.sheet.lit .cell {
		opacity: 1;
		filter: brightness(1.75) saturate(1.3);
	}

	/* Short stage: the grid is the artifact; the caption stands down so the
	   sheet keeps its square rather than being cropped. */
	@container (max-height: 220px) {
		.sheet-caption {
			display: none;
		}
		.sheet {
			width: min(100%, 96cqh);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet,
		.cell {
			transition: none;
		}
	}
</style>
