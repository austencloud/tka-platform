<!--
  ExportProgressOverlay.svelte

  Displays export progress with a progress bar and cancel button.
  Used during video/image export operations.
-->
<script lang="ts">
	import type { VideoExportProgress } from "$lib/features/compose/services/contracts/types";
	import { t } from "$lib/shared/i18n/i18n.svelte.js";

	let {
		progress,
		onCancel,
	}: {
		progress: VideoExportProgress;
		onCancel: () => void;
	} = $props();

	const progressPct = $derived(Math.round(progress.progress * 100));
	const progressLabel = $derived(
		progress.stage === "capturing"
			? t("export_capturing_progress")
			: progress.stage === "encoding"
				? t("export_encoding")
				: progress.stage === "complete"
					? t("export_done")
					: ""
	);
</script>

<div class="export-overlay">
	<div class="export-card">
		<span>{progressLabel} {progressPct}%</span>
		<div class="progress-bar">
			<div style="width:{progressPct}%"></div>
		</div>
		{#if progress.stage !== "complete"}
			<button onclick={onCancel}>{t("common_cancel")}</button>
		{/if}
	</div>
</div>

<style>
	.export-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
		border-radius: inherit;
	}

	.export-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 24px;
		background: var(--theme-card-bg);
		border: 1px solid var(--theme-stroke);
		border-radius: 12px;
		color: var(--theme-text);
	}

	.export-card .progress-bar {
		width: 160px;
		height: 6px;
		background: var(--theme-stroke);
		border-radius: 3px;
		overflow: hidden;
	}

	.export-card .progress-bar div {
		height: 100%;
		background: var(--theme-accent);
		transition: width var(--duration-fast) ease;
	}

	.export-card button {
		padding: 8px 16px;
		background: transparent;
		border: 1px solid var(--theme-stroke);
		border-radius: 6px;
		color: var(--theme-text-dim);
		cursor: pointer;
		min-height: 36px;
	}

	.export-card button:hover {
		background: var(--semantic-error);
		border-color: var(--semantic-error);
		color: white;
	}

	@media (prefers-reduced-motion: reduce) {
		.export-card .progress-bar div {
			transition: none;
		}
	}
</style>
