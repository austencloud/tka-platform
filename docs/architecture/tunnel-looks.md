# Tunnel Looks — the kaleidoscope symmetry engine

Status: accepted (2026-07-06). Supersedes the `fold` + `mirror` tunnel config.

## Context

The tunnel art view overlays transformed copies of the open sequence to form a
kaleidoscope. The original model had two knobs:

- `fold: 2 | 4 | 8` — number of **rotational** copies (cyclic group Cₙ).
- `mirror: boolean` — when on, appended a mirrored copy of the **entire**
  rotational stack (promoting Cₙ → the dihedral group Dₙ, doubling the copies).

Each copy draws 2 props (blue + red). So `fold 2 + mirror` produced 4 copies =
**8 props**, when the natural expectation of "mirror" is a single reflected copy
= 4 props. Mirror was a multiplier stacked on top of fold, not a peer
permutation — the density exploded and the prop count was illegible.

Austen (2026-07-06): *"we've treated mirrored as though it's a subtoggle applied
on top of rotated instead of its own permutation and thusly ended up with too
many props on the screen ... maybe what you need to be able to do is apply a
specific transformation upon each individual performer."*

## Decision

Model the tunnel as a **look**: the always-drawn base plus an explicit,
hand-curated list of extra copies. Each copy is an ordered chain of transform
ops. On-screen prop count is exactly `(copies.length + 1) * 2` — nothing
multiplies behind the scenes.

```ts
// tunnel-looks.ts
type CopyOp =
  | { kind: "rotate"; amount: number } // 45° units → rotateSequence
  | { kind: "mirror" }                 // → mirrorSequence
  | { kind: "flip" }                   // → flipSequence
  | { kind: "invert" }                 // → invertSequence (counter-rotation)
  | { kind: "colorSwap" }              // → colorSwapSequence
  | { kind: "rewind" };                // → rewindSequence

interface TunnelLook { id: string; name: string; icon: string; copies: CopyOp[][]; }
```

`buildTunnelLayers(base, look)` folds each op chain onto the base via the
canonical `sequence-transforms.ts` functions. **No new transform math** — the
engine is pure composition over the transforms that already exist. Ops compose
in order (rotate-then-mirror ≠ mirror-then-rotate).

"Mirror" is now `copies: [[mirror]]` → 4 props. "Pinwheel" (the old fold 4) is
`[[rot2],[rot4],[rot6]]` → 8 props. Every symmetry — rotation, reflection,
motion inversion, time reversal, color swap — is a first-class peer, and dense
mandalas are curated copy lists rather than an accidental group closure.

## The catalog

Curated by eye at `/test/tunnel-looks` (a judging gallery rendering the real
kaleidoscope for every candidate on one playhead). Per
`effects-earn-their-slot.md`, each look must uniquely visualize a symmetry no
other look covers.

| Look | copies | props | uniquely visualizes |
|---|---|---|---|
| Radial | `[rot…]` per arm count | 4 / 8 / 16 | N-fold rotation, arm count tunable (2/4/8) |
| Mirror | `[mirror]` | 4 | reflection across the vertical axis |
| Flip | `[flip]` | 4 | reflection N↔S |
| Counter | `[invert]` | 4 | counter-rotating overlay (PRO↔ANTI, CW↔CCW) |
| Echo | `[rewind]` | 4 | time-reversed copy |
| Cross | `[mirror],[flip],[rot4]` | 8 | dihedral D₂ (both reflection axes) |
| Mandala | 4-fold rot × mirror | 16 | curated D₄ |

Grid = 8 points (45° steps), so only 2/4/8-fold rotation is representable;
3/6-fold are not.

**Radial** is a density-tunable look: the old Duo (2-fold) / Pinwheel (4-fold) /
Kaleidoscope (8-fold) collapse into one look whose arm count is a tuner stepper
(`DensitySpec.build` generates the copy list from the count). It also carries a
**Mirror** toggle (`DensitySpec.mirrorable`): off = pure rotation, on = the
dihedral reflection copies (rotational → Mandala-style). Mirror is an explicit,
opt-in, default-off control — NOT the old hidden always-on multiplier that caused
the original prop explosion. Because reflection doubles the copies, mirror-on is
capped to `maxMirrorArms` (4 → 16 props; 8 mirrored would be 32, visual mush).

**Mandala** is kept as its own named tile even though `Radial + mirror + 4 arms`
renders the same D₄ — the tile is the one-tap "give me the fancy one," the toggle
is the tunable path. A small, deliberate overlap.

**Prism** (`[colorSwap]`) was cut — colorSwap only recolors, applies no spatial
transform, so the copy lands exactly on top of the base and the look reads as
doing nothing. The `colorSwap` op stays a valid `CopyOp` kind; no shipped look
uses it.

### Rejected: a figure Spin / Phase tuner

A tuner that rigidly rotated the whole figure (adding a degree offset to each
prop's `centerPathAngle` + `staffRotationAngle`) was prototyped and removed. The
prop's `centerPathAngle` is its angle **on the 8-point grid**; nudging it off a
grid point teleports the prop to a wrong location instead of smoothly rotating.
Any future "spin the whole thing" must rotate the rendered output (e.g. a CSS
transform on the stage), never perturb per-prop grid angles. Density is the only
per-look tuner that shipped.

## Consequences

- **Prop count is legible and curated.** A look lists exactly the copies it
  draws. No hidden doubling.
- **Reduced motion** clamps a dense look (`propCount > 8`) to a calm one on
  selection (`TunnelViewController.setLook`), so the highlighted choice and the
  rendered kaleidoscope always agree — the same intent as the old fold cap.
- **Persistence** stores `lookId`; `tunnel-view-state.ts` migrates legacy
  `fold`/`mirror` snapshots to the nearest look.
- **User-saved presets removed.** `tunnel-presets.ts` (name-a-look save) is
  deleted — superseded by the built-in curated catalog. Its save UI was already
  removed 2026-07-05.
- **Prop sampling** was extracted to `tunnel-prop-sampling.ts` so the live
  controller and the judging gallery derive props identically.
- **Second consumer updated.** `PropUnlockCelebration.svelte` (prop-collection
  reveal) now selects the `pinwheel` / `duo` looks instead of building a
  fold/mirror config.

## Files

- `tunnel-looks.ts` — CopyOp, TunnelLook, the LOOKS catalog, propCount, RM caps.
- `tunnel-layer-builder.ts` — `buildTunnelLayers(base, look)` + op dispatch.
- `tunnel-prop-sampling.ts` — shared per-copy prop derivation.
- `tunnel-view-controller.svelte.ts` — `lookId` state, `activeLook`, `setLook`.
- `tunnel-view-state.ts` — persistence + legacy migration.
- `ArtSettingsPanel.svelte` — the Look grid (single-select icon tiles).
- `routes/test/tunnel-looks/` — the judging gallery.

## Related

- `never-hand-roll.md` (reuses `sequence-transforms.ts`), `effects-earn-their-slot.md`
- `crossfade-primitive.md`, `sequence-viewer-shell.md` (same anti-drift playbook)
