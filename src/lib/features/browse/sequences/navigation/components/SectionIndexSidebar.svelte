<script lang="ts">
	import type { SequenceSection } from '../../../shared/domain/models/browse-models';

	interface Props {
		sections: SequenceSection[];
		onScrollToSection: (firstSequenceIndex: number) => void;
		activeSection?: string;
	}

	const { sections, onScrollToSection, activeSection }: Props = $props();

	// Compute the flat index of the first sequence in each section.
	// Sections are ordered, so we accumulate counts.
	const sectionOffsets = $derived.by(() => {
		const offsets: { title: string; startIndex: number }[] = [];
		let runningIndex = 0;
		for (const section of sections) {
			offsets.push({ title: section.title, startIndex: runningIndex });
			runningIndex += section.sequences.length;
		}
		return offsets;
	});

	function handleClick(startIndex: number) {
		onScrollToSection(startIndex);
	}
</script>

<nav class="section-index-sidebar" aria-label="Section navigation">
	<div class="sidebar-items">
		{#each sectionOffsets as { title, startIndex } (title)}
			<button
				class="sidebar-item"
				class:active={activeSection === title}
				onclick={() => handleClick(startIndex)}
				title={title}
			>
				<span class="sidebar-label">{title}</span>
			</button>
		{/each}
	</div>
</nav>

<style>
	.section-index-sidebar {
		display: none;
		flex-shrink: 0;
		width: 72px;
		overflow-y: auto;
		overflow-x: hidden;
		padding: var(--spacing-xs, 4px) 0;
		scrollbar-width: none;
	}

	.section-index-sidebar::-webkit-scrollbar {
		display: none;
	}

	/* Show only on desktop */
	@media (min-width: 768px) {
		.section-index-sidebar {
			display: flex;
			flex-direction: column;
		}
	}

	.sidebar-items {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--spacing-xs, 4px);
	}

	.sidebar-item {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
		border: none;
		border-radius: var(--radius-sm, 6px);
		background: transparent;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-compact, 12px);
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-height: 28px;
	}

	.sidebar-item:hover {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
		color: var(--theme-text, #fff);
	}

	.sidebar-item.active {
		background: var(--theme-accent, #6366f1);
		color: #fff;
		font-weight: 600;
	}

	.sidebar-label {
		max-width: 60px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
