<script lang="ts">
	/**
	 * Fuse Layout
	 *
	 * Shuffle-to-discover: pick a beat length, shuffle cards on each side,
	 * hit Fuse when you like what's showing. No pick step.
	 */

	import { getFuseContext } from "../context/fuse-context";
	import FusePanel from "./FusePanel.svelte";
	import FuseAnimationPreview from "./FuseAnimationPreview.svelte";
	import FuseTour from "$lib/shared/onboarding/components/fuse-tour/FuseTour.svelte";
	import HelpButton from "$lib/shared/components/help/HelpButton.svelte";
	import { fuseTourState } from "$lib/shared/onboarding/state/fuse-tour-state.svelte";
	import { animateFuseAssembly } from "../services/fuse-assembly-animator";
	import { deriveLettersForSequence } from "$lib/shared/navigation/services/letter-deriver";
	import { onMount } from "svelte";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

	const { state: fuseState } = getFuseContext();

	let fuseLength: number = $state(8);
	let showLengthPicker = $state(false);

	const LENGTHS = [2, 4, 8, 12, 16, 24, 32];

	onMount(() => {
		fuseTourState.triggerIfFirstTime();
	});


	function selectLength(len: number) {
		fuseLength = len;
		showLengthPicker = false;
	}

	// Track what each panel is currently showing (for fusing without pick)
	let leftBrowsingSeq = $state<SequenceData | null>(null);
	let rightBrowsingSeq = $state<SequenceData | null>(null);

	const canFuse = $derived(leftBrowsingSeq !== null && rightBrowsingSeq !== null);

	// DOM refs for assembly animation
	let leftPanelEl: HTMLDivElement = $state(undefined as unknown as HTMLDivElement);
	let rightPanelEl: HTMLDivElement = $state(undefined as unknown as HTMLDivElement);
	let fuseTargetEl: HTMLDivElement = $state(undefined as unknown as HTMLDivElement);


	async function handleFuse() {
		if (!leftBrowsingSeq || !rightBrowsingSeq) return;
		// Set the sequences on fuse state so startFuse can use them
		fuseState.selectLeft(leftBrowsingSeq);
		fuseState.selectRight(rightBrowsingSeq);
		fuseState.startFuse();

		// Derive letters on the fused sequence so it has a word
		if (fuseState.fusedSequence) {
			try {
				const withLetters = await deriveLettersForSequence(fuseState.fusedSequence);
				fuseState.setFusedSequence(withLetters);
			} catch {
				// Letters are nice-to-have, don't block on failure
			}
		}
	}

	// When state enters "fusing", complete immediately - the crossfade
	// transition on FuseTab handles the visual transition between views
	$effect(() => {
		if (fuseState.phase !== "fusing") return;
		fuseState.completeFuse();
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

	// Tour fuse result state
	let tourFuseCompleted = $state(false);
	let tourFusedWord = $state("");

	async function handleTourFuse() {
		await handleFuse();
		tourFuseCompleted = true;
		tourFusedWord = fuseState.fusedSequence?.word ??
			fuseState.fusedSequence?.steps?.map(s => s.letter).filter(Boolean).join("") ?? "";
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if fuseTourState.isActive}
	<!-- TOUR MODE: fixed overlay covers entire viewport including bottom nav -->
	<div class="tour-overlay">
		{#if fuseTourState.currentStop === "welcome"}
			<!-- Stop 1: Welcome - fullscreen centered FuseTour -->
			<div class="tour-stop welcome-stop">
				<FuseTour variant="fullscreen" />
			</div>

		{:else if fuseTourState.currentStop === "panels"}
			<!-- Stop 2: Both Panels - banner at top, both panels below -->
			<div class="tour-stop panels-stop">
				<div class="tour-banner-area">
					<FuseTour variant="banner" />
				</div>
				<div class="tour-panels">
					<div class="panel-wrap" bind:this={leftPanelEl}>
						<FusePanel
							side="left"
							bpm={fuseState.bpm}
							onControllerReady={(ctrl) => fuseState.registerController("left", ctrl)}
							length={fuseLength}
							currentStep={fuseState.currentStep}
							onCurrentSequenceChange={(seq) => leftBrowsingSeq = seq}
						/>
					</div>
					<div class="panel-wrap" bind:this={rightPanelEl}>
						<FusePanel
							side="right"
							bpm={fuseState.bpm}
							onControllerReady={(ctrl) => fuseState.registerController("right", ctrl)}
							length={fuseLength}
							currentStep={fuseState.currentStep}
							onCurrentSequenceChange={(seq) => rightBrowsingSeq = seq}
						/>
					</div>
				</div>
			</div>

		{:else if fuseTourState.currentStop === "shuffle"}
			<!-- Stop 3: Shuffle - banner below panels, near the shuffle buttons -->
			<div class="tour-stop shuffle-stop">
				<div class="tour-panels">
					<div class="panel-wrap" bind:this={leftPanelEl}>
						<FusePanel
							side="left"
							bpm={fuseState.bpm}
							onControllerReady={(ctrl) => fuseState.registerController("left", ctrl)}
							length={fuseLength}
							currentStep={fuseState.currentStep}
							onCurrentSequenceChange={(seq) => leftBrowsingSeq = seq}
							tourShuffleGlow={true}
						/>
					</div>
					<div class="panel-wrap" bind:this={rightPanelEl}>
						<FusePanel
							side="right"
							bpm={fuseState.bpm}
							onControllerReady={(ctrl) => fuseState.registerController("right", ctrl)}
							length={fuseLength}
							currentStep={fuseState.currentStep}
							onCurrentSequenceChange={(seq) => rightBrowsingSeq = seq}
							tourShuffleGlow={true}
						/>
					</div>
				</div>
				<div class="tour-banner-area">
					<FuseTour variant="banner" />
				</div>
			</div>

		{:else if fuseTourState.currentStop === "fuse"}
			<!-- Stop 4: Fuse - panels dimmed with fuse button, or result after fusing -->
			<div class="tour-stop fuse-stop">
				{#if !tourFuseCompleted}
					<!-- Pre-fuse: panels dimmed, fuse button pulsing -->
					<div class="tour-banner-area">
						<FuseTour variant="banner" />
					</div>
					<div class="tour-panels tour-panels-dimmed">
						<div class="panel-wrap" bind:this={leftPanelEl}>
							<FusePanel
								side="left"
								bpm={fuseState.bpm}
								onControllerReady={(ctrl) => fuseState.registerController("left", ctrl)}
								length={fuseLength}
								currentStep={fuseState.currentStep}
								onCurrentSequenceChange={(seq) => leftBrowsingSeq = seq}
							/>
						</div>
						<div class="panel-wrap" bind:this={rightPanelEl}>
							<FusePanel
								side="right"
								bpm={fuseState.bpm}
								onControllerReady={(ctrl) => fuseState.registerController("right", ctrl)}
								length={fuseLength}
								currentStep={fuseState.currentStep}
								onCurrentSequenceChange={(seq) => rightBrowsingSeq = seq}
							/>
						</div>
					</div>
					<div class="tour-fuse-area">
						<button
							class="fuse-button tour-fuse-btn"
							onclick={handleTourFuse}
						>
							<i class="fas fa-fire" aria-hidden="true"></i>
							<span>Fuse</span>
						</button>
					</div>
				{:else}
					<!-- Post-fuse: result with derived word + "Let's go" button -->
					<div class="tour-result">
						<div class="tour-result-word">{tourFusedWord || "Fused!"}</div>
						<p class="tour-result-subtitle">Your fused sequence</p>

						{#if fuseState.fusedSequence}
							<div class="tour-result-preview">
								<FuseAnimationPreview
									sequence={fuseState.fusedSequence}
									bpm={fuseState.bpm}
									currentStep={fuseState.currentStep}
									showBackButton={false}
								/>
							</div>
						{/if}

						<button
							class="fuse-button tour-finish-btn"
							onclick={() => {
								fuseTourState.complete();
								tourFuseCompleted = false;
								tourFusedWord = "";
							}}
						>
							Let's go
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>

{:else}
	<!-- NORMAL MODE -->
	<div class="fuse-layout">
		<div class="fuse-panels">
			<div class="panel-wrap" bind:this={leftPanelEl}>
				<FusePanel
					side="left"
					bpm={fuseState.bpm}
					onControllerReady={(ctrl) => fuseState.registerController("left", ctrl)}
					length={fuseLength}
					currentStep={fuseState.currentStep}
					onCurrentSequenceChange={(seq) => leftBrowsingSeq = seq}
				/>
			</div>
			<div class="panel-wrap" bind:this={rightPanelEl}>
				<FusePanel
					side="right"
					bpm={fuseState.bpm}
					onControllerReady={(ctrl) => fuseState.registerController("right", ctrl)}
					length={fuseLength}
					currentStep={fuseState.currentStep}
					onCurrentSequenceChange={(seq) => rightBrowsingSeq = seq}
				/>
			</div>
		</div>

		<!-- Invisible target for assembly animation -->
		<div class="fuse-target" bind:this={fuseTargetEl} aria-hidden="true"></div>

		<!-- Bottom bar -->
		<div class="fuse-bottom">
			<HelpButton
				onclick={() => fuseTourState.restart()}
				ariaLabel="Replay Fuse tour"
				title="Replay tour"
				size="compact"
			/>

			<div class="length-picker-wrap">
				<button
					class="length-trigger"
					onclick={() => showLengthPicker = !showLengthPicker}
					aria-label="Change beat length (currently {fuseLength})"
				>
					<span class="length-value">{fuseLength}</span>
					<span class="length-unit">beats</span>
				</button>
				{#if showLengthPicker}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="length-popover" role="radiogroup" aria-label="Beat length">
						{#each LENGTHS as len}
							<button
								class="length-option"
								class:active={fuseLength === len}
								role="radio"
								aria-checked={fuseLength === len}
								onclick={() => selectLength(len)}
							>{len}</button>
						{/each}
					</div>
				{/if}
			</div>

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
{/if}

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
		width: 44px;
		height: 44px;
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

	/* Tour overlay - fills the sub-tab-content container (which has container-type: size,
	   trapping position: fixed). Bottom nav is hidden separately via MainInterface. */
	.tour-overlay {
		position: absolute;
		inset: 0;
		z-index: 10;
		background: linear-gradient(165deg, #1a1a2e 0%, #0f0f23 40%, #1a1025 100%);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.tour-stop {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.welcome-stop {
		align-items: center;
		justify-content: center;
	}

	.tour-banner-area {
		flex-shrink: 0;
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
	}

	.tour-panels {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-xs, 4px);
		padding: 0 var(--spacing-xs, 4px);
	}

	.tour-panels-dimmed {
		opacity: 0.6;
	}

	.tour-fuse-area {
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		padding: var(--spacing-md, 16px);
	}

	.tour-fuse-btn {
		animation: tourPulse 2s ease-in-out infinite;
		font-size: 16px;
		padding: var(--spacing-md, 16px) var(--spacing-xl, 32px);
		min-height: 56px;
	}

	@keyframes tourPulse {
		0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
		50% { box-shadow: 0 0 0 12px rgba(249, 115, 22, 0); }
	}

	.tour-result {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: var(--spacing-md, 16px);
		min-height: 0;
	}

	.tour-result-word {
		font-size: 2.5rem;
		font-weight: 800;
		color: white;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	.tour-result-subtitle {
		margin: 0;
		font-size: var(--font-size-sm, 14px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	.tour-result-preview {
		width: 100%;
		max-width: 400px;
		aspect-ratio: 1;
		border-radius: var(--radius-md, 12px);
		overflow: hidden;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.tour-finish-btn {
		margin-top: 8px;
	}

	@media (prefers-reduced-motion: reduce) {
		.bpm-btn,
		.play-btn,
		.fuse-button {
			transition: none;
		}
		.tour-fuse-btn {
			animation: none;
		}
	}
</style>
