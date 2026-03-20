<script lang="ts">
	/**
	 * Fuse Sequence Browser
	 *
	 * Placeholder sequence picker. Will be wired to BrowseGrid in a later task.
	 * For now shows a scrollable placeholder that emits onSelect.
	 */

	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

	let {
		onSelect,
	}: {
		onSelect: (seq: SequenceData) => void;
	} = $props();
</script>

<div class="fuse-browser-placeholder">
	<i class="fas fa-search browser-icon" aria-hidden="true"></i>
	<p class="browser-text">Pick a sequence</p>
	<p class="browser-hint">Sequence browser will be wired here</p>
</div>

<style>
	.fuse-browser-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: var(--spacing-xs, 4px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	.browser-icon {
		font-size: 1.5rem;
		opacity: 0.3;
	}

	.browser-text {
		font-size: var(--font-size-min, 14px);
		margin: 0;
	}

	.browser-hint {
		font-size: var(--font-size-compact, 12px);
		margin: 0;
		opacity: 0.5;
	}
</style>
