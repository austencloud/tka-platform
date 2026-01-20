<script lang="ts">
	/**
	 * Worlds Destination - Wrapper for procedural infinite terrain module
	 *
	 * Now uses Threlte-based WorldScene for full avatar parity with
	 * Stage and Gallery destinations. Features:
	 * - Unified camera controller (V to cycle modes)
	 * - Full Avatar3D with GLTF models
	 * - Grid planes for reference
	 * - Physics-based movement with Rapier
	 *
	 * Uses WorldScene with PROCEDURAL_WORLD_CONFIG.
	 */

	import WorldScene from "./components/WorldScene.svelte";
	import { PROCEDURAL_WORLD_CONFIG } from "./core/realm-definitions";
</script>

<WorldScene realmConfig={PROCEDURAL_WORLD_CONFIG} />
