<script lang="ts">
	import type { EffectPresetGroup } from "./presets/types";
	import {
		loadCustomTrailColors,
		saveCustomTrailColors,
		applyCustomTrailColors,
		type CustomTrailColors,
	} from "./presets/trail-presets";
	import {
		loadCustomFireColors,
		saveCustomFireColors,
		applyCustomFireColors,
		type CustomFireColors,
	} from "./presets/fire-presets";
	import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

	interface Props {
		presetGroup: EffectPresetGroup;
		activePresetId: string | null;
		/** Sentinel id for the synthetic Default chip (shipped factory default). */
		defaultChipId?: string;
		/** Render the snapshot-backed Custom chip disabled (nothing saved yet). */
		customDisabled?: boolean;
		onSelectPreset: (presetId: string) => void;
		onCustomize: () => void;
		effectLabel: string;
		accentColor: string;
		summary: string;
	}

	const { presetGroup, activePresetId, defaultChipId, customDisabled = false, onSelectPreset, onCustomize, effectLabel, accentColor, summary }: Props = $props();

	const effectsConfigState = getEffectsConfigContext();

	// ── Trail custom colors ────────────────────────────────────────────
	let customTrailColors = $state<CustomTrailColors>(loadCustomTrailColors());

	function handleTrailColorChange(which: "blue" | "red", value: string) {
		customTrailColors = { ...customTrailColors, [which]: value };
		saveCustomTrailColors(customTrailColors);
		if (activePresetId === "trail-custom" && effectsConfigState) {
			applyCustomTrailColors(effectsConfigState, customTrailColors);
		}
	}

	// ── Fire custom colors ─────────────────────────────────────────────
	let customFireColors = $state<CustomFireColors>(loadCustomFireColors());

	function handleFireColorChange(which: "left" | "right", value: string) {
		customFireColors = { ...customFireColors, [which]: value };
		saveCustomFireColors(customFireColors);
		if (activePresetId === "fire-custom" && effectsConfigState) {
			applyCustomFireColors(effectsConfigState, customFireColors);
		}
	}
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
					<div class="dot" style:background={accentColor} style:box-shadow="0 0 14px 5px {accentColor}80"></div>
				</div>
				<span class="preset-name" class:active-name={isDefaultActive}>Default</span>
			</button>
		{/if}
		{#each presetGroup.presets as preset (preset.id)}
			{@const isActive = preset.id === activePresetId}
			{@const isCustom = preset.previewColor === "custom"}
			{@const isSnapshotCustom = isCustom && !preset.resolvePatch}
			{@const isDisabled = isSnapshotCustom && customDisabled}
			<button
				class="preset-card"
				class:active={isActive}
				class:disabled={isDisabled}
				type="button"
				role="radio"
				aria-checked={isActive}
				disabled={isDisabled}
				style:--card-accent={accentColor}
				onclick={() => onSelectPreset(preset.id)}
			>
				<div class="preview-area">
					{#if isCustom && preset.id === "trail-custom"}
						<div class="dual-dots">
							<div
								class="dot"
								style:background={customTrailColors.blue}
								style:box-shadow="0 0 14px 5px {customTrailColors.blue}80"
							></div>
							<div
								class="dot"
								style:background={customTrailColors.red}
								style:box-shadow="0 0 14px 5px {customTrailColors.red}80"
							></div>
						</div>
					{:else if isCustom && preset.id === "fire-custom"}
						<div class="dual-dots">
							<div
								class="dot"
								style:background={customFireColors.left}
								style:box-shadow="0 0 14px 5px {customFireColors.left}80"
							></div>
							<div
								class="dot"
								style:background={customFireColors.right}
								style:box-shadow="0 0 14px 5px {customFireColors.right}80"
							></div>
						</div>
					{:else if preset.previewColor === "rainbow"}
						<div class="rainbow-dot"></div>
					{:else if preset.previewColor2}
						<div class="dual-dots">
							<div
								class="dot"
								style:background={preset.previewColor}
								style:box-shadow="0 0 14px 5px {preset.previewColor}80"
							></div>
							<div
								class="dot"
								style:background={preset.previewColor2}
								style:box-shadow="0 0 14px 5px {preset.previewColor2}80"
							></div>
						</div>
					{:else if isSnapshotCustom}
						<div
							class="dot"
							style:background={accentColor}
							style:box-shadow={isDisabled ? "none" : `0 0 14px 5px ${accentColor}80`}
						></div>
					{:else}
						<div
							class="dot"
							style:background={preset.previewColor}
							style:box-shadow="0 0 14px 5px {preset.previewColor}80"
						></div>
					{/if}
				</div>
				<span class="preset-name" class:active-name={isActive}>{preset.name}</span>
			</button>
		{/each}
	</div>

	{#if activePresetId === "trail-custom"}
		<div class="custom-color-row">
			<label class="color-pick">
				<input
					type="color"
					value={customTrailColors.blue}
					oninput={(e) => handleTrailColorChange("blue", e.currentTarget.value)}
				/>
				<span class="color-label">Left</span>
			</label>
			<label class="color-pick">
				<input
					type="color"
					value={customTrailColors.red}
					oninput={(e) => handleTrailColorChange("red", e.currentTarget.value)}
				/>
				<span class="color-label">Right</span>
			</label>
		</div>
	{:else if activePresetId === "fire-custom"}
		<div class="custom-color-row">
			<label class="color-pick">
				<input
					type="color"
					value={customFireColors.left}
					oninput={(e) => handleFireColorChange("left", e.currentTarget.value)}
				/>
				<span class="color-label">Left</span>
			</label>
			<label class="color-pick">
				<input
					type="color"
					value={customFireColors.right}
					oninput={(e) => handleFireColorChange("right", e.currentTarget.value)}
				/>
				<span class="color-label">Right</span>
			</label>
		</div>
	{/if}

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

	.preset-card.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.preset-card.disabled:hover {
		border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
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

	/* ── Custom color pickers ── */
	.custom-color-row {
		display: flex;
		justify-content: center;
		gap: 24px;
		padding: 10px 0 4px;
	}

	.color-pick {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}

	.color-pick input[type="color"] {
		-webkit-appearance: none;
		appearance: none;
		width: 40px;
		height: 40px;
		border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
		border-radius: 50%;
		background: none;
		cursor: pointer;
		padding: 0;
		overflow: hidden;
	}

	.color-pick input[type="color"]::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	.color-pick input[type="color"]::-webkit-color-swatch {
		border: none;
		border-radius: 50%;
	}

	.color-pick input[type="color"]::-moz-color-swatch {
		border: none;
		border-radius: 50%;
	}

	.color-label {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	/* ── Reduced motion ── */
	@media (prefers-reduced-motion: reduce) {
		.preset-card,
		.customize-btn {
			transition: none;
		}
	}
</style>
