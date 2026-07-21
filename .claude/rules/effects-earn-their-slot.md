# Effects Must Earn Their Slot — ENFORCED

## The Problem This Solves

The TKA 3D effects system is a premium-differentiator feature. Every effect slot must **uniquely visualize** something no other effect covers. Derivative effects — "it's similar to X but slightly different" — dilute the system and fail the quality bar.

Austen's precedent: the Motion effect was renamed to Echo after the 2026-04-17
pivot specifically because its original framing duplicated existing
visualization logic. Echo was renamed again to **Ghost** (onion-skin prop
sprites) in `5931d08ec2` on 2026-06-29 — the same commit renamed Water to
**Goo**. Use the current ids; `echo` and `water` no longer resolve anywhere.

Memory: `feedback_effects_must_earn_slot.md` — "each effect must uniquely visualize something; reject derivative designs."

## The Rule

Before speccing or building a new visual effect, you MUST state:

1. **What this effect uniquely visualizes** — in a single sentence, name the observable the effect reveals that no existing effect reveals.
2. **Which existing effects it could be confused with** — and what distinguishes this effect mechanically (not aesthetically).
3. **The test for whether it passes the uniqueness bar** — if the user could be told "this is a tweak to effect X" without confusion, it is a tweak, not a new effect.

If the answer to #1 is vague ("it looks cool," "it adds atmosphere," "it's similar to trails but..."), STOP. That effect does not earn a slot.

## Forbidden

- Proposing a new effect without stating its unique observable
- Adding an effect spec to the effects-unification project when the slot-earning statement reads as a variation of an existing effect
- Shipping effect code labeled with a generic name like "Motion" or "Flow" without a specific, non-overlapping visualization target

## Existing slots (verified 2026-07-21)

The registry is the source of truth — read
`src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`
rather than trusting this list, which has gone stale before. As of 2026-07-21
it holds 16 slots:

`trails` · `fire` · `led` · `charcoal` (Coal) · `zap` · `sparkles` · `ghost` ·
`bloom` · `goo` · `bubbles` · `petals` · `smoke` · `ink` · `silk` · `animal` ·
`pulse`

Before proposing a new effect, read `project_effects_unification.md` in memory
and the specs under `docs/superpowers/specs/` matching `*effect*` / `*bloom*` /
`*trail*`.

## Related

- Memory: `feedback_effects_must_earn_slot.md`
- Memory: `project_effects_unification.md`
- Memory: `project_3d_effects.md`
