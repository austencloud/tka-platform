<script lang="ts">
	/**
	 * Hannon's Camp Destination
	 *
	 * Real terrain from Hannon's Camp America (Kinetic Fire festival site).
	 * Uses actual elevation data from Mapbox - NOT procedural generation.
	 *
	 * Now uses Threlte-based WorldScene for full avatar parity with
	 * Stage and Gallery destinations.
	 */

	import WorldScene from "$lib/shared/3d/procedural-engine/components/WorldScene.svelte";
	import { HANNONS_CAMP_CONFIG } from "$lib/shared/3d/procedural-engine/core/world-definitions";
	import type { ImportedTerrainData } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";
	import hannonsTerrainData from "./data/hannons-camp-terrain.json";
</script>

<WorldScene
	realmConfig={HANNONS_CAMP_CONFIG}
	terrainData={hannonsTerrainData as ImportedTerrainData}
/>
