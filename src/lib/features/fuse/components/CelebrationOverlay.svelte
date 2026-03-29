<!--
  CelebrationOverlay.svelte

  Canvas-based particle burst that radiates orange/amber particles from a
  center point. 800ms duration, 40-60 particles with velocity, gravity, and
  fade. Skips entirely when prefers-reduced-motion is enabled.
-->
<script lang="ts">
	import { onMount } from "svelte";

	let {
		centerX,
		centerY,
		onComplete,
	}: {
		centerX: number;
		centerY: number;
		onComplete: () => void;
	} = $props();

	let canvasEl: HTMLCanvasElement;

	interface Particle {
		x: number;
		y: number;
		vx: number;
		vy: number;
		radius: number;
		alpha: number;
		color: string;
	}

	const DURATION = 800;
	const PARTICLE_COUNT_MIN = 40;
	const PARTICLE_COUNT_MAX = 60;
	const GRAVITY = 120; // pixels/sec^2

	const COLORS = [
		"#fb923c", // orange-400
		"#f97316", // orange-500
		"#ea580c", // orange-600
		"#fbbf24", // amber-400
		"#f59e0b", // amber-500
		"#d97706", // amber-600
	];

	function randomRange(min: number, max: number): number {
		return min + Math.random() * (max - min);
	}

	function createParticles(): Particle[] {
		const count = Math.floor(randomRange(PARTICLE_COUNT_MIN, PARTICLE_COUNT_MAX));
		const particles: Particle[] = [];

		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = randomRange(80, 280);

			particles.push({
				x: centerX,
				y: centerY,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				radius: randomRange(2, 5),
				alpha: 1,
				color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#fb923c",
			});
		}

		return particles;
	}

	onMount(() => {
		// Skip animation entirely for reduced motion
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			onComplete();
			return;
		}

		const ctx = canvasEl.getContext("2d");
		if (!ctx) {
			onComplete();
			return;
		}

		// Size canvas to parent
		const rect = canvasEl.parentElement?.getBoundingClientRect();
		if (rect) {
			canvasEl.width = rect.width;
			canvasEl.height = rect.height;
		}

		const particles = createParticles();
		const startTime = performance.now();
		let frameId: number;

		function tick(now: number) {
			const elapsed = now - startTime;
			if (elapsed >= DURATION) {
				cancelAnimationFrame(frameId);
				onComplete();
				return;
			}

			const dt = 1 / 60; // approximate frame duration in seconds
			const progress = elapsed / DURATION;
			// Fade out over the second half
			const globalAlpha = progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2;

			ctx!.clearRect(0, 0, canvasEl.width, canvasEl.height);

			for (const p of particles) {
				// Physics update
				p.x += p.vx * dt;
				p.vy += GRAVITY * dt;
				p.y += p.vy * dt;
				p.alpha = Math.max(0, globalAlpha);

				// Draw
				ctx!.beginPath();
				ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
				ctx!.fillStyle = p.color;
				ctx!.globalAlpha = p.alpha;
				ctx!.fill();
			}

			ctx!.globalAlpha = 1;
			frameId = requestAnimationFrame(tick);
		}

		frameId = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(frameId);
	});
</script>

<canvas
	bind:this={canvasEl}
	class="celebration-canvas"
	aria-hidden="true"
></canvas>

<style>
	.celebration-canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 10;
	}
</style>
