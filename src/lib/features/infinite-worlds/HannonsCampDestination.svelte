<script lang="ts">
	/**
	 * Hannon's Camp Destination
	 *
	 * Real terrain from Hannon's Camp America (Kinetic Fire festival site).
	 * Uses actual elevation data from Mapbox - NOT procedural generation.
	 *
	 * Now uses the unified InfiniteWorldsModule with HANNONS_CAMP_CONFIG.
	 */

	import InfiniteWorldsModule from "./components/InfiniteWorldsModule.svelte";
	import { HANNONS_CAMP_CONFIG } from "./core/realm-definitions";
</script>

<InfiniteWorldsModule realmConfig={HANNONS_CAMP_CONFIG} />
