<script lang="ts">
	/**
	 * Worlds Destination - Wrapper for procedural infinite terrain module
	 *
	 * Enhancements planned:
	 * - Unified camera controller integration
	 * - Multiplayer exploration (future)
	 *
	 * Uses InfiniteWorldsModule with PROCEDURAL_WORLD_CONFIG.
	 */

	import InfiniteWorldsModule from "./components/InfiniteWorldsModule.svelte";
	import { PROCEDURAL_WORLD_CONFIG } from "./core/realm-definitions";
</script>

<InfiniteWorldsModule realmConfig={PROCEDURAL_WORLD_CONFIG} />
