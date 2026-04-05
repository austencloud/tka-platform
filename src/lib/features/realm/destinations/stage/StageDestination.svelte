<script lang="ts">
	/**
	 * Stage Destination - Performance stage for 3D sequence viewing
	 *
	 * Users can:
	 * - View and animate sequences in 3D space
	 * - Press V to cycle camera modes (orbit, third-person, first-person)
	 * - Walk with WASD in game modes
	 * - Load sequences from the library
	 *
	 * Features:
	 * - Multi-performer support with formations
	 * - Camera choreography
	 * - Visual effects (trails, bloom)
	 */

	import StageWorld from "$lib/shared/3d/StageWorld.svelte";
</script>

<StageWorld />
