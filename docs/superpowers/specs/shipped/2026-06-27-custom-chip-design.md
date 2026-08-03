# Custom Chip — Design

> Re-introduces a **Custom** chip, cleanly separated from **Default** (which is now
> the factory anchor, per `e1f8389f21`). Builds on the personal-default machinery
> from `2026-06-27-personal-default-collapse-design.md` but repurposes it for an
> explicit Custom slot instead of overloading "Default".

## Problem

After Default was repointed to the factory look (so it reliably shows the
colour-matched red/blue), there was no longer any chip holding the user's tweaked
look. Austen: *"as soon as you make a modification to a preset it turns your option
into a custom option and it holds the custom."* He chose **silent overwrite** (no
prompt) for the single Custom slot.

## Model

Per effect, the "Choose a Look" row is: **Default · <named presets> · Custom**.

- **Default** — factory anchor (unchanged). For trail, the matched red/blue.
- **Named presets** — fixed alternative looks (Neon, Ember, …).
- **Custom** — a single slot holding your last-modified look. Greyed/disabled until
  your first edit. Any manual edit (from Default or any preset) captures the live
  config into the slot, silently, persisted across reload. Clicking Custom restores
  it. It lights when the live config equals the slot.

Flow: land on Default → try Neon → nudge a slider → Custom lights, holding the
nudged look → bounce between Default/Neon/Custom freely; editing again silently
updates Custom. No prompt (single live slot; undo recovers within the session).

## State — `effects-config-state.svelte.ts`

The dormant `personalDefaults` slot already auto-captures on every `updateEffect`
and persists to `tka_effects_custom`, with `personalDefault` / `restorePersonalDefault`
/ `hasCustom`. Re-wire it to the Custom chip with two changes:

- **Start empty.** Seed `personalDefaults[id]` from the persisted store only — no
  fallback to the live config (the old `?? config[id]` fallback baked a *selected
  preset* into the slot, which is what showed Neon as "Default"). Absent → `null`.
- **One-time clean.** Before loading, if `tka_effects_custom_clean` flag is absent,
  `removeItem(tka_effects_custom)` and set the flag — discards the polluted v1
  auto-seeded data so existing users' Custom starts genuinely empty (disabled).
- `hasCustom(id)` already returns false for a `null` slot and false when the slot
  equals factory — it gates the disabled state. No change.
- `updateEffect` already captures + persists the slot. No change.

## Chips — `EffectsPanel.svelte` + `EffectPresetsSection.svelte`

- `EffectsPanel`: add `CUSTOM_CHIP_ID = "__custom__"`.
  - `activePresetId` priority: 1. live == factory → Default; 2. `matchPresetId` →
    named preset; 3. `hasCustom(fx)` && live == personal-default slot → Custom; else
    null.
  - `handlePresetSelect`: `CUSTOM_CHIP_ID` → `restorePersonalDefault(activeEffect)`.
  - `customDisabled = !hasCustom(activeEffect)`; `customColors` = for trail, the
    slot's `{blue, red}` (else null) for the chip preview.
  - Pass `customChipId`, `customDisabled`, `customColors` to `EffectPresetsSection`.
- `EffectPresetsSection`: render a trailing Custom synthetic chip (after the named
  presets), mirroring the Default chip: `disabled` + greyed when `customDisabled`;
  preview shows `customColors` dual dots for trail, else the accent dot; lights when
  `activePresetId === customChipId`.

## Testing

- State (`effects-config-state.test.ts`): Custom starts empty (`hasCustom` false at
  load with no persisted slot); first `updateEffect` makes `hasCustom` true and
  captures; `restorePersonalDefault` round-trips; preset application does not change
  the slot (existing tests cover most — add the "starts empty" case).

## Out of scope

- Multiple Custom slots / named saves (single slot per the silent-overwrite choice).
- Overwrite prompt (explicitly rejected in favour of silent).
