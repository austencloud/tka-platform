<script lang="ts">
	import { onMount } from "svelte";
	import { cubicInOut } from "svelte/easing";
	import { getMandalaGeometryCalculator } from "$lib/shared/mandala/getMandalaGeometryCalculator";
	import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";
	import { loadCatalogs, loadCatalogSequences } from "$lib/features/choreo-card/services/catalog-loader";
	import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
	import { MANDALA_STANDARD_TIP_DX } from "$lib/shared/mandala/domain/mandala-constants";
	import type { UndulationEasing, MandalaPathShape } from "$lib/shared/mandala/components/SequenceMandala.svelte";
	import type { Catalog } from "$lib/features/choreo-card/domain/models/Catalog";
	import type { MandalaPaths, MandalaPalette, MandalaRenderOptions } from "$lib/shared/mandala/domain/mandala-types";
	import type { MandalaPathOptions } from "$lib/shared/mandala/services/contracts/types";
	import {
		DARK_MOTION_BLUE_STROKE,
		DARK_MOTION_RED_STROKE,
		DARK_MOTION_BLUE_FILL,
		DARK_MOTION_RED_FILL,
		DARK_MOTION_PURPLE_STROKE,
		DARK_MOTION_PURPLE_FILL,
	} from "$lib/shared/mandala/domain/mandala-constants";
	import type { MandalaGeometryCalculator } from "$lib/shared/mandala/services/implementations/MandalaGeometryCalculator";

	const PALETTE: MandalaPalette = {
		blueStroke: DARK_MOTION_BLUE_STROKE,
		blueFill: DARK_MOTION_BLUE_FILL,
		redStroke: DARK_MOTION_RED_STROKE,
		redFill: DARK_MOTION_RED_FILL,
		purpleStroke: DARK_MOTION_PURPLE_STROKE,
		purpleFill: DARK_MOTION_PURPLE_FILL,
	};

	const MANDALA_SIZE = 400;

	function softElasticEase(t: number): number {
		if (t === 0 || t === 1) return t;
		const base = (1 - Math.cos(t * Math.PI)) / 2;
		const wobble = Math.sin(t * Math.PI * 3) * t * (1 - t) * 0.35;
		return base + wobble;
	}

	function breatheEase(t: number): number {
		return Math.pow(Math.sin(t * Math.PI / 2), 1.6);
	}

	function heartbeatEase(t: number): number {
		if (t < 0.3) return Math.pow(t / 0.3, 2) * 1.08;
		if (t < 0.45) return 1.08 - 0.18 * ((t - 0.3) / 0.15);
		return 0.9 + 0.1 * (1 - Math.pow(1 - (t - 0.45) / 0.55, 2));
	}

	function driftEase(t: number): number {
		const base = (1 - Math.cos(t * Math.PI)) / 2;
		const wander = Math.sin(t * Math.PI * 5) * Math.pow(t * (1 - t), 1.5) * 0.18;
		return base + wander;
	}

	function bloomEase(t: number): number {
		return 1 - Math.pow(1 - t, 3.5);
	}

	function tidalEase(t: number): number {
		const primary = (1 - Math.cos(t * Math.PI)) / 2;
		const secondary = Math.sin(t * Math.PI * 2) * 0.1 * (1 - Math.abs(2 * t - 1));
		return primary + secondary;
	}

	const EASING_FNS: Record<UndulationEasing, (t: number) => number> = {
		sine: (t: number) => (1 - Math.cos(t * Math.PI)) / 2,
		ease: cubicInOut,
		"soft-elastic": softElasticEase,
		breathe: breatheEase,
		heartbeat: heartbeatEase,
		drift: driftEase,
		bloom: bloomEase,
		tidal: tidalEase,
	};

	const EASING_OPTIONS: { id: UndulationEasing; label: string; desc: string }[] = [
		{ id: "sine", label: "Sine", desc: "Symmetric, natural" },
		{ id: "ease", label: "Ease", desc: "Cubic, heavier dwell at peaks" },
		{ id: "soft-elastic", label: "Soft Elastic", desc: "Gentle wobble throughout" },
		{ id: "breathe", label: "Breathe", desc: "Fast inhale, slow exhale" },
		{ id: "heartbeat", label: "Heartbeat", desc: "Sharp pulse + recoil" },
		{ id: "drift", label: "Drift", desc: "Organic micro-wobbles" },
		{ id: "bloom", label: "Bloom", desc: "Quick expand, gentle settle" },
		{ id: "tidal", label: "Tidal", desc: "Double-pulse like ocean waves" },
	];

	const PRESETS: { label: string; dx: number }[] = [
		{ label: "Fan center", dx: 105 },
		{ label: "Standard", dx: MANDALA_STANDARD_TIP_DX },
		{ label: "Club", dx: 130 },
		{ label: "Staff", dx: 135 },
	];

	const PATH_SHAPE_OPTIONS: { id: MandalaPathShape; label: string; desc: string }[] = [
		{ id: "arc", label: "Arc", desc: "Classic circular path (default)" },
		{ id: "linear", label: "Linear", desc: "Straight line between positions" },
		{ id: "concave", label: "Concave", desc: "Inward-bowing path" },
		{ id: "motion-aware", label: "Motion Aware", desc: "Pro=arc, Anti=concave" },
	];

	let calculator: MandalaGeometryCalculator | null = $state(null);
	let decks: Catalog[] = $state([]);
	let selectedDeckId: string = $state("");
	let deckSequences: any[] = $state([]);
	let loading: boolean = $state(false);
	let error: string = $state("");
	let currentIndex: number = $state(0);
	let tipDx: number = $state(MANDALA_STANDARD_TIP_DX);
	let selectedPathShape: MandalaPathShape = $state<MandalaPathShape>("arc");

	// Animation state
	let animating: boolean = $state(false);
	let animateMin: number = $state(0);
	let animateMax: number = $state(250);
	let animatePeriod: number = $state(5);
	let selectedEasing: UndulationEasing = $state<UndulationEasing>("sine");
	let rotationPerCycle: number = $state(90);
	let rafId: number = 0;
	let animatedDx: number = $state(MANDALA_STANDARD_TIP_DX);
	let rotationDeg: number = $state(0);

	type DataSource = "collection" | "decks";
	let dataSource: DataSource = $state<DataSource>("collection");

	const collectionSequences = $derived(
		mandalaCollectionState.collection.map((m) => ({
			id: m.id,
			word: m.name,
			steps: m.steps,
			bluePropType: m.bluePropType,
			redPropType: m.redPropType,
		}))
	);

	const sequences = $derived(dataSource === "collection" ? collectionSequences : deckSequences);
	const currentSeq = $derived(sequences[currentIndex] ?? null);

	const activeDx = $derived(animating ? animatedDx : tipDx);

	const pathOptions = $derived.by((): MandalaPathOptions | undefined => {
		if (selectedPathShape === "motion-aware") return { motionAware: true };
		if (selectedPathShape !== "arc") return { pathShape: selectedPathShape };
		return undefined;
	});

	const currentPaths = $derived.by((): MandalaPaths | null => {
		if (!calculator || !currentSeq?.steps) return null;
		return calculator.calculate(
			currentSeq.steps, "staff", "staff", pathOptions,
			{ dx: activeDx, dy: 0 }
		);
	});

	const fanPaths = $derived.by((): MandalaPaths | null => {
		if (!calculator || !currentSeq?.steps) return null;
		return calculator.calculate(
			currentSeq.steps, "staff", "staff", pathOptions,
			{ dx: 105, dy: 0 }
		);
	});

	const staffPaths = $derived.by((): MandalaPaths | null => {
		if (!calculator || !currentSeq?.steps) return null;
		return calculator.calculate(
			currentSeq.steps, "staff", "staff", pathOptions,
			{ dx: 135, dy: 0 }
		);
	});

	function renderSVG(paths: MandalaPaths | null, dx?: number): string {
		if (!paths) return "";
		return renderMandalaSVG(paths, {
			size: MANDALA_SIZE,
			style: "stroke",
			showGridDots: false,
			show: "both",
			transparentBackground: true,
			palette: PALETTE,
			tipDx: dx,
		});
	}

	function toggleAnimation() {
		animating = !animating;
		if (animating) {
			let startTime: number | null = null;
			let lastPhase = 0;
			function tick(time: number) {
				if (!animating) return;
				if (startTime === null) startTime = time;
				const elapsed = (time - startTime) / 1000;
				const phase = (elapsed % animatePeriod) / animatePeriod;
				const triangle = phase < 0.5 ? phase * 2 : 2 - phase * 2;
				const eased = EASING_FNS[selectedEasing](triangle);
				animatedDx = animateMin + (animateMax - animateMin) * eased;

				if (rotationPerCycle !== 0) {
					const dt = phase >= lastPhase ? phase - lastPhase : phase + (1 - lastPhase);
					rotationDeg += dt * rotationPerCycle;
				}
				lastPhase = phase;

				rafId = requestAnimationFrame(tick);
			}
			rafId = requestAnimationFrame(tick);
		} else {
			if (rafId) cancelAnimationFrame(rafId);
			rafId = 0;
			tipDx = Math.round(animatedDx);
		}
	}

	onMount(() => {
		calculator = getMandalaGeometryCalculator();
		loadCatalogs()
			.then((d) => {
				decks = d;
				const first = d[0];
				if (first) selectedDeckId = first.id;
			})
			.catch((e: any) => {
				error = e.message ?? "Failed to load decks";
			});

		return () => {
			if (rafId) cancelAnimationFrame(rafId);
		};
	});

	$effect(() => {
		if (dataSource !== "decks" || !selectedDeckId) return;
		loading = true;
		error = "";
		currentIndex = 0;
		loadCatalogSequences(selectedDeckId)
			.then((seqs) => { deckSequences = seqs; })
			.catch((e: any) => { error = e.message ?? "Failed to load sequences"; })
			.finally(() => { loading = false; });
	});

	function switchSource(source: DataSource) {
		dataSource = source;
		currentIndex = 0;
	}

	function prev() {
		if (sequences.length > 0) {
			currentIndex = (currentIndex - 1 + sequences.length) % sequences.length;
		}
	}

	function next() {
		if (sequences.length > 0) {
			currentIndex = (currentIndex + 1) % sequences.length;
		}
	}
</script>

<div class="page-root">
	<header class="toolbar">
		<h1>Undulating Mandala</h1>

		<div class="segmented">
			<button class:active={dataSource === "collection"} onclick={() => switchSource("collection")}>
				Collection
				{#if mandalaCollectionState.count > 0}
					<span class="badge">{mandalaCollectionState.count}</span>
				{/if}
			</button>
			<button class:active={dataSource === "decks"} onclick={() => switchSource("decks")}>
				Decks
			</button>
		</div>

		{#if dataSource === "decks"}
			<select bind:value={selectedDeckId} class="deck-select">
				{#each decks as deck}
					<option value={deck.id}>{deck.name} ({deck.totalSequences})</option>
				{/each}
			</select>
		{/if}

		{#if sequences.length > 0}
			<span class="seq-count">{sequences.length} sequences</span>
		{/if}
	</header>

	<main class="content">
		{#if loading}
			<div class="center-state">Loading...</div>
		{:else if error}
			<div class="center-state error">{error}</div>
		{:else if sequences.length === 0}
			<div class="center-state">
				{#if dataSource === "collection"}
					No saved mandalas. Save from Create workspace first.
				{:else}
					No sequences in this deck.
				{/if}
			</div>
		{:else}
			<div class="nav-row">
				<button class="nav-btn" onclick={prev} aria-label="Previous">
					<i class="fas fa-chevron-left" aria-hidden="true"></i>
				</button>
				<div class="nav-info">
					<span class="nav-word">{currentSeq?.word ?? currentSeq?.name ?? currentSeq?.id ?? ""}</span>
					<span class="nav-counter">{currentIndex + 1} / {sequences.length}</span>
				</div>
				<button class="nav-btn" onclick={next} aria-label="Next">
					<i class="fas fa-chevron-right" aria-hidden="true"></i>
				</button>
			</div>

			<div class="slider-section">
				<div class="slider-header">
					<label for="tip-slider">
						Tip Point dx: <strong>{Math.round(activeDx)}</strong>
						{#if animating}
							<span class="anim-badge">LIVE</span>
						{/if}
					</label>
					<div class="controls-row">
						<div class="presets">
							{#each PRESETS as preset}
								<button
									class="preset-btn"
									class:active={!animating && tipDx === preset.dx}
									onclick={() => { animating = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; tipDx = preset.dx; }}
								>
									{preset.label} ({preset.dx})
								</button>
							{/each}
						</div>
						<button
							class="play-btn"
							class:active={animating}
							onclick={toggleAnimation}
							aria-label={animating ? "Stop animation" : "Play animation"}
						>
							<i class="fas {animating ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
							{animating ? "Stop" : "Undulate"}
						</button>
					</div>
				</div>
				<input
					id="tip-slider"
					type="range"
					min="10"
					max="250"
					step="1"
					bind:value={tipDx}
					class="slider"
					disabled={animating}
					oninput={() => { if (animating) { animating = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; } }}
				/>
				<div class="slider-labels">
					<span>10</span>
					<span>Fan (105)</span>
					<span>Std ({MANDALA_STANDARD_TIP_DX})</span>
					<span>Staff (135)</span>
					<span>250</span>
				</div>

				<div class="anim-params">
					<div class="param-row">
						<span class="param-label">Easing</span>
						<div class="easing-selector">
							{#each EASING_OPTIONS as opt}
								<button
									class="easing-btn"
									class:active={selectedEasing === opt.id}
									onclick={() => { selectedEasing = opt.id; }}
									title={opt.desc}
								>
									{opt.label}
								</button>
							{/each}
						</div>
					</div>
					<div class="param-row">
						<span class="param-label">Path</span>
						<div class="easing-selector">
							{#each PATH_SHAPE_OPTIONS as opt}
								<button
									class="easing-btn"
									class:active={selectedPathShape === opt.id}
									onclick={() => { selectedPathShape = opt.id; }}
									title={opt.desc}
								>
									{opt.label}
								</button>
							{/each}
						</div>
					</div>
					<div class="param-row">
						<span class="param-label">Rotation</span>
						<div class="easing-selector">
							{#each [0, 45, 90, 180, 360] as deg}
								<button
									class="easing-btn"
									class:active={rotationPerCycle === deg}
									onclick={() => { rotationPerCycle = deg; }}
								>
									{deg === 0 ? "None" : `${deg}°`}
								</button>
							{/each}
						</div>
					</div>
					<div class="param-row">
						<label>
							Range: <input type="number" bind:value={animateMin} min="0" max="150" class="num-input" />
							– <input type="number" bind:value={animateMax} min="100" max="300" class="num-input" />
						</label>
						<label>
							Period: <input type="number" bind:value={animatePeriod} min="1" max="20" step="0.5" class="num-input" /> sec
						</label>
					</div>
				</div>
			</div>

			<div class="mandala-row">
				<div class="mandala-card reference">
					<div class="mandala-frame" style="width: {MANDALA_SIZE}px; height: {MANDALA_SIZE}px;">
						{@html renderSVG(fanPaths, 105)}
					</div>
					<span class="card-label">Fan (dx=105)</span>
				</div>

				<div class="mandala-card main" class:breathing={animating}>
					<div class="mandala-frame" style="width: {MANDALA_SIZE}px; height: {MANDALA_SIZE}px; transform: rotate({rotationDeg}deg);">
						{@html renderSVG(currentPaths, activeDx)}
					</div>
					<span class="card-label current-label">
						{animating ? "Undulating" : "Custom"} (dx={Math.round(activeDx)})
					</span>
				</div>

				<div class="mandala-card reference">
					<div class="mandala-frame" style="width: {MANDALA_SIZE}px; height: {MANDALA_SIZE}px;">
						{@html renderSVG(staffPaths, 135)}
					</div>
					<span class="card-label">Staff (dx=135)</span>
				</div>
			</div>
		{/if}
	</main>
</div>

<style>
	.page-root {
		display: flex;
		flex-direction: column;
		height: 100vh;
		color: #e2e8f0;
		background: #0a0a1a;
	}

	header.toolbar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.02);
	}

	h1 {
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		opacity: 0.7;
		margin: 0;
	}

	.deck-select {
		padding: 0.4rem 0.6rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(0, 0, 0, 0.3);
		color: inherit;
		font-size: 0.78rem;
		max-width: 260px;
	}

	.segmented {
		display: flex;
		gap: 1px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 8px;
		padding: 3px;
	}

	.segmented button {
		padding: 0.35rem 0.6rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font-size: 0.72rem;
		cursor: pointer;
		opacity: 0.5;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.segmented button.active {
		background: rgba(167, 139, 250, 0.2);
		opacity: 1;
	}

	.badge {
		font-size: 0.6rem;
		min-width: 16px;
		height: 16px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 4px;
		border-radius: 8px;
		background: rgba(167, 139, 250, 0.3);
		color: #c4b5fd;
	}

	.seq-count {
		font-size: 0.68rem;
		opacity: 0.35;
		margin-left: auto;
	}

	main.content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
	}

	.nav-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	.nav-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		cursor: pointer;
		transition: all 0.2s;
	}

	.nav-btn:hover {
		border-color: rgba(167, 139, 250, 0.3);
		background: rgba(167, 139, 250, 0.1);
	}

	.nav-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		min-width: 120px;
	}

	.nav-word {
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		opacity: 0.8;
	}

	.nav-counter {
		font-size: 0.68rem;
		opacity: 0.35;
	}

	/* Slider */
	.slider-section {
		width: 100%;
		max-width: 800px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.slider-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.slider-header label {
		font-size: 0.85rem;
		opacity: 0.8;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.slider-header strong {
		font-size: 1.1rem;
		color: #a78bfa;
		font-variant-numeric: tabular-nums;
	}

	.controls-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.presets {
		display: flex;
		gap: 0.4rem;
	}

	.preset-btn {
		padding: 0.25rem 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		font-size: 0.65rem;
		cursor: pointer;
		opacity: 0.5;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.preset-btn.active {
		border-color: rgba(167, 139, 250, 0.4);
		background: rgba(167, 139, 250, 0.15);
		opacity: 1;
	}

	.preset-btn:hover {
		opacity: 0.8;
		border-color: rgba(167, 139, 250, 0.3);
	}

	.play-btn {
		padding: 0.35rem 0.75rem;
		border: 1px solid rgba(139, 92, 246, 0.3);
		border-radius: 8px;
		background: rgba(139, 92, 246, 0.1);
		color: #c4b5fd;
		font-size: 0.72rem;
		cursor: pointer;
		transition: all 0.25s;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 600;
	}

	.play-btn:hover {
		background: rgba(139, 92, 246, 0.2);
		border-color: rgba(139, 92, 246, 0.5);
	}

	.play-btn.active {
		background: rgba(139, 92, 246, 0.25);
		border-color: rgba(139, 92, 246, 0.6);
		box-shadow: 0 0 16px rgba(139, 92, 246, 0.2);
	}

	.anim-badge {
		font-size: 0.55rem;
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
		background: rgba(139, 92, 246, 0.3);
		color: #c4b5fd;
		font-weight: 700;
		letter-spacing: 0.1em;
		animation: pulse-badge 1.5s ease-in-out infinite;
	}

	@keyframes pulse-badge {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.anim-params {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.7rem;
		opacity: 0.7;
		margin-top: 0.5rem;
	}

	.param-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.param-label {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.5;
		min-width: 52px;
	}

	.anim-params label {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.easing-selector {
		display: flex;
		gap: 3px;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 6px;
		padding: 2px;
	}

	.easing-btn {
		padding: 0.2rem 0.5rem;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: inherit;
		font-size: 0.65rem;
		cursor: pointer;
		opacity: 0.6;
		transition: all 0.2s;
	}

	.easing-btn.active {
		background: rgba(139, 92, 246, 0.25);
		opacity: 1;
		color: #c4b5fd;
	}

	.easing-btn:hover {
		opacity: 0.9;
	}

	.num-input {
		width: 50px;
		padding: 0.2rem 0.3rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.3);
		color: inherit;
		font-size: 0.7rem;
		text-align: center;
	}

	.slider {
		width: 100%;
		height: 6px;
		appearance: none;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		outline: none;
		cursor: pointer;
	}

	.slider:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.slider::-webkit-slider-thumb {
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #a78bfa;
		border: 2px solid rgba(255, 255, 255, 0.2);
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(167, 139, 250, 0.4);
	}

	.slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #a78bfa;
		border: 2px solid rgba(255, 255, 255, 0.2);
		cursor: pointer;
	}

	.slider-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.6rem;
		opacity: 0.3;
	}

	/* Mandala row */
	.mandala-row {
		display: flex;
		gap: 1.5rem;
		align-items: flex-start;
		flex-wrap: wrap;
		justify-content: center;
	}

	.mandala-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		padding: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: 14px;
		background: rgba(13, 13, 26, 0.6);
		transition: border-color 0.3s, box-shadow 0.3s;
	}

	.mandala-card.main {
		border-color: rgba(167, 139, 250, 0.2);
	}

	.mandala-card.breathing {
		border-color: rgba(139, 92, 246, 0.4);
		box-shadow: 0 0 32px rgba(139, 92, 246, 0.15);
	}

	.mandala-card.reference {
		opacity: 0.6;
	}

	.mandala-card:hover {
		border-color: rgba(167, 139, 250, 0.15);
	}

	.mandala-frame :global(svg) {
		width: 100%;
		height: 100%;
	}

	.card-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		opacity: 0.5;
		font-weight: 600;
	}

	.current-label {
		color: #a78bfa;
		opacity: 1;
	}

	.center-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 60vh;
		opacity: 0.4;
		text-align: center;
	}

	.center-state.error {
		opacity: 1;
		color: #f87171;
	}
</style>
