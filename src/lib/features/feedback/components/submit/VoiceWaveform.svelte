<!-- VoiceWaveform - Real-time audio frequency bar visualization -->
<script lang="ts">
	import { onMount } from "svelte";
	import type { AudioAnalyzer } from "../../services/audio-analyzer";

	const { analyzer } = $props<{
		analyzer: AudioAnalyzer;
	}>();

	let canvas: HTMLCanvasElement | undefined = $state();
	let animationId: number | null = null;
	let accentColor = "#6366f1";
	let canvasWidth = 0;
	let canvasHeight = 0;
	let ctx: CanvasRenderingContext2D | null = null;

	const BAR_COUNT = 32;
	const BAR_GAP = 3;
	const MIN_BAR_HEIGHT = 3;
	const CORNER_RADIUS = 2;

	onMount(() => {
		if (!canvas) return;

		ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Read accent color from theme once on mount
		const style = getComputedStyle(canvas);
		accentColor =
			style.getPropertyValue("--theme-accent-strong").trim() || "#6366f1";

		// Observe size changes for DPI-correct canvas rendering
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry || !canvas || !ctx) return;

			canvasWidth = entry.contentRect.width;
			canvasHeight = entry.contentRect.height;

			const dpr = window.devicePixelRatio || 1;
			canvas.width = Math.round(canvasWidth * dpr);
			canvas.height = Math.round(canvasHeight * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		});

		observer.observe(canvas);
		animationId = requestAnimationFrame(draw);

		return () => {
			observer.disconnect();
			if (animationId !== null) {
				cancelAnimationFrame(animationId);
				animationId = null;
			}
		};
	});

	function draw() {
		if (!ctx || canvasWidth === 0 || canvasHeight === 0) {
			animationId = requestAnimationFrame(draw);
			return;
		}

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		const data = analyzer.getFrequencyData();
		if (data.length === 0) {
			drawBaseline();
			animationId = requestAnimationFrame(draw);
			return;
		}

		const barWidth =
			(canvasWidth - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
		const binSize = Math.max(1, Math.floor(data.length / BAR_COUNT));

		// Compute raw amplitudes from frequency bins
		const amplitudes: number[] = [];
		for (let i = 0; i < BAR_COUNT; i++) {
			let sum = 0;
			for (let j = 0; j < binSize; j++) {
				const idx = i * binSize + j;
				sum += idx < data.length ? data[idx]! : 0;
			}
			amplitudes.push(sum / binSize / 255);
		}

		// Smooth adjacent bars for fluid appearance
		const smoothed = smoothAmplitudes(amplitudes);

		for (let i = 0; i < BAR_COUNT; i++) {
			const amp = smoothed[i]!;
			const maxBarHeight = canvasHeight - 4;
			const barHeight = Math.max(MIN_BAR_HEIGHT, amp * maxBarHeight);
			const x = i * (barWidth + BAR_GAP);
			const y = (canvasHeight - barHeight) / 2;
			const radius = Math.min(CORNER_RADIUS, barWidth / 2);

			ctx.fillStyle = accentColor;
			ctx.globalAlpha = 0.25 + amp * 0.75;
			ctx.beginPath();
			ctx.roundRect(x, y, barWidth, barHeight, radius);
			ctx.fill();
		}

		ctx.globalAlpha = 1;
		animationId = requestAnimationFrame(draw);
	}

	/** Draw minimal baseline bars when analyzer data isn't ready */
	function drawBaseline() {
		if (!ctx) return;
		const barWidth =
			(canvasWidth - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;

		for (let i = 0; i < BAR_COUNT; i++) {
			const x = i * (barWidth + BAR_GAP);
			const y = (canvasHeight - MIN_BAR_HEIGHT) / 2;
			const radius = Math.min(CORNER_RADIUS, barWidth / 2);

			ctx.fillStyle = accentColor;
			ctx.globalAlpha = 0.2;
			ctx.beginPath();
			ctx.roundRect(x, y, barWidth, MIN_BAR_HEIGHT, radius);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	function smoothAmplitudes(raw: number[]): number[] {
		const smoothed: number[] = [];
		for (let i = 0; i < raw.length; i++) {
			const prev = raw[i - 1] ?? raw[i]!;
			const curr = raw[i]!;
			const next = raw[i + 1] ?? raw[i]!;
			smoothed.push((prev + curr * 2 + next) / 4);
		}
		return smoothed;
	}
</script>

<canvas bind:this={canvas} class="waveform-canvas" aria-hidden="true"
></canvas>

<style>
	.waveform-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
