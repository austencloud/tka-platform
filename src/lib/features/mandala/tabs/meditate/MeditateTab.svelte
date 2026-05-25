<script lang="ts">
	import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
	import type { UndulationEasing } from "$lib/shared/mandala/components/SequenceMandala.svelte";
	import MandalaSelector from "./components/MandalaSelector.svelte";
	import MeditationControls from "./components/MeditationControls.svelte";
	import MeditationOverlay from "./components/MeditationOverlay.svelte";
	import { createMeditationSession } from "./state/meditation-session.svelte";
	import { createMeditationAudioService } from "./services/meditation-audio";
	import {
		getPatternCycleTime,
		type BreathingPattern,
		type AmbientTrack,
	} from "./domain/meditation-types";
	import type { StepLike } from "$lib/shared/mandala/services/contracts/types";
	import { onMount } from "svelte";

	const ANIMATE_MIN = 0;
	const ANIMATE_MAX = 250;
	const BASE_PERIOD = 5;

	type Phase = "select" | "configure" | "session";

	let phase = $state<Phase>("select");
	let selectedSteps = $state<StepLike[]>([]);
	let selectedName = $state("");
	let selectedBlueProp = $state("staff");
	let selectedRedProp = $state("staff");
	let containerSize = $state(300);
	let stageEl = $state<HTMLElement | null>(null);

	const reducedMotion = typeof window !== "undefined"
		? window.matchMedia("(prefers-reduced-motion: reduce)").matches
		: false;

	const meditationSession = createMeditationSession();
	let audioService = createMeditationAudioService();

	const sessionPeriod = $derived.by(() => {
		if (meditationSession.status === "running" && meditationSession.pattern) {
			return getPatternCycleTime(meditationSession.pattern);
		}
		return BASE_PERIOD;
	});

	const sessionEasing = $derived.by((): UndulationEasing => {
		if (meditationSession.status === "running" && meditationSession.pattern) {
			return meditationSession.pattern.defaultEasing;
		}
		return "sine";
	});

	const mandalaRotation = $derived(reducedMotion ? 0 : 90);

	const mandalaTipDx = $derived(meditationSession.holdPulseDx);

	const mandalaSize = $derived(Math.min(containerSize, 600));

	// ResizeObserver for responsive mandala sizing
	onMount(() => {
		let ro: ResizeObserver | undefined;

		if (stageEl) {
			ro = new ResizeObserver((entries) => {
				for (const entry of entries) {
					const { width, height } = entry.contentRect;
					containerSize = Math.min(width, height) * 0.85;
				}
			});
			ro.observe(stageEl);
		}

		return () => {
			ro?.disconnect();
			meditationSession.dispose();
			audioService.dispose();
		};
	});

	// Re-observe when stageEl changes (phase transitions)
	$effect(() => {
		if (!stageEl) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				containerSize = Math.min(width, height) * 0.85;
			}
		});
		ro.observe(stageEl);
		return () => ro.disconnect();
	});

	function handleMandalaSelect(
		steps: StepLike[],
		name: string,
		bluePropType: string,
		redPropType: string,
	) {
		selectedSteps = steps;
		selectedName = name;
		selectedBlueProp = bluePropType;
		selectedRedProp = redPropType;
		phase = "configure";
	}

	function handleStart(pattern: BreathingPattern, durationMinutes: number) {
		phase = "session";
		meditationSession.start(
			pattern,
			durationMinutes,
			ANIMATE_MIN,
			ANIMATE_MAX,
			handleSessionComplete,
		);
	}

	function handleSessionComplete() {
		audioService.playCompletionBell();
		audioService.stopAmbient();
	}

	function handleStop() {
		meditationSession.stop();
		audioService.stopAmbient();
		phase = "configure";
	}

	function handleExit() {
		meditationSession.stop();
		audioService.stopAmbient();
		phase = "select";
	}

	function handleAmbientChange(track: AmbientTrack) {
		if (track === "none") {
			audioService.stopAmbient();
		} else {
			audioService.startAmbient(track);
		}
	}

	function handleVolumeChange(volume: number) {
		audioService.setVolume(volume);
	}

	function handleMeditateAgain() {
		if (meditationSession.pattern) {
			phase = "session";
			meditationSession.start(
				meditationSession.pattern,
				meditationSession.durationMinutes,
				ANIMATE_MIN,
				ANIMATE_MAX,
				handleSessionComplete,
			);
		}
	}

	function handleNewMandala() {
		meditationSession.stop();
		audioService.stopAmbient();
		phase = "select";
	}
</script>

<div class="meditate-tab">
	{#if phase === "select"}
		<MandalaSelector onSelect={handleMandalaSelect} />
	{:else if phase === "configure"}
		<div class="configure-layout">
			<div class="preview-stage" bind:this={stageEl}>
				<SequenceMandala
					sequence={{ steps: selectedSteps }}
					size={mandalaSize}
					show="both"
					animate={true}
					animateMin={ANIMATE_MIN}
					animateMax={ANIMATE_MAX}
					animatePeriod={BASE_PERIOD}
					animateEasing="sine"
					animateRotation={mandalaRotation}
					bluePropType={selectedBlueProp}
					redPropType={selectedRedProp}
				/>
				<span class="mandala-label">{selectedName}</span>
			</div>
			<div class="controls-rail">
				<MeditationControls
					status={meditationSession.status}
					onStart={handleStart}
					onStop={handleStop}
					onExit={handleExit}
					onAmbientChange={handleAmbientChange}
					onVolumeChange={handleVolumeChange}
				/>
			</div>
		</div>
	{:else}
		<div class="session-viewport" bind:this={stageEl}>
			<SequenceMandala
				sequence={{ steps: selectedSteps }}
				size={mandalaSize}
				show="both"
				animate={true}
				animateMin={ANIMATE_MIN}
				animateMax={ANIMATE_MAX}
				animatePeriod={sessionPeriod}
				animateEasing={sessionEasing}
				animateRotation={mandalaRotation}
				tipDx={mandalaTipDx}
				bluePropType={selectedBlueProp}
				redPropType={selectedRedProp}
			/>
			<MeditationOverlay
				status={meditationSession.status}
				currentPhase={meditationSession.currentPhase}
				phaseElapsed={meditationSession.phaseElapsed}
				phaseDuration={meditationSession.phaseDuration}
				pattern={meditationSession.pattern}
				elapsedSeconds={meditationSession.elapsedSeconds}
				durationMinutes={meditationSession.durationMinutes}
				breathCount={meditationSession.breathCount}
				onMeditateAgain={handleMeditateAgain}
				onBackToMandala={handleNewMandala}
			/>
			<button
				type="button"
				class="session-exit-btn"
				onclick={handleStop}
				aria-label="End meditation session"
			>
				<i class="fas fa-xmark" aria-hidden="true"></i>
			</button>
		</div>
	{/if}
</div>

<style>
	.meditate-tab {
		width: 100%;
		height: 100%;
		background: transparent;
		overflow: hidden;
	}

	.configure-layout {
		display: flex;
		height: 100%;
	}

	.preview-stage {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		position: relative;
		min-width: 0;
	}

	.mandala-label {
		font-size: 14px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.5);
		letter-spacing: 0.03em;
	}

	.controls-rail {
		width: 300px;
		flex-shrink: 0;
		border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
		overflow-y: auto;
	}

	.session-viewport {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.session-exit-btn {
		position: absolute;
		top: 16px;
		left: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--min-touch-target, 44px);
		height: var(--min-touch-target, 44px);
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 10px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: 16px;
		cursor: pointer;
		transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
		z-index: 30;
	}

	@media (hover: hover) {
		.session-exit-btn:hover {
			background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
			border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
			color: var(--theme-text, white);
		}
	}

	.session-exit-btn:active {
		transform: scale(0.9);
		transition-duration: 50ms;
	}

	.session-exit-btn:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
		outline-offset: 2px;
	}

	@media (max-width: 768px) {
		.configure-layout {
			flex-direction: column;
		}

		.preview-stage {
			flex: 1;
			min-height: 0;
		}

		.controls-rail {
			width: 100%;
			max-height: 50%;
			border-left: none;
			border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.session-exit-btn {
			transition: none;
		}
		.session-exit-btn:active {
			transform: none;
		}
	}
</style>
