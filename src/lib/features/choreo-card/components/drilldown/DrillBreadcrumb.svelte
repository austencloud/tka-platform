<script lang="ts">
	import type { BreadcrumbSegment } from '../../state/deck-drilldown-types';

	interface DrillBreadcrumbProps {
		breadcrumbs: BreadcrumbSegment[];
		accentColor: string;
		onNavigate: (index: number) => void;
	}

	const { breadcrumbs, accentColor, onNavigate }: DrillBreadcrumbProps = $props();
</script>

<nav class="breadcrumb-trail" style="--bc-accent: {accentColor}" aria-label="Drill-down navigation">
	{#each breadcrumbs as segment, i (i)}
		{#if i > 0}
			<span class="separator" aria-hidden="true">›</span>
		{/if}

		{#if i < breadcrumbs.length - 1}
			<button
				class="segment clickable animate-in"
				onclick={() => onNavigate(i)}
				type="button"
			>
				{segment.label}
			</button>
		{:else}
			<span class="segment current animate-in" aria-current="step">
				{segment.label}
			</span>
		{/if}
	{/each}
</nav>

<style>
	.breadcrumb-trail {
		display: flex;
		align-items: center;
		gap: 0;
		font-size: 14px;
		min-height: 28px;
	}

	.separator {
		color: rgba(255, 255, 255, 0.15);
		margin: 0 2px;
		font-size: 11px;
		user-select: none;
	}

	.segment {
		padding: 4px 10px;
		border-radius: 6px;
		border: none;
		background: none;
		font: inherit;
		line-height: 1;
	}

	.clickable {
		color: var(--bc-accent);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.clickable:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.current {
		color: rgba(255, 255, 255, 0.35);
		cursor: default;
	}

	.animate-in {
		animation: breadcrumb-enter 200ms ease-out both;
	}

	@keyframes breadcrumb-enter {
		from {
			opacity: 0;
			transform: translateX(-6px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.animate-in {
			animation: none;
		}
	}
</style>
