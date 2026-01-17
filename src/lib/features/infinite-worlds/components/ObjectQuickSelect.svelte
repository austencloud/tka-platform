<script lang="ts">
	/**
	 * Object Quick Select
	 *
	 * HL2-style radial menu for selecting objects to place.
	 * Press Q to open, click or release Q on an item to select.
	 */

	import { OBJECT_CATALOG, type ObjectDefinition } from "../objects/object-catalog";

	interface Props {
		onSelect: (definition: ObjectDefinition) => void;
		onClose: () => void;
	}

	let { onSelect, onClose }: Props = $props();

	// Get a subset of commonly used objects for quick access
	const quickObjects = OBJECT_CATALOG.filter((obj) =>
		["bell-tent", "dome-tent", "flag", "fire-pit", "pin-marker", "waypoint"].includes(obj.key)
	);

	// Calculate positions in a circle
	function getPosition(index: number, total: number): { x: number; y: number } {
		const angle = (index / total) * Math.PI * 2 - Math.PI / 2; // Start from top
		const radius = 100;
		return {
			x: Math.cos(angle) * radius,
			y: Math.sin(angle) * radius,
		};
	}

	function handleSelect(def: ObjectDefinition): void {
		onSelect(def);
	}

	function handleBackdropClick(): void {
		onClose();
	}
</script>

<div
	class="quick-select-overlay"
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === "Escape" && onClose()}
	role="dialog"
	aria-label="Object selection"
	tabindex="-1"
>
	<div class="quick-select-container">
		<!-- Center hint -->
		<div class="center-hint">
			<span>Select Object</span>
		</div>

		<!-- Object options in a circle -->
		{#each quickObjects as def, i}
			{@const pos = getPosition(i, quickObjects.length)}
			<button
				class="quick-option"
				style="transform: translate({pos.x}px, {pos.y}px)"
				onclick={(e) => {
					e.stopPropagation();
					handleSelect(def);
				}}
				title={def.name}
			>
				<div
					class="option-icon"
					style="background-color: #{def.color.toString(16).padStart(6, '0')}"
				>
					<i class="fas {def.icon}" aria-hidden="true"></i>
				</div>
				<span class="option-label">{def.name}</span>
			</button>
		{/each}

		<!-- More options button -->
		<button
			class="quick-option more-btn"
			style="transform: translate(0px, 120px)"
			onclick={(e) => {
				e.stopPropagation();
				// Could open full palette, for now just close
				onClose();
			}}
		>
			<div class="option-icon more-icon">
				<i class="fas fa-ellipsis-h" aria-hidden="true"></i>
			</div>
			<span class="option-label">More...</span>
		</button>
	</div>

	<div class="escape-hint">
		<span class="key">ESC</span> Cancel
	</div>
</div>

<style>
	.quick-select-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		cursor: pointer;
	}

	.quick-select-container {
		position: relative;
		width: 300px;
		height: 300px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.center-hint {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		color: rgba(255, 255, 255, 0.6);
		font-size: 14px;
		pointer-events: none;
	}

	.quick-option {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 8px;
		background: rgba(0, 0, 0, 0.8);
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.quick-option:hover {
		background: rgba(249, 115, 22, 0.2);
		border-color: #f97316;
		transform: translate(var(--x), var(--y)) scale(1.1) !important;
	}

	.option-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 10px;
		color: white;
		font-size: 20px;
	}

	.more-icon {
		background: rgba(255, 255, 255, 0.1) !important;
	}

	.option-label {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.8);
		white-space: nowrap;
	}

	.more-btn {
		opacity: 0.7;
	}

	.more-btn:hover {
		opacity: 1;
	}

	.escape-hint {
		position: absolute;
		bottom: 40px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.5);
		pointer-events: none;
	}

	.key {
		padding: 4px 8px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
	}
</style>
