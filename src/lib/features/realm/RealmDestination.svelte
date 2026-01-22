<script lang="ts">
	/**
	 * Realm Destination - Campground clearing with procedural forest
	 *
	 * Spawn in a grassy meadow with fire pit, tent, and log seating.
	 * Walk out into procedurally generated forest terrain.
	 */

	import WorldScene from "./components/scene/WorldScene.svelte";
	import { PERFORMANCE_STAGE_CONFIG } from "./core/realm-definitions";
</script>

<WorldScene realmConfig={PERFORMANCE_STAGE_CONFIG} />
