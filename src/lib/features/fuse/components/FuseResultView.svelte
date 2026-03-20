<script lang="ts">
	/**
	 * Fuse Result View
	 *
	 * Displayed after a successful fuse. Shows the merged sequence
	 * with options to save, reset, or adjust.
	 */

	import { getFuseContext } from "../context/fuse-context";

	const { state } = getFuseContext();
</script>

<div class="fuse-result">
	<div class="result-header">
		<h2 class="result-title">Fused Sequence</h2>
	</div>

	<div class="result-content">
		{#if state.fusedSequence}
			<div class="result-preview">
				<i class="fas fa-check-circle result-icon" aria-hidden="true"></i>
				<p class="result-name">{state.fusedSequence.name}</p>
				<p class="result-meta">
					{state.fusedSequence.sequenceLength ?? state.fusedSequence.steps.length} beats
				</p>
			</div>
		{:else}
			<p class="result-empty">No result available</p>
		{/if}
	</div>

	<div class="result-actions">
		<button class="reset-btn" onclick={() => state.reset()}>
			<i class="fas fa-arrow-left" aria-hidden="true"></i>
			<span>Start Over</span>
		</button>
	</div>
</div>

<style>
	.fuse-result {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	.result-header {
		flex-shrink: 0;
		padding: var(--spacing-md, 16px);
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.result-title {
		margin: 0;
		font-size: var(--font-size-lg, 18px);
		font-weight: 700;
		color: var(--theme-text, #ffffff);
	}

	.result-content {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.result-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-sm, 8px);
		color: var(--theme-text, #ffffff);
	}

	.result-icon {
		font-size: 2.5rem;
		color: var(--semantic-success, #22c55e);
	}

	.result-name {
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		margin: 0;
	}

	.result-meta {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		margin: 0;
	}

	.result-empty {
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-min, 14px);
	}

	.result-actions {
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		padding: var(--spacing-md, 16px);
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.reset-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm, 8px);
		min-height: 44px;
		padding: var(--spacing-sm, 8px) var(--spacing-lg, 24px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-md, 12px);
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text, #ffffff);
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.reset-btn:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
	}

	@media (prefers-reduced-motion: reduce) {
		.reset-btn {
			transition: none;
		}
	}
</style>
