<!--
  Candidate E: the corpus as a wall.

  Rather than pick one representative figure, show that there ISN'T one — every
  plate VTG published, tiled small, with the current one lit. The claim the tile
  makes is "this is a system with a literature," which is the claim the single
  Minimal Beat Shapes plate can't make on its own.
-->
<script lang="ts">
	import { MediaQuery } from "svelte/reactivity";

	let {
		files,
		active = true,
		cols = 4,
	}: { files: string[]; active?: boolean; cols?: number } = $props();

	const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
	let lit = $state(0);

	$effect(() => {
		if (!active || reduceMotion.current) return;
		const timer = setInterval(() => {
			lit = (lit + 1) % files.length;
		}, 900);
		return () => clearInterval(timer);
	});
</script>

<div
	class="wall"
	style={`--cols:${cols}`}
	role="img"
	aria-label="Every plate published in Vulcan Tech Gospel V.1 and Vulcan Tech Gospel #2, tiled."
>
	{#each files as f, n (f)}
		<div class="cell" class:lit={active && n === lit}>
			<img src={`/images/notation/vtg/figures/${f}.webp`} alt="" decoding="async" />
		</div>
	{/each}
</div>

<style>
	.wall {
		width: 100%;
		height: 100%;
		min-height: 0;
		box-sizing: border-box;
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		grid-auto-rows: minmax(0, 1fr);
		gap: clamp(0.2rem, 1cqi, 0.5rem);
		padding: clamp(0.5rem, 2.5cqi, 1.4rem);
	}

	.cell {
		min-width: 0;
		min-height: 0;
		display: grid;
		place-items: center;
		padding: clamp(0.15rem, 0.8cqi, 0.4rem);
		border-radius: 6px;
		background: oklch(0.96 0.008 90 / 0.72);
		border: 1px solid oklch(0.72 0.13 40 / 0.16);
		transition: background-color 400ms ease, border-color 400ms ease,
			box-shadow 400ms ease;
	}

	.cell.lit {
		background: oklch(0.98 0.01 90 / 1);
		border-color: oklch(0.78 0.16 40 / 0.6);
		box-shadow: 0 0 22px oklch(0.78 0.16 40 / 0.28);
	}

	.cell img {
		width: 100%;
		height: 100%;
		min-height: 0;
		object-fit: contain;
		display: block;
	}

	@media (prefers-reduced-motion: reduce) {
		.cell {
			transition: none;
		}
	}
</style>
