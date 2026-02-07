<!--
	CompositionEmptyState.svelte

	Full-height template gallery shown when no compositions exist.
	Displays basic templates prominently with an expandable "More layouts" section.
	Clicking a template applies it to Arrange and navigates there.
-->
<script lang="ts">
	import type { CompositionTemplate } from "../../../compose/domain/types";
	import { getBasicTemplates, getAdvancedTemplates, createCellsFromTemplate } from "../../../compose/domain/templates";
	import { getComposeModuleState } from "../../../shared/state/compose-module-state.svelte";
	import { arrangeGridState } from "../../arrange/state/arrange-grid-state.svelte";
	import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
	import CompositionTemplateCard from "./CompositionTemplateCard.svelte";

	const basicTemplates = getBasicTemplates();
	const advancedTemplates = getAdvancedTemplates();
	const composeState = getComposeModuleState();

	let showAdvanced = $state(false);

	function handleTemplateSelect(template: CompositionTemplate) {
		// Map template to arrange preset
		const presetMap: Record<string, string> = {
			single: "single",
			mirror: "horizontal",
			"side-by-side": "horizontal",
			tunnel: "single",
			grid: "square",
			"vertical-stack": "vertical",
			"tunnel-grid": "square",
		};

		const preset = presetMap[template.id] ?? "single";
		arrangeGridState.setPresetLayout(preset as Parameters<typeof arrangeGridState.setPresetLayout>[0]);

		// Navigate to Arrange tab
		navigationState.setActiveTab("arrange");
		composeState.setCurrentTab("arrange");
	}
</script>

<div class="empty-state">
	<!-- Ambient gradient orb -->
	<div class="ambient-orb" aria-hidden="true"></div>

	<div class="content">
		<h2 class="title">Your compositions</h2>
		<p class="subtitle">Pick a layout to start building</p>

		<!-- Basic templates grid -->
		<div class="template-grid">
			{#each basicTemplates as template, i}
				<CompositionTemplateCard
					{template}
					staggerIndex={i}
					onSelect={handleTemplateSelect}
				/>
			{/each}
		</div>

		<!-- Advanced templates (expandable) -->
		{#if advancedTemplates.length > 0}
			<button
				type="button"
				class="more-toggle"
				onclick={() => (showAdvanced = !showAdvanced)}
			>
				<span>{showAdvanced ? "Fewer layouts" : "More layouts"}</span>
				<i
					class="fas fa-chevron-down"
					class:rotated={showAdvanced}
					aria-hidden="true"
				></i>
			</button>

			{#if showAdvanced}
				<div class="template-grid advanced">
					{#each advancedTemplates as template, i}
						<CompositionTemplateCard
							{template}
							staggerIndex={basicTemplates.length + i}
							onSelect={handleTemplateSelect}
						/>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.empty-state {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		min-height: 400px;
		padding: 32px 24px;
		overflow: hidden;
	}

	/* Animated gradient orb background */
	.ambient-orb {
		position: absolute;
		width: 300px;
		height: 300px;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent),
			transparent 70%
		);
		filter: blur(80px);
		animation: orbDrift 12s ease-in-out infinite alternate;
		pointer-events: none;
		z-index: 0;
	}

	@keyframes orbDrift {
		0% {
			transform: translate(-30%, -20%);
		}
		33% {
			transform: translate(20%, 10%);
		}
		66% {
			transform: translate(-10%, 25%);
		}
		100% {
			transform: translate(15%, -15%);
		}
	}

	.content {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
		max-width: 600px;
		width: 100%;
	}

	.title {
		font-size: var(--font-size-xl, 20px);
		font-weight: 700;
		color: var(--theme-text, #fff);
		margin: 0;
		text-align: center;
	}

	.subtitle {
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		margin: 0;
		text-align: center;
	}

	.template-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
		width: 100%;
	}

	.template-grid.advanced {
		margin-top: 4px;
	}

	.more-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: transparent;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 20px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		font-size: var(--font-size-compact, 12px);
		cursor: pointer;
		transition: color var(--duration-fast, 100ms) ease;
	}

	.more-toggle:hover {
		color: var(--theme-text, #fff);
	}

	.more-toggle:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	.more-toggle i {
		font-size: 10px;
		transition: transform var(--duration-fast, 100ms) ease;
	}

	.more-toggle i.rotated {
		transform: rotate(180deg);
	}

	/* Responsive: 3 cols on wider screens */
	@container (min-width: 481px) {
		.template-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@container (min-width: 800px) {
		.template-grid {
			grid-template-columns: repeat(5, 1fr);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ambient-orb {
			animation: none;
		}
	}
</style>
