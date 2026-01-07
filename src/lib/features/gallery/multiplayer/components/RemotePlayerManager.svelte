<script lang="ts">
	/**
	 * RemotePlayerManager
	 *
	 * Manages rendering of all remote players in the 3D scene.
	 * Handles LOD (Level of Detail) based on distance from local player.
	 */

	import type { RemotePlayer, PlayerPosition } from '../domain/multiplayer-models';
	import RemotePlayerAvatar from './RemotePlayerAvatar.svelte';

	interface Props {
		/** All remote players to render */
		remotePlayers: readonly RemotePlayer[];
		/** Local player position for LOD calculation */
		localPosition: PlayerPosition;
		/** Maximum render distance for full detail */
		maxRenderDistance?: number;
		/** Distance beyond which players are hidden */
		cullDistance?: number;
	}

	let {
		remotePlayers,
		localPosition,
		maxRenderDistance = 2000,
		cullDistance = 5000
	}: Props = $props();

	// Calculate distance from local player
	function getDistance(pos: PlayerPosition): number {
		const dx = pos.x - localPosition.x;
		const dy = pos.y - localPosition.y;
		const dz = pos.z - localPosition.z;
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	// Filter and sort players by distance
	const visiblePlayers = $derived.by(() => {
		return remotePlayers
			.map((player) => ({
				...player,
				distance: getDistance(player.position)
			}))
			.filter((player) => player.distance < cullDistance)
			.sort((a, b) => a.distance - b.distance);
	});

	// Determine if player should show name tag (LOD)
	function shouldShowNameTag(distance: number): boolean {
		return distance < maxRenderDistance * 0.5;
	}
</script>

{#each visiblePlayers as player (player.userId)}
	<RemotePlayerAvatar
		{player}
		showNameTag={shouldShowNameTag(player.distance)}
	/>
{/each}
