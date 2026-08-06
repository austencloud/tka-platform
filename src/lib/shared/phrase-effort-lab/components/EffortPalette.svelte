<script lang="ts">
	import type { EffortId } from "$lib/shared/effort/domain/effort-types";
	import { EFFORTS } from "$lib/shared/effort/domain/effort-types";

	interface Props {
		selectedEffort: EffortId | null;
		onSelect: (effort: EffortId) => void;
	}

	let { selectedEffort, onSelect }: Props = $props();
</script>

<div class="effort-palette" role="radiogroup" aria-label="Effort brush">
	{#each EFFORTS as effort}
		<button
			class="palette-btn"
			class:active={selectedEffort === effort.id}
			type="button"
			role="radio"
			aria-checked={selectedEffort === effort.id}
			onclick={() => onSelect(effort.id)}
			style:--effort-color={effort.color}
		>
			{effort.label}
		</button>
	{/each}
</div>

<style>
	.effort-palette {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.palette-btn {
		flex: 1;
		min-width: 70px;
		min-height: var(--min-touch-target, 44px);
		padding: 8px 4px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		cursor: pointer;
		transition: all var(--duration-fast, 100ms) ease;
		-webkit-tap-highlight-color: transparent;
	}

	.palette-btn:hover {
		background: color-mix(in srgb, var(--theme-text) 8%, transparent);
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, white);
	}

	.palette-btn.active {
		background: color-mix(in srgb, var(--effort-color) 20%, transparent);
		border-color: var(--effort-color);
		color: var(--theme-text, white);
		box-shadow: 0 0 8px color-mix(in srgb, var(--effort-color) 30%, transparent);
	}

	.palette-btn:focus-visible {
		outline: 2px solid var(--effort-color, var(--theme-accent));
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.palette-btn {
			transition: none;
		}
	}
</style>
