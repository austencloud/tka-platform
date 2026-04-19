<script lang="ts">
	import type { PlacedAsset } from './sidecar-schema';

	interface Props {
		assets: PlacedAsset[];
	}
	let { assets }: Props = $props();
</script>

<div class="placed-assets-layer" aria-hidden={assets.length === 0}>
	{#each assets as asset (asset.id)}
		<div
			class="placed-asset"
			class:stale={asset.bake.stale}
			style:left={asset.position.x + (asset.position.unit === 'pct' ? '%' : 'px')}
			style:top={asset.position.y + (asset.position.unit === 'pct' ? '%' : 'px')}
			style:width={asset.size.width + (asset.size.unit === 'pct' ? '%' : 'px')}
			style:height={asset.size.height + (asset.size.unit === 'pct' ? '%' : 'px')}
			style:transform={asset.rotation ? `rotate(${asset.rotation}deg)` : undefined}
			style:z-index={asset.zIndex ?? 1}
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
		</div>
	{/each}
</div>

<style>
	.placed-assets-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.placed-asset {
		position: absolute;
		pointer-events: auto;
	}
	.placed-asset img {
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
