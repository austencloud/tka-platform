# Pictograph Foundations Learning Sequence

**Status:** Approved for implementation
**Approved by:** Austen, 2026-09-03 ("for god's sake, yes")

## Outcome

The Learn path introduces motion before letters. Learners encounter one idea at
a time in this order:

1. letter-free hand paths;
2. hand timing and direction;
3. the anatomy of one complete pictograph;
4. the six Alpha/Beta words from the guide;
5. the remaining Learning Letters words only in their later concepts.

The `words-alpha-beta` lesson remains a six-word lesson. It must not reveal the
other thirteen founding-deck words in its recap.

## Canonical Owners

| Capability            | Owner                                         | Use                                   |
| --------------------- | --------------------------------------------- | ------------------------------------- |
| Pictograph rendering  | `PictographContainer`                         | Compose; never redraw                 |
| Animated motion       | `InlineAnimationPlayer` / `AnimatorCanvas`    | Reuse with hand props for foundations |
| Hand timing/direction | renderer-derived `ElementalGlyph`             | Bottom-right                          |
| Prop timing/direction | `derivePropRelationship`                      | Top-right                             |
| Guided highlighting   | card-anatomy region spotlight pattern         | Extend for pictograph regions         |
| Lesson navigation     | `ExperienceProgressIndicator` + `PanelButton` | Reuse                                 |
| Saved lesson position | `getExperiencePersistence`                    | Reuse per concept                     |

## Interaction Contract

- Every screen presents one primary artifact and one immediate action.
- Hand-motion examples contain no TKA letters.
- Timing/direction examples use animated hands and the production pictograph
  renderer. Learners see one mode at a time.
- The pictograph tutorial spotlights one region at a time without covering the
  pictograph. The complete pictograph remains visible throughout.
- The word lesson keeps performance video, animation, Choreo Card, and guide
  notes synchronized to the same word.
- The animation context menu remains available. Lesson defaults are ephemeral
  and do not overwrite the learner's global viewer preferences.

## Approved Pictograph-Anatomy Copy

The following text is approved exactly as shown:

1. “A pictograph shows one step of motion.”
2. “Top left: the step number.”
3. “Top center: where the hands start and end.”
4. “Bottom left: the TKA letter and its turns.”
5. “Bottom right: the hands’ timing and direction.”
6. “Top right: the props’ timing and direction.”
7. “In the middle: the props and the paths your hands follow.”

No additional explanatory prose is approved by this specification. Routine
control labels and the guide's existing canonical names remain permitted.

## Responsive Composition

- Phone: instruction above the square artifact; navigation below; no nested
  horizontal scrolling.
- Wide phone: instruction and artifact share the available height without
  hiding either.
- Tablet: a compact instruction rail beside the artifact when space permits.
- Desktop and 4K: one authored content band with a stable instruction rail and
  a larger artifact stage. Controls retain normal logical size; extra width is
  used for composition, not magnification.

## Verification

- Focused Learn contract and state tests.
- One repository check after focused failures are resolved.
- Browser interaction check for Next/Previous, replay, spotlight progression,
  and the animation context menu.
- Visual inspection at 375x667, 960x412, 820x1180, 1440x900, 1920x1080,
  2560x1440, and 3840x2160, plus 200% zoom.
