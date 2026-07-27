<!--
  Kinetic Alphabet artifact: the real demo sequence playing in the shared
  SequenceHeroDemo (the site's one live-sequence embed), with its pictograph
  word strip. Inactive, a poster of the alphabet's own letter cards holds the
  silhouette so only one heavy renderer is ever mounted across the rail.
-->
<script lang="ts">
	import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
	import demoJson from "$lib/shared/landing/data/demo-sequence.json";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

	let { active = false }: { active?: boolean } = $props();

	const demoSequence = demoJson as unknown as SequenceData;

	// The alphabet's own published letter cards, as the resting word strip.
	const POSTER_LETTERS = ["a", "b", "c", "d"];
</script>

<div class="tka-artifact">
	{#if active}
		<div class="live">
			<SequenceHeroDemo sequence={demoSequence} note="the demo sequence" />
		</div>
	{:else}
		<div class="poster" role="img" aria-label="Kinetic Alphabet letter cards">
			{#each POSTER_LETTERS as letter (letter)}
				<img
					src={`/notation/letters/kinetic-alphabet-letter-${letter}-small.webp`}
					alt=""
					loading="lazy"
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.tka-artifact {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
	}

	.live {
		width: 100%;
		max-height: 100%;
		display: grid;
		place-items: center;
		/* SequenceHeroDemo caps itself at 26rem; give it the stage. */
		--hero-demo-max-width: min(30rem, 78cqh);
	}

	.live :global(.hero-demo) {
		margin-top: 0;
	}

	.poster {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(0.5rem, 2cqi, 1rem);
		width: min(76%, 26rem);
	}

	.poster img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 12px;
		border: 1px solid oklch(0.55 0.08 300 / 0.35);
		box-shadow: 0 10px 24px oklch(0 0 0 / 0.4);
	}
</style>
