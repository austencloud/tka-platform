<script lang="ts">
	/**
	 * Fuse Button
	 *
	 * The merge trigger. Orange gradient matching the Fuse tab color.
	 * Disabled when canFuse is false. Respects prefers-reduced-motion.
	 */

	import { getFuseContext } from "../context/fuse-context";

	const { state } = getFuseContext();

	const isFusing = $derived(state.phase === "fusing");
</script>

<button
	class="fuse-button"
	disabled={!state.canFuse || isFusing}
	aria-disabled={!state.canFuse || isFusing}
	onclick={() => state.startFuse()}
>
	{#if isFusing}
		<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
		<span>Fusing...</span>
	{:else}
		<i class="fas fa-fire" aria-hidden="true"></i>
		<span>Fuse</span>
	{/if}
</button>

<style>
	.fuse-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
		min-height: 48px;
		padding: var(--spacing-sm, 8px) var(--spacing-xl, 32px);
		border: none;
		border-radius: var(--radius-md, 12px);
		background: linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%);
		color: #ffffff;
		font-size: var(--font-size-min, 14px);
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.15s ease, transform 0.1s ease;
		width: 100%;
		max-width: 320px;
	}

	.fuse-button:hover:not(:disabled) {
		opacity: 0.9;
	}

	.fuse-button:active:not(:disabled) {
		transform: scale(0.98);
	}

	.fuse-button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	@media (prefers-reduced-motion: reduce) {
		.fuse-button {
			transition: none;
		}

		.fuse-button:active:not(:disabled) {
			transform: none;
		}
	}
</style>
