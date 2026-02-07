<!--
	CompositionTemplateCard.svelte

	Individual template card for the empty state gallery.
	Clicking applies the template to the Arrange tab and navigates there.
-->
<script lang="ts">
	import type { CompositionTemplate } from "../../../compose/domain/types";
	import { COMPOSE_MODE_CONFIG } from "$lib/features/compose/shared/domain/compose-mode-config";

	const {
		template,
		staggerIndex = 0,
		onSelect,
	}: {
		template: CompositionTemplate;
		staggerIndex?: number;
		onSelect: (template: CompositionTemplate) => void;
	} = $props();

	// Derive mode from template ID for icon/color lookup
	const modeConfig = $derived(
		COMPOSE_MODE_CONFIG[template.id as keyof typeof COMPOSE_MODE_CONFIG] ?? null
	);

	function handleClick() {
		onSelect(template);
	}

	// Layout label from dimensions
	const layoutLabel = $derived(
		`${template.layout.cols}x${template.layout.rows}`
	);
</script>

<button
	type="button"
	class="template-card"
	onclick={handleClick}
	style="
		--accent: {template.color};
		--stagger-delay: calc(var(--stagger-normal, 50ms) * {staggerIndex});
	"
>
	<!-- SVG Layout Preview -->
	<div class="preview">
		<svg viewBox="0 0 100 100" class="layout-svg" aria-hidden="true">
			{#each Array(template.layout.rows) as _, row}
				{#each Array(template.layout.cols) as _, col}
					{@const gap = 4}
					{@const cellW = (100 - gap * (template.layout.cols + 1)) / template.layout.cols}
					{@const cellH = (100 - gap * (template.layout.rows + 1)) / template.layout.rows}
					{@const x = gap + col * (cellW + gap)}
					{@const y = gap + row * (cellH + gap)}
					<rect
						{x}
						{y}
						width={cellW}
						height={cellH}
						rx="3"
						class="cell-rect"
					/>
				{/each}
			{/each}
		</svg>
	</div>

	<!-- Template Info -->
	<div class="info">
		<span class="template-name">{template.name}</span>
		<span class="template-desc">{template.description}</span>
	</div>
</button>

<style>
	.template-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 16px;
		border-radius: 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		cursor: pointer;
		color: var(--theme-text, #fff);
		width: 100%;
		transition:
			transform var(--duration-fast, 100ms) var(--ease-out, ease-out),
			border-color var(--duration-fast, 100ms) var(--ease-out, ease-out),
			box-shadow var(--duration-fast, 100ms) var(--ease-out, ease-out);
		animation: cardEntrance var(--duration-dramatic, 350ms) var(--ease-out, ease-out) both;
		animation-delay: var(--stagger-delay, 0ms);
	}

	.template-card:hover {
		transform: scale(var(--hover-scale-md, 1.02));
		border-color: var(--accent);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent),
			0 8px 24px rgba(0, 0, 0, 0.3);
	}

	.template-card:active {
		transform: scale(var(--active-scale, 0.98));
	}

	.template-card:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	.preview {
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.layout-svg {
		width: 100%;
		height: 100%;
	}

	.cell-rect {
		fill: var(--accent);
		fill-opacity: 0.2;
		stroke: var(--accent);
		stroke-width: 2;
		stroke-opacity: 0.6;
	}

	.info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-align: center;
	}

	.template-name {
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
	}

	.template-desc {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		line-height: 1.3;
	}

	@keyframes cardEntrance {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.template-card {
			animation: none;
			transition: none;
		}
		.template-card:hover {
			transform: none;
		}
	}

	@media (hover: none) and (pointer: coarse) {
		.template-card:active {
			transform: scale(var(--active-scale, 0.98));
			transition-duration: var(--duration-instant, 50ms);
		}
	}
</style>
