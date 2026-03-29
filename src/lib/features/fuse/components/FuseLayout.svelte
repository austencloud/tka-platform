<script lang="ts">
	/**
	 * FuseLayout v2
	 *
	 * Single component managing the entire fuse lifecycle with three always-mounted
	 * AnimatorCanvas instances (hero, blue-only split, red-only split). Visibility is
	 * toggled via CSS classes, never {#if}, so FLIP measurements work in Tasks 4-5.
	 *
	 * Browse UI (beat grids + shuffle) is inlined from the now-deleted FusePanel.
	 * Tour overlay deferred to Task 7.
	 */

	import { getFuseContext } from "../context/fuse-context";
	import FuseSequenceBrowser from "./FuseSequenceBrowser.svelte";
	import FuseTour from "$lib/shared/onboarding/components/fuse-tour/FuseTour.svelte";
	import HelpButton from "$lib/shared/components/help/HelpButton.svelte";
	import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
	import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
	import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
	import { fuseTourState } from "$lib/shared/onboarding/state/fuse-tour-state.svelte";
	import { container } from "$lib/shared/di";
	import { onMount, onDestroy, untrack } from "svelte";
	import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/implementations/SequenceViewerNavigator";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
	import type { IAnimationPlaybackControllerFactory } from "$lib/features/compose/services/contracts/IAnimationPlaybackControllerFactory";
	import type { ISequenceMotionLoader } from "$lib/shared/sequence-viewer/services/contracts/ISequenceMotionLoader";
	import type { PropState } from "$lib/shared/animation-engine/domain/PropState";

	// ── Context ──────────────────────────────────────────────────────────
	const { state: fuseState } = getFuseContext();

	// ── Derived phase helpers ────────────────────────────────────────────
	const phase = $derived(fuseState.phase);
	const isDisassembled = $derived(phase === "disassembled");
	const isAssembled = $derived(phase === "assembled");
	const isTransitioning = $derived(phase === "reassembling" || phase === "disassembling");
	const resizePaused = $derived(isTransitioning);

	// ── Browse state ─────────────────────────────────────────────────────
	let leftBrowsingSeq = $state<SequenceData | null>(null);
	let rightBrowsingSeq = $state<SequenceData | null>(null);
	const canFuse = $derived(leftBrowsingSeq !== null && rightBrowsingSeq !== null);

	// ── Beat length ──────────────────────────────────────────────────────
	let fuseLength = $state(8);
	const LENGTHS = [2, 4, 8, 12, 16, 24, 32];
	let showLengthPicker = $state(false);

	// ── Shuffle function refs + counters ─────────────────────────────────
	let leftShuffleFn = $state<(() => void) | null>(null);
	let rightShuffleFn = $state<(() => void) | null>(null);
	let leftCounter = $state({ current: 0, total: 0 });
	let rightCounter = $state({ current: 0, total: 0 });

	// ── Hero playback ────────────────────────────────────────────────────
	const heroAnimState = createAnimationPanelState();
	let heroController: IAnimationPlaybackController | null = null;
	let motionLoader: ISequenceMotionLoader | null = null;

	const heroBlueProp = $derived<PropState | null>(
		isAssembled ? heroAnimState.bluePropState : null
	);
	const heroRedProp = $derived<PropState | null>(
		isAssembled ? heroAnimState.redPropState : null
	);
	const heroCurrentStep = $derived(heroAnimState.currentStep);
	const heroIsPlaying = $derived(heroAnimState.isPlaying);

	// ── Split canvas prop states ─────────────────────────────────────────
	// The split canvases don't need their own playback controllers. The
	// FuseSequenceBrowser already renders ChoreoCards with beat highlighting
	// driven by fuseState.currentBeat. The split AnimatorCanvases here are
	// placeholders for the FLIP animation (Tasks 4-5). For now they show
	// nothing when disassembled — the browse cards ARE the visual.
	let leftBlueProp = $state<PropState | null>(null);
	let rightRedProp = $state<PropState | null>(null);

	// ── ChoreoCard sync ──────────────────────────────────────────────────
	const highlightedStepIndex = $derived.by(() => {
		if (!heroIsPlaying || !fuseState.fusedSequence?.steps?.length) return null;
		return Math.floor(heroCurrentStep) % fuseState.fusedSequence.steps.length;
	});

	// ── Element refs (for FLIP in Tasks 4-5) ─────────────────────────────
	let layoutEl = $state<HTMLDivElement>(undefined!);
	let heroEl = $state<HTMLDivElement>(undefined!);
	let splitLeftEl = $state<HTMLDivElement>(undefined!);
	let splitRightEl = $state<HTMLDivElement>(undefined!);
	let browseLeftEl = $state<HTMLDivElement>(undefined!);
	let browseRightEl = $state<HTMLDivElement>(undefined!);
	let cardAreaEl = $state<HTMLDivElement>(undefined!);


	// ── Lifecycle ─────────────────────────────────────────────────────────
	onMount(() => {
		fuseTourState.triggerIfFirstTime();

		try {
			const factory = container.items.animationPlaybackControllerFactory as IAnimationPlaybackControllerFactory;
			heroController = factory.create();
		} catch {
			// Factory may not be registered; hero playback won't work
		}

		try {
			motionLoader = container.items.sequenceMotionLoader as ISequenceMotionLoader;
		} catch {
			// Motion loader unavailable
		}
	});

	onDestroy(() => {
		heroController?.dispose();
		heroAnimState.dispose();
	});

	// ── Hero initialization effect ───────────────────────────────────────
	// When we enter assembled state with a fused sequence, initialize the
	// hero playback controller so the animation canvas plays the result.
	$effect(() => {
		const seq = fuseState.fusedSequence;
		if (!seq || !isAssembled) return;

		const ctrl = heroController;
		const loader = motionLoader;
		if (!ctrl || !loader) return;

		untrack(async () => {
			if (heroAnimState.isPlaying) ctrl.togglePlayback();
			heroAnimState.reset();

			const fullSeq = await loader.ensureMotionData(seq);
			if (!fullSeq) return;

			heroAnimState.setShouldLoop(true);
			const ok = ctrl.initialize(fullSeq, heroAnimState);
			if (!ok) return;

			ctrl.setSpeed(fuseState.bpm / 60);
			setTimeout(() => ctrl.togglePlayback(), 300);
		});
	});

	// ── Disassemble completion (TEMP: skip animation, Task 4 adds FLIP) ─
	$effect(() => {
		if (fuseState.phase !== "disassembling") return;
		fuseState.completeDisassemble();
	});

	// ── Action handlers ──────────────────────────────────────────────────

	async function handleFuse() {
		if (!leftBrowsingSeq || !rightBrowsingSeq) return;

		fuseState.selectLeft(leftBrowsingSeq);
		fuseState.selectRight(rightBrowsingSeq);
		fuseState.startReassemble();

		// TEMP: skip animation, go straight to assembled (Task 4 adds FLIP)
		fuseState.completeReassemble();

		// Derive letters so the fused sequence has a word
		if (fuseState.fusedSequence) {
			try {
				const letterDeriver = container.items.letterDeriver;
				const withLetters = await letterDeriver.deriveLettersForSequence(fuseState.fusedSequence);
				fuseState.setFusedSequence(withLetters);
			} catch {
				// Letters are nice-to-have, don't block on failure
			}
		}
	}

	function handleSave() {
		// TODO: wire to save flow
	}

	function handleOpenInViewer() {
		const seq = fuseState.fusedSequence;
		if (!seq) return;
		openSequenceViewer(seq, {
			returnPath: "/app/create",
			returnLabel: "Fuse",
			initialBpm: fuseState.bpm,
		});
	}

	function handleStepClick(stepIndex: number) {
		heroController?.seekToStep(stepIndex);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === " ") {
			event.preventDefault();
			fuseState.toggleClock();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fuse-layout" bind:this={layoutEl}>
	<!-- ─── Hero canvas: always mounted ──────────────────────────────── -->
	<div
		class="hero-slot"
		class:slot-visible={isAssembled}
		class:slot-hidden={!isAssembled}
		bind:this={heroEl}
	>
		<AnimatorCanvas
			blueProp={heroBlueProp}
			redProp={heroRedProp}
			gridVisible={true}
			isPlaying={isAssembled && heroIsPlaying}
			currentStep={heroCurrentStep}
			resizePaused={resizePaused}
			fillContainer={true}
			hideProgressBar={false}
			progressBarVariant="gradient"
			word={fuseState.fusedSequence?.word ?? null}
		/>
	</div>

	<!-- ─── Split left canvas: always mounted ────────────────────────── -->
	<div
		class="split-slot split-left"
		class:slot-visible={isDisassembled}
		class:slot-hidden={!isDisassembled}
		bind:this={splitLeftEl}
	>
		<AnimatorCanvas
			blueProp={leftBlueProp}
			redProp={null}
			gridVisible={true}
			isPlaying={isDisassembled && fuseState.clockRunning}
			currentStep={fuseState.currentBeat}
			resizePaused={resizePaused}
			fillContainer={true}
			hideProgressBar={true}
			hideTkaGlyph={true}
			hideStepNumbers={true}
		/>
	</div>

	<!-- ─── Split right canvas: always mounted ───────────────────────── -->
	<div
		class="split-slot split-right"
		class:slot-visible={isDisassembled}
		class:slot-hidden={!isDisassembled}
		bind:this={splitRightEl}
	>
		<AnimatorCanvas
			blueProp={null}
			redProp={rightRedProp}
			gridVisible={true}
			isPlaying={isDisassembled && fuseState.clockRunning}
			currentStep={fuseState.currentBeat}
			resizePaused={resizePaused}
			fillContainer={true}
			hideProgressBar={true}
			hideTkaGlyph={true}
			hideStepNumbers={true}
		/>
	</div>

	<!-- ─── Browse chrome: disassembled state ────────────────────────── -->
	{#if isDisassembled}
		<div class="browse-area">
			<div class="browse-column" bind:this={browseLeftEl}>
				<div class="card-section">
					<FuseSequenceBrowser
						side="left"
						length={fuseLength}
						onSelect={() => {}}
						hideActions={true}
						onCurrentItemChange={(seq) => (leftBrowsingSeq = seq)}
						onShuffleReady={(fn) => (leftShuffleFn = fn)}
						onCounterChange={(c, t) => (leftCounter = { current: c, total: t })}
					/>
				</div>
				<button class="shuffle-btn shuffle-blue" onclick={() => leftShuffleFn?.()}>
					<i class="fas fa-shuffle" aria-hidden="true"></i>
					Shuffle {leftCounter.current} / {leftCounter.total}
				</button>
			</div>
			<div class="browse-column" bind:this={browseRightEl}>
				<div class="card-section">
					<FuseSequenceBrowser
						side="right"
						length={fuseLength}
						onSelect={() => {}}
						hideActions={true}
						onCurrentItemChange={(seq) => (rightBrowsingSeq = seq)}
						onShuffleReady={(fn) => (rightShuffleFn = fn)}
						onCounterChange={(c, t) => (rightCounter = { current: c, total: t })}
					/>
				</div>
				<button class="shuffle-btn shuffle-red" onclick={() => rightShuffleFn?.()}>
					<i class="fas fa-shuffle" aria-hidden="true"></i>
					Shuffle {rightCounter.current} / {rightCounter.total}
				</button>
			</div>
		</div>
	{/if}

	<!-- ─── ChoreoCard: assembled state ──────────────────────────────── -->
	{#if isAssembled && fuseState.fusedSequence}
		<div class="card-area" bind:this={cardAreaEl}>
			<div class="card-scroll themed-scrollbar">
				<ChoreoCard
					sequence={fuseState.fusedSequence}
					showWord={false}
					showDifficultyLevel={false}
					showCreatorName={false}
					showNotes={false}
					showBirthday={false}
					showLoopGlyph={false}
					showStepNumbers={true}
					includeStartPosition={true}
					darkMode={true}
					highlightedStepIndex={highlightedStepIndex}
					showHighlight={heroIsPlaying}
					onStepClick={handleStepClick}
				/>
			</div>
		</div>
	{/if}

	<!-- ─── Bottom bar ───────────────────────────────────────────────── -->
	<div class="fuse-bottom">
		{#if isDisassembled}
			<HelpButton
				onclick={() => fuseTourState.restart()}
				ariaLabel="Replay tour"
				title="Replay tour"
				size="compact"
			/>

			<div class="length-picker-wrap">
				<button
					class="length-trigger"
					onclick={() => (showLengthPicker = !showLengthPicker)}
					aria-label="Change beat length (currently {fuseLength})"
				>
					<span class="length-value">{fuseLength}</span>
					<span class="length-unit">beats</span>
				</button>
				{#if showLengthPicker}
					<div class="length-popover" role="radiogroup" aria-label="Beat length">
						{#each LENGTHS as len}
							<button
								class="length-option"
								class:active={fuseLength === len}
								role="radio"
								aria-checked={fuseLength === len}
								onclick={() => {
									fuseLength = len;
									showLengthPicker = false;
								}}
							>
								{len}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<button
				class="fuse-button"
				disabled={!canFuse || isTransitioning}
				onclick={handleFuse}
			>
				<i class="fas fa-fire" aria-hidden="true"></i>
				<span>Fuse</span>
			</button>
		{:else if isAssembled}
			<button class="action-btn action-save" onclick={handleSave} disabled={isTransitioning}>
				<i class="fas fa-bookmark" aria-hidden="true"></i>
				Save
			</button>
			<button
				class="action-btn action-ghost"
				onclick={() => fuseState.startDisassemble(true)}
				disabled={isTransitioning}
			>
				<i class="fas fa-redo" aria-hidden="true"></i>
				Build Another
			</button>
			<button class="action-btn action-ghost" onclick={handleOpenInViewer} disabled={isTransitioning}>
				<i class="fas fa-expand" aria-hidden="true"></i>
				Open in Viewer
			</button>
			<button
				class="action-btn action-ghost"
				onclick={() => fuseState.startDisassemble(false)}
				disabled={isTransitioning}
			>
				<i class="fas fa-arrow-left" aria-hidden="true"></i>
				Swap a Half
			</button>
		{/if}
	</div>
</div>

<style>
	/* ── Layout shell ─────────────────────────────────────────────────── */

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

	/* ── Canvas slot visibility ───────────────────────────────────────── */

	.slot-visible {
		visibility: visible;
		position: relative;
	}

	.slot-hidden {
		visibility: hidden;
		position: absolute;
		pointer-events: none;
	}

	/* ── Hero slot ─────────────────────────────────────────────────────── */

	.hero-slot {
		flex: 1;
		min-height: 0;
		max-width: 600px;
	}

	.hero-slot.slot-hidden {
		top: 0;
		left: 0;
		width: 50%;
		max-width: 600px;
		height: 60%;
	}

	/* ── Split canvas slots ────────────────────────────────────────────── */

	.split-slot {
		flex: 0 0 auto;
		width: 48%;
		max-width: 300px;
		aspect-ratio: 1;
	}

	.split-left.slot-hidden {
		top: 0;
		left: 0;
		width: 48%;
		max-width: 300px;
	}

	.split-right.slot-hidden {
		top: 0;
		right: 0;
		width: 48%;
		max-width: 300px;
	}

	/* When visible and disassembled, the splits are visual-only placeholders.
	   The real browse UI is in .browse-area. Hide visible splits behind browse. */
	.split-slot.slot-visible {
		position: absolute;
		top: 0;
		width: 48%;
		max-width: 300px;
		z-index: -1;
		opacity: 0;
	}

	/* ── Browse area (disassembled state) ─────────────────────────────── */

	.browse-area {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-xs, 4px);
		padding: var(--spacing-xs, 4px);
	}

	@container fuse-layout (max-width: 600px) {
		.browse-area {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}
	}

	.browse-column {
		display: flex;
		flex-direction: column;
		min-height: 0;
		gap: var(--spacing-xs, 4px);
	}

	.card-section {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* ── Shuffle buttons ──────────────────────────────────────────────── */

	.shuffle-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-xs, 4px);
		padding: 10px 16px;
		border-radius: var(--radius-md, 8px);
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		cursor: pointer;
		min-height: 48px;
		transition: border-color 150ms ease, background 150ms ease;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text, #ffffff);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.shuffle-btn:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		background: rgba(255, 255, 255, 0.06);
	}

	.shuffle-blue {
		border-color: rgba(59, 130, 246, 0.3);
	}

	.shuffle-blue:hover {
		border-color: rgba(59, 130, 246, 0.5);
	}

	.shuffle-red {
		border-color: rgba(239, 68, 68, 0.3);
	}

	.shuffle-red:hover {
		border-color: rgba(239, 68, 68, 0.5);
	}

	/* ── Card area (assembled state) ──────────────────────────────────── */

	.card-area {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		padding: var(--spacing-xs, 4px);
	}

	.card-scroll {
		height: 100%;
		overflow-y: auto;
	}

	/* ── Bottom bar ────────────────────────────────────────────────────── */

	.fuse-bottom {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-xs, 4px) var(--spacing-md, 16px);
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		min-height: 56px;
	}

	/* ── Length picker ─────────────────────────────────────────────────── */

	.length-picker-wrap {
		position: relative;
	}

	.length-trigger {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 44px;
		padding: 6px 12px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-sm, 6px);
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text, #ffffff);
		cursor: pointer;
		transition: border-color 150ms ease;
	}

	.length-trigger:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
	}

	.length-value {
		font-size: var(--font-size-sm, 14px);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.length-unit {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	.length-popover {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 6px;
		display: flex;
		gap: 2px;
		padding: 4px;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
		border-radius: var(--radius-md, 8px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		z-index: 20;
	}

	.length-option {
		min-width: 44px;
		min-height: 44px;
		border: none;
		border-radius: var(--radius-sm, 6px);
		background: transparent;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		font-size: var(--font-size-sm, 14px);
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 150ms ease;
	}

	.length-option:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.length-option.active {
		background: var(--theme-accent, #6366f1);
		color: #ffffff;
	}

	/* ── Fuse button ──────────────────────────────────────────────────── */

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

	/* ── Action buttons (assembled state) ─────────────────────────────── */

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-xs, 4px);
		min-height: 44px;
		padding: 8px 16px;
		border-radius: var(--radius-md, 8px);
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: border-color 150ms ease, background 150ms ease;
	}

	.action-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.action-save {
		background: linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%);
		color: #ffffff;
		border: none;
	}

	.action-save:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.action-ghost {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text, #ffffff);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.action-ghost:hover:not(:disabled) {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		background: rgba(255, 255, 255, 0.06);
	}

	/* ── Responsive: assembled layout ─────────────────────────────────── */
	/* On wider screens, hero + card side by side */

	@container fuse-layout (min-width: 700px) {
		.fuse-layout:has(.hero-slot.slot-visible) {
			display: grid;
			grid-template-columns: 1fr 1fr;
			grid-template-rows: 1fr auto;
		}

		.hero-slot.slot-visible {
			grid-column: 1;
			grid-row: 1;
			max-width: none;
		}

		.card-area {
			grid-column: 2;
			grid-row: 1;
		}

		.fuse-bottom {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}

	/* ── Reduced motion ───────────────────────────────────────────────── */

	@media (prefers-reduced-motion: reduce) {
		.shuffle-btn,
		.fuse-button,
		.action-btn,
		.length-trigger,
		.length-option {
			transition: none;
		}
	}
</style>
