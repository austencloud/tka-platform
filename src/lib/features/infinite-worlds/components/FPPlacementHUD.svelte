<script lang="ts">
	/**
	 * FPPlacementHUD
	 *
	 * First-person placement mode HUD with crosshair and selected object info.
	 * Shown when an object is selected for placement in FP mode.
	 */

	import type { ObjectDefinition } from "../objects/object-catalog";

	interface Props {
		selectedObject: ObjectDefinition;
		placementHint: string; // "Click" or "Tap" based on input type
	}

	let { selectedObject, placementHint }: Props = $props();
</script>

<!-- Crosshair -->
<div class="fp-crosshair">
	<div class="crosshair-line horizontal"></div>
	<div class="crosshair-line vertical"></div>
	<div class="crosshair-dot"></div>
</div>

<!-- Placement HUD -->
<div class="fp-placement-hud">
	<div class="placement-item">
		<div
			class="placement-icon"
			style="background-color: #{selectedObject.color.toString(16).padStart(6, '0')}"
		>
			<i class="fas {selectedObject.icon}" aria-hidden="true"></i>
		</div>
		<span class="placement-name">{selectedObject.name}</span>
	</div>
	<div class="placement-controls">
		<span class="hint-key">{placementHint}</span> Place
		<span class="hint-key">Q</span> Next
		<span class="hint-key">ESC</span> Cancel
	</div>
</div>

<style>
	/* Crosshair */
	.fp-crosshair {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		z-index: 300;
	}

	.crosshair-line {
		position: absolute;
		background: rgba(255, 255, 255, 0.8);
		box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
	}

	.crosshair-line.horizontal {
		width: 20px;
		height: 2px;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.crosshair-line.vertical {
		width: 2px;
		height: 20px;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.crosshair-dot {
		position: absolute;
		width: 4px;
		height: 4px;
		background: #f97316;
		border-radius: 50%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		box-shadow: 0 0 4px rgba(249, 115, 22, 0.8);
	}

	/* Placement HUD */
	.fp-placement-hud {
		position: absolute;
		bottom: 80px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 16px 24px;
		background: rgba(0, 0, 0, 0.85);
		border: 1px solid rgba(249, 115, 22, 0.4);
		border-radius: 12px;
		z-index: 250;
	}

	.placement-item {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.placement-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		color: white;
		font-size: 18px;
	}

	.placement-name {
		font-size: 16px;
		font-weight: 600;
		color: white;
	}

	.placement-controls {
		display: flex;
		align-items: center;
		gap: 16px;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.6);
	}

	.hint-key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		padding: 3px 6px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.8);
		margin-right: 4px;
	}
</style>
