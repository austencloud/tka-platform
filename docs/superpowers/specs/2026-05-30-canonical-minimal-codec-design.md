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

**Per motion (uniform — no float special case):**

| Field | Width | Notes |
|-------|-------|-------|
| startLocation | 2 char | |
| endLocation | 2 char | |
| rotationDirection | 1 char | `cw` / `ccw` / `noRotation`. For a float this slot carries the **prefloat** rotation direction (always `cw`/`ccw`, since floats are always shifts). |
| turns | existing turn-code | whole + half turns (0, 0.5, 1, 1.5, …) and `f` for float; encoding carried over from v3 unchanged |

**Every motion is exactly these four fields.** There is no appended float tail.

The key symmetry: every motion already has a `rotationDirection` slot, and for a
float that slot was otherwise wasted (it would hold `noRotation`, which carries no
information). Instead, a float stores its **prefloat rotation direction** in that
slot. This is sound because:

- Floats are always shifts (MCP: "float only applies to shifts"), so the prefloat
  is always pro/anti, so the prefloat rotation is always `cw`/`ccw` — the slot
  always carries a real value.
- `prefloatMotionType` is then derived from that rotation + locations using the
  **same** orbital rule that derives a normal motion's `motionType` from its
  rotation. The `prefloatMotionType ↔ prefloatRotationDirection` map is the same
  bijection as `motionType ↔ rotationDirection`, just applied to the prefloat
  slot. The forward half already exists (`step-deriver.ts:derivePrefloatRotation`,
  `SoloPropStepData.ts:25-27`); the codec uses its inverse on decode.

So neither prefloat field is stored separately: the rotation lives in the existing
per-motion rotation slot, and the motion type is derived. Float collapses to the
same 4-field shape as every other motion.

### Derived on decode

- **isFloat** — `turns == "fl"`; sets `motionType = float` and routes the stored
  rotation slot to `prefloatRotationDirection`
- **motionType** (non-float) — from `{startLocation, endLocation,
  rotationDirection, turns}`
- **prefloatMotionType** (float only) — from the stored rotation slot + locations
  (same orbital rule as motionType)
- **handPath** (incl. hashIn/hashOut) — from locations (center involvement) +
  orbital direction
- **startOrientation** (per motion) — chained from the seed, per hand
- **endOrientation** (per motion) — from motionType + turns + rotationDirection +
  locations + startOrientation (floats use the locations-only handpath rule)
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

Per-motion drops from 8 fields (v1) → 6 (v3) → **4** here, uniformly — floats
included (the prefloat rotation rides in the existing rotation slot, so a float is
the same 4 fields as anything else, no tail). propType moves from N per-motion
occurrences to 2 header chars. For a typical 8-step two-hand sequence the motion
payload is roughly half of v1, and every redundant axis (orientation, motionType,
handPath, per-motion prop, prefloatMotionType) is structurally impossible to
desynchronize from its source.

---

## Motion-type derivation rule

### Two independent axes

The TKA data model carries **two parallel classifications**, stored as separate
CSV columns and separate model concepts:

- **`MotionType`** (`{pro, anti, float, dash, static}` — exactly five). This is the
  field the codec stores/derives. `hash` is **not** a `MotionType` value.
- **`HandPath` / `HandMotionType`** (`{cw, ccw, dash, static, hashIn, hashOut}`).
  This is where `hash` lives. `csv-pictograph-parser.ts:50-53` reads it from the
  separate `blueHandPath` column; `hand-path-factory.ts:23` keys the centric path
  off `locations.includes(CENTER)`.

**Hash is the hand-path label for any straight-line motion touching center**
(dash−, half-distance). Both directions are hash: `hashIn` = end is center,
`hashOut` = start is center. Because hash is determined purely by center
involvement and the codec stores both locations, **the hash label is always
recoverable and never lost** — it does not need its own stored field on either
axis.

### Deriving the stored `motionType`

```
deriveMotionType(startLoc, endLoc, rotationDirection, turns):
    if turns == "fl":                       return FLOAT
    orbit = deriveHandOrbitalDirection(startLoc, endLoc)   # existing primitive
    if orbit != null:                        # it's a shift arc
        return (rotationDirection == orbit) ? PRO : ANTI
    if startLoc == endLoc:                    return STATIC
    # straight line (perimeter↔perimeter opposite, OR perimeter↔center):
    # both are DASH on the MotionType axis; the HandPath axis labels the
    # center-touching ones hash (hashIn/hashOut), derived separately below.
    return DASH
```

### Deriving the hand path (separate, geometry-only)

```
deriveHandPath(startLoc, endLoc, rotationDirection, turns):
    if turns == "fl":                       return orbit(startLoc, endLoc)  # the stored slot already holds prefloat cw/ccw
    orbit = deriveHandOrbitalDirection(startLoc, endLoc)
    if orbit != null:                        return orbit            # cw / ccw (shift)
    if startLoc == endLoc:                    return STATIC
    if startLoc == CENTER:                    return HASH_OUT        # center -> perimeter
    if endLoc   == CENTER:                    return HASH_IN         # perimeter -> center
    return DASH                                                      # perimeter <-> opposite
```

Both derivers consume the same stored fields and the same canonical
`deriveHandOrbitalDirection` primitive.

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
  The motion's stored rotation slot holds the prefloat rotation direction
  (`cw`/`ccw`); `prefloatMotionType` is derived from that slot + locations via the
  same orbital rule. Nothing about the float is stored beyond the four uniform
  fields.
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
Shifts are exempt — a 0-turn pro/anti keeps its arc direction. In the live model a
float clears `rotationDirection` to `NO_ROTATION` and stashes the real direction in
`prefloatRotationDirection` (`turns-handler.ts:70-77`). The codec inverts this on
**encode**: for a float it writes the prefloat rotation direction into the single
stored rotation slot (never `noRotation`, since floats are always shifts), and on
**decode** routes that slot back to `prefloatRotationDirection` while setting
`motionType = float`. The `turns == "fl"` marker is what tells encode/decode which
interpretation the slot takes.

The decode pipeline orders derivation as a DAG with no cycles:
`motionType` (needs only locs + rotDir + turns) → `startOrientation` (chained
seed) → `endOrientation` (needs motionType + startOrientation). No step depends on
a value derived later.

---

## Fully handled (no stored field needed)

- **hash (`HandMotionType.HASH_IN/OUT`):** pure geometry. A hash is a straight line
  to/from center (dash−). On the `MotionType` axis it derives to `dash` (rotation
  physics are dash-identical); on the `HandPath` axis `deriveHandPath` returns
  `hashIn` (end is center) / `hashOut` (start is center) from center involvement.
  Both directions are hash. Recovered entirely from the stored locations — no
  caveat, no reserved marker. The parity gate asserts both derivers against real
  data.
- **center positions (Tau / Terra):** `c` is a valid `GridLocation`. A `c→c`
  motion is `static` (start == end). A perimeter↔center motion is `dash`
  (MotionType) + `hash` (HandPath), per above. Fully derived.

## Known boundaries (genuinely not derivable — flagged, out of scope today)

- **skew (`SkewDirection +/-`, L5+):** arc length is **not** derivable from
  endpoints (e.g. S→NE spans multiple segments and is reachable by more than one
  arc). Skews are not in the current `MotionType` encoding. When L5+ skew encoding
  lands, it MUST store an explicit skew marker; derivation cannot recover it. This
  is the one axis that earns a stored field when it arrives. Not built now; the
  parity gate flags any current data that would need it.

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
  -> for each motion: parse {startLoc, endLoc, rotDir, turns}   # 4 fields, uniform
       if turns == "fl":
         -> motionType = float
         -> prefloatRotationDirection = rotDir           # the stored slot
         -> prefloatMotionType = deriveMotionType-rule(locs, rotDir)
       else:
         -> motionType = deriveMotionType(locs, rotDir, turns)
       -> handPath        = deriveHandPath(locs, rotDir, turns)
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
   pictograph dataframe (all letters, both grid modes, including centric/Tau/Terra
   rows). For each, run `deriveMotionType(locs, rotDir, turns)` and assert it
   equals the stored `motionType`, AND run `deriveHandPath(...)` and assert it
   equals the stored `blueHandPath`/`redHandPath` (hashIn/hashOut/dash/static/
   cw/ccw). Any miss — center/hash, skew, an unexpected pair — fails the build and
   names the offending motion. This proves losslessness against real data, not
   against hand-reasoning.
2. **Round-trip.** For a representative sequence set: encode → decode reproduces
   every motion's motionType, handPath, startOrientation, endOrientation,
   propType, and — for floats — both `prefloatMotionType` (derived) and
   `prefloatRotationDirection` (the stored rotation slot). A float-specific case
   asserts the stored rotation slot round-trips and the pro/anti is recovered.
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
- Every motion is exactly four stored fields (startLoc, endLoc, rotationDirection,
  turns); no float special-case tail.
- `motionType`, `handPath`, both orientations, per-motion `propType`, and (for
  floats) `prefloatMotionType` are absent from the stored string and reconstructed
  on decode. A float's prefloat rotation rides in the existing rotation slot.
- Exhaustive corpus parity test passes for every motion in both grid modes, on
  both the `motionType` and `handPath` axes.
- Round-trip preserves all derived fields, including float prefloat recovery.
- `deriveHandOrbitalDirection` / `deriveMotionType` / `deriveHandPath` /
  `calculateEndOrientation` exist as exactly one canonical copy each.
- `reencodeFlat`, recipe-hash version logic, and the v1/v2/v3 branches are gone.
