<!--
  Vulcan Tech Gospel artifact: a compact field of the real VTG glyph SVGs that
  ship in static/images/vtg_glyphs/. When active, the focus drifts across the
  field on an interval — the glyphs themselves are untouched, and no invented
  reduction or category system is drawn. Reduced motion holds the field still.
-->
<script lang="ts">
	import { MediaQuery } from "svelte/reactivity";

	let { active = false }: { active?: boolean } = $props();

	const GLYPHS = ["SS", "SO", "TS", "TO", "QS", "QO"];
	const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");

	let lit = $state(0);

	$effect(() => {
		if (!active || reduceMotion.current) return;
		const timer = setInterval(() => {
			lit = (lit + 1) % GLYPHS.length;
		}, 1500);
		return () => clearInterval(timer);
	});
</script>

<div class="vtg-field" role="img" aria-label="Six Vulcan Tech Gospel timing and direction glyphs">
	{#each GLYPHS as glyph, i (glyph)}
		<div class="glyph" class:lit={active && i === lit}>
			<img src={`/images/vtg_glyphs/${glyph}.svg`} alt="" loading="lazy" />
		</div>
	{/each}
</div>

<style>
	.vtg-field {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-content: center;
		gap: clamp(0.5rem, 2.5cqi, 1.2rem);
		padding: clamp(0.8rem, 4cqi, 2rem);
	}

	.glyph {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border-radius: 14px;
		background: oklch(0.98 0 0 / 0.92);
		border: 1px solid oklch(0.7 0.1 40 / 0.25);
		transition:
			transform 320ms cubic-bezier(0.34, 1.4, 0.44, 1),
			box-shadow 320ms ease;
	}

	.glyph img {
		width: 78%;
		height: 78%;
		object-fit: contain;
	}

	.glyph.lit {
		transform: translateY(-5%) scale(1.06);
		box-shadow:
			0 10px 26px oklch(0 0 0 / 0.35),
			0 0 0 2px oklch(0.72 0.16 40 / 0.7);
	}

	@media (prefers-reduced-motion: reduce) {
		.glyph {
			transition: none;
		}
		.glyph.lit {
			transform: none;
		}
	}
</style>
