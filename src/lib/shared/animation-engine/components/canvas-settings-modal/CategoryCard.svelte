<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		id: string;
		title: string;
		icon: string;
		iconColor?: string;
		expanded: boolean;
		onToggle: () => void;
		animateIndex: number;
		children: Snippet;
	}

	let { id, title, icon, iconColor, expanded, onToggle, animateIndex, children }: Props = $props();
</script>

<div class="category-card" data-animate={animateIndex}>
	<button
		class="card-header"
		class:expanded
		onclick={onToggle}
		aria-expanded={expanded}
		aria-controls="ctx-body-{id}"
		type="button"
	>
		<i class="fas {icon}" style={iconColor ? `color: ${iconColor}` : ""} aria-hidden="true"></i>
		<span class="card-title">{title}</span>
		<i class="fas fa-chevron-down card-chevron" class:rotated={expanded} aria-hidden="true"></i>
	</button>

	{#if expanded}
		<div class="card-body" id="ctx-body-{id}">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.category-card {
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		overflow: hidden;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: var(--min-touch-target, 44px);
		padding: 12px 16px;
		background: transparent;
		border: none;
		color: var(--theme-text, white);
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		cursor: pointer;
		transition: background var(--duration-fast, 100ms) ease;
	}

	.card-header:hover {
		background: color-mix(in srgb, var(--theme-text) 4%, transparent);
	}

	.card-header.expanded {
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
	}

	.card-header:focus-visible {
		outline: 2px solid var(--theme-accent, #8b5cf6);
		outline-offset: -2px;
	}

	.card-title {
		flex: 1;
		text-align: left;
	}

	.card-chevron {
		font-size: var(--font-size-compact, 12px);
		opacity: 0.5;
		transition: transform var(--duration-fast, 100ms) ease;
	}

	.card-chevron.rotated {
		transform: rotate(180deg);
	}

	.card-body {
		padding: 16px;
	}

	@media (prefers-reduced-motion: reduce) {
		.card-header,
		.card-chevron {
			transition: none;
		}
	}
</style>
