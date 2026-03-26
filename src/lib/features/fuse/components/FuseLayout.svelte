<script lang="ts">
	/**
	 * Fuse Layout
	 *
	 * Shuffle-to-discover: pick a beat length, shuffle cards on each side,
	 * hit Fuse when you like what's showing. No pick step.
	 */

	import { getFuseContext } from "../context/fuse-context";
	import FusePanel from "./FusePanel.svelte";
	import { container } from "$lib/shared/di";
	import type { IFuseAssemblyAnimator } from "../services/contracts/IFuseAssemblyAnimator";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

	const { state: fuseState } = getFuseContext();

	let fuseLength: number = $state(8);

	const LENGTHS = [2, 4, 8, 12, 16, 24, 32];

	// Track what each panel is currently showing (for fusing without pick)
	let leftBrowsingSeq = $state<SequenceData | null>(null);
	let rightBrowsingSeq = $state<SequenceData | null>(null);

	const canFuse = $derived(leftBrowsingSeq !== null && rightBrowsingSeq !== null);

	// DOM refs for assembly animation
	let leftPanelEl: HTMLDivElement;
	let rightPanelEl: HTMLDivElement;
	let fuseTargetEl: HTMLDivElement;

	let fuseAssemblyAnimator: IFuseAssemblyAnimator;
	try {
		fuseAssemblyAnimator = container.items.fuseAssemblyAnimator;
	} catch {
		fuseAssemblyAnimator = { async animate() {} };
	}

	function handleFuse() {
		if (!leftBrowsingSeq || !rightBrowsingSeq) return;
		// Set the sequences on fuse state so startFuse can use them
		fuseState.selectLeft(leftBrowsingSeq);
		fuseState.selectRight(rightBrowsingSeq);
		fuseState.startFuse();
	}

	// When state enters "fusing", trigger the assembly animation
	$effect(() => {
		if (fuseState.phase !== "fusing") return;
		const frameId = requestAnimationFrame(async () => {
			if (!leftPanelEl || !rightPanelEl || !fuseTargetEl) {
				fuseState.completeFuse();
				return;
			}
			await fuseAssemblyAnimator.animate(leftPanelEl, rightPanelEl, fuseTargetEl);
			fuseState.completeFuse();
		});
		return () => cancelAnimationFrame(frameId);
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === " ") {
			event.preventDefault();
			fuseState.toggleClock();
		}
	}

	function decrementBpm() {
		fuseState.setBpm(Math.max(10, fuseState.bpm - 5));
	}

	function incrementBpm() {
		fuseState.setBpm(Math.min(300, fuseState.bpm + 5));
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fuse-layout">
	<!-- Beat length selector -->
	<div class="fuse-config">
		<div class="length-selector" role="radiogroup" aria-label="Beat length">
			{#each LENGTHS as len}
				<button
					class="length-chip"
					class:active={fuseLength === len}
					role="radio"
					aria-checked={fuseLength === len}
					onclick={() => fuseLength = len}
				>{len}</button>
			{/each}
		</div>
	</div>

	<!-- Two panels side by side -->
	<div class="fuse-panels">
		<div class="panel-wrap" bind:this={leftPanelEl}>
			<FusePanel
				side="left"
				bpm={fuseState.bpm}
				onControllerReady={(ctrl) => fuseState.registerController("left", ctrl)}
				length={fuseLength}
				currentBeat={fuseState.currentBeat}
				onCurrentSequenceChange={(seq) => leftBrowsingSeq = seq}
			/>
		</div>
		<div class="panel-wrap" bind:this={rightPanelEl}>
			<FusePanel
				side="right"
				bpm={fuseState.bpm}
				onControllerReady={(ctrl) => fuseState.registerController("right", ctrl)}
				length={fuseLength}
				currentBeat={fuseState.currentBeat}
				onCurrentSequenceChange={(seq) => rightBrowsingSeq = seq}
			/>
		</div>
	</div>

	<!-- Invisible target for assembly animation -->
	<div class="fuse-target" bind:this={fuseTargetEl} aria-hidden="true"></div>

	<!-- Bottom bar: BPM, play/pause, fuse -->
	<div class="fuse-bottom">
		<div class="bpm-control">
			<button class="bpm-btn" onclick={decrementBpm} aria-label="Decrease BPM">
				<i class="fas fa-minus" aria-hidden="true"></i>
			</button>
			<span class="bpm-display">{fuseState.bpm}</span>
			<button class="bpm-btn" onclick={incrementBpm} aria-label="Increase BPM">
				<i class="fas fa-plus" aria-hidden="true"></i>
			</button>
		</div>

		<button
			class="play-btn"
			onclick={() => fuseState.toggleClock()}
			aria-label={fuseState.clockRunning ? "Pause" : "Play"}
		>
			{#if fuseState.clockRunning}
				<svg viewBox="0 0 24 24" fill="currentColor">
					<path d="M6 4h4v16H6zm8 0h4v16h-4z" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="currentColor">
					<path d="M8 5v14l11-7z" />
				</svg>
			{/if}
		</button>

		<button
			class="fuse-button"
			disabled={!canFuse}
			onclick={handleFuse}
		>
			<i class="fas fa-fire" aria-hidden="true"></i>
			<span>Fuse</span>
		</button>
	</div>
</div>

<style>
	.fuse-layout {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		overflow: hidden;
		container-type: inline-size;
		container-name: fuse-layout;
		position: relative;
	}

	.fuse-config {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-xs, 4px) var(--spacing-md, 16px);
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
	}

	.length-selector {
		display: flex;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: var(--radius-md, 8px);
		padding: 2px;
		gap: 2px;
	}

	.length-chip {
		padding: 6px 10px;
		min-width: 32px;
		min-height: 36px;
		border: none;
		border-radius: var(--radius-sm, 6px);
		background: transparent;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		font-size: var(--font-size-compact, 12px);
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 150ms ease, color 150ms ease;
	}

	.length-chip.active {
		background: var(--theme-accent, #6366f1);
		color: #ffffff;
	}

	.fuse-panels {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr;
		gap: var(--spacing-xs, 4px);
		padding: var(--spacing-xs, 4px);
	}

	@container fuse-layout (max-width: 700px) {
		.fuse-panels {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}
	}

	.panel-wrap {
		min-height: 0;
		display: flex;
	}

	.panel-wrap > :global(*) {
		flex: 1;
		min-height: 0;
	}

	.fuse-target {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 200px;
		height: 200px;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.fuse-bottom {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-xs, 4px) var(--spacing-md, 16px);
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
	}

	.bpm-control {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs, 4px);
	}

	.bpm-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 50%;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		font-size: 12px;
		cursor: pointer;
		transition: border-color 150ms ease, color 150ms ease;
	}

	.bpm-btn:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, #ffffff);
	}

	.bpm-display {
		min-width: 36px;
		text-align: center;
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		color: var(--theme-text, #ffffff);
		font-variant-numeric: tabular-nums;
	}

	.play-btn {
		width: 52px;
		height: 52px;
		min-width: 52px;
		min-height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(
			135deg,
			var(--theme-accent, #3b82f6) 0%,
			color-mix(in srgb, var(--theme-accent, #3b82f6) 80%, black) 100%
		);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		flex-shrink: 0;
		transition: transform 150ms ease, box-shadow 150ms ease;
	}

	.play-btn svg {
		width: 24px;
		height: 24px;
	}

	.play-btn:hover {
		transform: scale(1.05);
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
	}

	.play-btn:active {
		transform: scale(0.98);
	}

	.fuse-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
		min-height: 48px;
		padding: var(--spacing-sm, 8px) var(--spacing-xl, 32px);
		border: none;
		border-radius: var(--radius-md, 12px);
		background: linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%);
		color: #ffffff;
		font-size: var(--font-size-min, 14px);
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.15s ease, transform 0.1s ease;
	}

	.fuse-button:hover:not(:disabled) {
		opacity: 0.9;
	}

	.fuse-button:active:not(:disabled) {
		transform: scale(0.98);
	}

	.fuse-button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	@media (prefers-reduced-motion: reduce) {
		.length-chip,
		.bpm-btn,
		.play-btn,
		.fuse-button {
			transition: none;
		}
	}
</style>
