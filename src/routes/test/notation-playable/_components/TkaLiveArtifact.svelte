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

	import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

	let { active = false }: { active?: boolean } = $props();

	const demoSequence = demoJson as unknown as SequenceData;

	// The resting poster is the sequence's own word in the TKA letters font —
	// no image assets, so it can't 404 out from under the tile.
	const posterWord = simplifyRepeatedWord(demoSequence.word);
</script>

<div class="tka-artifact">
	{#if active}
		<div class="live">
			<SequenceHeroDemo sequence={demoSequence} note="the demo sequence" />
		</div>
	{:else}
		<div class="poster" role="img" aria-label={`The word ${posterWord}, written in Kinetic Alphabet letters`}>
			<span class="tka-font poster-word">{posterWord}</span>
			<span class="poster-sub">a sequence, read as a word</span>
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
		justify-items: center;
		gap: 0.5rem;
	}

	.poster-word {
		font-size: clamp(2.4rem, 22cqi, 8rem);
		line-height: 1;
		color: oklch(0.9 0.06 305);
		text-shadow: 0 0 26px oklch(0.6 0.18 305 / 0.5);
	}

	.poster-sub {
		font-size: clamp(0.7rem, 2.4cqi, 0.95rem);
		font-style: italic;
		color: oklch(0.66 0.03 270);
	}
</style>
