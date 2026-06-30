<!--
  FuseResultView.svelte

  Displayed after a successful fuse. Shows the fused sequence in a split
  layout: animation canvas on the left, ChoreoCard on the right.
  Autoplay starts immediately on mount.
-->
<script lang="ts">

import { getAnimationPlaybackController } from "$lib/shared/animation-engine/get-animation-playback-controller";
import { ensureMotionData } from "$lib/shared/sequence-viewer/services/sequence-motion-loader";
	import { onMount, onDestroy, untrack } from "svelte";
	import { getFuseContext } from "../context/fuse-context";
	import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
	import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
	import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
	import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
	import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
	import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
	import { authState } from "$lib/shared/auth/state/auth-state.svelte";
	import { showToast } from "$lib/shared/toast/state/toast-state.svelte";

	const { state: fuseState } = getFuseContext();

	const DEFAULT_BPM = 60;

	// Animation playback state
	let controller = $state<AnimationPlaybackController | null>(null);
	const animState = createAnimationPanelState();

	let loading = $state(true);
	let error = $state<string | null>(null);

	// Save-to-library state
	let saving = $state(false);
	let saved = $state(false);

	const isPlaying = $derived(animState.isPlaying);
	const currentStep = $derived(animState.currentStep);
	const bluePropState = $derived(animState.bluePropState);
	const redPropState = $derived(animState.redPropState);

	const sequence = $derived(fuseState.fusedSequence);
	const sequenceData = $derived(animState.sequenceData ?? sequence);

	const stepData = $derived.by(() => {
		const seq = sequenceData;
		if (!seq) return null;
		if (currentStep < 1) return seq.startPosition ?? null;
		const idx = Math.min(Math.max(0, Math.floor(currentStep) - 1), (seq.steps?.length ?? 1) - 1);
		return seq.steps?.[idx] ?? null;
	});

	const letter = $derived(stepData?.letter ?? null);
	const gridMode = $derived(sequenceData?.gridMode ?? sequence?.gridMode);

	// ChoreoCard highlight sync
	const highlightedStepIndex = $derived.by(() => {
		if (!isPlaying) return null;
		return Math.floor(currentStep) - 1;
	});

	// Display name: use derived word, fall back to generic
	const displayWord = $derived.by(() => {
		const seq = sequence;
		if (!seq) return "";
		if (seq.word && seq.word !== "__fused__") return seq.word;
		return seq.displayName || seq.name || "";
	});

	onMount(async () => {
		try {
			controller = getAnimationPlaybackController();
			loading = false;
		} catch (err) {
			console.error("Failed to initialize fuse result playback:", err);
			error = "Failed to load animation";
			loading = false;
		}
	});

	onDestroy(() => {
		controller?.dispose();
		animState.dispose();
	});

	// Initialize playback when controller and sequence are ready - autoplay immediately
	$effect(() => {
		void controller;
		const seq = sequence;

		if (!controller || !seq) return;

		// Capture the autoplay timeout so a re-run or teardown can cancel a
		// still-pending toggle — otherwise overlapping timeouts fire against
		// the same controller when the effect re-triggers within 50ms.
		let autoplayTimer: ReturnType<typeof setTimeout> | undefined;
		// Guards the async chain from mutating state after this run is cleaned up.
		let disposed = false;

		untrack(async () => {
			if (animState.isPlaying) controller!.togglePlayback();
			animState.reset();

			const fullSeq = await ensureMotionData(seq);
			if (disposed) return;
			if (!fullSeq) {
				error = "Failed to load sequence motion data";
				return;
			}

			animState.setShouldLoop(true);
			const ok = controller!.initialize(fullSeq, animState);
			if (disposed) return;
			if (!ok) {
				error = "Failed to initialize playback";
				return;
			}

			const speed = fuseState.bpm / DEFAULT_BPM;
			controller!.setSpeed(speed);

			// Autoplay with minimal delay
			autoplayTimer = setTimeout(() => controller?.togglePlayback(), 50);
		});

		return () => {
			disposed = true;
			if (autoplayTimer !== undefined) clearTimeout(autoplayTimer);
		};
	});

	async function handleSave() {
		if (saving || saved) return;
		const seq = sequence;
		if (!seq) {
			showToast("No sequence to save", "info");
			return;
		}
		if (!authState.isAuthenticated) {
			showToast("Sign in to save sequences", "info");
			return;
		}
		saving = true;
		try {
			await getLibraryRepository().saveSequence(seq);
			saved = true;
			showToast("Saved to library", "success");
		} catch (err) {
			console.error("Failed to save fused sequence:", err);
			showToast("Failed to save sequence", "error");
		} finally {
			saving = false;
		}
	}

	function handleBuildAnother() {
		fuseState.reset();
	}

	function handleOpenInViewer() {
		if (!sequence) return;
		openSequenceViewer(sequence, {
			returnPath: "/app/create",
			returnLabel: "Fuse",
			initialBpm: fuseState.bpm,
		});
	}

	function handleStepClick(stepIndex: number) {
		controller?.seekToStep(stepIndex);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			event.preventDefault();
			fuseState.reset();
		}
		if (event.key === " ") {
			event.preventDefault();
			controller?.togglePlayback();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="fuse-result"
	role="region"
	aria-label="Fused sequence result"
	tabindex="0"
	onkeydown={handleKeydown}
>
	<!-- Header: word + steps -->
	{#if displayWord}
		<div class="result-header">
			<h2 class="result-title">{displayWord}</h2>
			{#if sequence}
				<span class="result-meta">
					{sequence.sequenceLength ?? sequence.steps?.length ?? 0} steps
				</span>
			{/if}
		</div>
	{/if}

	<!-- Split layout: canvas + card -->
	<div class="result-split">
		<!-- Animation canvas -->
		<div class="canvas-pane">
			{#if loading}
				<div class="state-msg">
					<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
					<span>Loading fused sequence...</span>
				</div>
			{:else if error}
				<div class="state-msg error">
					<span>{error}</span>
				</div>
			{:else if sequence}
				<div class="canvas-container">
					<AnimatorCanvas
						blueProp={bluePropState}
						redProp={redPropState}
						gridVisible={true}
						{gridMode}
						{letter}
						{stepData}
						sequenceData={sequenceData}
						{currentStep}
						{isPlaying}
						word={sequenceData?.word ?? sequence?.word ?? null}
						hideProgressBar={false}
						hideTkaGlyph={false}
						hideStepNumbers={false}
						progressBarVariant="gradient"
						fillContainer={true}
					/>
				</div>
			{:else}
				<div class="state-msg">
					<span>No result available</span>
				</div>
			{/if}
		</div>

		<!-- ChoreoCard -->
		<div class="card-pane">
			{#if sequence}
				<div class="card-scroll themed-scrollbar">
					<ChoreoCard
						{sequence}
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
						showHighlight={isPlaying}
						onStepClick={handleStepClick}
					/>
				</div>
			{/if}
		</div>
	</div>

	<!-- Action buttons -->
	<div class="result-actions">
		<button
			class="action-btn action-save"
			onclick={handleSave}
			disabled={saving || saved}
			aria-label={saved ? "Saved to library" : "Save to library"}
		>
			{#if saving}
				<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
				<span>Saving</span>
			{:else if saved}
				<i class="fas fa-check" aria-hidden="true"></i>
				<span>Saved</span>
			{:else}
				<i class="fas fa-bookmark" aria-hidden="true"></i>
				<span>Save</span>
			{/if}
		</button>
		<button class="action-btn action-ghost" onclick={handleBuildAnother}>
			<i class="fas fa-redo" aria-hidden="true"></i>
			<span>Build Another</span>
		</button>
		<button class="action-btn action-ghost" onclick={handleOpenInViewer}>
			<i class="fas fa-expand" aria-hidden="true"></i>
			<span>Open in Viewer</span>
		</button>
	</div>
</div>

<style>
	.fuse-result {
		/* Shared Fuse brand gradient — mirrors FuseLayout / FuseSequenceBrowser. */
		--fuse-gradient: linear-gradient(
			135deg,
			var(--fuse-accent-light, #fb923c) 0%,
			var(--fuse-accent, #f97316) 50%,
			var(--fuse-accent-deep, #ea580c) 100%
		);
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		overflow: hidden;
		position: relative;
		outline: none;
		container-type: inline-size;
		container-name: fuse-result;
	}

	.result-header {
		flex-shrink: 0;
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.result-title {
		margin: 0;
		font-size: var(--font-size-lg, 18px);
		font-weight: 700;
		color: var(--theme-text, #ffffff);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.result-meta {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	/* ── Split layout ──────────────────────────────────────────── */

	.result-split {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-xs, 4px);
		padding: var(--spacing-sm, 8px);
	}

	@container fuse-result (max-width: 600px) {
		.result-split {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}
	}

	/* ── Canvas pane ───────────────────────────────────────────── */

	.canvas-pane {
		min-height: 0;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.canvas-container {
		width: 100%;
		max-width: 600px;
		height: 100%;
		border-radius: var(--radius-md, 12px);
		overflow: hidden;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
	}

	/* ── Card pane ─────────────────────────────────────────────── */

	.card-pane {
		min-height: 0;
		min-width: 0;
		display: flex;
		overflow: hidden;
	}

	.card-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--spacing-xs, 4px);
	}

	/* ── State messages ────────────────────────────────────────── */

	.state-msg {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-sm, 14px);
	}

	.state-msg.error {
		color: var(--semantic-error, #fca5a5);
	}

	/* ── Action buttons ────────────────────────────────────────── */

	.result-actions {
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs, 4px);
		min-height: 44px;
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		border-radius: var(--radius-md, 12px);
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.action-save {
		background: var(--fuse-gradient);
		color: #ffffff;
		border: none;
	}

	.action-save:hover:not(:disabled) {
		opacity: 0.9;
	}

	.action-save:disabled {
		opacity: 0.5;
		cursor: progress;
	}

	.action-ghost {
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text, #ffffff);
	}

	.action-ghost:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
	}

	.action-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #fb923c);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.action-btn {
			transition: none;
		}
	}
</style>
