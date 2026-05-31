# Per-Prop Arrow Defaults — Design

**Date:** 2026-05-30
**Status:** Approved design, pending implementation plan
**Author:** Austen + Claude (brainstormed)

## Problem

The arrow-positioning cascade was built for **staffs**. The Default tier — the
shared baseline pool every pictograph draws from — is **prop-agnostic**:

```
Default key (today): gridMode | motionType | placementKey | turns      ← no prop
```

`src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts:198`
(`getDefaultAdjustment`) and the static JSON under `/data/arrow_placement/` carry
zero prop information. Non-staff props (fan, club, triad, buugeng) were retrofitted
with the **Prop Geometry** tier — a letter-free *nudge* that pushes the arrow clear
of a bigger prop body. That nudge sits on top of the one staff-shaped baseline.

The arrow's natural resting place for a fan is **fundamentally different** from a
staff's, not merely "staff position pushed a bit." Expressing that as per-letter
or per-combo nudges on a staff baseline is tedious and inaccurate. We want each
prop to own its baseline.

## Decision

Promote **prop** to a first-class dimension of the **Default tier only**. Each
prop owns a complete, isolated, version-controlled dataset, seeded once from the
existing staff data (≈60% accurate immediately), then tuned independently.

Approach **A + C hybrid**, with the runtime staff-fallback cascade rejected in
favor of **seed-once isolation** (more explicit, less brittle):

- **A** — `propType` becomes part of the Default key + resolver; tuned in-panel
  via the existing Default Save flow.
- **C** — per-prop **static seed JSON** files, generated once by copying staff,
  committed to the repo.

The other three tiers are **unchanged**: Special JSON (per-letter, prop-blind),
Global (per-letter, prop-combo layered), and Prop Geometry (per-combo clearance)
keep their roles. Cascade order is unchanged:

```
Global Override → Special JSON → Prop Geometry → Default     (first match wins)
```

### Why not the other options

- **B (full parallel pipeline per prop — own Default + Special + Override):**
  rejected. Special JSON and Global are per-*letter* fixes; duplicating them per
  prop multiplies tuning work — the opposite of the goal. "Fundamentally different
  per prop" only has to live in the **baseline**.
- **Runtime staff-fallback cascade (levels 3–4 chasing staff):** rejected as
  brittle / implicit. A prop referencing staff at runtime couples them forever.
  Seed-from-staff at authoring time gives the same 60% head start without the
  runtime coupling.

## §1 — Resolution cascade (Default tier, per prop)

For arrow of prop `P` at `(gridMode, motionType, placementKey, turns)`:

```
1. P Firestore override   ← in-panel tuning on top (admin Save flow)
2. P static seed JSON      ← P's own dataset (60% from staff, then hand-tuned)
   NO staff reference at runtime.
Last-resort (only when P has NO seed folder at all):
3. staff static JSON       ← shipped baseline, so an unregistered prop renders
                             staff-like instead of arrows-at-origin
```

- **Staff is not special at runtime.** It is one prop whose static files are the
  ones shipping today (kept at the root path for back-compat). Staff resolves
  **identically to today**: root JSON + legacy Firestore docs.
- **Full isolation (accepted tradeoff):** once `P` is seeded it forks from staff.
  Later staff-dataset improvements do **not** propagate to `P`. This is correct
  for "fundamentally different per prop" — divergence is the point.
- **Key adds `propType` only** (own prop). Combo-dependent clearance stays in
  Prop Geometry (which already keys `otherPropType`). Per-prop Default answers
  "where does *this* prop's arrow sit," nothing about the neighbor.

## §2 — Data & seeding (static, version-controlled)

**File layout** (extends the existing default dir):

```
Staff / back-compat (untouched):
  /data/arrow_placement/<grid>/default/default_<grid>_<motion>_placements.json

Per-prop seed (new):
  /data/arrow_placement/<grid>/default/<prop>/default_<grid>_<motion>_placements.json
```

`<grid>` ∈ {diamond, box}; `<motion>` ∈ {pro, anti, float, dash, static};
`<prop>` = exact lowercased `PropType` value (`fan`, `club`, `triad`, …).

**Seed script** `scripts/seed-prop-default-placements.mjs`:
- For each `prop` in the seed list × `grid` × `motion`: read the staff root JSON,
  write an identical copy into `<prop>/`.
- Idempotent: re-running overwrites only files that are byte-identical to staff
  (never clobbers a hand-tuned per-prop file — guard by comparing against the
  staff source, skip if the target already diverges).
- Commit the generated files → instant 60% baseline, fully in version control.

**Seed list:** the `PropType` values we support, from
`src/lib/shared/pictograph/prop/domain/enums/PropType.ts`. Staff stays at root;
fan, bigfan, club, bigclub, triad, bigtriad, buugeng-family, minihoop, etc. get
folders. Keying on exact `propType` matches the Prop Geometry key. Family-level
sharing (staff-family props sharing one dataset) is a **future optimization**,
not in scope.

## §3 — Static loader (`arrow-placer.ts`)

- `allPlacements` gains a prop dimension:
  `[gridMode][prop][motionType][placementKey][turns]`.
- `placementFiles` becomes prop-aware: resolve `<prop>/` files for a given
  `(gridMode, prop)`; when no `<prop>/` folder exists, reuse the root staff files
  (this is the §1 last-resort path).
- Lazy-load by `(gridMode, prop)` instead of `(gridMode)` — only load a prop's 5
  files the first time that prop renders. `loadedGridModes` becomes a
  `loaded(gridMode, prop)` set.
- `getDefaultAdjustment(motionType, placementKey, turns, gridMode, propType)` —
  new `propType` param. Lookup reads `allPlacements[gridMode][prop]…`, falling to
  the staff set when the prop set is absent.

## §4 — Firestore override (per-prop, in-panel tuning)

Thread `propType` through the default-override stack
(`default-arrow-placement-repository.ts`, persister, state, singleton resolver):

- `getValue` / `hasValue` / `saveDefault` / `deleteDefault` /
  `saveDefaultLocal` / `deleteDefaultLocal` gain a `propType` argument.
- Persister **doc-id** gains a prop segment.
- Resolver signature becomes
  `(gridMode, motionType, placementKey, turns, propType) => [x,y] | null`
  (`setDefaultOverrideResolver` in `arrow-placer.ts`, registered at
  `default-override-singleton.ts:41`).
- **Back-compat:** legacy docs with no prop segment read as `staff`. The doc-id
  decoder maps a missing prop → `"staff"`, so existing admin staff overrides keep
  working untouched.
- Admin gate (`austencloud@gmail.com`) and live-preview/WASD flow unchanged.

## §5 — Plumbing the call chain

- `arrow-adjustment-calculator.ts` `calculateDefaultAdjustment`
  (`:709`): read the arrow's own prop — `motionData.propType?.toLowerCase() ??
  "staff"` — and pass it into `DefaultPlacer.getDefaultAdjustment`.
- `DefaultPlacer.getDefaultAdjustment(placementKey, turns, motionType, gridMode,
  propType)` (`default-placer.ts:61`) + the `IDefaultPlacerJson` interface gain
  the param, forwarding to `ArrowPlacer`.
- `DefaultTierInfo` (`PipelineDiagnostics.ts`) gains `propType: string` so the
  diagnostics producer reports which prop's value the trace/dock is showing.

## §6 — Inspect dock UX (`PipelineEditorDock.svelte`)

- `defaultLookup`, `defaultHasValue`, `handleDefaultNumericUpdate`,
  `handleDefaultSave`, `handleDefaultDelete` include `propType`. Reuse the
  existing `thisPropType` derived already computed in the component.
- **Dock head shows the prop being tuned** — e.g. `Blue · fan · Default` — so the
  admin knows which prop's dataset they are editing. The new segment MUST honor
  `.claude/rules/no-layout-shift.md` (ghost-sizer / reserved width; the longest
  prop name sizes the box).
- Prop Geometry tier and all other tiers: no UX change.

## §7 — Tiers, restated (the mental model this locks in)

| Tier | Scope | Prop? | Letter? | Role |
|---|---|---|---|---|
| Global Override | manual catch-all | combo (L1/L2/L3) | yes | top manual override |
| Special JSON | per-letter dataset + Firestore | no | yes | hand-tuned per-letter |
| Prop Geometry | per-combo clearance nudge | this + other | no | dodge the OTHER prop's body |
| **Default** | **per-prop baseline (new)** | **this** | no | **where THIS prop's arrow sits** |

Default = "natural resting place for this prop." Prop Geometry = "extra clearance
when the partner prop intrudes." They no longer overlap conceptually.

## Testing

- **Staff regression:** with no per-prop folders and a staff-only Firestore doc,
  resolution is byte-identical to today. Existing default-placement unit tests
  pass unchanged.
- **Seed parity:** a freshly seeded `<prop>` dataset returns the same values as
  staff for every `(grid, motion, placementKey, turns)`.
- **Cascade:** P Firestore override wins over P static seed; P static seed wins
  when no override; unseeded prop falls to staff static JSON.
- **propType threading:** end-to-end from `calculateDefaultAdjustment` →
  rendered arrow position reflects the prop's dataset.
- **Back-compat decode:** a legacy Firestore default doc (no prop segment) reads
  under `staff` and still shadows the staff JSON.
- **Loader isolation:** loading `fan` does not mutate or read `staff`'s cached
  placements (separate `[gridMode][prop]` buckets).

## Out of scope

- Per-prop Special JSON / Global (rejected option B).
- Family-level dataset sharing (future optimization).
- A "promote tuned Firestore values back into committed JSON" tool (nice-to-have;
  can follow once tuning volume justifies it).
- Migrating staff's root files into a `staff/` folder (kept at root for
  back-compat; not worth the churn).

## Related

- `.claude/rules/verify-at-canonical-source.md` — Default is the canonical
  baseline; corrections ground here.
- `.claude/rules/no-layout-shift.md` — the new dock-head prop segment.
- `src/lib/shared/pictograph/arrow/positioning/prop-geometry/` — the per-combo
  clearance tier this design leaves intact.
