<!--
  ExportControlsSection.svelte

  Reusable export controls for SequencePreviewPanel (preview mode).
  Export format is determined by the parent's media type selection (no duplicate selector).

  Features:
  - Settings button per format
  - Export button with progress
  - Integrates with existing ShareHub settings panels
-->
<script lang="ts">
	import type { MediaFormat } from "$lib/shared/share-hub/domain/models/MediaFormat";
	import type { ExportProgress, ExportSettings } from "../domain/types";
	import ExportButton from "$lib/shared/share-hub/components/shared/ExportButton.svelte";
	import SettingsPanel from "$lib/shared/share-hub/components/settings/SettingsPanel.svelte";
	import AnimationSettings from "$lib/shared/share-hub/components/settings/AnimationSettings.svelte";
	import StaticSettingsPanel from "$lib/shared/share-hub/components/settings/StaticSettings.svelte";
	import PerformanceSettingsPanel from "$lib/shared/share-hub/components/settings/PerformanceSettings.svelte";

	let {
		selectedFormat = "animation" as MediaFormat,
		isExporting = false,
		exportProgress = null as ExportProgress | null,
		isSequenceSaved = true,
		isMobile = false,
		sequence = null as any,
		onExport,
		onSettingsChange,
		onCustomNameChange,
	}: {
		selectedFormat?: MediaFormat;
		isExporting?: boolean;
		exportProgress?: ExportProgress | null;
		isSequenceSaved?: boolean;
		isMobile?: boolean;
		sequence?: any;
		onExport?: (format: MediaFormat, settings: ExportSettings) => void;
		onSettingsChange?: (format: MediaFormat, settings: any) => void;
		onCustomNameChange?: (value: string) => void;
	} = $props();

	// Local state
	let settingsPanelOpen = $state(false);

	// Derived labels
	const formatLabel = $derived(
		selectedFormat === "animation"
			? "Animation"
			: selectedFormat === "static"
				? "Image"
				: "Video"
	);
	const actionVerb = $derived(isMobile ? "Share" : "Save");
	const buttonLabel = $derived(
		isSequenceSaved
			? `${actionVerb} ${formatLabel}`
			: `Save & ${actionVerb} ${formatLabel}`
	);

	const settingsTitle = $derived(
		`${formatLabel} Settings`
	);

	// Progress text
	const progressText = $derived.by(() => {
		if (!exportProgress) return null;
		switch (exportProgress.stage) {
			case "capturing":
				return `Capturing frames... ${Math.round(exportProgress.progress * 100)}%`;
			case "encoding":
				return `Encoding... ${Math.round(exportProgress.progress * 100)}%`;
			case "complete":
				return "Complete!";
			case "error":
				return "Error";
			default:
				return null;
		}
	});

	function handleExport() {
		onExport?.(selectedFormat, { format: selectedFormat });
	}

	function openSettings() {
		settingsPanelOpen = true;
	}

	function closeSettings() {
		settingsPanelOpen = false;
	}
</script>

<div class="export-controls-section">
	<!-- Custom Name Input - styled to match settings chips row -->
	{#if sequence}
		<div class="custom-name-row">
			<label for="export-custom-name" class="custom-name-label">
				<i class="fas fa-tag" aria-hidden="true"></i>
				<span class="label-text">Export as</span>
			</label>
			<input
				id="export-custom-name"
				type="text"
				class="custom-name-input"
				value={sequence.customName || ""}
				oninput={(e) => {
					onCustomNameChange?.((e.target as HTMLInputElement).value);
				}}
				placeholder={sequence.word || "custom name"}
				maxlength="50"
				autocomplete="off"
				autocorrect="off"
				autocapitalize="off"
				spellcheck="false"
				data-lpignore="true"
				data-1p-ignore="true"
				data-form-type="other"
				name="sequence-export-name"
			/>
		</div>
	{/if}

	<!-- Action Row: Settings + Export -->
	<div class="action-row">
		<!-- Settings Button -->
		<button
			class="settings-btn"
			onclick={openSettings}
			aria-label="Open {formatLabel} settings"
		>
			<i class="fas fa-cog" aria-hidden="true"></i>
		</button>

		<!-- Export Button -->
		<div class="export-btn-container">
			{#if isExporting && progressText}
				<div class="progress-overlay">
					<div class="progress-bar-container">
						<div
							class="progress-bar"
							style="width: {(exportProgress?.progress ?? 0) * 100}%"
						></div>
					</div>
					<span class="progress-text">{progressText}</span>
				</div>
			{:else}
				<ExportButton
					label={buttonLabel}
					loading={isExporting}
					onclick={handleExport}
				/>
			{/if}
		</div>
	</div>

	<!-- Settings Panel Overlay -->
	{#if settingsPanelOpen}
		<SettingsPanel
			isOpen={settingsPanelOpen}
			title={settingsTitle}
			onClose={closeSettings}
		>
			{#if selectedFormat === "animation"}
				<AnimationSettings />
			{:else if selectedFormat === "static"}
				<StaticSettingsPanel />
			{:else if selectedFormat === "performance"}
				<PerformanceSettingsPanel />
			{/if}
		</SettingsPanel>
	{/if}
</div>

<style>
	.export-controls-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
	}

	/* Custom Name Row - matches settings-chips pattern from SequenceMediaViewerUnified */
	.custom-name-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		transition: border-color 0.15s ease;
	}

	.custom-name-row:focus-within {
		border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
	}

	.custom-name-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		white-space: nowrap;
		flex-shrink: 0;
	}

	.custom-name-label i {
		font-size: 14px;
		color: var(--theme-accent, rgba(155, 135, 245, 0.8));
	}

	.custom-name-input {
		flex: 1;
		min-width: 0;
		padding: 10px 14px;
		min-height: 44px; /* WCAG touch target */
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
		border: 1px solid transparent;
		border-radius: 22px;
		color: var(--theme-text, white);
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		transition: all 0.15s ease;
	}

	.custom-name-input::placeholder {
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		font-weight: 400;
	}

	.custom-name-input:hover {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
	}

	.custom-name-input:focus {
		outline: none;
		background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
		border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
	}

	.action-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.settings-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--min-touch-target, 44px);
		height: var(--min-touch-target, 44px);
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 10px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.settings-btn i {
		font-size: 18px;
	}

	.settings-btn:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
		color: var(--theme-text, white);
	}

	.export-btn-container {
		flex: 1;
		min-width: 0;
	}

	.progress-overlay {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 16px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 10px;
	}

	.progress-bar-container {
		width: 100%;
		height: 4px;
		background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		background: var(--semantic-success, #22c55e);
		transition: width 0.15s ease;
	}

	.progress-text {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		text-align: center;
	}

	@media (prefers-reduced-motion: reduce) {
		.settings-btn,
		.custom-name-row,
		.custom-name-input {
			transition: none;
		}

		.progress-bar {
			transition: none;
		}
	}
</style>
