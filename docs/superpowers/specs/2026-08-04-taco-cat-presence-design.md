# Taco Cat Presence — giving the ghost a body

**Date:** 2026-08-04
**Status:** Design approved, blocked on art
**Depends on:** `2026-08-04-ghost-mind-design.md` (the brain must exist first)
**Deferred sibling:** the docent (spoken greeting, guided walkthrough, reset offer)

---

## The problem

The mind spec produces a presenter that genuinely explores the app and narrates
why. It wears the existing body: a 28px glowing accent dot.

A dot is the right body for building and validating the brain. It is the wrong
body for a flow jam. Austen's ask (2026-08-04):

> "I want Taco Cat to be the one who's exploring the software so that when I
> bring it to Taco Tuesday Flo Jam people see their beloved Taco Cat"

The value is specific and worth naming: at that jam the audience is not
strangers evaluating software, it is a community who **already know this
character**. Recognition does the work that a product tour cannot. Someone
glances over, sees a friend, and looks for longer than they would have.

## Before anything else: ask

`flowtacocat` appears in this codebase twice, both as a **creator handle** in
`src/lib/features/creators/state/creators-data-state.svelte.ts:30`. Taco Cat is
a real person in the community, not an existing mascot — there is no character
art, no lore, and no asset anywhere in the repo.

Putting a real community member's character into the product, on a laptop, at
their own jam, is worth an explicit "can I?" first. This is a prerequisite
task, not a caveat. Everything below assumes yes.

## Non-goals

- **Dialogue.** "Oh hi, I was waiting for you" and the guided walkthrough are
  the docent spec. This one is silent-except-for-thoughts, exactly like the
  mind spec's ghost.
- **Animation richness beyond the pose set.** Nine poses, crossfaded. Not a
  rigged character, not a physics tail, not per-frame lipsync.
- **Replacing the dot everywhere.** The composer marketing acts keep the dot;
  it suits that page. Taco Cat is the presentation-mode body.

---

## Architecture: one seam

The mind already drives an abstract pointer. Make the body a swappable
implementation behind a single seam rather than editing `GhostPointer.svelte`
in place — the dot must survive for the composer acts, and the dot is also the
fallback if art is late.

```
  Mind  →  GhostState { x, y, pressed, visible, parked }
                     +  GhostMood  (new, from the active intention)
                            |
                     <GhostBody>
                       ├── DotBody.svelte       existing pointer, unchanged
                       └── TacoCatBody.svelte   new
```

`GhostBody` picks its implementation from a `body: "dot" | "tacocat"` prop.
Nothing above the seam knows which is mounted. The mind spec ships with `dot`;
this spec adds `tacocat` and flips presentation mode to it.

### Mood is derived, never hand-set

A pose that has to be authored per action is another treadmill. Pose resolves
from state the system already has:

```ts
type GhostMood =
  | "curious"      // default — the intention didn't say otherwise
  | "thinking"     // between intentions, while scoring
  | "lightbulb"    // a high-scoring intention just won decisively
  | "delighted"    // an `admire` intention is running
  | "bored"        // the active category's fatigue is high
  | "overwhelmed"  // the `overwhelmed` intention
  | "waiting";     // parked after takeover
```

Motor state wins over mood: `pressed` and mid-glide always render their own
poses regardless of what the intention wanted. Order of precedence, highest
first: `parked` → `pressed` → `moving` → intention `mood` → `curious`.

`lightbulb` is the one worth getting right. It fires when the winning
intention's final score exceeded the runner-up by a wide margin — a genuine
"oh!" rather than a coin flip. That makes the lightbulb *mean* something, and
it will land at exactly the moments Austen described.

### Pose set (9)

`idle` · `moving` · `pressing` · `thinking` · `lightbulb` · `delighted` ·
`bored` · `overwhelmed` · `waiting`

### Art requirements

The gating dependency. What the implementer needs delivered:

- **Format: SVG sprite, one symbol per pose.** Reasons: the ghost must be crisp
  at 3840×2160 (`4k-native-layout.md` — the park laptop may drive a TV), the
  poses need to recolor against light and dark backgrounds, and nine SVGs cost
  less than nine PNG size-variants. Lottie is rejected: a runtime dependency
  and a per-frame cost for what is a nine-state swap.
- **Readable at ~4.5 m.** The jam test is someone glancing from across a
  circle. Silhouette must carry the pose — if `bored` and `curious` are
  distinguishable only by an eyebrow, they are the same pose.
- **Transparent background**, single consistent baseline/anchor point across
  all nine so the character does not jump when the pose changes.
- **Sized in `rem`**, not px, so it rides the root ramp (`4k-native-layout.md`).
  Nominal ~4rem tall; the pointer hotspot is an explicit anchor offset in the
  SVG, not the center of the box.

Place under `static/branding/tacocat/`. If art slips, the dot ships and this
spec waits — the seam makes that a one-prop decision, not a rollback.

### The thought bubble

The mind spec renders thoughts in `ThoughtCaption.svelte`. This spec restyles
it as a speech bubble anchored to the character. Three constraints, all of
which are existing house rules and all of which the naive version violates:

1. **No layout shift.** Thought text is variable-width and changes at runtime —
   the textbook ghost-sizer case from `no-layout-shift.md`. The bubble is
   absolutely positioned relative to the character and must never resize
   anything around it.
2. **Crossfade between thoughts via the shared primitive.** Use
   `src/lib/shared/components/Crossfade.svelte` with `key` = the thought
   string. Per `crossfade-primitive.md` this is cheap content, so the `{#key}`
   remount is correct — but it is inside a sized bubble, so it needs `fill`,
   and anything constant across thoughts (the bubble tail, the chrome) stays
   **outside** the crossfade. That rule exists because this exact mistake is
   the documented first-attempt failure.
3. **Flips to stay on screen.** Bubble sits above-right by default and mirrors
   to above-left near the right edge, so it never runs off and never covers the
   control the character is about to press.

Hold each thought for a minimum readable duration even if the intention
finishes faster; a caption that flickers is worse than no caption.

### Accessibility

The character and bubble are decorative in presentation mode:
`aria-hidden="true"`, `pointer-events: none`, exactly as `GhostPointer` does
today. The parked "watch it again" affordance keeps its real `<button>` with
its 44px hit area — that survives the body swap unchanged and is the only part
of the body that is ever interactive.

Presentation mode does not mount under `prefers-reduced-motion`.

---

## Verification

New visual surface, so screenshots are required per
`visual-verification-mandatory.md`: 1920×1080, 2560×1440, 3840×2160, 1440×900.
Small-end viewports are skipped and that skip is recorded — the target is a
laptop at a park.

Specific things the frames must answer, none of which a green typecheck can:

- All nine poses at 3840 — is the character still legible, or is it punctuation?
- A long thought near the right edge — does the bubble flip, or run off?
- The bubble over a dense picker — does it cover the control being pressed?
- Pose transition — does the character jump because two SVGs disagree on the
  anchor point?

## Risks

| Risk | Mitigation |
|---|---|
| Art is late or never arrives | The dot ships; `body="dot"` is the default and this whole spec is one prop away |
| Character reads as gimmicky outside its home crowd | It is presentation-mode only and opt-in. It never appears in the product for ordinary users |
| Poses indistinguishable at distance | Silhouette requirement above, verified in the 3840 frame, not assumed |
| Bubble covers the action | Flip rule + the dense-picker frame in verification |
| Permission not secured | Prerequisite task, gates the whole spec |
