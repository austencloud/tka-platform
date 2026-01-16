<script lang="ts">
	/**
	 * Hannon's Camp Destination
	 *
	 * Real terrain from Hannon's Camp America (Kinetic Fire festival site).
	 * Uses actual elevation data from Mapbox overlaid on the infinite worlds system.
	 */

	import { onMount } from "svelte";
	import InfiniteWorldsModule from "./components/InfiniteWorldsModule.svelte";

	let moduleRef: InfiniteWorldsModule;
	let autoLoadHannons = true;
</script>

<InfiniteWorldsModule bind:this={moduleRef} {autoLoadHannons} />
