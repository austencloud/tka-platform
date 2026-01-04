<!--
  ExportControlsSection.svelte

  Reusable export controls for SequenceViewerPanel (preview mode).
  Wraps the existing ShareHub components for format selection and export.

  Features:
  - Format selector (Animation, Image, Video)
  - Settings button per format
  - Export button with progress
  - Integrates with existing ShareHub settings panels
-->
<script lang="ts">
	import type { MediaFormat } from "$lib/shared/share-hub/domain/models/MediaFormat";
	import type { ExportProgress, ExportSettings } from "../domain/types";
	import FormatSelector from "$lib/shared/share-hub/components/shared/FormatSelector.svelte";
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
		onFormatChange,
		onExport,
		onSettingsChange,
	}: {
		selectedFormat?: MediaFormat;
		isExporting?: boolean;
		exportProgress?: ExportProgress | null;
		isSequenceSaved?: boolean;
		isMobile?: boolean;
		onFormatChange?: (format: MediaFormat) => void;
		onExport?: (format: MediaFormat, settings: ExportSettings) => void;
		onSettingsChange?: (format: MediaFormat, settings: any) => void;
	} = $props();

	// Local state
	let settingsPanelOpen = $state(false);
	let currentFormat = $state<MediaFormat>(selectedFormat);

	// Sync with prop
	$effect(() => {
		currentFormat = selectedFormat;
	});

	// Derived labels
	const formatLabel = $derived(
		currentFormat === "animation"
			? "Animation"
			: currentFormat === "static"
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

	function handleFormatSelect(format: MediaFormat) {
		currentFormat = format;
		onFormatChange?.(format);
	}

	function handleExport() {
		onExport?.(currentFormat, { format: currentFormat });
	}

	function openSettings() {
		settingsPanelOpen = true;
	}

	function closeSettings() {
		settingsPanelOpen = false;
	}
</script>

<div class="export-controls-section">
	<!-- Format Selector -->
	<div class="format-row">
		<FormatSelector
			selectedFormat={currentFormat}
			onFormatSelect={handleFormatSelect}
		/>
	</div>

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
			{#if currentFormat === "animation"}
				<AnimationSettings />
			{:else if currentFormat === "static"}
				<StaticSettingsPanel />
			{:else if currentFormat === "performance"}
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

	.format-row {
		display: flex;
		justify-content: center;
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
		.settings-btn {
			transition: none;
		}

		.progress-bar {
			transition: none;
		}
	}
</style>
