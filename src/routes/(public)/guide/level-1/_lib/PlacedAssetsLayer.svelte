<script lang="ts">
	import { useEditorContext } from './EditorContext.svelte';
	import DraggableAsset from './DraggableAsset.svelte';
	import {
		LIBRARY_DRAG_MIME,
		makePlacedAssetFromDrop,
		type LibraryDropEntry
	} from './library-drop';
	import type { Position, Size } from './sidecar-schema';

	interface Props {
		pageWidth?: number;
		pageHeight?: number;
	}
	let { pageWidth = 0, pageHeight = 0 }: Props = $props();

	const ctx = useEditorContext();

	let layer: HTMLDivElement | undefined = $state();
	let measuredWidth = $state(0);
	let measuredHeight = $state(0);

	$effect(() => {
		if (!layer) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				measuredWidth = entry.contentRect.width;
				measuredHeight = entry.contentRect.height;
			}
		});
		ro.observe(layer);
		return () => ro.disconnect();
	});

	const effectiveWidth = $derived(pageWidth > 0 ? pageWidth : measuredWidth);
	const effectiveHeight = $derived(pageHeight > 0 ? pageHeight : measuredHeight);

	function commitChange(id: string, next: { position: Position; size: Size }) {
		ctx.mutate(
			(draft) => {
				const target = draft.placedAssets.find((a) => a.id === id);
				if (target) {
					target.position = next.position;
					target.size = next.size;
				}
				return draft;
			},
			{ key: `pos:${id}`, withinMs: 600 }
		);
	}

	function handleLayerClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			ctx.selectedAssetId = null;
		}
	}

	function handleDragOver(event: DragEvent) {
		if (event.dataTransfer?.types?.includes(LIBRARY_DRAG_MIME)) {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDrop(event: DragEvent) {
		const raw = event.dataTransfer?.getData(LIBRARY_DRAG_MIME);
		if (!raw) return;
		event.preventDefault();
		let entry: LibraryDropEntry;
		try {
			entry = JSON.parse(raw) as LibraryDropEntry;
		} catch {
			return;
		}
		if (!entry?.id || (entry.kind !== 'pictograph' && entry.kind !== 'sequence')) return;

		const rect = layer?.getBoundingClientRect();
		const offsetX = rect ? event.clientX - rect.left : event.offsetX;
		const offsetY = rect ? event.clientY - rect.top : event.offsetY;

		const dims = {
			width: effectiveWidth || rect?.width || 1,
			height: effectiveHeight || rect?.height || 1
		};
		const newAsset = makePlacedAssetFromDrop(entry, { x: offsetX, y: offsetY }, dims);
		ctx.mutate((draft) => {
			draft.placedAssets.push(newAsset);
			return draft;
		});
		ctx.selectedAssetId = newAsset.id;
	}
</script>

<div
	class="placed-assets-layer"
	bind:this={layer}
	aria-hidden={ctx.sidecar.placedAssets.length === 0}
	onclick={handleLayerClick}
	ondragover={handleDragOver}
	ondrop={handleDrop}
	role="presentation"
>
	{#each ctx.sidecar.placedAssets as asset (asset.id)}
		<DraggableAsset
			{asset}
			pageWidth={effectiveWidth}
			pageHeight={effectiveHeight}
			selected={ctx.selectedAssetId === asset.id}
			onSelect={() => (ctx.selectedAssetId = asset.id)}
			onChange={(next) => commitChange(asset.id, next)}
		>
			{#if asset.bake.path}
				<img src={asset.bake.path} alt="" draggable="false" />
			{:else}
				<div class="placeholder">
					<span>{asset.type}</span>
					<small>not yet baked</small>
				</div>
			{/if}
			{#if asset.bake.stale}
				<span class="stale-badge" title="Source changed since last bake">↻ stale</span>
			{/if}
		</DraggableAsset>
	{/each}
</div>

<style>
	.placed-assets-layer {
		position: absolute;
		inset: 0;
		pointer-events: auto;
	}
	.placed-assets-layer :global(.draggable-asset img) {
		width: 100%;
		height: 100%;
		display: block;
		user-select: none;
	}
	.placeholder {
		width: 100%;
		height: 100%;
		display: grid;
		place-content: center;
		background: repeating-linear-gradient(
			45deg,
			#f4f4f4,
			#f4f4f4 8px,
			#ececec 8px,
			#ececec 16px
		);
		color: #555;
		font-family: system-ui, sans-serif;
		font-size: 0.7rem;
		text-align: center;
		border: 1px dashed #aaa;
	}
	.placeholder span {
		font-weight: 600;
	}
	.placeholder small {
		color: #888;
	}
	.stale-badge {
		position: absolute;
		top: 4px;
		right: 4px;
		background: rgba(255, 200, 0, 0.95);
		color: #1a1a1a;
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
		font-family: system-ui, sans-serif;
		font-size: 0.65rem;
		font-weight: 600;
		pointer-events: none;
	}
</style>
