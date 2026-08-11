# Wing Declaration Shape — era-agnostic manifests for the shared graybox harness

**Date:** 2026-08-11
**Parent spec:** `2026-08-11-museum-exhibit-hallway-architecture-design.md` (APPROVED — names this as the next design artifact)
**Canon source:** `2026-08-11-museum-wings-phase0-canon.md` (all six Phase 0 rows approved; triptych, choreo-card opener, eternal props SEALED)
**Status:** DESIGN — awaiting Austen's review

## What this is

The per-wing manifest the shared graybox review harness consumes. One
declaration per wing states the approved Phase 0 canon — teaching sentence,
the five beats, cases, barrier — in a machine-checkable form, plus the three
sealed elements from the 08-11 round: the choreo-card opener, the case
triptych, and the eternal-props ensemble. Era-agnostic by construction:
future historical wings are new manifests, not new architectures.

This spec defines the **shape and its validator**. The harness itself
(`GrayboxRoom` + `GrayboxReviewShell`, replacing the four hand-rolled review
routes) is the follow-up implementation plan, drawn against this shape.

## Ownership audit (never-hand-roll evidence gate)

Search terms used: `CaveModeRoom`, `GrayboxRoom|GrayboxReviewShell`,
`ROOM_CONTENT`, `graybox` route glob, `museum-exhibit-sequences`. Findings:

| Concern | Existing owner | Relationship |
|---|---|---|
| Spatial truth (walls, dimensions, stations, edges, terrain) | `src/lib/features/museum/data/vulcan-cave-floor-plan.ts` (`RoomNode`, performer stations via per-room layout modules) | **Compose** — declarations reference `roomId` and station `refId`s; never duplicate a coordinate |
| Mode metadata (`roomId`, `category`, `technicalMode`, `performerIds`, `sequenceIds`, `tone`) | `CAVE_MODE_ROOMS` in the same file | **Supersede by derivation** — the declaration absorbs these fields; `CAVE_MODE_ROOMS` becomes a thin derived export so existing consumers keep working (see Decision 1) |
| Canonical sequences | `museum-exhibit-sequences.ts` (19 verbatim transcriptions) + `static/data/hero/tnd-base-words.json` (variation authority) | **Compose** — cases carry `sequenceKey` + `catalogId` references; the validator enforces the verbatim binding |
| Plaque/performer copy | `museum-room-content.ts` (`ROOM_CONTENT`) | **Keep separate** — prose copy is content, not grammar; declarations reference rooms, not plaques |
| Review-page chrome (HUD, loading, reset, theme) | Hand-rolled ×4: `drowned-gallery-graybox`, `first-fire-graybox`, `earth-root-chasm-graybox`, `earth-root-observatory-graybox` (+ older `water-traverse`, `water-grotto`) | **Replaced by the harness** (follow-up plan) — the shell boilerplate is near-identical across all four; only theme tokens, location labels, and loading copy differ, and those become declaration fields |
| Scene-specific interaction programs (e.g. Fire's procession state machine, `first-fire-graybox-review.ts`) | Scene-owned modules | **Keep separate, reference by id** — genuinely per-wing logic; the declaration names it (`signatureProgramId`), never contains it |
| Evidence manifests | `scene-gates.json` + validator | **Keep separate** — evidence index, not creative truth (per museum-scene-production skill); gains one new check that the gate's wing declaration validates |
| Pedagogy/beat layer (teaching sentence, five beats, barrier, payoff) | **No owner** — exists only as prose in the Phase 0 canon sheet | **Create** — this is the new capability; `WingDeclaration` is its owner |

## The shape

Location: `src/lib/features/museum/data/wing-declarations/`

- `types.ts` — the interfaces below
- `vulcan-cave-wings.ts` — the six manifests (content transcribed from the
  approved Phase 0 rows)
- `validate-wing-declaration.ts` — the grammar checker
- `tests/unit/wing-declaration-grammar.test.ts` — runs the validator over
  every registered wing in CI

```ts
export interface WingDeclaration {
	/** Stable, era-agnostic id: the TnD class, e.g. "split-same". */
	wingId: string;
	/** Which museum era hosts this wing. All six launch wings: "vulcan-cave". */
	era: string;
	/** Spatial owner: RoomNode id in the era's floor plan. */
	roomId: string;

	mode: {
		category: "SS" | "SO" | "TS" | "TO" | "QS" | "QO";
		/** Clinical label spoken by the Order: "SPLIT-SAME". Elemental names never appear. */
		label: string;
		/** e.g. "Split timing · Same direction". */
		technicalMode: string;
	};

	/** Verbatim from the approved Phase 0 row. */
	teachingSentence: string;
	uniqueObservable: string;

	barrier: {
		/** Open string set, not an enum — future eras add kinds freely. */
		kind: string; // "still-water" | "heat" | "elevation" | "void" | "light-shaft" | "sealed-glass" | ...
		/** How the room expresses it (prose, from the canon row). */
		expression: string;
	};

	/** THE GRAMMAR: exactly five beats, in this order, typed as a tuple. */
	beats: [ThresholdBeat, OpenerBeat, CasesBeat, PayoffBeat, ExitBeat];

	/** Optional scene-owned interaction program (Fire's procession, etc.). */
	signatureProgram?: { id: string; description: string };

	/** Graybox review-shell presentation (what the hand-rolled pages hardcode today). */
	review: {
		accentColor: string;
		loadingTitle: string;
		loadingSubtitle: string;
		/** Player-z (or program-driven) location labels for the HUD readout. */
		locationLabels: { label: string; whenZAbove?: number }[];
	};
}

interface ThresholdBeat {
	kind: "threshold";
	/** The wing stamp/title presented at entry. */
	stamp: string;
}

interface OpenerBeat {
	kind: "opener";
	/** SEALED FORM: the wing's choreo card (pictographs, unlabeled) + a
	 * propless avatar performing the hand path, hand-tip trails on. */
	catalogId: string; // which word the opener demonstrates
	sequenceKey: string; // museum-exhibit-sequences key backing the card + avatar
	stationRef: string; // performer station (may be pending placement pre-Gate-1)
}

interface CasesBeat {
	kind: "cases";
	cases: ExhibitCase[];
}

interface ExhibitCase {
	word: string; // "AAAA" — display uses simplifyRepeatedWord
	catalogId: string; // "tnd-split-same-aaaa" — the variation authority row
	sequenceKey: string; // museum-exhibit-sequences key (must match catalog verbatim)
	/** The one showcase per word — INVIOLABLE (eternal-props rider 2). */
	showcaseStationRef: string;
	/** SEALED TRIPTYCH: alcove avatar + screen + card sign, one playback clock.
	 * Placement is Gate 1's job; the declaration only asserts presence. */
	triptych: { screen: true; cardSign: true };
	/** Eternal-props ensemble AROUND the showcase (rider 1: positioning free).
	 * Static dual-wield only. */
	ensemble?: { stationRef: string; prop: "staff" | "club" | "fan" | "buugeng" }[];
}

interface PayoffBeat {
	kind: "payoff";
	/** Viewpoint station/landing the payoff is composed from. */
	viewpointRef: string;
	/** Which case words are visible from it (validator: ⊆ declared cases). */
	visibleCases: string[];
	description: string;
}

interface ExitBeat {
	kind: "exit";
	/** Next wingId in walk order; null for the era's last wing (hands off to the next era). */
	toWingId: string | null;
	/** Seam phenomenon (prose, from the canon sheet's seam plan). */
	handoff: string;
}
```

Why a fixed 5-tuple instead of an ordered array: the grammar *is* the type.
A manifest that skips the opener or doubles the payoff fails to compile, and
the validator re-checks the same invariant at runtime for any future
JSON-loaded manifest.

## The validator (machine-checkable grammar)

`validateWingDeclaration(declaration, context)` returns a list of findings
(`error` | `pending`). CI fails on any `error`. Checks:

1. **Beat order and completeness** — the five kinds, exactly once, in order.
2. **Canonical binding (the sealed rule, made permanent):** every
   `catalogId` exists in `tnd-base-words.json`; the case `word` equals the
   catalog steps' letters; the referenced `sequenceKey` exists in
   `museum-exhibit-sequences.ts` and its steps 1–4 match the catalog entry
   **field-for-field** (letter, start/end position, and all six motion
   fields per hand). This promotes the one-off retranscription diff script
   into a standing CI guard — the drift that required the 08-11 fix can
   never silently recur.
3. **One case per word:** case words unique within the wing; every case's
   `catalogId` carries the wing's category prefix; case count matches the
   family after reversal collapse (3 for SS/SO/TS/TO/QO, 4 for QS).
4. **Station refs:** `showcaseStationRef` / opener `stationRef` /
   `ensemble[].stationRef` / `viewpointRef` either resolve to a performer
   `refId` in the wing's floor-plan room (→ ok) or are reported `pending`
   (→ a Gate 1 board obligation, not a failure — declarations precede
   Gate 1 placement by design). An ensemble ref equal to a showcase ref is
   an `error` (rider 2).
5. **Ensemble props** drawn only from the static dual-wield set (the type
   enforces this; the validator re-checks JSON-era manifests). Never poi.
6. **Payoff visibility:** `visibleCases ⊆` declared case words.
7. **Walk-order chain:** across all registered wings of an era, `toWingId`
   links form one path visiting every wing exactly once
   (Water→Fire→Earth→Air→Sun→Moon for vulcan-cave, ending `null`).
8. **Non-empty canon fields:** teaching sentence, observable, barrier kind +
   expression, threshold stamp.

Context passed in: the catalog JSON, the museum sequence map, and the era's
floor plan — the validator only *reads* owners, never copies their data.

## How the harness consumes it (forward reference, not in scope here)

- `GrayboxReviewShell` (outside the Canvas): HUD title = `mode.label` +
  room name, subtitle from `review.locationLabels`, accent + loading copy
  from `review`, beat-progress readout from the five-beat grammar, reset
  button. This replaces the four copies of the hand-rolled page shell.
- `GrayboxRoom` (inside the Canvas): resolves `roomId` against the era's
  floor plan for geometry/colliders/walk; mounts the wing's scene component;
  wires `signatureProgram` if declared.
- Gate 1 boards are drawn per wing from its declaration: every `pending`
  station ref from the validator is exactly the placement work the board
  must show. The 3D prop asset inventory (staves/clubs/fans/buugeng)
  gates the `ensemble` entries.

## Decisions for review

1. **`CAVE_MODE_ROOMS` becomes derived.** The declaration absorbs its
   fields (`roomId`, `label`, `category`, `technicalMode`, plus per-case
   sequence ids). I recommend re-exporting `CAVE_MODE_ROOMS` as a mapping
   over the six declarations so its ~4 existing consumers keep working with
   zero behavior change, and the declaration is the single source. The
   alternative — two parallel data sets — is exactly the drift class the
   sealed rules exist to kill.
2. **Six manifests in one file vs one file per wing.** Recommend one file
   (`vulcan-cave-wings.ts`): the walk-order chain and cross-wing validator
   read naturally, and each manifest is ~60 lines of data.
3. **The verbatim-binding CI test.** Recommend shipping it with the shape
   (check 2 above). It costs one JSON read per test run and makes the
   canonical-binding seal self-enforcing forever.

## Out of scope (later artifacts)

- The harness implementation plan (GrayboxRoom/GrayboxReviewShell) — next,
  after this shape is approved.
- Gate 1 boards for all six wings (lockstep) — drawn from these manifests.
- Migration/retirement of the four hand-rolled review routes — part of the
  harness plan.
- Moon's floor-plan rider, hallway routing, barrier-softening schedule —
  tracked in the parent spec.
