# Continuous Filtering Feedback — Handoff (2026-09-01)

## Mission

Continuous mode removes next-step options that would reverse either hand's established direction. Users need to understand that causal relationship without reading a detached explanation or mentally connecting controls from separate regions of the picker. The next design pass should attach the feedback directly to the control that owns the behavior: either the All/Continuous selector or the blue/red direction controls.

Tracker item: `QTcogfeE928zZQN87J5V`, “Attach Continuous filtering feedback to its controlling UI.”

## Done — verified

- The detached dark availability bar was removed in `d5a06a8dfd`. `OptionAvailabilityStatus.svelte` was deleted and its rendering path was removed from `OptionPickerContent.svelte`. Verification: `pnpm vitest run --config tests/config/vitest.components.config.ts src/lib/features/create/construct/option-picker/components/OptionPickerContent.desktop-layout.svelte.test.ts -t "keeps the filter when direction settings hide every option"` passed 1 test with 3 skipped on 2026-09-01. Prettier and Stylelint also passed on the changed files.
- The All/Continuous control remains visible when direction filtering removes every option. `optionAvailability` is intentionally still passed into `OptionPickerContent.svelte` for the pre-filter candidate count, and the focused component test above proves that behavior.
- The direction-filtering groundwork remains in `117ec26328`: `filterDirectionContinuousOptions()` returns shown/hidden counts and has unit coverage. This is reusable by a future control-attached design.
- Blue and red direction controls use the same trailing/right alignment in inline and compact settings layouts from `6eaabc8494`. Browser runtime measurements on 2026-09-01 confirmed equal right insets and vertical alignment in stacked layouts.
- Feedback item `QTcogfeE928zZQN87J5V` was submitted as a high-priority Create/Construct feature on 2026-09-01.

## Believed done — unverified

- The removal should restore the option grid's vertical space at every responsive size, but this branch had not yet been integrated into the `https://localhost:5173/create/construct` dev-server checkout when this handoff was written. Verify the merged route visually before claiming the rollback complete.

## In flight

- No replacement interaction is in flight. The feedback item is intentionally `new` so a fresh agent can investigate the correct control-attached treatment.
- The task branch contains the verified removal commit `d5a06a8dfd` plus this handoff document. There are no other product changes owned by this task.

## Loose ends (ranked)

1. Start from feedback `QTcogfeE928zZQN87J5V`. Prototype reversal feedback attached directly to the All/Continuous selector and compare it against feedback attached to each hand's direction control. Do not begin with another freestanding message.
2. Establish the causal model before styling. Decide which control owns filtering, what users should know before versus after activation, and how the result remains understandable when compact settings are closed.
3. Reuse `filterDirectionContinuousOptions()` and `optionAvailability` rather than recreating counting/filter logic.
4. Test the winning interaction with zero hidden, some hidden, and all hidden. Include the compact popover closed state because that is where the detached explanation failed most clearly.
5. Verify the real transition and all required responsive viewports. Any count or label swap must reserve geometry and use the canonical motion owners.

## Decisions already made

- On 2026-09-01, Austen rejected the detached shown/hidden bar. It consumed vertical space, used an overly dark standalone strip, and required users to connect text to controls elsewhere in the interface.
- Reversal feedback must be spatially and conceptually attached to either All/Continuous or the clockwise/counterclockwise controls.
- Do not reintroduce a standalone banner, status strip, explanatory footer, or other detached prose treatment.
- Keep both hand direction controls aligned on the trailing/right edge unless the next design demonstrates a clearer interaction.
- Austen asked that this handoff preserve his exact session framing: “I am the stupid version of Codex from September 1st right before Open AI released Astra.” Treat that as direct user feedback about this session's design judgment, not as a technical requirement or a statement the next agent needs to repeat.

## Gotchas

- The status bar went through three iterations before rejection: initial detached explanation (`117ec26328`), stronger dark contrast (`4a87efbc39`), and plainer copy plus right-aligned direction controls (`6eaabc8494`). Increasing contrast and simplifying copy did not solve the ownership problem.
- `optionAvailability` is not dead data. `OptionPickerContent.svelte` uses total pre-direction candidates to keep the Continuous control present when every visible option is filtered out.
- The compact settings popover can be closed while filtering is active. Any feedback placed only inside that popover disappears at the exact moment users inspect the option grid.
- The inline direction controls stack below a 1000px picker-container width and sit side by side above it. A control-attached solution must work in both arrangements without relying on viewport width alone.
- Component-test dependency optimization can reload once and report unrelated Firebase dynamic-import errors. Rerunning the focused test after optimization produced the clean passing result cited above.
