<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";

	let {
		variant = "chips",
	}: {
		variant?: "chips" | "rows";
	} = $props();

	const vm = getAnimationVisibilityManager();

	let gridVisible = $state(vm.isGridVisible());
	let tkaGlyph = $state(vm.getVisibility("tkaGlyph"));
	let stepNumbers = $state(vm.getVisibility("stepNumbers"));
	let propsVisible = $state(vm.getVisibility("props"));
	let wordHeader = $state(vm.getVisibility("wordHeader"));
	let progressBar = $state(vm.getVisibility("progressBar"));

	function handleVisibilityChange(): void {
		gridVisible = vm.isGridVisible();
		tkaGlyph = vm.getVisibility("tkaGlyph");
		stepNumbers = vm.getVisibility("stepNumbers");
		propsVisible = vm.getVisibility("props");
		wordHeader = vm.getVisibility("wordHeader");
		progressBar = vm.getVisibility("progressBar");
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

	function toggleGrid(): void {
		vm.setGridMode(gridVisible ? "none" : "8point");
	}

	const toggles: { key: "tkaGlyph" | "stepNumbers" | "props" | "wordHeader" | "progressBar"; label: string; icon: string }[] = [
		{ key: "tkaGlyph", label: "TKA Glyph", icon: "fa-font" },
		{ key: "stepNumbers", label: "Step #", icon: "fa-list-ol" },
		{ key: "props", label: "Props", icon: "fa-wand-magic" },
		{ key: "wordHeader", label: "Word", icon: "fa-heading" },
		{ key: "progressBar", label: "Progress", icon: "fa-bars-progress" },
	];

	function getToggleValue(key: string): boolean {
		switch (key) {
			case "tkaGlyph": return tkaGlyph;
			case "stepNumbers": return stepNumbers;
			case "props": return propsVisible;
			case "wordHeader": return wordHeader;
			case "progressBar": return progressBar;
			default: return false;
		}
	}
</script>

{#if variant === "rows"}
	<div class="display-rows">
		<button
			class="toggle-row"
			type="button"
			aria-pressed={gridVisible}
			onclick={toggleGrid}
		>
			<i class="fas fa-border-all row-icon" aria-hidden="true"></i>
			<span class="row-label">Grid</span>
			<span class="toggle-indicator" class:on={gridVisible}></span>
		</button>

		{#each toggles as toggle}
			{@const isOn = getToggleValue(toggle.key)}
			<button
				class="toggle-row"
				type="button"
				aria-pressed={isOn}
				onclick={() => vm.toggleVisibility(toggle.key)}
			>
				<i class="fas {toggle.icon} row-icon" aria-hidden="true"></i>
				<span class="row-label">{toggle.label}</span>
				<span class="toggle-indicator" class:on={isOn}></span>
			</button>
		{/each}
	</div>
{:else}
	<div class="display-chips">
		<button
			class="rt-chip"
			type="button"
			aria-pressed={gridVisible}
			onclick={toggleGrid}
		>Grid</button>

		{#each toggles as toggle}
			<button
				class="rt-chip"
				type="button"
				aria-pressed={getToggleValue(toggle.key)}
				onclick={() => vm.toggleVisibility(toggle.key)}
			>{toggle.label}</button>
		{/each}
	</div>
{/if}

<style>
	.display-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.display-rows {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: var(--min-touch-target, 44px);
		padding: 8px 12px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		font-size: var(--font-size-compact, 12px);
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast, 100ms) ease;
	}

	.toggle-row:hover {
		background: color-mix(in srgb, var(--theme-text) 6%, transparent);
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, white);
	}

	.toggle-row[aria-pressed="true"] {
		color: var(--theme-text, white);
	}

	.toggle-row:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	.row-icon {
		width: 16px;
		text-align: center;
		font-size: 12px;
		opacity: 0.6;
		flex-shrink: 0;
	}

	.toggle-row[aria-pressed="true"] .row-icon {
		opacity: 1;
		color: var(--theme-accent, #8b5cf6);
	}

	.row-label {
		flex: 1;
		text-align: left;
	}

	.toggle-indicator {
		width: 32px;
		height: 18px;
		border-radius: 9px;
		background: rgba(255, 255, 255, 0.15);
		position: relative;
		flex-shrink: 0;
		transition: background var(--duration-fast, 100ms) ease;
	}

	.toggle-indicator::after {
		content: "";
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.5);
		transition: transform var(--duration-fast, 100ms) ease, background var(--duration-fast, 100ms) ease;
	}

	.toggle-indicator.on {
		background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 50%, transparent);
	}

	.toggle-indicator.on::after {
		transform: translateX(14px);
		background: var(--theme-accent, #8b5cf6);
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle-row,
		.toggle-indicator,
		.toggle-indicator::after {
			transition: none;
		}
	}
</style>
