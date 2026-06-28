<script lang="ts">
	import type { EffectPresetGroup } from "./presets/types";
	import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

	interface Props {
		presetGroup: EffectPresetGroup;
		activePresetId: string | null;
		/** Sentinel id for the synthetic Default chip (the factory default look). */
		defaultChipId?: string;
		onSelectPreset: (presetId: string) => void;
		onCustomize: () => void;
		effectLabel: string;
		accentColor: string;
		summary: string;
	}

	const { presetGroup, activePresetId, defaultChipId, onSelectPreset, onCustomize, effectLabel, accentColor, summary }: Props = $props();

	// Trail's Default IS the colour-matched factory blue/red, so its Default chip
	// shows those dots instead of the generic accent dot. Static (the factory look),
	// not the live config — Default always reads as the matched red/blue.
	const trailDefaultColors = $derived(
		presetGroup.effectType === "trails"
			? { blue: DEFAULT_EFFECTS_CONFIG.trails.blueColor, red: DEFAULT_EFFECTS_CONFIG.trails.redColor }
			: null,
	);
</script>

<div class="presets-section">
	<span class="section-label">CHOOSE A LOOK</span>

	<div
		class="preset-grid"
		role="radiogroup"
		aria-label="Choose a {effectLabel} preset"
	>
		{#if defaultChipId}
			{@const isDefaultActive = activePresetId === defaultChipId}
			<button
				class="preset-card"
				class:active={isDefaultActive}
				type="button"
				role="radio"
				aria-checked={isDefaultActive}
				style:--card-accent={accentColor}
				onclick={() => onSelectPreset(defaultChipId)}
			>
				<div class="preview-area">
					{#if trailDefaultColors}
						<div class="dual-dots">
							<div class="dot" style:background={trailDefaultColors.blue} style:box-shadow="0 0 14px 5px {trailDefaultColors.blue}80"></div>
							<div class="dot" style:background={trailDefaultColors.red} style:box-shadow="0 0 14px 5px {trailDefaultColors.red}80"></div>
						</div>
					{:else}
						<div class="dot" style:background={accentColor} style:box-shadow="0 0 14px 5px {accentColor}80"></div>
					{/if}
				</div>
				<span class="preset-name" class:active-name={isDefaultActive}>Default</span>
			</button>
		{/if}
		{#each presetGroup.presets as preset (preset.id)}
			{@const isActive = preset.id === activePresetId}
			<button
				class="preset-card"
				class:active={isActive}
				type="button"
				role="radio"
				aria-checked={isActive}
				style:--card-accent={accentColor}
				onclick={() => onSelectPreset(preset.id)}
			>
				<div class="preview-area">
					{#if preset.previewColor === "rainbow"}
						<div class="rainbow-dot"></div>
					{:else if preset.previewColor2}
						<div class="dual-dots">
							<div class="dot" style:background={preset.previewColor} style:box-shadow="0 0 14px 5px {preset.previewColor}80"></div>
							<div class="dot" style:background={preset.previewColor2} style:box-shadow="0 0 14px 5px {preset.previewColor2}80"></div>
						</div>
					{:else}
						<div class="dot" style:background={preset.previewColor} style:box-shadow="0 0 14px 5px {preset.previewColor}80"></div>
					{/if}
				</div>
				<span class="preset-name" class:active-name={isActive}>{preset.name}</span>
			</button>
		{/each}
	</div>

	<div class="summary-row">
		<div class="summary-dot" style:background={accentColor} style:box-shadow="0 0 6px 2px {accentColor}60"></div>
		<span class="summary-text">{summary}</span>
	</div>

	<button
		class="customize-btn"
		type="button"
		style:--btn-accent={accentColor}
		onclick={onCustomize}
	>
		Customize {effectLabel} Settings
	</button>
</div>

<style>
	.presets-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	/* ── Section label ── */
	.section-label {
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	/* ── Preset grid ── */
	.preset-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.preset-card {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 8px;
		min-height: var(--min-touch-target, 44px);
		padding: 8px 12px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 10px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		cursor: pointer;
		transition:
			border-color var(--duration-fast, 100ms) ease,
			background var(--duration-fast, 100ms) ease;
		-webkit-tap-highlight-color: transparent;
	}

	.preset-card:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
	}

	.preset-card.active {
		border-color: var(--card-accent);
		background: color-mix(in srgb, var(--card-accent) 8%, transparent);
	}

	.preset-card:focus-visible {
		outline: 2px solid var(--card-accent, var(--theme-accent, #8b5cf6));
		outline-offset: 2px;
	}

	/* ── Preview visuals ── */
	.preview-area {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dual-dots {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.dual-dots .dot {
		width: 8px;
		height: 8px;
	}

	.rainbow-dot {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: conic-gradient(red, orange, yellow, green, blue, violet, red);
		opacity: 0.4;
	}

	/* ── Preset name ── */
	.preset-name {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		text-align: left;
		line-height: 1.2;
	}

	.preset-name.active-name {
		color: var(--theme-text, white);
	}

	/* ── Summary row ── */
	.summary-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 0;
	}

	.summary-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.summary-text {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	/* ── Customize button ── */
	.customize-btn {
		width: 100%;
		min-height: 44px;
		padding: 10px 16px;
		border: 1.5px solid color-mix(in srgb, var(--btn-accent) 40%, transparent);
		border-radius: 10px;
		background: color-mix(in srgb, var(--btn-accent) 8%, transparent);
		color: var(--btn-accent);
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		cursor: pointer;
		transition:
			background var(--duration-fast, 100ms) ease,
			border-color var(--duration-fast, 100ms) ease;
		-webkit-tap-highlight-color: transparent;
	}

	.customize-btn:hover {
		background: color-mix(in srgb, var(--btn-accent) 14%, transparent);
		border-color: color-mix(in srgb, var(--btn-accent) 60%, transparent);
	}

	.customize-btn:focus-visible {
		outline: 2px solid var(--btn-accent);
		outline-offset: 2px;
	}

	/* ── Reduced motion ── */
	@media (prefers-reduced-motion: reduce) {
		.preset-card,
		.customize-btn {
			transition: none;
		}
	}
</style>
