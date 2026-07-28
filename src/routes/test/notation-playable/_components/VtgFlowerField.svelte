<!--
  Vulcan Tech Gospel artifact: the flowers, in a given timing and direction.

  The catalog's sourced record is "the flower patterns available within a given
  timing and direction, and how to move between them" — Yee's own two goals. So
  the artifact is not a shelf of category glyphs; it is the PATTERNS, with
  timing and direction as the axis you move along.

  The six real VTG glyphs (static/images/vtg_glyphs/) become the axis control.
  For whichever timing/direction is current, the stage shows the four spin-style
  pairings that timing and direction can trace — prospin and antispin against
  each other on two hands — each painted as a real light trail.

  Nothing here is invented. The six modes are the repo's own `MODE_ORDER` /
  `MODE_LABEL`; each cell's geometry comes from that mode's canonical base word
  (`resolveBase`, the l1-tnd-motions words) with the cell's turns applied.
  Because each mode resolves a different base word anchored its own way, every
  position on the axis draws a different picture — see `cellSrc` for why the
  parity corrector is deliberately not used here.

  What it is NOT: a reproduction of Yee's book, and no claim about which
  named shape ("isolation", "extension") a given cell is. These are TKA's own
  flowers showing the SHAPE of the work — variety within one timing and
  direction — and the entry's sources point to his site.

  Base words load from the static JSON the landing hero uses, not Firestore, so
  the tile needs no auth (`shape-matrix-hero-pool.ts` precedent).
-->
<script lang="ts">
	import { onMount } from "svelte";
	import { MediaQuery } from "svelte/reactivity";
	import { calculate as calculateMandalaGeometry } from "$lib/shared/mandala/services/mandala-geometry-calculator";
	import { getTipPoints } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
	import {
		loadDiamondEdges,
		type CsvEdge,
	} from "$lib/features/choreo-card/services/pictograph-letter-lookup";
	import { hydrateSequence } from "$lib/features/choreo-card/services/sequence-render-hydrator";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
	import {
		buildBaseIndex,
		resolveBase,
	} from "$lib/shared/shape-matrix/services/tnd-base-index";
	import { applyVariationDescriptor } from "$lib/features/choreo-card/services/deck-variation";
	import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
	import {
		MODE_ORDER,
		MODE_LABEL,
		type VtgMode,
	} from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
	import {
		flowerTurnPattern,
		type Flower,
		type FlowerStyle,
	} from "$lib/shared/shape-matrix/domain/flower-signature";
	import { renderPoiCell } from "$lib/shared/shape-matrix/services/shape-matrix-poi-render";

	let { active = false }: { active?: boolean } = $props();

	const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");

	/** The four spin-style pairings two hands can hold at one ratio. */
	const PAIRS: ReadonlyArray<{ blue: FlowerStyle; red: FlowerStyle }> = [
		{ blue: "pro", red: "pro" },
		{ blue: "pro", red: "anti" },
		{ blue: "anti", red: "pro" },
		{ blue: "anti", red: "anti" },
	];

	/**
	 * One turn per hand: prospin traces two petals, antispin four — the reading
	 * most legible at tile scale, and the pair that makes the two styles tell
	 * themselves apart at a glance.
	 */
	const TURNS = 1;

	const STYLE_WORD: Record<FlowerStyle, string> = { pro: "prospin", anti: "antispin" };

	function flowerOf(style: FlowerStyle): Flower {
		return {
			style,
			turns: TURNS,
			ori: "in",
			grid: "diamond",
			petals: style === "pro" ? 2 * TURNS : 2 * TURNS + 2,
		};
	}

	const BASE_WORDS_URL = "/data/hero/tnd-base-words.json";
	const CELL_PX = 260;

	interface Loaded {
		idx: Map<string, SequenceData>;
		edges: CsvEdge[];
		clubTipDx: number;
	}

	let loaded = $state<Loaded | null>(null);
	let modeIndex = $state(0);
	const mode = $derived(MODE_ORDER[modeIndex] ?? MODE_ORDER[0]!);

	onMount(async () => {
		try {
			const [wordsRaw, edges] = await Promise.all([
				fetch(BASE_WORDS_URL).then((r) => {
					if (!r.ok) throw new Error(`base words ${r.status}`);
					return r.json() as Promise<Record<string, unknown>[]>;
				}),
				loadDiamondEdges(),
			]);
			loaded = {
				idx: buildBaseIndex(wordsRaw.map((w) => hydrateSequence(w))),
				edges,
				clubTipDx: getTipPoints("club").points[0]?.dx ?? 130,
			};
		} catch {
			loaded = null;
		}
	});

	// Each mode's four cells are built once, on demand, and kept.
	const cache = new Map<string, string | null>();

	/**
	 * The mode's base word, with this cell's turns and orientation applied, as a
	 * light trail.
	 *
	 * Deliberately NOT parity-corrected. `verifyAndCorrect` searches the start
	 * orientations that make a realization reproduce the canonical single-hand
	 * locus — right for the shape-matrix drill, where the cell IS the flower
	 * pair and the modes are alternative ways to reach it, but it re-anchors
	 * both hands onto one centred locus and so erases exactly what this axis is
	 * about. Measured: with correction on, Split·Same and Together·Same drew
	 * pixel-identical cells. Each base word's own anchoring is the picture.
	 */
	function cellSrc(m: VtgMode, pair: { blue: FlowerStyle; red: FlowerStyle }): string | null {
		const key = `${m}|${pair.blue}|${pair.red}`;
		if (cache.has(key)) return cache.get(key)!;
		let url: string | null = null;
		try {
			const data = loaded!;
			const blue = flowerOf(pair.blue);
			const red = flowerOf(pair.red);
			const base = resolveBase(data.idx, m, pair.blue, pair.red);
			if (base) {
				const { sequence } = applyVariationDescriptor(
					base,
					{
						turnPattern: `${flowerTurnPattern(blue).split("|")[0]}|${flowerTurnPattern(red).split("|")[0]}`,
						gridMode: blue.grid,
						startOriPair: { blue: Orientation.IN, red: Orientation.IN },
					},
					data.edges,
				);
				const paths = calculateMandalaGeometry(
					sequence.steps,
					undefined,
					undefined,
					{ tipEnds: 1, pathShape: "arc" },
					{ dx: data.clubTipDx, dy: 0 },
				);
				// The poi painter takes a blue source and a red source; this
				// realization already carries both hands, so it is its own pair.
				// Start markers carry the timing: split puts the two dots at
				// opposite points, together puts them on the same one.
				url = renderPoiCell(paths, paths, CELL_PX, data.clubTipDx, {
					startMarkers: true,
				});
			}
		} catch {
			url = null;
		}
		cache.set(key, url);
		return url;
	}

	// Moving between timings and directions is Yee's second goal, so the axis
	// travels on its own while the tile is live.
	$effect(() => {
		if (!active || reduceMotion.current) return;
		const timer = setInterval(() => {
			modeIndex = (modeIndex + 1) % MODE_ORDER.length;
		}, 3200);
		return () => clearInterval(timer);
	});
</script>

<div class="vtg-field">
	<div
		class="stage"
		class:lit={active}
		role="img"
		aria-label={loaded
			? `The four spin-style pairings available in ${MODE_LABEL[mode]} timing and direction, drawn as light trails`
			: "Vulcan Tech Gospel flower patterns, loading"}
	>
		{#if loaded}
			{#key mode}
				<div class="cells">
					{#each PAIRS as pair (`${pair.blue}-${pair.red}`)}
						{@const src = cellSrc(mode, pair)}
						<figure class="cell">
							{#if src}
								<img src={src} alt="" decoding="async" />
							{:else}
								<div class="cell-missing"></div>
							{/if}
							<figcaption>{STYLE_WORD[pair.blue]} · {STYLE_WORD[pair.red]}</figcaption>
						</figure>
					{/each}
				</div>
			{/key}
		{/if}
	</div>

	<!-- The real glyphs, demoted from the exhibit to the axis they label. -->
	<div class="axis">
		{#each MODE_ORDER as m, i (m)}
			<div class="glyph" class:lit={m === mode}>
				<img src={`/images/vtg_glyphs/${m}.svg`} alt="" loading={i < 2 ? "eager" : "lazy"} />
			</div>
		{/each}
	</div>
	<p class="axis-label">{MODE_LABEL[mode]}</p>
</div>

<style>
	.vtg-field {
		width: 100%;
		height: 100%;
		max-height: 100%;
		overflow: hidden;
		display: grid;
		/* Definite column track: the stage sizes off `min(100%, Ncqh)`, which has
		   no percentage basis against an `auto` track and would grow to the cqh
		   arm, spilling the tile (the 325px overflow class of bug). */
		grid-template-columns: minmax(0, 1fr);
		/* All three rows hug their content and the group centres as a unit. A
		   `1fr` stage row instead absorbs every spare pixel of a tall tile and
		   strands the axis at the bottom, ~180px below the artwork. */
		grid-template-rows: auto auto auto;
		justify-items: center;
		align-content: center;
		gap: clamp(0.4rem, 1.6cqi, 0.9rem);
		padding: clamp(0.6rem, 3cqi, 1.6rem);
		box-sizing: border-box;
	}

	.stage {
		display: grid;
		place-items: center;
		/* 62cqh, not 74: the axis and its label share the column, and without
		   the reservation a short stage (fold landscape) pushes the square out
		   of the tile. `border-box` so `aspect-ratio` squares the padded box
		   rather than the content box, which made it 25px taller than wide. */
		box-sizing: border-box;
		width: min(100%, 62cqh);
		max-width: 100%;
		aspect-ratio: 1;
		padding: clamp(0.3rem, 1.6cqi, 0.9rem);
		border-radius: 14px;
		background: oklch(0.14 0.02 40 / 0.6);
		border: 1px solid oklch(0.72 0.13 40 / 0.26);
		box-shadow: 0 0 40px oklch(0.72 0.14 40 / 0.1);
		transition:
			border-color 400ms ease,
			box-shadow 400ms ease;
	}

	.stage.lit {
		border-color: oklch(0.78 0.15 40 / 0.5);
		box-shadow: 0 0 60px oklch(0.78 0.16 40 / 0.18);
	}

	.cells {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		width: 100%;
		gap: clamp(0.2rem, 1.4cqi, 0.6rem);
		animation: settle 520ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	@keyframes settle {
		from {
			opacity: 0;
			transform: scale(0.965);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.cell {
		margin: 0;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		gap: 0.2rem;
		min-width: 0;
	}

	.cell img,
	.cell-missing {
		width: 100%;
		aspect-ratio: 1;
		display: block;
		border-radius: 8px;
	}

	.cell-missing {
		background: oklch(0.1 0 0 / 0.6);
	}

	.cell figcaption {
		font-size: clamp(0.42rem, 1.5cqi, 0.72rem);
		letter-spacing: 0.06em;
		text-transform: lowercase;
		text-align: center;
		color: oklch(0.68 0.03 60);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* The glyphs label the axis; they must never outshout the patterns they
	   index. Sized off a per-glyph cap, not off the stage width — six cells of
	   `1fr` across a 555px hero made them read as a segmented control. */
	.axis {
		display: flex;
		justify-content: center;
		gap: clamp(0.15rem, 0.9cqi, 0.4rem);
	}

	.glyph {
		display: grid;
		place-items: center;
		width: clamp(1.3rem, 7cqi, 3.1rem);
		aspect-ratio: 1;
		border-radius: 6px;
		background: oklch(0.98 0 0 / 0.52);
		opacity: 0.42;
		transition:
			opacity 320ms ease,
			background-color 320ms ease,
			box-shadow 320ms ease;
	}

	.glyph img {
		width: 78%;
		height: 78%;
		object-fit: contain;
	}

	.glyph.lit {
		opacity: 1;
		background: oklch(0.98 0 0 / 0.94);
		box-shadow: 0 0 0 1.5px oklch(0.76 0.16 40 / 0.8);
	}

	.axis-label {
		margin: 0;
		font-size: clamp(0.5rem, 2.1cqi, 0.95rem);
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: oklch(0.8 0.06 60);
		/* The six labels differ in width; reserving the widest stops the axis
		   from shifting sideways as the mode travels. */
		min-width: 14ch;
		text-align: center;
	}

	/* Narrow stage: four cells across ~150px put the style captions under 8px,
	   where they read as texture rather than words. The patterns and the axis
	   label carry it alone. */
	@container (max-width: 360px) {
		.cell figcaption {
			display: none;
		}
		.axis-label {
			font-size: 0.7rem;
			letter-spacing: 0.08em;
		}
	}

	/* Short stage: the patterns are the artifact; the text rows stand down and
	   the square takes the room they freed, rather than spilling the tile. */
	@container (max-height: 300px) {
		.cell figcaption,
		.axis-label {
			display: none;
		}
		.stage {
			width: min(100%, 70cqh);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stage,
		.glyph {
			transition: none;
		}
		.cells {
			animation: none;
		}
	}
</style>
