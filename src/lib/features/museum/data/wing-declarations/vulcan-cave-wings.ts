import type { WingDeclaration } from "./types";

/**
 * The six Vulcan Cave wings, in walk order. Content transcribed from the
 * approved Phase 0 canon sheet
 * (docs/superpowers/specs/2026-08-11-museum-wings-phase0-canon.md); station
 * refs bind to vulcan-cave-floor-plan performer refIds; sequence keys to
 * museum-exhibit-sequences; catalog ids to static/data/hero/tnd-base-words.json.
 * Stamps and non-Water review copy are first-draft clinical text pending a
 * museum-writer pass. Opener stations and payoff viewpoints are pending
 * placement until each wing's Gate 1 board.
 */
export const VULCAN_CAVE_WINGS: readonly WingDeclaration[] = [
	{
		wingId: "split-same",
		era: "vulcan-cave",
		roomId: "cave-water",
		mode: {
			category: "SS",
			label: "SPLIT-SAME",
			technicalMode: "Split-time / same-direction",
		},
		teachingSentence:
			"Two hands share one path, half a cycle apart — each hand is the other's echo.",
		uniqueObservable:
			"The echo made visible: the still pool doubles every figure, and a reflection is exactly what split-same is in time — the same shape, displaced.",
		barrier: {
			kind: "still-water",
			expression:
				"Still water. Cases sit across the pool; the surface doubles every figure.",
		},
		beats: [
			{ kind: "threshold", stamp: "Catalogue Wing I — SPLIT-SAME" },
			{
				kind: "opener",
				catalogId: "tnd-split-same-aaaa",
				sequenceKey: "cave-water-seq-a",
				stationRef: "cave-water-opener",
			},
			{
				kind: "cases",
				cases: [
					{
						word: "AAAA",
						catalogId: "tnd-split-same-aaaa",
						sequenceKey: "cave-water-seq-a",
						showcaseStationRef: "cave-water-a",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "BBBB",
						catalogId: "tnd-split-same-bbbb",
						sequenceKey: "cave-water-seq-b",
						showcaseStationRef: "cave-water-b",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "CCCC",
						catalogId: "tnd-split-same-cccc",
						sequenceKey: "cave-water-seq-c",
						showcaseStationRef: "cave-water-c",
						triptych: { screen: true, cardSign: true },
					},
				],
			},
			{
				kind: "payoff",
				viewpointRef: "cave-water-parapet",
				visibleCases: ["AAAA", "BBBB", "CCCC"],
				description: "A, B and C doubled in the pool from the parapet.",
			},
			{
				kind: "exit",
				toWingId: "split-opp",
				handoff: "The last surface steams; heat shimmer leads into Fire.",
			},
		],
		signatureProgram: {
			id: "water-dive-passage",
			description:
				"The dive-through passage arriving at the mirror-pool parapet.",
		},
		review: {
			accentColor: "#38bdf8",
			loadingTitle: "Flooding the gallery",
			loadingSubtitle: "Loading the Blender graybox",
			locationLabels: [
				{ label: "Flooded approach", whenZAbove: 22 },
				{ label: "Descent shaft", whenZAbove: 17 },
				{ label: "The drowned gallery", whenZAbove: -2 },
				{ label: "Surfacing stair", whenZAbove: -12 },
				{ label: "Grotto ring", whenZAbove: -24 },
				{ label: "Fire threshold" },
			],
		},
	},
	{
		wingId: "split-opp",
		era: "vulcan-cave",
		roomId: "cave-fire",
		mode: {
			category: "SO",
			label: "SPLIT-OPPOSITE",
			technicalMode: "Split-time / opposite-direction",
		},
		teachingSentence:
			"Two hands a half-cycle apart, arcing opposite ways — never together in time, never together in direction: pure alternation.",
		uniqueObservable:
			"Alternation as light — when one is up the other is down, like flames trading.",
		barrier: {
			kind: "heat",
			expression: "Heat and shrine gates between the visitor and the courts.",
		},
		beats: [
			{ kind: "threshold", stamp: "Catalogue Wing II — SPLIT-OPPOSITE" },
			{
				kind: "opener",
				catalogId: "tnd-split-opp-jdjd",
				sequenceKey: "cave-fire-seq-dj",
				stationRef: "cave-fire-opener",
			},
			{
				kind: "cases",
				cases: [
					{
						word: "JDJD",
						catalogId: "tnd-split-opp-jdjd",
						sequenceKey: "cave-fire-seq-dj",
						showcaseStationRef: "cave-fire-automaton-dj",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "KEKE",
						catalogId: "tnd-split-opp-keke",
						sequenceKey: "cave-fire-seq-ek",
						showcaseStationRef: "cave-fire-automaton-ek",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "LFLF",
						catalogId: "tnd-split-opp-lflf",
						sequenceKey: "cave-fire-seq-fl",
						showcaseStationRef: "cave-fire-automaton-fl",
						triptych: { screen: true, cardSign: true },
					},
				],
			},
			{
				kind: "payoff",
				viewpointRef: "cave-fire-payoff",
				visibleCases: ["LFLF"],
				description:
					"The last lit shrine seen across the dark of the extinguished ones.",
			},
			{
				kind: "exit",
				toWingId: "tog-same",
				handoff:
					"Extinction, then green growth circling the cold trench into Earth.",
			},
		],
		signatureProgram: {
			id: "first-fire-procession",
			description:
				"The darkening procession — each shrine's flames self-extinguish as the next ignites, ending in total extinction.",
		},
		review: {
			accentColor: "#fb923c",
			loadingTitle: "Raking the coals",
			loadingSubtitle: "Loading the Blender graybox",
			locationLabels: [{ label: "The First Fire" }],
		},
	},
	{
		wingId: "tog-same",
		era: "vulcan-cave",
		roomId: "cave-earth",
		mode: {
			category: "TS",
			label: "TOGETHER-SAME",
			technicalMode: "Together-time / same-direction",
		},
		teachingSentence:
			"Two hands in sync, arcing the same way — unison: two hands, one motion.",
		uniqueObservable:
			"From above, unison reads as a single shape — the overlook is the pedagogy.",
		barrier: {
			kind: "elevation",
			expression: "Elevation: the terrace climb above the cases.",
		},
		beats: [
			{ kind: "threshold", stamp: "Catalogue Wing III — TOGETHER-SAME" },
			{
				kind: "opener",
				catalogId: "tnd-tog-same-gggg",
				sequenceKey: "cave-earth-seq-g",
				stationRef: "cave-earth-opener",
			},
			{
				kind: "cases",
				cases: [
					{
						word: "GGGG",
						catalogId: "tnd-tog-same-gggg",
						sequenceKey: "cave-earth-seq-g",
						showcaseStationRef: "cave-earth-automaton-g",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "HHHH",
						catalogId: "tnd-tog-same-hhhh",
						sequenceKey: "cave-earth-seq-h",
						showcaseStationRef: "cave-earth-automaton-h",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "IIII",
						catalogId: "tnd-tog-same-iiii",
						sequenceKey: "cave-earth-seq-i",
						showcaseStationRef: "cave-earth-automaton-i",
						triptych: { screen: true, cardSign: true },
					},
				],
			},
			{
				kind: "payoff",
				viewpointRef: "cave-earth-overlook",
				visibleCases: ["GGGG", "HHHH", "IIII"],
				description:
					"The final ensemble sightline — three unison figures aligned from the overlook.",
			},
			{
				kind: "exit",
				toWingId: "tog-opp",
				handoff: "Roots thin, the floor falls away, wind.",
			},
		],
		signatureProgram: {
			id: "earth-terrace-climb",
			description: "The terrace climb above the cases.",
		},
		review: {
			accentColor: "#a3e635",
			loadingTitle: "Raising the terraces",
			loadingSubtitle: "Loading the Blender graybox",
			locationLabels: [{ label: "The Earth terraces" }],
		},
	},
	{
		wingId: "tog-opp",
		era: "vulcan-cave",
		roomId: "cave-air",
		mode: {
			category: "TO",
			label: "TOGETHER-OPPOSITE",
			technicalMode: "Together-time / opposite-direction",
		},
		teachingSentence:
			"Two hands in sync, arcing opposite ways — mirror symmetry in space, moving as one moment.",
		uniqueObservable: "The mirror axis — the room and the motion share it.",
		barrier: {
			kind: "void",
			expression: "A void crossed on mirrored bridges.",
		},
		beats: [
			{ kind: "threshold", stamp: "Catalogue Wing IV — TOGETHER-OPPOSITE" },
			{
				kind: "opener",
				catalogId: "tnd-tog-opp-djdj",
				sequenceKey: "cave-air-seq-dj",
				stationRef: "cave-air-opener",
			},
			{
				kind: "cases",
				cases: [
					{
						word: "DJDJ",
						catalogId: "tnd-tog-opp-djdj",
						sequenceKey: "cave-air-seq-dj",
						showcaseStationRef: "cave-air-automaton-dj",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "EKEK",
						catalogId: "tnd-tog-opp-ekek",
						sequenceKey: "cave-air-seq-ek",
						showcaseStationRef: "cave-air-automaton-ek",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "FLFL",
						catalogId: "tnd-tog-opp-flfl",
						sequenceKey: "cave-air-seq-fl",
						showcaseStationRef: "cave-air-automaton-fl",
						triptych: { screen: true, cardSign: true },
					},
				],
			},
			{
				kind: "payoff",
				viewpointRef: "cave-air-rejoin",
				visibleCases: ["DJDJ", "EKEK", "FLFL"],
				description:
					"From the rejoin point, both bridges and all cases in one mirrored view.",
			},
			{
				kind: "exit",
				toWingId: "quarter-same",
				handoff: "The void brightens; the first shaft of light.",
			},
		],
		signatureProgram: {
			id: "air-twin-crossing",
			description:
				"The twin crossing — the path splits into two mirrored bridges around the central void and rejoins; the visitor's own route performs together-opposite.",
		},
		review: {
			accentColor: "#e2e8f0",
			loadingTitle: "Spanning the void",
			loadingSubtitle: "Loading the Blender graybox",
			locationLabels: [{ label: "The Air crossing" }],
		},
	},
	{
		wingId: "quarter-same",
		era: "vulcan-cave",
		roomId: "cave-sun",
		mode: {
			category: "QS",
			label: "QUARTER-SAME",
			technicalMode: "Quarter-time / same-direction",
		},
		teachingSentence:
			"Two hands a quarter-cycle apart, arcing the same way — a chase that never closes.",
		uniqueObservable:
			"Four-fold rotational symmetry — four letters, four quarters.",
		barrier: {
			kind: "light-shaft",
			expression: "The central light shaft/atrium the path must ring.",
		},
		beats: [
			{ kind: "threshold", stamp: "Catalogue Wing V — QUARTER-SAME" },
			{
				kind: "opener",
				catalogId: "tnd-quarter-same-ssss",
				sequenceKey: "cave-sun-seq-s",
				stationRef: "cave-sun-opener",
			},
			{
				kind: "cases",
				cases: [
					{
						word: "SSSS",
						catalogId: "tnd-quarter-same-ssss",
						sequenceKey: "cave-sun-seq-s",
						showcaseStationRef: "cave-sun-automaton-s",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "TTTT",
						catalogId: "tnd-quarter-same-tttt",
						sequenceKey: "cave-sun-seq-t",
						showcaseStationRef: "cave-sun-automaton-t",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "UUUU",
						catalogId: "tnd-quarter-same-uuuu",
						sequenceKey: "cave-sun-seq-u",
						showcaseStationRef: "cave-sun-automaton-u",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "VVVV",
						catalogId: "tnd-quarter-same-vvvv",
						sequenceKey: "cave-sun-seq-v",
						showcaseStationRef: "cave-sun-automaton-v",
						triptych: { screen: true, cardSign: true },
					},
				],
			},
			{
				kind: "payoff",
				viewpointRef: "cave-sun-fourth-landing",
				visibleCases: ["SSSS", "TTTT", "UUUU", "VVVV"],
				description:
					"From the fourth landing, all four cases around the lit mandala.",
			},
			{
				kind: "exit",
				toWingId: "quarter-opp",
				handoff: "Noon dims to silver night.",
			},
		],
		signatureProgram: {
			id: "sun-quarter-circuit",
			description:
				"The quarter circuit — the path rings the shaft in four quarter-turn landings, one case per quarter, the mandala floor below.",
		},
		review: {
			accentColor: "#fbbf24",
			loadingTitle: "Angling the light shaft",
			loadingSubtitle: "Loading the Blender graybox",
			locationLabels: [{ label: "The Sun atrium" }],
		},
	},
	{
		wingId: "quarter-opp",
		era: "vulcan-cave",
		roomId: "cave-moon",
		mode: {
			category: "QO",
			label: "QUARTER-OPPOSITE",
			technicalMode: "Quarter-time / opposite-direction",
		},
		teachingSentence:
			"A quarter-cycle apart, arcing opposite ways — the waxing and waning relationship.",
		uniqueObservable: "Phases: quarter offsets are what moon phases are.",
		barrier: {
			kind: "sealed-glass",
			expression:
				"Sealed observation glass — no air out there; the regolith plain becomes the diorama.",
		},
		beats: [
			{ kind: "threshold", stamp: "Catalogue Wing VI — QUARTER-OPPOSITE" },
			{
				kind: "opener",
				catalogId: "tnd-quarter-opp-mpmp",
				sequenceKey: "cave-moon-seq-mp",
				stationRef: "cave-moon-opener",
			},
			{
				kind: "cases",
				cases: [
					{
						word: "MPMP",
						catalogId: "tnd-quarter-opp-mpmp",
						sequenceKey: "cave-moon-seq-mp",
						showcaseStationRef: "cave-moon-automaton-mp",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "NQNQ",
						catalogId: "tnd-quarter-opp-nqnq",
						sequenceKey: "cave-moon-seq-nq",
						showcaseStationRef: "cave-moon-automaton-nq",
						triptych: { screen: true, cardSign: true },
					},
					{
						word: "OROR",
						catalogId: "tnd-quarter-opp-oror",
						sequenceKey: "cave-moon-seq-or",
						showcaseStationRef: "cave-moon-automaton-or",
						triptych: { screen: true, cardSign: true },
					},
				],
			},
			{
				kind: "payoff",
				viewpointRef: "cave-moon-full-window",
				visibleCases: ["MPMP", "NQNQ", "OROR"],
				description:
					"The full window — all three performers on the plain at once.",
			},
			{
				kind: "exit",
				toWingId: null,
				handoff: "Dawn — first warm desert light into the Egypt threshold.",
			},
		],
		signatureProgram: {
			id: "moon-observatory-gallery",
			description:
				"The observatory gallery — a sealed window traverse where the plain reveals in phase-lit segments, waxing to the full view.",
		},
		review: {
			accentColor: "#c4b5fd",
			loadingTitle: "Sealing the observatory glass",
			loadingSubtitle: "Loading the Blender graybox",
			locationLabels: [{ label: "The Moon gallery" }],
		},
	},
];
