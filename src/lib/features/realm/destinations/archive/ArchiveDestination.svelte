<script lang="ts">
	/**
	 * ArchiveDestination - The Kinetic Archive
	 *
	 * Top-level destination component for the narrative museum experience.
	 * Uses WorldScene for camera/movement, renders HTML overlays for
	 * plaque reading and interaction prompts.
	 */
	import WorldScene from "$lib/features/realm/components/scene/WorldScene.svelte";
	import { ARCHIVE_WING1_CONFIG } from "$lib/features/realm/core/realm-definitions";
	import { getActiveArchiveState } from "./state/archive-state-bridge.svelte";
	import PlaqueOverlay from "./components/PlaqueOverlay.svelte";

	const archiveState = $derived(getActiveArchiveState());

	const showPrompt = $derived(
		archiveState &&
		archiveState.interactionTargetId !== null &&
		!archiveState.isOverlayOpen
	);

	function handlePlaqueClose() {
		if (!archiveState) return;
		archiveState.closePlaque();
		document.body.requestPointerLock();
	}
</script>

<WorldScene realmConfig={ARCHIVE_WING1_CONFIG} />

{#if archiveState}
	<!-- Interaction prompt -->
	{#if showPrompt}
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
{/if}

<style>
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
		animation: promptFadeIn 0.2s ease-out;
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

	@keyframes promptFadeIn {
		from { opacity: 0; transform: translateX(-50%) translateY(8px); }
		to { opacity: 1; transform: translateX(-50%) translateY(0); }
	}
</style>
