<!--
	CompositionViewerDrawer.svelte

	Full-screen bottom drawer for viewing composition details.
	Modeled on SequenceViewerDrawerHost for a familiar experience.
	Shows animated composition preview, metadata, and action buttons.
-->
<script lang="ts">
	import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
	import type { CompositionBrowseItem } from "../state/composition-browse-state.svelte";
	import { COMPOSE_MODE_CONFIG } from "$lib/features/compose/shared/domain/compose-mode-config";
	import CompositionAnimatedPreview from "./CompositionAnimatedPreview.svelte";
	import CompositionMiniPreview from "./CompositionMiniPreview.svelte";
	import { container } from "$lib/shared/di";
	import type { ICompositionThumbnailResolver } from "../services/contracts/ICompositionThumbnailResolver";

	let {
		composition,
		isOpen = $bindable(false),
		onClose,
		onPlay,
		onEdit,
		onFavorite,
		onDuplicate,
		onDelete,
	}: {
		composition: CompositionBrowseItem | null;
		isOpen?: boolean;
		onClose: () => void;
		onPlay: () => void;
		onEdit: () => void;
		onFavorite: () => void;
		onDuplicate: () => void;
		onDelete: () => void;
	} = $props();

	const modeConfig = $derived(composition ? COMPOSE_MODE_CONFIG[composition.mode] : null);

	const thumbnailResolver = container?.items?.compositionThumbnailResolver as
		| ICompositionThumbnailResolver
		| undefined;

	const thumbnailUrl = $derived(
		composition ? (thumbnailResolver?.resolveThumbnail(composition) ?? null) : null
	);

	const hasRenderableCells = $derived(
		composition
			? composition.cells.length > 0 && composition.sequenceCount > 0
			: false
	);

	const layoutLabel = $derived(
		composition ? `${composition.layout.cols}x${composition.layout.rows}` : ""
	);

	const lastEdited = $derived(
		composition
			? composition.updatedAt.toLocaleDateString(undefined, {
					weekday: "short",
					month: "short",
					day: "numeric",
					year: "numeric",
				})
			: ""
	);

	function capitalizeWords(str: string): string {
		return str
			.split(" ")
			.map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
			.join(" ");
	}

	const capitalizedCreator = $derived(
		composition ? capitalizeWords(composition.creator) : ""
	);

	function handleDrawerClose() {
		onClose();
	}
</script>

<Drawer
	bind:isOpen
	placement="bottom"
	snapPoints={["100%"]}
	onclose={handleDrawerClose}
	showHandle={false}
	ariaLabel="Composition Viewer"
	class="composition-viewer-drawer"
>
	{#if composition && modeConfig}
		<div class="drawer-container">
			<!-- Header -->
			<header class="viewer-header">
				<button
					type="button"
					class="back-button"
					onclick={handleDrawerClose}
					aria-label="Back to compositions"
				>
					<i class="fas fa-chevron-down" aria-hidden="true"></i>
					<span class="back-label">Compositions</span>
				</button>

				<div class="header-title">Composition Viewer</div>

				<!-- Spacer to balance header layout -->
				<div class="header-spacer"></div>
			</header>

			<!-- Body -->
			<div class="viewer-body">
				<!-- Animated Preview -->
				<div class="preview-section">
					{#if hasRenderableCells}
						<CompositionAnimatedPreview
							cells={composition.cells}
							layout={composition.layout}
						/>
					{:else if thumbnailUrl}
						<img
							src={thumbnailUrl}
							alt={composition.name}
							class="preview-image"
						/>
					{:else}
						<CompositionMiniPreview
							cells={composition.cells}
							layout={composition.layout}
						/>
					{/if}
				</div>

				<!-- Metadata -->
				<div class="metadata-section">
					<h2 class="composition-name">{composition.name || "Untitled"}</h2>

					<!-- Mode pill -->
					<span
						class="mode-pill"
						style="color: {modeConfig.accent}; border-color: {modeConfig.accent}"
					>
						<i class="fas {modeConfig.icon}" aria-hidden="true"></i>
						{modeConfig.label}
					</span>

					<!-- Metadata grid -->
					<div class="meta-grid">
						<div class="meta-item">
							<span class="meta-label">Creator</span>
							<span class="meta-value">{capitalizedCreator}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Last edited</span>
							<span class="meta-value">{lastEdited}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Layout</span>
							<span class="meta-value">{layoutLabel} grid</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Sequences</span>
							<span class="meta-value">{composition.sequenceCount}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer: Action buttons -->
			<footer class="viewer-footer">
				<div class="actions-row">
					<button type="button" class="action-btn play" onclick={onPlay}>
						<i class="fas fa-play" aria-hidden="true"></i>
						<span>Play</span>
					</button>

					<button type="button" class="action-btn edit" onclick={onEdit}>
						<i class="fas fa-pen" aria-hidden="true"></i>
						<span>Edit</span>
					</button>

					<button
						type="button"
						class="action-btn fave"
						class:favorited={composition.isFavorite}
						onclick={onFavorite}
					>
						<i class="fas fa-heart" aria-hidden="true"></i>
						<span>{composition.isFavorite ? "Unfave" : "Fave"}</span>
					</button>

					<button type="button" class="action-btn copy" onclick={onDuplicate}>
						<i class="fas fa-copy" aria-hidden="true"></i>
						<span>Copy</span>
					</button>

					<button type="button" class="action-btn delete" onclick={onDelete}>
						<i class="fas fa-trash" aria-hidden="true"></i>
						<span>Delete</span>
					</button>
				</div>
			</footer>
		</div>
	{/if}
</Drawer>

<style>
	/* Override Drawer defaults for full-screen composition viewer */
	:global(.composition-viewer-drawer) {
		--sheet-bg: var(--theme-panel-bg, #0a0a14) !important;
		--sheet-filter: none !important;
		--sheet-border-radius-top-left: 0px !important;
		--sheet-border-radius-top-right: 0px !important;
		border-top-left-radius: 0 !important;
		border-top-right-radius: 0 !important;
	}

	.drawer-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background: var(--theme-panel-bg, #0a0a14);
	}

	/* ===========================
	   HEADER
	   =========================== */

	.viewer-header {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px;
		min-height: 48px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.back-button {
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		color: var(--theme-accent, #f43f5e);
		font-size: 14px;
		cursor: pointer;
		padding: 0 10px 0 12px;
		min-height: 48px;
		border-radius: 8px;
		transition: background 150ms ease;
	}

	.back-button:hover {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
	}

	.back-button:focus-visible {
		outline: 2px solid var(--theme-accent, #f43f5e);
		outline-offset: 2px;
	}

	.back-button i {
		font-size: 11px;
		flex-shrink: 0;
	}

	.back-label {
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		white-space: nowrap;
	}

	.header-title {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		color: var(--theme-text, #ffffff);
		white-space: nowrap;
		pointer-events: none;
	}

	.header-spacer {
		width: 48px;
		flex-shrink: 0;
	}

	/* ===========================
	   BODY
	   =========================== */

	.viewer-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	/* ===========================
	   PREVIEW SECTION
	   =========================== */

	.preview-section {
		width: 100%;
		aspect-ratio: 16 / 10;
		flex-shrink: 0;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.3);
	}

	.preview-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* ===========================
	   METADATA
	   =========================== */

	.metadata-section {
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.composition-name {
		font-size: var(--font-size-xl, 20px);
		font-weight: 700;
		margin: 0;
		color: var(--theme-text, #fff);
		word-break: break-word;
	}

	.mode-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		border: 1px solid;
		border-radius: 20px;
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		width: fit-content;
	}

	.mode-pill i {
		font-size: 11px;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.meta-label {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		text-transform: uppercase;
		letter-spacing: 0.03em;
		font-weight: 500;
	}

	.meta-value {
		font-size: var(--font-size-sm, 14px);
		color: var(--theme-text, #fff);
	}

	/* ===========================
	   FOOTER: ACTION BUTTONS
	   =========================== */

	.viewer-footer {
		display: flex;
		flex-direction: column;
		padding: 8px;
		padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.actions-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
	}

	.action-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 60px;
		height: 52px;
		padding: 6px 14px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		cursor: pointer;
		transition: all var(--duration-fast, 150ms) ease;
		-webkit-tap-highlight-color: transparent;
	}

	.action-btn i {
		font-size: 16px;
	}

	.action-btn span {
		font-size: var(--font-size-compact, 12px);
		white-space: nowrap;
	}

	.action-btn:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
		color: var(--theme-text, white);
	}

	.action-btn:active {
		transform: scale(0.9);
		transition-duration: 0ms;
	}

	.action-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	/* Color-coded action buttons (matching sequence viewer style) */
	.action-btn.play {
		background: rgba(99, 102, 241, 0.15);
		border-color: rgba(99, 102, 241, 0.35);
		color: #818cf8;
	}

	.action-btn.play:hover {
		background: rgba(99, 102, 241, 0.25);
		border-color: rgba(99, 102, 241, 0.5);
		color: #a5b4fc;
	}

	.action-btn.edit {
		background: rgba(245, 158, 11, 0.1);
		border-color: rgba(245, 158, 11, 0.25);
		color: #f59e0b;
	}

	.action-btn.edit:hover {
		background: rgba(245, 158, 11, 0.2);
		border-color: rgba(245, 158, 11, 0.4);
	}

	.action-btn.fave {
		background: rgba(168, 85, 247, 0.1);
		border-color: rgba(168, 85, 247, 0.25);
		color: #a855f7;
	}

	.action-btn.fave:hover {
		background: rgba(168, 85, 247, 0.2);
		border-color: rgba(168, 85, 247, 0.4);
	}

	.action-btn.fave.favorited {
		background: rgba(239, 68, 68, 0.15);
		border-color: rgba(239, 68, 68, 0.35);
		color: #ef4444;
	}

	.action-btn.fave.favorited:hover {
		background: rgba(239, 68, 68, 0.25);
		border-color: rgba(239, 68, 68, 0.5);
	}

	.action-btn.copy {
		background: rgba(6, 182, 212, 0.1);
		border-color: rgba(6, 182, 212, 0.25);
		color: #06b6d4;
	}

	.action-btn.copy:hover {
		background: rgba(6, 182, 212, 0.2);
		border-color: rgba(6, 182, 212, 0.4);
	}

	.action-btn.delete {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
	}

	.action-btn.delete:hover {
		background: rgba(239, 68, 68, 0.12);
		border-color: rgba(239, 68, 68, 0.35);
		color: #ef4444;
	}

	@media (prefers-reduced-motion: reduce) {
		.action-btn:active {
			transform: none;
		}

		.back-button {
			transition: none;
		}
	}
</style>
