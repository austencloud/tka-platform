# Canonical Minimal Sequence Codec — Design

**Date:** 2026-05-30
**Status:** Approved for planning
**Author:** Austen + Claude (brainstorming session)

**Goal:** Replace the versioned TKA sequence codec with a single canonical format
that stores only the irreducible fields of a sequence and derives everything
else (motionType, both orientations, per-motion propType) on decode. Structurally
prevent stored-vs-derived drift, and shrink the encoded payload.

**Why now:** Choreo Cards are **not released**. No shortcodes, QR codes, or shared
URLs are in the wild that must keep decoding. Nothing is set in stone, so the
codec can be overhauled rather than version-extended. This removes the entire
reason the v1/v2/v3 machinery existed.

---

## Background: where the codec is today

The shared codec lives in
`src/lib/shared/navigation/services/sequence-encoder.ts`. As of the v2/v3 work
earlier today it carries three motion-format versions on a flat pipe-delimited
string:

- **v1** (legacy, no sentinel): per-motion 8 fields incl. both orientations.
- **v2** (`v2|`): drops `endOrientation`, derives it on decode.
- **v3** (`v3|<blueSeed><redSeed>|`): also drops per-motion `startOrientation`,
  chaining it from a 2-char per-hand seed.

The format string feeds three transports: shortcodes (`tka.run/<code>`), inline
offline blobs (`s~…`), and shared deep links / route paths. A content-addressed
`encoderHash` (SHA-256 of the encode output) dedups sequences. Recipe QR codes
(`r1:`) hash a seed sequence and verify by re-encoding.

Because the format string changed across v1→v2→v3, the `encoderHash` of a given
sequence changed too. With nothing released, that drift is irrelevant: there is
no stored corpus of hashes to stay compatible with.

---

## The irreducible model

A motion's behavior is fully specified by its spatial inputs plus one
per-hand orientation seed for the whole sequence. Everything else is a
classification or a propagation of those inputs.

### Stored

**Header (once per sequence):**

| Field | Width | Notes |
|-------|-------|-------|
| blue orientation seed | 1 char | start-position blue `startOrientation` |
| red orientation seed | 1 char | start-position red `startOrientation` |
| blue prop type | 1 char | sequence-wide; supports cat-dog mixed props |
| red prop type | 1 char | sequence-wide |

**Per motion:**

| Field | Width | Notes |
|-------|-------|-------|
| startLocation | 2 char | |
| endLocation | 2 char | |
| rotationDirection | 1 char | `cw` / `ccw` / `noRotation` |
| turns | existing turn-code | whole + half turns (0, 0.5, 1, 1.5, …) and `f` for float; encoding carried over from v3 unchanged |

**Per FLOAT motion only (appended when `turns == "fl"`):**

| Field | Width | Notes |
|-------|-------|-------|
| prefloatMotionType | 1 char | the pro/anti the float came from — NOT derivable |
| prefloatRotationDirection | 1 char | NOT derivable |

### Derived on decode

- **motionType** — from `{startLocation, endLocation, rotationDirection, turns}`
- **startOrientation** (per motion) — chained from the seed, per hand
- **endOrientation** (per motion) — from motionType + turns + rotationDirection +
  locations + startOrientation
- **propType** (per motion) — copied from the header value for the motion's color

### Why each derived field is safe to drop

- **propType:** `SequenceData.ts:71` already documents *"propType removed — prop
  type is a viewer preference, not sequence data"*, and `MotionData.ts:102` notes
  *"motion.propType is stored but ALWAYS overridden by global settings during
  render."* Prop varies per hand (cat-dog mode), never per motion. The sequence
  already models `bluePropType` / `redPropType` at the top level
  (`SequenceData.ts:161-162`). Carrying it in the codec at all is deliberate — so
  a scanned sequence renders with the same prop the printed card shows — but it
  belongs in the header, once.
- **orientations:** already derived as of v3; mechanism unchanged.
- **motionType:** see derivation rule below.

### Size

Per-motion drops from 8 fields (v1) → 6 (v3) → **4** here (plus a 2-field tail on
floats only). propType moves from N per-motion occurrences to 2 header chars. For
a typical 8-step two-hand sequence the motion payload is roughly half of v1, and
every redundant axis (orientation, motionType, per-motion prop) is structurally
impossible to desynchronize from its source.

---

## Motion-type derivation rule

Motion types (from Flow Arts Knowledge MCP, `MotionType` enum):
`pro, anti, float, dash, static` — exactly five. `hash` is **not** a stored
`MotionType` (it lives in `HandMotionType` / `SkewDirection`); it does not appear
in the encoded space today.

The classifier is a composition of an existing, battle-tested primitive plus a
trivial split:

```
deriveMotionType(startLoc, endLoc, rotationDirection, turns):
    if turns == "fl":                       return FLOAT
    orbit = deriveHandOrbitalDirection(startLoc, endLoc)   # existing primitive
    if orbit != null:                        # it's a shift arc
        return (rotationDirection == orbit) ? PRO : ANTI
    # orbit == null  => non-shift straight-line / stationary trajectory
    return (startLoc == endLoc) ? STATIC : DASH
```

**Reuse, not reinvention.** `deriveHandOrbitalDirection(startLoc, endLoc)` already
exists (in `rotation-direction-pattern-manager.ts` and
`step-operations/rotation-direction-handler.ts`). Its documented contract: return
`cw`/`ccw` for a shift arc, `null` for a dash/static trajectory. Concretely it is
a hardcoded pair table covering the two 90° shift families of the L1-4 space —
diamond (cardinal: s→w, w→n, n→e, e→s + reverses) and box (intercardinal: ne→se,
se→sw, sw→nw, nw→ne + reverses). Every pair NOT in that table returns `null`,
which is precisely why the static/dash split downstream is safe for the current
encodable space, and precisely where skews (L5+, cross-mode or extended arcs)
would fall through — see boundaries. The existing
`deriveMotionType` in those files is only a *partial* classifier (it resolves
pro-vs-anti but returns the **stored** type for static/dash/float). Our codec has
no stored type on decode, so we need the *full* classifier above — but it is built
from the same primitive, so it inherits the same ground-truth orbital table.

**Single source of truth.** `deriveHandOrbitalDirection` is currently duplicated.
This design extracts ONE canonical copy into the shared deriver module (alongside
`calculateEndOrientation`) and points the codec, the create-module callers, and
the existing partial `deriveMotionType` at it. No new orbital table is authored.

### Why the rule is correct for each type

- **float:** identified by the `turns == "fl"` marker before any geometry check.
  Its underlying pro/anti is preserved as stored prefloat fields.
- **shift (pro/anti):** `deriveHandOrbitalDirection` returns the arc direction;
  `rotationDirection` is guaranteed `cw`/`ccw` on shifts (see invariant below), so
  the pro/anti comparison always has a real direction to compare against.
- **static:** `startLoc == endLoc`, orbit is null.
- **dash:** straight line to a non-equal location, orbit is null.

### The load-bearing invariant (verified)

Pro-vs-anti derivation requires that **every shift stores a `cw`/`ccw`
rotationDirection, even at 0 turns.** Confirmed in
`step-operations/turns-handler.ts:88-111`: the block that zeroes
`rotationDirection` to `NO_ROTATION` at 0 turns is gated on `isDashOrStatic`.
Shifts are exempt — a 0-turn pro/anti keeps its arc direction. Float is the only
place a shift's rotationDirection is cleared (`turns-handler.ts:70-77`), and that
case is caught first by the `turns == "fl"` branch, with the real direction
preserved in `prefloatRotationDirection`.

The decode pipeline orders derivation as a DAG with no cycles:
`motionType` (needs only locs + rotDir + turns) → `startOrientation` (chained
seed) → `endOrientation` (needs motionType + startOrientation). No step depends on
a value derived later.

---

## Known boundaries (flagged, out of scope today)

These are not bugs in the design; they are the edges of what the current encoded
space contains. Each is guarded by the parity ship gate below.

- **hash (`HandMotionType.HASH_IN/OUT`):** not a stored `MotionType`. A hash is a
  straight line to/from center; `deriveHandOrbitalDirection` returns null for it,
  so the classifier yields `dash` (its rotation physics are dash-identical). If
  hash is ever promoted to a stored `MotionType`, it needs a center-involvement
  branch. The parity gate will flag any current data that misclassifies.
- **skew (`SkewDirection +/-`, L5+):** arc length is **not** derivable from
  endpoints (e.g. S→NE spans multiple segments and is reachable by more than one
  arc). Skews are not in the current `MotionType` encoding. When L5+ skew encoding
  lands, it MUST store an explicit skew marker; derivation cannot recover it. The
  format reserves room for this; it is not built now.
- **center positions (Tau / Terra):** `c` is a valid `GridLocation`. A `c→c`
  motion is `static` (start == end); a perimeter↔center motion classifies as
  `dash`. Covered by the parity gate.

---

## What gets removed

With nothing released, the version machinery is dead weight:

- v1 / v2 / v3 sentinels and their separate decode paths → **deleted**; one format.
- `reencodeFlat` and all version-aware re-encoding → **deleted**.
- Recipe-hash version-awareness in `compositional-decoder.ts` → **deleted**
  (single format means one hash basis).
- Backfill migration of stored `encoderHash` → **not needed**. No released corpus
  exists to stay compatible with. Any dev/test sequences are regenerated.

The permanent-legacy-decode obligation is gone. There is exactly one encode path
and one decode path.

---

## Architecture

### Modules

- **`sequence-encoder.ts`** — the single encode/decode entry points. Encode emits
  the header + per-motion fields. Decode parses them and calls the deriver module.
  All `formatVersion` parameters, the v1/v2/v3 branches, and `reencodeFlat` are
  removed.
- **Shared deriver module** (canonical, single copy) — houses
  `deriveHandOrbitalDirection`, the full `deriveMotionType`, and
  `calculateEndOrientation`. The codec and the create-module callers import from
  here. This is the anti-drift core: one place computes each derived field.
- **`compositional-encoder.ts` / `compositional-decoder.ts`** — recipe QR path,
  simplified to the single format (no seed-version branching).
- **`short-code-manager.ts` / `public-sequence-hash-matcher.ts`** — unchanged in
  interface; they continue to hash `encodeSequence` output. The hash basis is now
  the single canonical format.

### Data flow (decode)

```
encoded string
  -> parse header (2 ori seeds, 2 prop types)
  -> for each motion: parse {startLoc, endLoc, rotDir, turns [+ prefloat if fl]}
       -> deriveMotionType(locs, rotDir, turns)
       -> startOrientation = running per-hand chain (seeded)
       -> endOrientation   = calculateEndOrientation(type, turns, rotDir, locs, startOri)
       -> propType         = header[color]
  -> SequenceData
```

### Error handling

- Unknown field codes (malformed string) → decode throws a typed error; callers
  already handle decode failure (e.g. `decodeSequenceFromQR` try/catch).
- A motion whose `deriveMotionType` result contradicts an internal consistency
  check (e.g. `turns == "fl"` on non-shift geometry) → throws, because that
  indicates corrupt input, not a recoverable state.

---

## Testing

The parity test is the centerpiece and the direct answer to "is there a bug in
the weeds."

1. **Exhaustive corpus parity (ship gate).** Enumerate every motion in the real
   pictograph dataframe (all letters, both grid modes). For each, run
   `deriveMotionType(locs, rotDir, turns)` and assert it equals the stored
   `motionType`. Any miss — center/hash, skew, an unexpected pair — fails the
   build and names the offending motion. This proves losslessness against real
   data, not against hand-reasoning.
2. **Round-trip.** For a representative sequence set: encode → decode reproduces
   every motion's motionType, startOrientation, endOrientation, propType, and
   prefloat pair.
3. **Orientation algebra** (carried over from the v2/v3 tests): pro/anti × turns
   parities, fractional turns, nonradial seeds.
4. **Drift guard.** Extend `deriver-parity.test.ts` to assert the codec's
   classifier and the create-module callers resolve through the same single
   `deriveHandOrbitalDirection` / `deriveMotionType`, so a future edit can't
   reintroduce a divergent copy.
5. **Prop placement.** Header carries blue/red prop; cat-dog (mixed) props
   round-trip; per-motion propType on the hydrated `MotionData` matches the header
   value for its color.

A failing parity test on any motion is a hard stop: either the classifier needs a
rule (e.g. a stored marker for that class) or the data is wrong. No motion ships
on a guessed type.

---

## Success criteria

- One encode path, one decode path; no version sentinels anywhere in the codec.
- `motionType`, both orientations, and per-motion `propType` are absent from the
  stored string and reconstructed on decode.
- Exhaustive corpus parity test passes for every motion in both grid modes.
- Round-trip preserves all derived fields + prefloat.
- `deriveHandOrbitalDirection` / `deriveMotionType` / `calculateEndOrientation`
  exist as exactly one canonical copy each.
- `reencodeFlat`, recipe-hash version logic, and the v1/v2/v3 branches are gone.
