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

	import WorldScene from "./components/WorldScene.svelte";
	import { HANNONS_CAMP_CONFIG } from "./core/realm-definitions";
</script>

<WorldScene realmConfig={HANNONS_CAMP_CONFIG} />
