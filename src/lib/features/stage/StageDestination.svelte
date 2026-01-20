<script lang="ts">
	/**
	 * Stage Destination - Performance stage within explorable forest world
	 *
	 * The Stage is now a flat circular area at the center of a procedurally
	 * generated forest. Users can:
	 * - Perform sequences on the stage grid (center area)
	 * - Press V to enter third-person or first-person mode
	 * - Walk with WASD to explore the surrounding forest
	 * - Return to the stage area anytime
	 *
	 * Eventually will be enhanced with:
	 * - Timeline choreography editor
	 * - Formation system
	 * - Camera choreography
	 * - N-performer synchronization
	 */

	import StageWorld from "$lib/shared/3d-animation/StageWorld.svelte";
</script>

<StageWorld />
