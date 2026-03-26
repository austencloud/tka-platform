<script lang="ts">
	/**
	 * Fuse Layout
	 *
	 * Shuffle-to-discover approach: pick mode (props/hands) and length,
	 * then shuffle through random choreo cards on each side until you
	 * find two you like. Fuse them together.
	 */

	import { getFuseContext } from "../context/fuse-context";
	import FusePanel from "./FusePanel.svelte";
	import FuseButton from "./FuseButton.svelte";
	import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
	import { container } from "$lib/shared/di";
	import type { IFuseAssemblyAnimator } from "../services/contracts/IFuseAssemblyAnimator";

	const { state: fuseState } = getFuseContext();

	import type { FuseDisplayMode } from "./FusePanel.svelte";

	type FuseMode = "soloProps" | "handPaths";

	let fuseMode: FuseMode = $state("soloProps");
	let fuseLength: number = $state(8);
	let displayMode: FuseDisplayMode = $state("card");

	const LENGTHS = [2, 4, 8, 12, 16, 24, 32];

	// BPM is always visible — no conditional appearance that causes layout shift

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
		if (event.key === "Escape") {
			if (fuseState.rightSequence) {
				event.preventDefault();
				fuseState.deselectRight();
			} else if (fuseState.leftSequence) {
				event.preventDefault();
				fuseState.deselectLeft();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fuse-layout">
	<!-- Mode and length selector -->
	<div class="fuse-config">
		<div class="mode-toggle" role="radiogroup" aria-label="Fuse mode">
			<button
				class="config-chip"
				class:active={fuseMode === "soloProps"}
				role="radio"
				aria-checked={fuseMode === "soloProps"}
				onclick={() => fuseMode = "soloProps"}
			>Prop Paths</button>
			<button
				class="config-chip"
				class:active={fuseMode === "handPaths"}
				role="radio"
				aria-checked={fuseMode === "handPaths"}
				onclick={() => fuseMode = "handPaths"}
			>Hand Paths</button>
		</div>

		<div class="mode-toggle" role="radiogroup" aria-label="View mode">
			<button
				class="config-chip"
				class:active={displayMode === "card"}
				role="radio"
				aria-checked={displayMode === "card"}
				onclick={() => displayMode = "card"}
			><i class="fas fa-th" aria-hidden="true"></i> Card</button>
			<button
				class="config-chip"
				class:active={displayMode === "animation"}
				role="radio"
				aria-checked={displayMode === "animation"}
				onclick={() => displayMode = "animation"}
			><i class="fas fa-play" aria-hidden="true"></i> Animation</button>
		</div>

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

	<!-- Two shuffle cards side by side -->
	<div class="fuse-panels">
		<div class="panel-wrap" bind:this={leftPanelEl}>
			<FusePanel
				side="left"
				selectedSequence={fuseState.leftSequence}
				onSelect={fuseState.selectLeft}
				onDeselect={fuseState.deselectLeft}
				bpm={fuseState.bpm}
				onControllerReady={(ctrl) => fuseState.registerController("left", ctrl)}
				mode={fuseMode}
				length={fuseLength}
				currentBeat={fuseState.currentBeat}
				{displayMode}
			/>
		</div>
		<div class="panel-wrap" bind:this={rightPanelEl}>
			<FusePanel
				side="right"
				selectedSequence={fuseState.rightSequence}
				onSelect={fuseState.selectRight}
				onDeselect={fuseState.deselectRight}
				bpm={fuseState.bpm}
				onControllerReady={(ctrl) => fuseState.registerController("right", ctrl)}
				mode={fuseMode}
				length={fuseLength}
				currentBeat={fuseState.currentBeat}
				{displayMode}
			/>
		</div>
	</div>

	<!-- Invisible target for assembly animation -->
	<div class="fuse-target" bind:this={fuseTargetEl} aria-hidden="true"></div>

	<div class="fuse-playback">
		<TempoControl
			bpm={fuseState.bpm}
			onBpmChange={fuseState.setBpm}
			showPresets={true}
			showPractice={false}
		/>
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
		<FuseButton />
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
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		flex-wrap: wrap;
	}

	.mode-toggle,
	.length-selector {
		display: flex;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: var(--radius-md, 8px);
		padding: 2px;
		gap: 2px;
	}

	.config-chip,
	.length-chip {
		padding: 6px 14px;
		border: none;
		border-radius: var(--radius-sm, 6px);
		background: transparent;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		font-size: var(--font-size-compact, 12px);
		font-weight: 500;
		cursor: pointer;
		min-height: 36px;
		min-width: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 150ms ease, color 150ms ease;
	}

	.config-chip.active {
		background: var(--theme-accent, #6366f1);
		color: #ffffff;
	}

	.length-chip {
		padding: 6px 10px;
		min-width: 32px;
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
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-sm, 8px);
	}

	@container fuse-layout (max-width: 700px) {
		.fuse-panels {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}

		.fuse-config {
			flex-direction: column;
			gap: var(--spacing-xs, 4px);
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

	.fuse-playback {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
	}

	.fuse-playback :global(.tempo-control) {
		width: auto;
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

	@media (prefers-reduced-motion: reduce) {
		.config-chip,
		.length-chip {
			transition: none;
		}
	}
</style>
