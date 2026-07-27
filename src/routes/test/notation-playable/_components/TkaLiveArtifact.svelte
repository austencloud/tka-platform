<!--
  Kinetic Alphabet artifact: the real demo sequence playing in the shared
  SequenceHeroDemo (the site's one live-sequence embed), with its pictograph
  word strip. Inactive, a poster of the alphabet's own letter cards holds the
  silhouette so only one heavy renderer is ever mounted across the rail.
-->
<script lang="ts">
	import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
	import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
	import demoJson from "$lib/shared/landing/data/demo-sequence.json";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

	import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

	let { active = false }: { active?: boolean } = $props();

	const demoSequence = demoJson as unknown as SequenceData;

	// The resting poster is the sequence's own mandala — the path both props
	// actually trace. A single letter said nothing about what the alphabet
	// writes; the mandala is the shape of the writing.
	const posterWord = simplifyRepeatedWord(demoSequence.word);
</script>

<div class="tka-artifact">
	{#if active}
		<div class="live">
			<SequenceHeroDemo sequence={demoSequence} note="the demo sequence" />
		</div>
	{:else}
		<div
			class="poster"
			role="img"
			aria-label={`The mandala traced by the sequence ${posterWord}`}
		>
			<div class="mandala-frame">
				<SequenceMandala sequence={demoSequence} size={520} darkMode={true} show="both" />
			</div>
			<span class="poster-sub">
				<span class="tka-font poster-word">{posterWord}</span>
				— the path both props trace
			</span>
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
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		justify-items: center;
		align-content: center;
		gap: 0.6rem;
		padding: clamp(0.5rem, 3cqi, 1.5rem);
		box-sizing: border-box;
	}

	/* The mandala fills the plate: it is the artifact, not a thumbnail. */
	.mandala-frame {
		display: grid;
		place-items: center;
		width: 100%;
		min-height: 0;
	}

	/* SequenceMandala sizes its container with an inline px width/height from
	   its `size` prop; the inner SVG is already 100%/100%, so overriding the
	   box (and only the box) lets the artwork scale to whatever plate it is
	   in. !important is required to beat the inline style. */
	.mandala-frame :global(.mandala-container) {
		width: min(100%, 92cqh) !important;
		height: auto !important;
		aspect-ratio: 1;
		filter: drop-shadow(0 0 26px oklch(0.6 0.18 305 / 0.3));
	}

	.poster-word {
		font-size: 1.15em;
		color: oklch(0.88 0.08 305);
	}

	.poster-sub {
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		font-size: clamp(0.7rem, 2.2cqi, 0.95rem);
		font-style: italic;
		color: oklch(0.66 0.03 270);
	}
</style>
