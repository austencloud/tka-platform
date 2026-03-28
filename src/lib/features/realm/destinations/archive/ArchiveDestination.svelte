<script lang="ts">
	/**
	 * ArchiveDestination — The Kinetic Archive
	 *
	 * Standalone 3D scene with proper FPS camera. Does NOT use WorldScene
	 * (designed for outdoor terrain with third-person raycasting that breaks
	 * in enclosed rooms). Uses GalleryCanvas + FirstPersonCamera directly.
	 */
	import GalleryCanvas from "$lib/features/realm/destinations/gallery/components/GalleryCanvas.svelte";
	import DiscoveryChamber from "./components/DiscoveryChamber.svelte";
	import FirstPersonCamera from "./components/FirstPersonCamera.svelte";
	import PlaqueOverlay from "./components/PlaqueOverlay.svelte";
	import { createArchiveState } from "./state/archive-state.svelte";

	const archiveState = createArchiveState();

	const groundY = 8;

	let playerPosition = $state({ x: 0, y: groundY + 1.7, z: 3 });

	function handlePlaqueClose() {
		archiveState.closePlaque();
		// Re-lock pointer after closing plaque
		const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-engine]");
		canvas?.requestPointerLock();
	}
</script>

<div class="archive-scene">
	<GalleryCanvas
		renderingBackend="webgpu-auto"
		autoRender={true}
		toneMapping={undefined}
	>
		<FirstPersonCamera
			position={[0, groundY + 1.7, 3]}
			lookAt={[0, groundY + 1.2, -5]}
			speed={2.5}
			eyeHeight={groundY + 1.7}
			onPositionChange={(pos) => { playerPosition = pos; }}
		/>

		<DiscoveryChamber
			{groundY}
			{playerPosition}
			{archiveState}
		/>
	</GalleryCanvas>

	<!-- Crosshair -->
	<div class="crosshair"></div>

	<!-- Click-to-start hint (fades out after pointer lock) -->
	{#if !archiveState.isOverlayOpen}
		<div class="hint" class:hidden={false}>
			Click to explore
		</div>
	{/if}

	<!-- Interaction prompt -->
	{#if archiveState.interactionTargetId && !archiveState.isOverlayOpen}
		<div class="interaction-prompt">
			<div class="prompt-key">E</div>
			<div class="prompt-text">Examine</div>
		</div>
	{/if}

	<!-- Plaque overlay -->
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
		width: 100%;
		height: 100%;
		position: relative;
		background: #050403;
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
		background: rgba(200, 180, 140, 0.5);
		border-radius: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		z-index: 10;
		box-shadow: 0 0 4px rgba(200, 180, 140, 0.3);
	}

	.hint {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-family: "Georgia", "Times New Roman", serif;
		font-size: 1.1rem;
		color: rgba(200, 180, 140, 0.6);
		letter-spacing: 0.1em;
		pointer-events: none;
		z-index: 10;
		transition: opacity 0.5s ease;
	}

	.hint.hidden {
		opacity: 0;
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
		background: rgba(0, 0, 0, 0.7);
		border: 1px solid rgba(200, 180, 140, 0.3);
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
		background: rgba(200, 180, 140, 0.15);
		border: 1px solid rgba(200, 180, 140, 0.4);
		border-radius: 4px;
		font-family: system-ui, sans-serif;
		font-size: 0.9rem;
		font-weight: 600;
		color: #d4c5a0;
	}

	.prompt-text {
		font-family: "Georgia", "Times New Roman", serif;
		font-size: 0.9rem;
		color: #c8b890;
		letter-spacing: 0.05em;
	}
</style>
