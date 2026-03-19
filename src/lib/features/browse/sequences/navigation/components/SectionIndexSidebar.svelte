<script lang="ts">
	import type { SequenceSection } from '../../../shared/domain/models/browse-models';

	interface Props {
		sections: SequenceSection[];
		onScrollToSection: (firstSequenceIndex: number) => void;
		activeSection?: string;
	}

	const { sections, onScrollToSection, activeSection }: Props = $props();

	// Compute the flat index of the first sequence in each section.
	// Also extract a short label from the full section title for the sidebar.
	const sectionOffsets = $derived.by(() => {
		const offsets: { title: string; shortLabel: string; count: number; startIndex: number }[] = [];
		let runningIndex = 0;
		for (const section of sections) {
			offsets.push({
				title: section.title,
				shortLabel: extractShortLabel(section.title),
				count: section.sequences.length,
				startIndex: runningIndex,
			});
			runningIndex += section.sequences.length;
		}
		return offsets;
	});

	// Extract a compact label from the full section title.
	// "📅 3 DAYS AGO (1 SEQUENCE)" → "3d ago"
	// "📅 1/6/2026 (13 SEQUENCES)" → "1/6"
	// "A (12 SEQUENCES)" → "A"
	// "4 BEATS (5 SEQUENCES)" → "4"
	function extractShortLabel(title: string): string {
		// Strip emoji prefix
		const clean = title.replace(/^📅\s*/, '').trim();

		// Remove parenthesized count suffix: "(N SEQUENCE(S))"
		const withoutCount = clean.replace(/\s*\(\d+\s*sequences?\)/i, '').trim();

		// Date patterns
		if (/^\d+\s*days?\s*ago$/i.test(withoutCount)) {
			const days = withoutCount.match(/^(\d+)/)?.[1];
			return `${days}d`;
		}
		if (/^\d+\s*weeks?\s*ago$/i.test(withoutCount)) {
			const weeks = withoutCount.match(/^(\d+)/)?.[1];
			return `${weeks}w`;
		}
		if (/^\d+\s*months?\s*ago$/i.test(withoutCount)) {
			const months = withoutCount.match(/^(\d+)/)?.[1];
			return `${months}mo`;
		}
		if (/^yesterday$/i.test(withoutCount)) return 'Yday';
		if (/^today$/i.test(withoutCount)) return 'Today';

		// Date like "1/6/2026" → "1/6"
		const dateMatch = withoutCount.match(/^(\d{1,2}\/\d{1,2})\/\d{4}$/);
		if (dateMatch) return dateMatch[1];

		// Beat count like "4 beats" → "4"
		const beatMatch = withoutCount.match(/^(\d+)\s*beats?$/i);
		if (beatMatch) return beatMatch[1];

		// Letter or short label — return as-is if short enough
		if (withoutCount.length <= 4) return withoutCount;

		// Truncate anything else
		return withoutCount.slice(0, 4);
	}

	function handleClick(startIndex: number) {
		onScrollToSection(startIndex);
	}
</script>

<nav class="section-index-sidebar" aria-label="Section navigation">
	<div class="sidebar-track">
		{#each sectionOffsets as { title, shortLabel, count, startIndex } (startIndex)}
			<button
				class="sidebar-marker"
				class:active={activeSection === title}
				onclick={() => handleClick(startIndex)}
				title="{title}"
			>
				<span class="marker-label">{shortLabel}</span>
				<span class="marker-count">{count}</span>
			</button>
		{/each}
	</div>
</nav>

<style>
	.section-index-sidebar {
		display: none;
		flex-shrink: 0;
		width: 52px;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
		border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
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

	.sidebar-track {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 4px 0;
	}

	.sidebar-marker {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		padding: 4px 2px;
		border: none;
		border-radius: 0;
		background: transparent;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		cursor: pointer;
		transition: background 0.1s ease, color 0.1s ease;
		min-height: 32px;
		position: relative;
	}

	.sidebar-marker::before {
		content: '';
		position: absolute;
		left: 0;
		top: 4px;
		bottom: 4px;
		width: 2px;
		background: transparent;
		border-radius: 1px;
		transition: background 0.1s ease;
	}

	.sidebar-marker:hover {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text, #fff);
	}

	.sidebar-marker:hover::before {
		background: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
	}

	.sidebar-marker.active {
		color: var(--theme-accent, #6366f1);
	}

	.sidebar-marker.active::before {
		background: var(--theme-accent, #6366f1);
	}

	.marker-label {
		font-size: 11px;
		font-weight: 600;
		line-height: 1;
		letter-spacing: 0.02em;
	}

	.marker-count {
		font-size: 9px;
		font-weight: 400;
		opacity: 0.5;
		line-height: 1;
	}

	.sidebar-marker.active .marker-count {
		opacity: 0.8;
	}
</style>
