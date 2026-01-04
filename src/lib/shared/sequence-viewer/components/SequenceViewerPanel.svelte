<!--
  SequenceViewerPanel.svelte

  Unified sequence viewer panel that works in two modes:
  - preview: Export-focused (Create module) - shows export controls, format selection
  - full: Detail-focused (Discover gallery) - shows metadata, favorites, actions

  Uses SequenceMediaViewer for the core media display with tabs.
-->
<script lang="ts">
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type {
		ViewerMode,
		MediaType,
		ExportProgress,
		MediaFormat,
		ExportSettings,
		CreatorInfo,
	} from "../domain/types";
	import SequenceMediaViewerUnified from "./SequenceMediaViewerUnified.svelte";
	import ExportControlsSection from "./ExportControlsSection.svelte";

	let {
		sequence,
		mode,
		initialMediaType = "image" as MediaType,

		// Common callbacks
		onClose,
		onShare,

		// Preview mode props
		onExport,
		isExporting = false,
		exportProgress = null as ExportProgress | null,

		// Full mode props
		onFavorite,
		onEdit,
		onDelete,
		isFavorited = false,
		creatorInfo = null as CreatorInfo | null,
	}: {
		sequence: SequenceData;
		mode: ViewerMode;
		initialMediaType?: MediaType;
		onClose?: () => void;
		onShare?: () => void;
		onExport?: (format: MediaFormat, settings: ExportSettings) => void;
		isExporting?: boolean;
		exportProgress?: ExportProgress | null;
		onFavorite?: () => void;
		onEdit?: () => void;
		onDelete?: () => void;
		isFavorited?: boolean;
		creatorInfo?: CreatorInfo | null;
	} = $props();

	// Derived display values
	const sequenceTitle = $derived(
		sequence?.word || sequence?.name || "Untitled Sequence"
	);
	const beatCount = $derived(sequence?.beats?.length ?? 0);

	// Export format state (preview mode)
	let selectedFormat = $state<MediaFormat>("animation");
</script>

<div class="sequence-viewer-panel" class:preview-mode={mode === "preview"}>
	<!-- Header -->
	<header class="viewer-header">
		<div class="header-left">
			{#if onClose}
				<button
					class="icon-btn close-btn"
					onclick={() => onClose?.()}
					aria-label="Close"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			{/if}
			<h2 class="title">{sequenceTitle}</h2>
		</div>

		<div class="header-right">
			{#if mode === "full" && onFavorite}
				<button
					class="icon-btn favorite-btn"
					class:active={isFavorited}
					onclick={() => onFavorite?.()}
					aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
				>
					<i class="fas fa-heart" aria-hidden="true"></i>
				</button>
			{/if}

			{#if onShare}
				<button
					class="icon-btn share-btn"
					onclick={() => onShare?.()}
					aria-label="Share"
				>
					<i class="fas fa-share-alt" aria-hidden="true"></i>
				</button>
			{/if}
		</div>
	</header>

	<!-- Media Viewer -->
	<div class="media-section">
		<SequenceMediaViewerUnified
			{sequence}
			{initialMediaType}
			{isExporting}
			{exportProgress}
			controlsLevel={mode === "preview" ? "full" : "standard"}
		/>
	</div>

	<!-- Mode-specific content -->
	{#if mode === "preview"}
		<!-- Export Controls Section -->
		<ExportControlsSection
			selectedFormat={selectedFormat}
			{isExporting}
			{exportProgress}
			onFormatChange={(format) => (selectedFormat = format)}
			onExport={(format, settings) => onExport?.(format, settings)}
		/>
	{:else}
		<!-- Full Mode: Metadata & Actions -->
		<div class="metadata-section">
			{#if creatorInfo}
				<div class="creator-info">
					{#if creatorInfo.avatarUrl}
						<img
							src={creatorInfo.avatarUrl}
							alt={creatorInfo.displayName}
							class="creator-avatar"
						/>
					{:else}
						<div class="creator-avatar placeholder">
							<i class="fas fa-user" aria-hidden="true"></i>
						</div>
					{/if}
					<span class="creator-name">{creatorInfo.displayName}</span>
				</div>
			{/if}

			<div class="sequence-stats">
				<span class="stat">
					<i class="fas fa-music" aria-hidden="true"></i>
					{beatCount} beats
				</span>
			</div>
		</div>

		<!-- Action Buttons (full mode) -->
		<div class="action-buttons">
			{#if onEdit}
				<button class="action-btn" onclick={() => onEdit?.()}>
					<i class="fas fa-edit" aria-hidden="true"></i>
					<span>Edit</span>
				</button>
			{/if}
			{#if onDelete}
				<button class="action-btn danger" onclick={() => onDelete?.()}>
					<i class="fas fa-trash" aria-hidden="true"></i>
					<span>Delete</span>
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.sequence-viewer-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		color: var(--theme-text, white);
	}

	/* Header */
	.viewer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.header-left,
	.header-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.title {
		font-size: var(--font-size-lg);
		font-weight: 600;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--min-touch-target, 44px);
		height: var(--min-touch-target, 44px);
		background: transparent;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 10px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.icon-btn svg {
		width: 20px;
		height: 20px;
	}

	.icon-btn i {
		font-size: 18px;
	}

	.icon-btn:hover {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
		color: var(--theme-text, white);
	}

	.favorite-btn.active {
		color: var(--semantic-error, #ef4444);
		border-color: var(--semantic-error, #ef4444);
	}

	/* Media Section */
	.media-section {
		flex: 1;
		min-height: 0;
		padding: 12px 16px;
	}

	/* Metadata Section (full mode) */
	.metadata-section {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.creator-info {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.creator-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		object-fit: cover;
	}

	.creator-avatar.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	.creator-name {
		font-size: var(--font-size-sm, 14px);
		font-weight: 500;
	}

	.sequence-stats {
		display: flex;
		gap: 16px;
	}

	.stat {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
	}

	.stat i {
		font-size: 12px;
	}

	/* Action Buttons (full mode) */
	.action-buttons {
		display: flex;
		gap: 12px;
		padding: 12px 16px;
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.action-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 10px;
		color: var(--theme-text, white);
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
	}

	.action-btn.danger {
		color: var(--semantic-error, #ef4444);
		border-color: color-mix(
			in srgb,
			var(--semantic-error, #ef4444) 30%,
			transparent
		);
	}

	.action-btn.danger:hover {
		background: color-mix(
			in srgb,
			var(--semantic-error, #ef4444) 15%,
			transparent
		);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.icon-btn,
		.action-btn {
			transition: none;
		}
	}
</style>
