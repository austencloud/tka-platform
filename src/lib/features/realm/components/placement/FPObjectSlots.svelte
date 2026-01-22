<script lang="ts">
	/**
	 * FPObjectSlots
	 *
	 * HL2-style numbered object slots shown in first-person mode.
	 * Allows quick selection of objects via number keys 1-6.
	 */

	import type { ObjectDefinition } from "../objects/object-catalog";

	interface Props {
		objects: ObjectDefinition[];
		activeIndex: number;
		onSelect: (index: number) => void;
	}

	let { objects, activeIndex, onSelect }: Props = $props();
</script>

<div class="fp-object-slots">
	{#each objects as obj, i}
		<button
			class="object-slot"
			class:active={activeIndex === i}
			onclick={() => onSelect(i)}
			title="{obj.name} (Press {i + 1})"
		>
			<span class="slot-number">{i + 1}</span>
			<div
				class="slot-icon"
				style="background-color: #{obj.color.toString(16).padStart(6, '0')}"
			>
				<i class="fas {obj.icon}" aria-hidden="true"></i>
			</div>
		</button>
	{/each}
</div>

<style>
	.fp-object-slots {
		position: absolute;
		bottom: 20px;
		right: 20px;
		display: flex;
		gap: 6px;
		z-index: 250;
	}

	.object-slot {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 6px;
		background: rgba(0, 0, 0, 0.6);
		border: 2px solid rgba(255, 255, 255, 0.15);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
		opacity: 0.7;
	}

	.object-slot:hover {
		opacity: 1;
		border-color: rgba(255, 255, 255, 0.3);
	}

	.object-slot.active {
		opacity: 1;
		background: rgba(249, 115, 22, 0.2);
		border-color: #f97316;
	}

	.slot-number {
		position: absolute;
		top: -8px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 10px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.6);
		background: rgba(0, 0, 0, 0.8);
		padding: 1px 5px;
		border-radius: 3px;
	}

	.object-slot.active .slot-number {
		color: #f97316;
	}

	.slot-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		color: white;
		font-size: 14px;
	}
</style>
