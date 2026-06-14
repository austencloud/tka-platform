<script lang="ts">
	/**
	 * ArchiveDestination - The Kinetic Archive
	 *
	 * Standalone 3D scene using IndoorScene for physics-based FPS navigation
	 * with Rapier collision detection and grid-snapped room geometry.
	 */
	import IndoorScene from "$lib/shared/3d/indoor/IndoorScene.svelte";
	import { buildRoom } from "$lib/shared/3d/indoor/services/room-geometry-builder";
	import { DISCOVERY_CHAMBER } from "./domain/wing-definitions";
	import { createArchiveState } from "./state/archive-state.svelte";
	import DiscoveryChamber from "./components/DiscoveryChamber.svelte";
	import PlaqueOverlay from "./components/PlaqueOverlay.svelte";

	const archiveState = createArchiveState();
	const solvedRoom = buildRoom(DISCOVERY_CHAMBER);

	// World offset: existing archive uses groundY = 8
	solvedRoom.worldOffset = { x: 0, y: 8, z: 0 };

	let playerPosition = $state({ x: 0, y: 0, z: 0 });

	function handlePlaqueClose() {
		archiveState.closePlaque();
		const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-engine]");
		canvas?.requestPointerLock();
	}
</script>

<div class="archive-scene">
	<IndoorScene
		room={solvedRoom}
		eyeHeight={1.7}
		moveSpeed={2.5}
		onPositionChange={(pos) => { playerPosition = pos; }}
	>
		<DiscoveryChamber
			{solvedRoom}
			{playerPosition}
			{archiveState}
		/>
	</IndoorScene>

	<!-- Crosshair -->
	<div class="crosshair"></div>

	{#if !archiveState.isOverlayOpen}
		<div class="hint">Click to explore</div>
	{/if}

	{#if archiveState.interactionTargetId && !archiveState.isOverlayOpen}
		<div class="interaction-prompt">
			<div class="prompt-key">E</div>
			<div class="prompt-text">Examine</div>
		</div>
	{/if}

	{#if archiveState.isOverlayOpen && archiveState.activePlaqueContent}
		<PlaqueOverlay
			content={archiveState.activePlaqueContent}
			visible={true}
			onClose={handlePlaqueClose}
		/>
	{/if}
</div>

<style>
	.archive-scene {
		/* Parchment tint RGB triple — one source for the rgba(200,180,140,…) family. */
		--archive-parchment: 200, 180, 140;

		width: 100%;
		height: 100%;
		position: relative;
		background: var(--archive-void, #050403);
		cursor: crosshair;
	}

	.archive-scene :global(canvas) {
		cursor: none;
	}

	.crosshair {
		position: fixed;
		top: 50%;
		left: 50%;
		width: 2px;
		height: 2px;
		background: rgba(var(--archive-parchment), 0.5);
		border-radius: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		z-index: 10;
		box-shadow: 0 0 4px rgba(var(--archive-parchment), 0.3);
	}

	.hint {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-family: "Georgia", "Times New Roman", serif;
		font-size: 1.1rem;
		color: rgba(var(--archive-parchment), 0.6);
		letter-spacing: 0.1em;
		pointer-events: none;
		z-index: 10;
		transition: opacity 0.5s ease;
	}

	.interaction-prompt {
		position: fixed;
		bottom: 30%;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1.2rem;
		background: var(--archive-prompt-scrim, rgba(0, 0, 0, 0.7));
		border: 1px solid rgba(var(--archive-parchment), 0.3);
		border-radius: 6px;
		z-index: 100;
		pointer-events: none;
	}

	.prompt-key {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		background: rgba(var(--archive-parchment), 0.15);
		border: 1px solid rgba(var(--archive-parchment), 0.4);
		border-radius: 4px;
		font-family: system-ui, sans-serif;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--archive-parchment-bright, #d4c5a0);
	}

	.prompt-text {
		font-family: "Georgia", "Times New Roman", serif;
		font-size: 0.9rem;
		color: var(--archive-parchment-body, #c8b890);
		letter-spacing: 0.05em;
	}

	@media (prefers-reduced-motion: reduce) {
		.hint {
			transition: none;
		}
	}
</style>
