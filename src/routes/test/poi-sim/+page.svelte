<!--
  Poi Momentum Sim — visual test page (real code, per visualization-routing.md:
  test route rendering real domain modules, not a mockup).

  2D canvas: ghosted intended head path + hand path (what a perfectly taut
  cord would trace), live simulated head + cord (highlighted red when slack).
  Controls drive the same sim/metrics modules the unit tests exercise —
  hand-path-sampler → calibration → poi-sim (Verlet tick loop) → metrics.

  Spec: docs/superpowers/specs/2026-07-18-poi-momentum-simulator-design.md
-->
<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import ParamSlider from "$lib/features/lab/tabs/scene-lab/components/ParamSlider.svelte";
	import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
	import {
		sampleHandPath,
		type PoiHandColor,
		type HandPathSample,
	} from "$lib/features/levels/poi-lab/sim/hand-path-sampler";
	import type { StepLike } from "$lib/shared/mandala/services/types";
	import {
		gridToMeters,
		metersToGrid,
		beatDuration,
		clampBpm,
		clampTetherLength,
		DEFAULT_TETHER_LENGTH_METERS,
		TETHER_LENGTH_RANGE_METERS,
		BPM_RANGE,
		DEFAULT_HAND_RADIUS_METERS,
	} from "$lib/features/levels/poi-lab/sim/calibration";
	import {
		PoiSimDriver,
		type Vec2,
		type PoiSimFrame,
	} from "$lib/features/levels/poi-lab/sim/poi-sim";
	import {
		slackFraction,
		headDeviation,
		evaluatePerformability,
		findMinBpm,
	} from "$lib/features/levels/poi-lab/sim/metrics";

	// ── Hardcoded representative step sequences ─────────────────────────────
	// Motion vocabulary (MotionType.PRO/ANTI/DASH/STATIC, GridLocation "n"/"e"/
	// "s"/"w") is real domain shape (StepLike), not a mockup.
	function step(
		motionType: string,
		rotationDirection: string,
		startLocation: string,
		endLocation: string,
		turns: number = 1
	): StepLike {
		return {
			motions: {
				blue: { motionType, rotationDirection, startLocation, endLocation, turns },
				red: { motionType, rotationDirection, startLocation, endLocation, turns },
			},
		};
	}

	const SEQUENCES: Record<string, { label: string; steps: StepLike[] }> = {
		"static-spin": {
			label: "Static spin",
			steps: [
				step("static", "cw", "n", "n", 1),
				step("static", "cw", "n", "n", 1),
				step("static", "cw", "n", "n", 1),
				step("static", "cw", "n", "n", 1),
			],
		},
		extension: {
			label: "Extension",
			steps: [
				step("pro", "cw", "n", "e", 1),
				step("pro", "cw", "e", "s", 1),
				step("pro", "cw", "s", "w", 1),
				step("pro", "cw", "w", "n", 1),
			],
		},
		"spin-reversal": {
			label: "Spin reversal",
			steps: [
				step("pro", "cw", "n", "e", 1),
				step("anti", "ccw", "e", "n", 1),
				step("pro", "cw", "n", "e", 1),
				step("anti", "ccw", "e", "n", 1),
			],
		},
		dash: {
			label: "Dash",
			steps: [
				step("dash", "cw", "n", "s", 0),
				step("dash", "cw", "s", "n", 0),
				step("dash", "cw", "n", "s", 0),
				step("dash", "cw", "s", "n", 0),
			],
		},
	};

	type SeqKey = keyof typeof SEQUENCES;
	const sequenceOptions = (Object.keys(SEQUENCES) as SeqKey[]).map((k) => ({
		value: k,
		label: SEQUENCES[k].label,
	}));

	// ── Controls ─────────────────────────────────────────────────────────────
	let bpm = $state(120);
	let tetherLength = $state(DEFAULT_TETHER_LENGTH_METERS);
	let sequenceKey = $state<SeqKey>("extension");
	let handColor = $state<PoiHandColor>("blue");
	let isPlaying = $state(true);

	// ── Sampled paths (grid units → meters), recomputed on sequence/hand/tether
	// change — the intended-head tip offset is derived from the (adjustable)
	// tether length slider, not a fixed grid-unit constant, so the ground
	// truth always matches what the cord can actually reach. ──
	const sample = $derived.by<HandPathSample>(() => {
		const tipDxGridUnits = metersToGrid(clampTetherLength(tetherLength), {
			handRadiusMeters: DEFAULT_HAND_RADIUS_METERS,
		});
		return sampleHandPath(SEQUENCES[sequenceKey].steps, handColor, tipDxGridUnits);
	});

	function toMeters(points: readonly Vec2[]): Vec2[] {
		return points.map((p) => ({
			x: gridToMeters(p.x, { handRadiusMeters: DEFAULT_HAND_RADIUS_METERS }),
			y: gridToMeters(p.y, { handRadiusMeters: DEFAULT_HAND_RADIUS_METERS }),
		}));
	}

	const handPathMeters = $derived(toMeters(sample.hand));
	const intendedHeadMeters = $derived(toMeters(sample.intendedHead));
	const durationSeconds = $derived(
		beatDuration(clampBpm(bpm)) * SEQUENCES[sequenceKey].steps.length
	);

	// ── Live driver (recreated whenever the topology changes) ───────────────
	let driver: PoiSimDriver | null = null;
	// $state so `liveMetrics` (a $derived.by reading `frames`) reactively
	// recomputes as frames are pushed during the RAF playback loop — a plain
	// `let` array mutated via .push() never notifies derived values in runes
	// mode, leaving the slack/deviation readout frozen after first render.
	let frames: PoiSimFrame[] = $state([]);
	let simTime = $state(0);
	let liveHand = $state<Vec2>({ x: 0, y: 0 });
	let liveHead = $state<Vec2>({ x: 0, y: 0 });
	let liveTaut = $state(true);

	function sampleAt(path: readonly Vec2[], t: number, span: number): Vec2 {
		const n = path.length;
		if (n === 0) return { x: 0, y: 0 };
		const pathSpan = n - 1;
		const normalized = (t / span) * pathSpan;
		const wrapped = ((normalized % pathSpan) + pathSpan) % pathSpan || 0;
		const lo = Math.floor(wrapped);
		const hi = Math.min(lo + 1, n - 1);
		const frac = wrapped - lo;
		const a = path[lo]!;
		const b = path[hi]!;
		return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
	}

	function resetDriver() {
		frames = [];
		simTime = 0;
		const seedHand = sampleAt(handPathMeters, 0, durationSeconds);
		driver = new PoiSimDriver(seedHand, {
			tetherLength: clampTetherLength(tetherLength),
			substepsPerSecond: 240,
		});
		const p = driver.positions;
		liveHand = seedHand;
		liveHead = { x: p[3]!, y: p[4]! };
		liveTaut = true;
	}

	// Rebuild the driver whenever sequence, hand color, or tether length change
	// (topology), but NOT on every bpm tweak — bpm only rescales playback speed.
	let lastTopo = "";
	$effect(() => {
		const topo = `${sequenceKey}|${handColor}|${tetherLength}`;
		if (topo !== lastTopo) {
			lastTopo = topo;
			resetDriver();
		}
	});

	// ── Playback loop ────────────────────────────────────────────────────────
	let raf = 0;
	let lastNow = 0;
	onMount(() => {
		resetDriver();
		lastNow = performance.now();
		const tick = (now: number) => {
			const dt = (now - lastNow) / 1000;
			lastNow = now;
			if (isPlaying && driver) {
				const span = durationSeconds;
				let remaining = Math.min(dt, 1 / 30); // clamp huge tab-switch gaps
				const substep = driver.dt;
				while (remaining > 0 && driver) {
					const t = simTime + substep;
					const handAt = sampleAt(handPathMeters, t, span);
					const frame = driver.step(handAt);
					frames.push(frame);
					if (frames.length > 4000) frames.shift();
					simTime = frame.t;
					liveHand = frame.hand;
					liveHead = frame.head;
					liveTaut = frame.taut;
					remaining -= substep;
				}
			}
			draw();
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	onDestroy(() => cancelAnimationFrame(raf));

	function togglePlay() {
		isPlaying = !isPlaying;
	}
	function reset() {
		resetDriver();
	}

	// ── Metrics ───────────────────────────────────────────────────────────────
	function intendedHeadAt(t: number): Vec2 {
		return sampleAt(intendedHeadMeters, t, durationSeconds);
	}

	const liveMetrics = $derived.by(() => {
		if (frames.length === 0) return { slack: 0, meanDev: 0, maxDev: 0 };
		const slack = slackFraction(frames);
		const dev = headDeviation(frames, intendedHeadAt);
		return { slack, meanDev: dev.mean, maxDev: dev.max };
	});

	let minBpm = $state<number | null>(null);
	let computingMinBpm = $state(false);

	function computeMinBpm() {
		computingMinBpm = true;
		minBpm = null;
		// Runs headless per candidate BPM using the sampled paths at that BPM's
		// duration — same sim/metrics modules, batch entry point.
		const found = findMinBpm({
			runAtBpm: (candidateBpm) => {
				const span = beatDuration(clampBpm(candidateBpm)) * SEQUENCES[sequenceKey].steps.length;
				const seedHand = sampleAt(handPathMeters, 0, span);
				const testDriver = new PoiSimDriver(seedHand, {
					tetherLength: clampTetherLength(tetherLength),
					substepsPerSecond: 240,
				});
				const testFrames: PoiSimFrame[] = [];
				const substeps = Math.round(span * 240);
				for (let i = 1; i <= substeps; i++) {
					const t = i * testDriver.dt;
					testFrames.push(testDriver.step(sampleAt(handPathMeters, t, span)));
				}
				return evaluatePerformability(testFrames, (tt) => sampleAt(intendedHeadMeters, tt, span))
					.performable;
			},
			range: BPM_RANGE,
		});
		minBpm = found;
		computingMinBpm = false;
	}

	// ── Canvas rendering ──────────────────────────────────────────────────────
	let canvasEl: HTMLCanvasElement | undefined = $state();
	const CANVAS_SIZE = 480;
	const METERS_TO_PX = 160; // fits the 0.5-0.9m tether range comfortably in frame

	function toPx(p: Vec2): { x: number; y: number } {
		return {
			x: CANVAS_SIZE / 2 + p.x * METERS_TO_PX,
			y: CANVAS_SIZE / 2 + p.y * METERS_TO_PX,
		};
	}

	function draw() {
		const ctx = canvasEl?.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

		// Ghosted intended paths (hand faint, intended head fainter-still dashed).
		drawGhostPath(ctx, handPathMeters, "rgba(129, 140, 248, 0.35)", false);
		drawGhostPath(ctx, intendedHeadMeters, "rgba(248, 113, 113, 0.3)", true);

		// Live cord — highlighted when slack.
		const handPx = toPx(liveHand);
		const headPx = toPx(liveHead);
		ctx.beginPath();
		ctx.moveTo(handPx.x, handPx.y);
		ctx.lineTo(headPx.x, headPx.y);
		ctx.strokeStyle = liveTaut ? "rgba(255,255,255,0.85)" : "#facc15";
		ctx.lineWidth = liveTaut ? 2 : 4;
		ctx.stroke();

		// Live hand.
		ctx.beginPath();
		ctx.arc(handPx.x, handPx.y, 6, 0, Math.PI * 2);
		ctx.fillStyle = "#818cf8";
		ctx.fill();

		// Live head.
		ctx.beginPath();
		ctx.arc(headPx.x, headPx.y, 8, 0, Math.PI * 2);
		ctx.fillStyle = "#f87171";
		ctx.fill();
	}

	function drawGhostPath(
		ctx: CanvasRenderingContext2D,
		points: readonly Vec2[],
		color: string,
		dashed: boolean
	) {
		if (points.length < 2) return;
		ctx.save();
		ctx.beginPath();
		ctx.setLineDash(dashed ? [4, 4] : []);
		const first = toPx(points[0]!);
		ctx.moveTo(first.x, first.y);
		for (let i = 1; i < points.length; i++) {
			const p = toPx(points[i]!);
			ctx.lineTo(p.x, p.y);
		}
		ctx.closePath();
		ctx.strokeStyle = color;
		ctx.lineWidth = 1.5;
		ctx.stroke();
		ctx.restore();
	}

	$effect(() => {
		// Redraw immediately when ghost paths change, even while paused.
		void handPathMeters;
		void intendedHeadMeters;
		draw();
	});
</script>

<div class="page">
	<header>
		<h1>Poi Momentum Sim</h1>
		<p class="sub">
			Real Verlet solver (tension-only distance constraint) driven by the
			sampled hand path — the tempo floor emerges from the constraint, not a rule.
		</p>
	</header>

	<div class="body">
		<div class="stage-col">
			<div class="stage">
				<canvas bind:this={canvasEl} width={CANVAS_SIZE} height={CANVAS_SIZE}></canvas>
			</div>
			<div class="transport">
				<button onclick={togglePlay}>{isPlaying ? "Pause" : "Play"}</button>
				<button onclick={reset}>Reset</button>
			</div>
		</div>

		<aside class="controls-col">
			<section class="control-group">
				<span class="group-label">Sequence</span>
				<SegmentedControl
					options={sequenceOptions}
					value={sequenceKey}
					onchange={(v) => (sequenceKey = v)}
					color="accent"
					size="sm"
				/>
			</section>

			<section class="control-group">
				<span class="group-label">Hand</span>
				<SegmentedControl
					options={[
						{ value: "blue", label: "Blue" },
						{ value: "red", label: "Red" },
					]}
					value={handColor}
					onchange={(v) => (handColor = v as PoiHandColor)}
					color={handColor}
					size="sm"
				/>
			</section>

			<section class="control-group">
				<ParamSlider
					label="BPM"
					value={bpm}
					min={BPM_RANGE.min}
					max={BPM_RANGE.max}
					step={1}
					onChange={(v) => (bpm = v)}
				/>
			</section>

			<section class="control-group">
				<ParamSlider
					label="Tether length"
					value={tetherLength}
					min={TETHER_LENGTH_RANGE_METERS.min}
					max={TETHER_LENGTH_RANGE_METERS.max}
					step={0.01}
					unit="m"
					onChange={(v) => (tetherLength = v)}
				/>
			</section>

			<section class="control-group">
				<button class="min-bpm-btn" onclick={computeMinBpm} disabled={computingMinBpm}>
					{computingMinBpm ? "Finding…" : "Find min BPM"}
				</button>
			</section>

			<section class="readout">
				<div class="readout-row">
					<span class="readout-label">Slack fraction</span>
					<span class="readout-value">{(liveMetrics.slack * 100).toFixed(1)}%</span>
				</div>
				<div class="readout-row">
					<span class="readout-label">Max deviation</span>
					<span class="readout-value">{liveMetrics.maxDev.toFixed(3)} m</span>
				</div>
				<div class="readout-row">
					<span class="readout-label">Min BPM</span>
					<span class="readout-value">{minBpm != null ? Math.round(minBpm) : "n/a"}</span>
				</div>
			</section>
		</aside>
	</div>
</div>

<style>
	.page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: radial-gradient(circle at 30% 20%, #14141f 0%, #0a0a0f 70%);
		color: #e8e8f0;
		font-family: system-ui, sans-serif;
		padding: 16px 20px;
	}

	header h1 {
		margin: 0;
		font-size: 1.3rem;
	}
	.sub {
		margin: 4px 0 0;
		opacity: 0.6;
		font-size: 0.82rem;
		max-width: 60ch;
	}

	.body {
		flex: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 300px;
		gap: 20px;
		align-items: start;
	}

	.stage-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.stage {
		width: min(100%, 480px);
		aspect-ratio: 1 / 1;
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: #07070b;
	}

	.stage canvas {
		width: 100%;
		height: 100%;
		display: block;
	}

	.transport {
		display: flex;
		gap: 8px;
	}

	.controls-col {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 14px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		background: rgba(18, 18, 28, 0.55);
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.group-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.55;
	}

	button {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: inherit;
		padding: 8px 14px;
		border-radius: 9px;
		font-size: 0.82rem;
		cursor: pointer;
		min-height: 44px;
	}
	button:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.12);
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.min-bpm-btn {
		width: 100%;
		background: linear-gradient(135deg, #6d5ef0, #b14ddb);
		border-color: transparent;
		color: #fff;
		font-weight: 600;
	}

	.readout {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.readout-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 0.85rem;
	}

	.readout-label {
		opacity: 0.6;
	}

	.readout-value {
		font-variant-numeric: tabular-nums;
		min-width: 6ch;
		text-align: right;
		font-weight: 600;
	}
</style>
