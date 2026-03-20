<script lang="ts">
	/**
	 * Fuse Layout
	 *
	 * Responsive split layout with two sequence browser panels, a shared
	 * tempo control, length-matching toggle, and the fuse button. CSS grid:
	 * 1fr 1fr on desktop, stacked 1fr / 1fr on mobile (<900px).
	 * Uses container queries.
	 *
	 * When the state enters the "fusing" phase, triggers the assembly
	 * animation (both panels slide toward center and fade out), then
	 * transitions to the "result" phase.
	 */

	import { getFuseContext } from "../context/fuse-context";
	import FusePanel from "./FusePanel.svelte";
	import FuseButton from "./FuseButton.svelte";
	import FuseLengthToggle from "./FuseLengthToggle.svelte";
	import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
	import { container } from "$lib/shared/di";
	import type { IFuseAssemblyAnimator } from "../services/contracts/IFuseAssemblyAnimator";

	const { state } = getFuseContext();

	const showTempo = $derived(state.leftSequence !== null || state.rightSequence !== null);
const showHint = $derived(state.leftSequence === null || state.rightSequence === null);

	// DOM refs for assembly animation
	let leftPanelEl: HTMLDivElement;
	let rightPanelEl: HTMLDivElement;
	let fuseTargetEl: HTMLDivElement;

	let fuseAssemblyAnimator: IFuseAssemblyAnimator;
	try {
		fuseAssemblyAnimator = container.items.fuseAssemblyAnimator;
	} catch {
		// Fallback: if DI fails, create a no-op animator so the flow still works
		fuseAssemblyAnimator = {
			async animate() {
				// no-op
			},
		};
	}

	// When state enters "fusing", trigger the assembly animation
	$effect(() => {
		if (state.phase !== "fusing") return;

		// Run animation after next frame so DOM refs are stable
		const frameId = requestAnimationFrame(async () => {
			if (!leftPanelEl || !rightPanelEl || !fuseTargetEl) {
				// Missing elements — skip animation, go straight to result
				state.completeFuse();
				return;
			}

			await fuseAssemblyAnimator.animate(leftPanelEl, rightPanelEl, fuseTargetEl);
			state.completeFuse();
		});

		return () => cancelAnimationFrame(frameId);
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			// Deselect the most recently selected panel
			if (state.rightSequence) {
				event.preventDefault();
				state.deselectRight();
			} else if (state.leftSequence) {
				event.preventDefault();
				state.deselectLeft();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fuse-layout">
	{#if showHint}
		<p class="workspace-hint">Select two sequences to fuse</p>
	{/if}
	<div class="fuse-panels">
		<div class="panel-wrap" bind:this={leftPanelEl}>
			<FusePanel
				side="left"
				selectedSequence={state.leftSequence}
				onSelect={state.selectLeft}
				onDeselect={state.deselectLeft}
				bpm={state.bpm}
				onControllerReady={(ctrl) => state.registerController("left", ctrl)}
			/>
		</div>
		<div class="panel-wrap" bind:this={rightPanelEl}>
			<FusePanel
				side="right"
				selectedSequence={state.rightSequence}
				onSelect={state.selectRight}
				onDeselect={state.deselectRight}
				bpm={state.bpm}
				onControllerReady={(ctrl) => state.registerController("right", ctrl)}
			/>
		</div>
	</div>

	<!-- Invisible target element at center — the assembly animation converges here -->
	<div class="fuse-target" bind:this={fuseTargetEl} aria-hidden="true"></div>

	{#if showTempo}
		<div class="fuse-tempo">
			<TempoControl
				bpm={state.bpm}
				onBpmChange={state.setBpm}
				showPresets={true}
				showPractice={false}
			/>
		</div>
	{/if}

	<div class="fuse-controls">
		<FuseLengthToggle
			matchLengths={state.matchLengths}
			onChange={state.setMatchLengths}
		/>
	</div>

	<div class="fuse-action">
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

	.fuse-panels {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr 1fr;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-sm, 8px);
	}

	.panel-wrap {
		min-height: 0;
		display: flex;
	}

	.panel-wrap > :global(*) {
		flex: 1;
		min-height: 0;
	}

	@container fuse-layout (min-width: 900px) {
		.fuse-panels {
			grid-template-columns: 1fr 1fr;
			grid-template-rows: 1fr;
		}
	}

	/* The animation target — sits at center of the layout, invisible */
	.fuse-target {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 200px;
		height: 200px;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.workspace-hint {
		flex-shrink: 0;
		text-align: center;
		font-size: clamp(1rem, 2.5vmin, 1.25rem);
		font-weight: 500;
		color: var(--theme-text, #fff);
		padding: clamp(8px, 1.5vmin, 12px) 1rem;
		margin: 0;
		letter-spacing: 0.02em;
	}

	.fuse-tempo {
		flex-shrink: 0;
		padding: 0 var(--spacing-sm, 8px);
	}

	.fuse-controls {
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
	}

	.fuse-action {
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
	}
</style>
