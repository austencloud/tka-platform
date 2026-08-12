# Wing Declarations Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the era-agnostic wing declaration data layer — types, six Vulcan Cave manifests, the grammar validator, the verbatim-canonical-binding CI test — and derive `CAVE_MODE_ROOMS` from it.

**Architecture:** Pure-data manifests (`WingDeclaration`) reference the floor plan, museum sequences, and the TnD catalog by id; a validator cross-checks every reference and re-proves the verbatim catalog binding; `CAVE_MODE_ROOMS` becomes a derived export so the declarations are the single source. No runtime/UI work in this plan — the shared graybox harness and Water slice follow after Water's Gate 1 board.

**Tech Stack:** TypeScript data modules under `src/lib/features/museum/data/wing-declarations/`, vitest unit test in `tests/unit/museum/`.

**Spec:** `docs/superpowers/specs/2026-08-11-wing-declaration-shape-design.md` (approved 2026-08-12, all three recommendations accepted). Sequencing context: parent spec amended rule 2 (Water vertical slice first).

**Project rules that bind every task:** work on `main`, commits use explicit pathspecs (`git commit -m "..." -- <paths>`), never `git add -A`. Never start/kill the dev server. One `svelte-check`/`type-check` per turn, piped to a log.

---

### Task 1: Export the raw sequence shapes from museum-exhibit-sequences

The validator compares museum steps to the catalog field-for-field, which needs the RAW record (pre-conversion), currently module-private.

**Files:**
- Modify: `src/lib/features/museum/data/museum-exhibit-sequences.ts` (interfaces at lines 23–45, `RAW` at line 108, public API at ~line 678)

- [ ] **Step 1: Export the three raw interfaces**

Change lines 23, 33, 42 from `interface RawMotion {` / `interface RawStep {` / `interface RawSequence {` to:

```ts
export interface RawMotion {
```

```ts
export interface RawStep {
```

```ts
export interface RawSequence {
```

- [ ] **Step 2: Add the raw record to the public API**

In the `// ── Public API ──` section (after the `MUSEUM_EXHIBIT_SEQUENCES` export at the end of the file), add:

```ts
/**
 * The verbatim transcriptions, pre-conversion. The wing-declaration validator
 * compares these field-for-field against the l1-tnd-motions catalog
 * (static/data/hero/tnd-base-words.json) — the canonical-binding guard.
 */
export const RAW_MUSEUM_SEQUENCES: Record<string, RawSequence> = RAW;
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(museum): export raw sequence transcriptions for the wing-declaration validator" -- src/lib/features/museum/data/museum-exhibit-sequences.ts
```

---

### Task 2: Wing declaration types

**Files:**
- Create: `src/lib/features/museum/data/wing-declarations/types.ts`

- [ ] **Step 1: Write the types file** (data-only module; no test of its own — the validator test in Task 4 exercises it)

```ts
/**
 * Era-agnostic wing declaration — the manifest the shared graybox review
 * harness consumes. One per wing. Declares the approved Phase 0 canon
 * (teaching sentence, five beats, cases, barrier) plus the sealed elements
 * from 2026-08-11: the choreo-card opener, the case triptych, and the
 * eternal-props ensemble. Future historical wings are new manifests, not
 * new architectures.
 *
 * Spec: docs/superpowers/specs/2026-08-11-wing-declaration-shape-design.md
 */

export type TndCategory = "SS" | "SO" | "TS" | "TO" | "QS" | "QO";

/** Static dual-wield props only — never poi (eternal-props seal). */
export type StaticDualWieldProp = "staff" | "club" | "fan" | "buugeng";

export interface ThresholdBeat {
	kind: "threshold";
	/** The wing stamp/title presented at entry. Clinical Order voice. */
	stamp: string;
}

export interface OpenerBeat {
	kind: "opener";
	/**
	 * SEALED FORM: the wing's choreo card (actual pictographs, unlabeled)
	 * beside a propless avatar performing just that hand path, trail effect
	 * on the tips of the hands.
	 */
	catalogId: string;
	/** museum-exhibit-sequences key backing both the card and the avatar. */
	sequenceKey: string;
	/** Performer station; pending placement until the wing's Gate 1 board. */
	stationRef: string;
}

export interface ExhibitCase {
	/** Expanded letter string, e.g. "AAAA". Display uses simplifyRepeatedWord. */
	word: string;
	/** l1-tnd-motions catalog row id — the variation authority. */
	catalogId: string;
	/** museum-exhibit-sequences key; the validator proves it matches the catalog verbatim. */
	sequenceKey: string;
	/** The one showcase per word — INVIOLABLE (eternal-props rider 2). */
	showcaseStationRef: string;
	/**
	 * SEALED TRIPTYCH: alcove avatar + screen + card sign, one playback
	 * clock. Presence asserted here; placement is Gate 1's job.
	 */
	triptych: { screen: true; cardSign: true };
	/**
	 * Eternal-props ensemble AROUND the showcase (rider 1: positioning is
	 * free per wing). Never replaces the showcase.
	 */
	ensemble?: { stationRef: string; prop: StaticDualWieldProp }[];
}

export interface CasesBeat {
	kind: "cases";
	cases: ExhibitCase[];
}

export interface PayoffBeat {
	kind: "payoff";
	/** Viewpoint station/landing the payoff is composed from. */
	viewpointRef: string;
	/** Case words visible from it (validator: subset of declared cases). */
	visibleCases: string[];
	description: string;
}

export interface ExitBeat {
	kind: "exit";
	/** Next wingId in walk order; null for the era's last wing. */
	toWingId: string | null;
	/** Seam phenomenon handing off to the next space. */
	handoff: string;
}

export interface WingDeclaration {
	/** Stable, era-agnostic id: the TnD class, e.g. "split-same". */
	wingId: string;
	/** Which museum era hosts this wing. All six launch wings: "vulcan-cave". */
	era: string;
	/** Spatial owner: RoomNode id in the era's floor plan. */
	roomId: string;

	mode: {
		category: TndCategory;
		/** Clinical label spoken by the Order, e.g. "SPLIT-SAME". */
		label: string;
		/** e.g. "Split-time / same-direction". */
		technicalMode: string;
	};

	/** Verbatim from the approved Phase 0 canon row. */
	teachingSentence: string;
	uniqueObservable: string;

	barrier: {
		/** Open string set, not an enum — future eras add kinds freely. */
		kind: string;
		expression: string;
	};

	/** THE GRAMMAR: exactly five beats, in this order, typed as a tuple. */
	beats: [ThresholdBeat, OpenerBeat, CasesBeat, PayoffBeat, ExitBeat];

	/** Optional scene-owned interaction program (Fire's procession, etc.). */
	signatureProgram?: { id: string; description: string };

	/** Graybox review-shell presentation (what hand-rolled pages hardcode today). */
	review: {
		accentColor: string;
		loadingTitle: string;
		loadingSubtitle: string;
		/** HUD location readout: first entry whose whenZAbove the player-z exceeds wins; a final entry without whenZAbove is the fallback. */
		locationLabels: { label: string; whenZAbove?: number }[];
	};
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(museum): wing declaration types" -- src/lib/features/museum/data/wing-declarations/types.ts
```

---

### Task 3: The six Vulcan Cave manifests

Content sources (do not invent): teaching sentences / observables / barriers / payoffs / seams from `docs/superpowers/specs/2026-08-11-museum-wings-phase0-canon.md`; station refs from `CAVE_MODE_ROOMS` performer ids; sequence keys from `museum-exhibit-sequences.ts`; catalog ids from the canon sheet's binding table. Water's `review` block transcribes the existing hand-rolled route (`src/routes/test/drowned-gallery-graybox/+page.svelte` lines 9–19: accent `#38bdf8`, z-band labels). Stamps and non-Water review copy are first-draft clinical text — flagged for a museum-writer pass later; everything else is transcription.

**Files:**
- Create: `src/lib/features/museum/data/wing-declarations/vulcan-cave-wings.ts`

- [ ] **Step 1: Write the manifests file**

```ts
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
		uniqueObservable:
			"The mirror axis — the room and the motion share it.",
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
		uniqueObservable:
			"Phases: quarter offsets are what moon phases are.",
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
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(museum): six Vulcan Cave wing declaration manifests" -- src/lib/features/museum/data/wing-declarations/vulcan-cave-wings.ts
```

---

### Task 4: Validator + grammar test (TDD)

**Files:**
- Create: `tests/unit/museum/wing-declaration-grammar.test.ts`
- Create: `src/lib/features/museum/data/wing-declarations/validate-wing-declarations.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VULCAN_CAVE_WINGS } from "$lib/features/museum/data/wing-declarations/vulcan-cave-wings";
import type { WingDeclaration } from "$lib/features/museum/data/wing-declarations/types";
import {
	validateWingDeclarations,
	type WingValidationContext,
} from "$lib/features/museum/data/wing-declarations/validate-wing-declarations";
import { RAW_MUSEUM_SEQUENCES } from "$lib/features/museum/data/museum-exhibit-sequences";
import { VULCAN_CAVE_ROOMS } from "$lib/features/museum/data/vulcan-cave-floor-plan";

function buildContext(): WingValidationContext {
	const catalog = JSON.parse(
		readFileSync(resolve("static/data/hero/tnd-base-words.json"), "utf8")
	);
	const performersByRoom = Object.fromEntries(
		VULCAN_CAVE_ROOMS.map((room) => [
			room.id,
			(room.performers ?? []).map((performer) => performer.refId),
		])
	);
	return { catalog, rawSequences: RAW_MUSEUM_SEQUENCES, performersByRoom };
}

/** Deep-copies the manifests so mutation tests never touch the real data. */
function cloneWings(): WingDeclaration[] {
	return structuredClone(VULCAN_CAVE_WINGS) as WingDeclaration[];
}

describe("wing declaration grammar", () => {
	const context = buildContext();

	it("all six Vulcan Cave wings validate with zero errors", () => {
		const findings = validateWingDeclarations(VULCAN_CAVE_WINGS, context);
		const errors = findings.filter((finding) => finding.level === "error");
		expect(errors).toEqual([]);
	});

	it("every showcase station resolves today — only opener/viewpoint/ensemble may be pending", () => {
		const findings = validateWingDeclarations(VULCAN_CAVE_WINGS, context);
		expect(
			findings.filter((finding) => finding.code === "showcase-pending")
		).toEqual([]);
		for (const finding of findings.filter((f) => f.level === "pending")) {
			expect(finding.code).toBe("station-pending");
		}
	});

	it("rejects a case whose word disagrees with its catalog row", () => {
		const wings = cloneWings();
		wings[0].beats[2].cases[0].word = "BBBB";
		const findings = validateWingDeclarations(wings, context);
		expect(findings.some((f) => f.code === "word-mismatch")).toBe(true);
	});

	it("rejects a museum sequence that drifts from the catalog", () => {
		const wings = cloneWings();
		const drifted = structuredClone(RAW_MUSEUM_SEQUENCES);
		drifted["cave-water-seq-a"].steps[1].blueMotion.rotationDirection = "cw";
		const findings = validateWingDeclarations(wings, {
			...context,
			rawSequences: drifted,
		});
		expect(findings.some((f) => f.code === "verbatim-mismatch")).toBe(true);
	});

	it("rejects duplicate case words within a wing", () => {
		const wings = cloneWings();
		wings[0].beats[2].cases[1] = structuredClone(wings[0].beats[2].cases[0]);
		const findings = validateWingDeclarations(wings, context);
		expect(findings.some((f) => f.code === "duplicate-word")).toBe(true);
	});

	it("rejects an ensemble avatar parked on a showcase station", () => {
		const wings = cloneWings();
		wings[0].beats[2].cases[0].ensemble = [
			{ stationRef: "cave-water-a", prop: "club" },
		];
		const findings = validateWingDeclarations(wings, context);
		expect(findings.some((f) => f.code === "ensemble-on-showcase")).toBe(true);
	});

	it("rejects a non-static prop in an ensemble (JSON-era guard)", () => {
		const wings = cloneWings();
		wings[0].beats[2].cases[0].ensemble = [
			{ stationRef: "cave-water-ensemble-x", prop: "poi" as never },
		];
		const findings = validateWingDeclarations(wings, context);
		expect(findings.some((f) => f.code === "ensemble-prop")).toBe(true);
	});

	it("rejects a payoff naming an undeclared case", () => {
		const wings = cloneWings();
		wings[0].beats[3].visibleCases = ["ZZZZ"];
		const findings = validateWingDeclarations(wings, context);
		expect(findings.some((f) => f.code === "payoff-unknown-case")).toBe(true);
	});

	it("rejects a broken walk-order chain", () => {
		const wings = cloneWings();
		wings[0].beats[4].toWingId = "quarter-opp";
		const findings = validateWingDeclarations(wings, context);
		expect(findings.some((f) => f.code === "chain-broken")).toBe(true);
	});

	it("rejects a wrong case count for the category", () => {
		const wings = cloneWings();
		wings[0].beats[2].cases.pop();
		const findings = validateWingDeclarations(wings, context);
		expect(findings.some((f) => f.code === "case-count")).toBe(true);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/museum/wing-declaration-grammar.test.ts`
Expected: FAIL — cannot resolve `validate-wing-declarations` (module does not exist yet).

- [ ] **Step 3: Write the validator**

```ts
import type { RawMotion, RawSequence } from "../museum-exhibit-sequences";
import type { ExhibitCase, TndCategory, WingDeclaration } from "./types";

/**
 * The machine-checkable grammar for wing declarations. Reads the owners it
 * cross-references (catalog JSON, raw museum sequences, floor-plan
 * performers) through this context — it never copies their data.
 */
export interface WingValidationContext {
	catalog: CatalogEntry[];
	rawSequences: Record<string, RawSequence>;
	/** roomId → performer refIds present in the era's floor plan. */
	performersByRoom: Record<string, readonly string[]>;
}

/** The slice of a tnd-base-words.json row the validator reads. */
export interface CatalogEntry {
	id: string;
	steps: {
		letter: string;
		startPosition: string;
		endPosition: string;
		stepNumber: number;
		motions: { blue: RawMotion; red: RawMotion };
	}[];
}

export type WingFindingLevel = "error" | "pending";

export interface WingFinding {
	level: WingFindingLevel;
	wingId: string;
	code:
		| "beat-order"
		| "catalog-missing"
		| "word-mismatch"
		| "sequence-missing"
		| "verbatim-mismatch"
		| "case-count"
		| "category-prefix"
		| "duplicate-word"
		| "showcase-pending"
		| "station-pending"
		| "ensemble-on-showcase"
		| "ensemble-prop"
		| "payoff-unknown-case"
		| "chain-broken"
		| "empty-field";
	message: string;
}

const BEAT_ORDER = ["threshold", "opener", "cases", "payoff", "exit"] as const;

/** Family sizes after reversal collapse (PM = MP): QS has four rows, the rest three. */
const CASE_COUNT_BY_CATEGORY: Record<TndCategory, number> = {
	SS: 3,
	SO: 3,
	TS: 3,
	TO: 3,
	QS: 4,
	QO: 3,
};

const CATALOG_PREFIX_BY_CATEGORY: Record<TndCategory, string> = {
	SS: "tnd-split-same-",
	SO: "tnd-split-opp-",
	TS: "tnd-tog-same-",
	TO: "tnd-tog-opp-",
	QS: "tnd-quarter-same-",
	QO: "tnd-quarter-opp-",
};

/** Eternal-props seal: static dual-wield only, never poi. The type enforces
 * this for TS manifests; the validator re-checks for future JSON-era ones. */
const STATIC_DUAL_WIELD_PROPS = new Set(["staff", "club", "fan", "buugeng"]);

const MOTION_FIELDS = [
	"startLocation",
	"endLocation",
	"motionType",
	"rotationDirection",
	"startOrientation",
	"endOrientation",
] as const;

function motionsMatch(a: RawMotion, b: RawMotion): boolean {
	return MOTION_FIELDS.every((field) => a[field] === b[field]);
}

function checkVerbatimBinding(
	wing: WingDeclaration,
	exhibitCase: ExhibitCase,
	context: WingValidationContext,
	findings: WingFinding[]
): void {
	const catalogEntry = context.catalog.find(
		(entry) => entry.id === exhibitCase.catalogId
	);
	if (!catalogEntry) {
		findings.push({
			level: "error",
			wingId: wing.wingId,
			code: "catalog-missing",
			message: `${exhibitCase.catalogId} is not in the catalog`,
		});
		return;
	}
	const catalogSteps = catalogEntry.steps
		.filter((step) => step.stepNumber >= 1)
		.sort((a, b) => a.stepNumber - b.stepNumber);
	const catalogWord = catalogSteps.map((step) => step.letter).join("");
	if (catalogWord !== exhibitCase.word) {
		findings.push({
			level: "error",
			wingId: wing.wingId,
			code: "word-mismatch",
			message: `case ${exhibitCase.word} vs catalog ${catalogWord} (${exhibitCase.catalogId})`,
		});
	}
	const sequence = context.rawSequences[exhibitCase.sequenceKey];
	if (!sequence) {
		findings.push({
			level: "error",
			wingId: wing.wingId,
			code: "sequence-missing",
			message: `${exhibitCase.sequenceKey} is not in museum-exhibit-sequences`,
		});
		return;
	}
	if (sequence.word !== exhibitCase.word) {
		findings.push({
			level: "error",
			wingId: wing.wingId,
			code: "word-mismatch",
			message: `case ${exhibitCase.word} vs museum sequence word ${sequence.word} (${exhibitCase.sequenceKey})`,
		});
	}
	const museumSteps = sequence.steps
		.filter((step) => step.stepNumber >= 1)
		.sort((a, b) => a.stepNumber - b.stepNumber);
	if (museumSteps.length !== catalogSteps.length) {
		findings.push({
			level: "error",
			wingId: wing.wingId,
			code: "verbatim-mismatch",
			message: `${exhibitCase.sequenceKey}: ${museumSteps.length} steps vs catalog ${catalogSteps.length}`,
		});
		return;
	}
	for (let index = 0; index < catalogSteps.length; index += 1) {
		const fromCatalog = catalogSteps[index]!;
		const fromMuseum = museumSteps[index]!;
		const stepMatches =
			fromCatalog.letter === fromMuseum.letter &&
			fromCatalog.startPosition === fromMuseum.startPosition &&
			fromCatalog.endPosition === fromMuseum.endPosition &&
			motionsMatch(fromCatalog.motions.blue, fromMuseum.blueMotion) &&
			motionsMatch(fromCatalog.motions.red, fromMuseum.redMotion);
		if (!stepMatches) {
			findings.push({
				level: "error",
				wingId: wing.wingId,
				code: "verbatim-mismatch",
				message: `${exhibitCase.sequenceKey} step ${fromCatalog.stepNumber} drifts from ${exhibitCase.catalogId}`,
			});
		}
	}
}

function checkStation(
	wing: WingDeclaration,
	stationRef: string,
	role: "showcase" | "station",
	context: WingValidationContext,
	findings: WingFinding[]
): void {
	const performers = context.performersByRoom[wing.roomId] ?? [];
	if (performers.includes(stationRef)) return;
	findings.push({
		level: "pending",
		wingId: wing.wingId,
		code: role === "showcase" ? "showcase-pending" : "station-pending",
		message: `${stationRef} has no floor-plan station yet (Gate 1 placement)`,
	});
}

export function validateWingDeclarations(
	wings: readonly WingDeclaration[],
	context: WingValidationContext
): WingFinding[] {
	const findings: WingFinding[] = [];

	for (const wing of wings) {
		// 1. Beat order and completeness (re-checked at runtime for JSON-era manifests).
		const kinds = wing.beats.map((beat) => beat.kind);
		if (
			kinds.length !== BEAT_ORDER.length ||
			BEAT_ORDER.some((expected, index) => kinds[index] !== expected)
		) {
			findings.push({
				level: "error",
				wingId: wing.wingId,
				code: "beat-order",
				message: `beats are [${kinds.join(", ")}], expected [${BEAT_ORDER.join(", ")}]`,
			});
			continue;
		}
		const [threshold, opener, casesBeat, payoff] = wing.beats;

		// 8. Non-empty canon fields.
		const requiredText: [string, string][] = [
			["teachingSentence", wing.teachingSentence],
			["uniqueObservable", wing.uniqueObservable],
			["barrier.kind", wing.barrier.kind],
			["barrier.expression", wing.barrier.expression],
			["threshold.stamp", threshold.stamp],
		];
		for (const [field, value] of requiredText) {
			if (!value.trim()) {
				findings.push({
					level: "error",
					wingId: wing.wingId,
					code: "empty-field",
					message: `${field} is empty`,
				});
			}
		}

		// 3. One case per word; category prefix; family count.
		const words = new Set<string>();
		for (const exhibitCase of casesBeat.cases) {
			if (words.has(exhibitCase.word)) {
				findings.push({
					level: "error",
					wingId: wing.wingId,
					code: "duplicate-word",
					message: `${exhibitCase.word} declared twice`,
				});
			}
			words.add(exhibitCase.word);
			const prefix = CATALOG_PREFIX_BY_CATEGORY[wing.mode.category];
			if (!exhibitCase.catalogId.startsWith(prefix)) {
				findings.push({
					level: "error",
					wingId: wing.wingId,
					code: "category-prefix",
					message: `${exhibitCase.catalogId} does not carry ${prefix}`,
				});
			}
			// 2. Canonical binding.
			checkVerbatimBinding(wing, exhibitCase, context, findings);
			// 4. Stations.
			checkStation(
				wing,
				exhibitCase.showcaseStationRef,
				"showcase",
				context,
				findings
			);
			const showcaseRefs = new Set(
				casesBeat.cases.map((c) => c.showcaseStationRef)
			);
			for (const member of exhibitCase.ensemble ?? []) {
				if (showcaseRefs.has(member.stationRef)) {
					findings.push({
						level: "error",
						wingId: wing.wingId,
						code: "ensemble-on-showcase",
						message: `ensemble ref ${member.stationRef} is a showcase station (rider 2)`,
					});
				} else {
					checkStation(wing, member.stationRef, "station", context, findings);
				}
				if (!STATIC_DUAL_WIELD_PROPS.has(member.prop)) {
					findings.push({
						level: "error",
						wingId: wing.wingId,
						code: "ensemble-prop",
						message: `${member.prop} is not a static dual-wield prop (eternal-props seal)`,
					});
				}
			}
		}
		if (casesBeat.cases.length !== CASE_COUNT_BY_CATEGORY[wing.mode.category]) {
			findings.push({
				level: "error",
				wingId: wing.wingId,
				code: "case-count",
				message: `${casesBeat.cases.length} cases, ${wing.mode.category} needs ${CASE_COUNT_BY_CATEGORY[wing.mode.category]}`,
			});
		}

		// Opener binds like a case (same catalog + sequence checks, no showcase).
		checkVerbatimBinding(
			wing,
			{
				word:
					context.catalog
						.find((entry) => entry.id === opener.catalogId)
						?.steps.filter((step) => step.stepNumber >= 1)
						.sort((a, b) => a.stepNumber - b.stepNumber)
						.map((step) => step.letter)
						.join("") ?? "",
				catalogId: opener.catalogId,
				sequenceKey: opener.sequenceKey,
				showcaseStationRef: opener.stationRef,
				triptych: { screen: true, cardSign: true },
			},
			context,
			findings
		);
		checkStation(wing, opener.stationRef, "station", context, findings);

		// 6. Payoff visibility.
		checkStation(wing, payoff.viewpointRef, "station", context, findings);
		for (const visible of payoff.visibleCases) {
			if (!words.has(visible)) {
				findings.push({
					level: "error",
					wingId: wing.wingId,
					code: "payoff-unknown-case",
					message: `payoff names undeclared case ${visible}`,
				});
			}
		}
	}

	// 7. Walk-order chain: one head, one null tail, every wing visited once.
	const byId = new Map(wings.map((wing) => [wing.wingId, wing]));
	const referenced = new Set(
		wings
			.map((wing) => wing.beats[4].toWingId)
			.filter((id): id is string => id !== null)
	);
	const heads = wings.filter((wing) => !referenced.has(wing.wingId));
	let chainOk = heads.length === 1;
	if (chainOk) {
		const visited = new Set<string>();
		let cursor: WingDeclaration | undefined = heads[0];
		while (cursor && !visited.has(cursor.wingId)) {
			visited.add(cursor.wingId);
			const next = cursor.beats[4].toWingId;
			cursor = next === null ? undefined : byId.get(next);
		}
		chainOk = visited.size === wings.length;
	}
	if (!chainOk && wings.length > 0) {
		findings.push({
			level: "error",
			wingId: heads[0]?.wingId ?? wings[0]!.wingId,
			code: "chain-broken",
			message: "exit links do not form one path visiting every wing once",
		});
	}

	return findings;
}
```

Note on the opener: its synthetic `ExhibitCase` is only a vehicle for reusing `checkVerbatimBinding` (which never touches stations); the opener's station is checked separately with role `"station"`, so pending is allowed pre-Gate-1. Filename note: the spec listed `validate-wing-declaration.ts` (singular); the module is pluralized because its unit of validation is the wing SET — the walk-chain check is cross-wing by nature.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/museum/wing-declaration-grammar.test.ts`
Expected: PASS, 10 tests. If the first test lists findings, read them — they name the exact manifest field that disagrees with an owner. Fix the manifest (or, if the owner is wrong, STOP and report — never edit catalog/floor-plan data to satisfy the validator).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(museum): wing declaration grammar validator with verbatim canonical binding" -- src/lib/features/museum/data/wing-declarations/validate-wing-declarations.ts tests/unit/museum/wing-declaration-grammar.test.ts
```

---

### Task 5: Derive CAVE_MODE_ROOMS from the declarations

**Files:**
- Modify: `src/lib/features/museum/data/vulcan-cave-floor-plan.ts:76-163` (the `CAVE_MODE_ROOMS` literal)

- [ ] **Step 1: Verify no consumer depends on the current Sun ordering**

`CAVE_MODE_ROOMS`'s Sun arrays are currently ordered u, s, v, t; the declaration's canon order is S, T, U, V. Pairing (performer[i] ↔ sequence[i]) is preserved by deriving both arrays from the same cases array, but confirm nothing indexes them against an external order:

Run: `grep -rn "CAVE_MODE_ROOMS" src/ --include="*.ts" --include="*.svelte"`
Expected consumers: `vulcan-cave-floor-plan.ts` (definition), `element-motifs.ts` (reads `category`/`label`/`technicalMode` only — verify by reading its usage), and the two blender-contract files (verify the same). If any consumer indexes `performerIds`/`sequenceIds` positionally against something other than each other, STOP and report before changing order.

- [ ] **Step 2: Replace the literal with the derivation**

Replace lines 76–163 (`export const CAVE_MODE_ROOMS = [` through `] as const satisfies readonly CaveModeRoom[];`) with:

```ts
import { VULCAN_CAVE_WINGS } from "./wing-declarations/vulcan-cave-wings";
```

(add the import at the top of the file with the other `./` imports), and at the old definition site:

```ts
/**
 * Dev-facing flavor that stays with the cave floor plan rather than the
 * era-agnostic declarations: the elemental shorthand label and the zone tone.
 */
const WING_ROOM_META: Record<
  string,
  { label: string; tone: MuseumFloorPlanZoneTone }
> = {
  "cave-water": { label: "Water", tone: "arrival" },
  "cave-fire": { label: "Fire", tone: "retail" },
  "cave-earth": { label: "Earth", tone: "social" },
  "cave-air": { label: "Air", tone: "service" },
  "cave-sun": { label: "Sun", tone: "anchor" },
  "cave-moon": { label: "Moon", tone: "exhibit" },
};

/**
 * Derived from the wing declarations (the single source since 2026-08-12) —
 * do not hand-edit mode data here. Ordering follows the declarations' walk
 * order. Note the Moon wing has three cases, not four: MPMP, NQNQ and OROR
 * are the Quarter-Opposite pairs that close across M–R (PM = MP collapse);
 * the fourth compass point is the arrival hole.
 */
export const CAVE_MODE_ROOMS: readonly CaveModeRoom[] = VULCAN_CAVE_WINGS.map(
  (wing) => {
    const meta = WING_ROOM_META[wing.roomId];
    if (!meta) {
      throw new Error(`No cave room meta for wing room ${wing.roomId}`);
    }
    return {
      roomId: wing.roomId,
      label: meta.label,
      category: wing.mode.category,
      technicalMode: wing.mode.technicalMode,
      performerIds: wing.beats[2].cases.map(
        (exhibitCase) => exhibitCase.showcaseStationRef
      ),
      sequenceIds: wing.beats[2].cases.map(
        (exhibitCase) => exhibitCase.sequenceKey
      ),
      tone: meta.tone,
    };
  }
);
```

Circular-import check: `vulcan-cave-wings.ts` imports only `./types` — it must NEVER import the floor plan (the validator receives performers through its context instead). If an import cycle appears here, that is the bug.

- [ ] **Step 3: Prove the derivation preserves behavior**

Run: `npx vitest run tests/unit/museum/wing-declaration-grammar.test.ts`
Expected: PASS (the test imports both modules, so a cycle or derivation error fails here).

Then confirm the derived values match the old literal — every roomId keeps its category, technicalMode, tone, label, and the same performer/sequence id SETS (Sun's order legitimately changes to canon S,T,U,V; the pairing stays aligned):

```bash
node -e "const{execSync}=require('child_process');" 2>/dev/null; npx tsx -e "
import { CAVE_MODE_ROOMS } from './src/lib/features/museum/data/vulcan-cave-floor-plan';
for (const room of CAVE_MODE_ROOMS) {
  console.log(room.roomId, room.category, room.tone, '|', room.performerIds.join(','), '|', room.sequenceIds.join(','));
}
"
```

Expected output (six lines; Sun re-ordered to canon, everything else identical to the old literal):

```
cave-water SS arrival | cave-water-a,cave-water-b,cave-water-c | cave-water-seq-a,cave-water-seq-b,cave-water-seq-c
cave-fire SO retail | cave-fire-automaton-dj,cave-fire-automaton-ek,cave-fire-automaton-fl | cave-fire-seq-dj,cave-fire-seq-ek,cave-fire-seq-fl
cave-earth TS social | cave-earth-automaton-g,cave-earth-automaton-h,cave-earth-automaton-i | cave-earth-seq-g,cave-earth-seq-h,cave-earth-seq-i
cave-air TO service | cave-air-automaton-dj,cave-air-automaton-ek,cave-air-automaton-fl | cave-air-seq-dj,cave-air-seq-ek,cave-air-seq-fl
cave-sun QS anchor | cave-sun-automaton-s,cave-sun-automaton-t,cave-sun-automaton-u,cave-sun-automaton-v | cave-sun-seq-s,cave-sun-seq-t,cave-sun-seq-u,cave-sun-seq-v
cave-moon QO exhibit | cave-moon-automaton-mp,cave-moon-automaton-nq,cave-moon-automaton-or | cave-moon-seq-mp,cave-moon-seq-nq,cave-moon-seq-or
```

(If `tsx` is unavailable, `npx vitest run` with a temporary inline test is an acceptable substitute; delete it after.)

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(museum): derive CAVE_MODE_ROOMS from the wing declarations" -- src/lib/features/museum/data/vulcan-cave-floor-plan.ts
```

---

### Task 6: Whole-slice verification

- [ ] **Step 1: Type-check the new files** (one check this turn, piped to a log)

```bash
npm run type-check > /tmp/wing-decl-typecheck.log 2>&1
grep -nE "wing-declarations|museum-exhibit-sequences|vulcan-cave-floor-plan|wing-declaration-grammar" /tmp/wing-decl-typecheck.log
```

Expected: no hits (the repo has known pre-existing errors elsewhere — the type-gate-repair backlog; only OUR files must be clean).

- [ ] **Step 2: Run the museum unit tests that touch the changed modules**

```bash
npx vitest run tests/unit/museum/
```

Expected: PASS (including any pre-existing museum tests that import the floor plan).

- [ ] **Step 3: Update the canon sheet status line**

In `docs/superpowers/specs/2026-08-11-museum-wings-phase0-canon.md`, "What Phase 0 unblocks", append after the sequencing amendment paragraph:

```markdown
**Built (2026-08-12):** the declarations layer is live —
`src/lib/features/museum/data/wing-declarations/` (types, six manifests,
grammar validator) with the verbatim canonical binding enforced in CI
(`tests/unit/museum/wing-declaration-grammar.test.ts`), and
`CAVE_MODE_ROOMS` derived from the manifests. Pending station refs
(openers, viewpoints) are each wing's Gate 1 placement obligations.
```

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(museum): record the wing declarations layer as built" -- docs/superpowers/specs/2026-08-11-museum-wings-phase0-canon.md
```

---

## Out of scope (subsequent plans, in order)

1. **Water Gate 1 board** — measured floor plan, route, sightlines, opener +
   parapet placement (resolves Water's pending refs). Design artifact for
   Austen, per the museum-scene-production gate contract.
2. **Shared graybox harness** (`GrayboxRoom` + `GrayboxReviewShell`) consuming
   `WingDeclaration.review`, migrating the drowned-gallery route first.
3. **Water vertical slice** — one case through graybox + triptych + opener.
