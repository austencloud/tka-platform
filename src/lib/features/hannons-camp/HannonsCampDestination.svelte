<script lang="ts">
	/**
	 * Hannon's Camp Destination
	 *
	 * Real terrain from Hannon's Camp America (Kinetic Fire festival site).
	 * Uses actual elevation data from Mapbox - NOT procedural generation.
	 *
	 * Now uses Threlte-based WorldScene for full avatar parity with
	 * Stage and Gallery destinations.
	 *
	 * The elevation field is FETCHED, not imported. It is 4 MB of JSON; a
	 * top-level `import` compiled all of it into this component's chunk, so the
	 * bytes shipped even though this destination is registered `enabled: false`.
	 * WorldScene mounts once, already holding the field, rather than mounting
	 * against a null terrain and reacting later — a real-terrain realm has
	 * nothing to build until the elevation arrives.
	 */

	import WorldScene from "$lib/shared/3d/procedural-engine/components/WorldScene.svelte";
	import { HANNONS_CAMP_CONFIG } from "$lib/shared/3d/procedural-engine/core/world-definitions";
	import type { ImportedTerrainData } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";
	import { jsonCache } from "$lib/shared/pictograph/shared/services/simple-json-cache";

	const terrain = jsonCache.get<ImportedTerrainData>(
		HANNONS_CAMP_CONFIG.terrain.dataPath!
	);
</script>

{#await terrain}
	<div class="terrain-status">Loading Hannon's Camp elevation…</div>
{:then terrainData}
	<WorldScene realmConfig={HANNONS_CAMP_CONFIG} {terrainData} />
{:catch error}
	<div class="terrain-status terrain-status--error">
		Hannon's Camp terrain failed to load: {error.message}
	</div>
{/await}

<style>
	.terrain-status {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		padding: 2rem;
		color: var(--theme-text-secondary, #94a3b8);
		font-size: 1rem;
		text-align: center;
	}

	.terrain-status--error {
		color: var(--semantic-error, #f87171);
	}
</style>
