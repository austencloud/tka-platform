<script lang="ts">
	import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
	import { DEFAULT_MANDALAS } from "$lib/features/mandala/tabs/meditate/domain/default-mandalas";
	import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
	import { exportMandalaPNG, downloadBlob } from "./services/mandala-export";
	import type { StepLike } from "$lib/shared/mandala/services/contracts/types";

	interface MandalaSource {
		id: string;
		name: string;
		steps: StepLike[];
		bluePropType: string;
		redPropType: string;
		group: "default" | "collection";
	}

	const RESOLUTIONS = [
		{ label: "1x", size: 540 },
		{ label: "2x", size: 1080 },
		{ label: "4x", size: 2160 },
	] as const;

	const BACKGROUNDS = ["transparent", "black", "white"] as const;
	type Background = (typeof BACKGROUNDS)[number];

	let selectedId = $state(DEFAULT_MANDALAS[0]?.id ?? "");
	let resolution = $state<number>(1080);
	let background = $state<Background>("transparent");
	let strokeWidth = $state(2.5);
	let exporting = $state(false);
	let previewEl = $state<HTMLElement | null>(null);
	let previewSize = $state(400);

	const sources = $derived.by((): MandalaSource[] => {
		const defaults: MandalaSource[] = DEFAULT_MANDALAS.map((m) => ({
			id: m.id,
			name: m.name,
			steps: m.steps,
			bluePropType: m.bluePropType,
			redPropType: m.redPropType,
			group: "default",
		}));

		const collected: MandalaSource[] = mandalaCollectionState.collection.map((m) => ({
			id: m.id,
			name: m.name,
			steps: m.steps as StepLike[],
			bluePropType: m.bluePropType,
			redPropType: m.redPropType,
			group: "collection",
		}));

		return [...defaults, ...collected];
	});

	const selected = $derived(sources.find((s) => s.id === selectedId) ?? sources[0]);

	const resolutionLabel = $derived(
		RESOLUTIONS.find((r) => r.size === resolution)?.label ?? "2x",
	);

	$effect(() => {
		if (!previewEl) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				previewSize = Math.min(width, height) * 0.8;
			}
		});
		ro.observe(previewEl);
		return () => ro.disconnect();
	});

	async function handleExport() {
		if (!selected || exporting) return;
		exporting = true;
		try {
			const blob = await exportMandalaPNG(
				selected.steps,
				selected.bluePropType,
				selected.redPropType,
				{ size: resolution, background, strokeWidth },
			);
			const safeName = selected.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
			downloadBlob(blob, `mandala-${safeName}-${resolution}px.png`);
		} catch (err) {
			console.error("[MandalaExport] Export failed:", err);
		} finally {
			exporting = false;
		}
	}
</script>

<div class="export-tab">
	<div class="controls-panel">
		<h3 class="panel-title">Export Settings</h3>

		<!-- Source Picker: visual grid, not dropdown -->
		<div class="control-group">
			<span class="control-label">Mandala</span>
			<div class="source-grid" role="radiogroup" aria-label="Select mandala to export">
				{#each sources as src (src.id)}
					<button
						type="button"
						class="source-card"
						class:active={selectedId === src.id}
						role="radio"
						aria-checked={selectedId === src.id}
						aria-label={src.name}
						onclick={() => (selectedId = src.id)}
					>
						<div class="source-thumb">
							<SequenceMandala
								sequence={{ steps: src.steps }}
								size={48}
								show="both"
								bluePropType={src.bluePropType}
								redPropType={src.redPropType}
							/>
						</div>
						<span class="source-name">{src.name}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Resolution -->
		<div class="control-group">
			<span class="control-label">Resolution</span>
			<div class="chip-row" role="radiogroup" aria-label="Resolution">
				{#each RESOLUTIONS as res (res.size)}
					<button
						type="button"
						class="chip"
						class:active={resolution === res.size}
						role="radio"
						aria-checked={resolution === res.size}
						onclick={() => (resolution = res.size)}
					>
						{res.label}
						<span class="chip-detail">{res.size}px</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Background -->
		<div class="control-group">
			<span class="control-label">Background</span>
			<div class="chip-row" role="radiogroup" aria-label="Background color">
				{#each BACKGROUNDS as bg (bg)}
					<button
						type="button"
						class="chip"
						class:active={background === bg}
						role="radio"
						aria-checked={background === bg}
						onclick={() => (background = bg)}
					>
						{#if bg === "transparent"}
							<span class="bg-swatch transparent-swatch"></span>
						{:else}
							<span class="bg-swatch" style:background={bg}></span>
						{/if}
						{bg}
					</button>
				{/each}
			</div>
		</div>

		<!-- Stroke Width -->
		<div class="control-group">
			<label class="control-label" for="stroke-width">
				Stroke Width
				<span class="control-value">{strokeWidth.toFixed(1)}</span>
			</label>
			<input
				id="stroke-width"
				type="range"
				min="0.5"
				max="5"
				step="0.5"
				bind:value={strokeWidth}
				class="range-input"
			/>
		</div>

		<!-- Download Button -->
		<button
			type="button"
			class="download-btn"
			onclick={handleExport}
			disabled={exporting || !selected}
		>
			{#if exporting}
				<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
				Exporting...
			{:else}
				<i class="fas fa-download" aria-hidden="true"></i>
				Download PNG
			{/if}
		</button>
	</div>

	<div class="preview-area" bind:this={previewEl}>
		{#if selected}
			<div class="preview-mandala">
				<SequenceMandala
					sequence={{ steps: selected.steps }}
					size={previewSize}
					show="both"
					bluePropType={selected.bluePropType}
					redPropType={selected.redPropType}
					strokeWidth={strokeWidth}
				/>
			</div>
			<span class="resolution-label">{resolutionLabel} · {resolution}px</span>
		{:else}
			<p class="empty-state">No mandalas available</p>
		{/if}
	</div>
</div>

<style>
	.export-tab {
		display: flex;
		width: 100%;
		height: 100%;
		background: transparent;
		overflow: hidden;
	}

	.controls-panel {
		width: 300px;
		flex-shrink: 0;
		padding: 24px 20px;
		border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.panel-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--theme-text, white);
		letter-spacing: 0.02em;
		margin: 0;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.control-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		text-transform: uppercase;
		letter-spacing: 0.04em;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.control-value {
		color: var(--theme-text, rgba(255, 255, 255, 0.7));
		font-variant-numeric: tabular-nums;
	}

	/* Source grid: visual thumbnails instead of dropdown */
	.source-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
		gap: 8px;
	}

	.source-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 4px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		border-radius: 10px;
		cursor: pointer;
		transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
		min-height: var(--min-touch-target, 44px);
	}

	.source-card:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
	}

	.source-card.active {
		background: color-mix(in srgb, var(--theme-accent, #6366f1) 20%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
		border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
	}

	.source-card:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
		outline-offset: 2px;
	}

	.source-thumb {
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.source-name {
		font-size: 10px;
		font-weight: 500;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		text-align: center;
		line-height: 1.2;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chip-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: var(--min-touch-target, 44px);
		padding: 0 14px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 10px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
		white-space: nowrap;
	}

	.chip:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, white);
	}

	.chip.active {
		background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
		border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
		color: white;
	}

	.chip:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
		outline-offset: 2px;
	}

	.chip-detail {
		font-size: 11px;
		opacity: 0.5;
	}

	.bg-swatch {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
		flex-shrink: 0;
	}

	.transparent-swatch {
		background: repeating-conic-gradient(
			rgba(255, 255, 255, 0.15) 0% 25%,
			rgba(255, 255, 255, 0.05) 0% 50%
		) 0 0 / 8px 8px;
	}

	.range-input {
		width: 100%;
		height: var(--min-touch-target, 44px);
		-webkit-appearance: none;
		appearance: none;
		background: transparent;
		cursor: pointer;
	}

	.range-input::-webkit-slider-runnable-track {
		height: 4px;
		background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 2px;
	}

	.range-input::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--theme-accent, #6366f1);
		border: 2px solid rgba(255, 255, 255, 0.9);
		margin-top: -7px;
		transition: transform var(--duration-instant, 100ms) ease;
	}

	.range-input::-webkit-slider-thumb:hover {
		transform: scale(1.15);
	}

	.range-input::-moz-range-track {
		height: 4px;
		background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 2px;
		border: none;
	}

	.range-input::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--theme-accent, #6366f1);
		border: 2px solid rgba(255, 255, 255, 0.9);
	}

	.range-input:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
		outline-offset: 2px;
	}

	.download-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		min-height: 48px;
		margin-top: auto;
		background: linear-gradient(135deg, var(--theme-accent, #6366f1), color-mix(in srgb, var(--theme-accent, #6366f1) 80%, #8b5cf6));
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 12px;
		color: white;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--duration-normal, 200ms) var(--ease-out, ease);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
	}

	@media (hover: hover) {
		.download-btn:hover:not(:disabled) {
			transform: translateY(-1px);
			box-shadow: 0 6px 16px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
		}
	}

	.download-btn:active:not(:disabled) {
		transform: scale(0.98);
		transition-duration: 50ms;
	}

	.download-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.download-btn:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
		outline-offset: 2px;
	}

	.preview-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		min-width: 0;
		padding: 24px;
	}

	.preview-mandala {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.resolution-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		letter-spacing: 0.02em;
	}

	.empty-state {
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		font-size: 14px;
	}

	@media (max-width: 768px) {
		.export-tab {
			flex-direction: column-reverse;
		}

		.controls-panel {
			width: 100%;
			max-height: 55%;
			border-right: none;
			border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
		}

		.preview-area {
			flex: 1;
			min-height: 0;
			padding: 16px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chip,
		.download-btn,
		.source-card {
			transition: none;
		}

		.download-btn:hover:not(:disabled) {
			transform: none;
		}
	}
</style>
