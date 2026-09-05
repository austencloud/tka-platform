# Hand Positions UX audit, September 5, 2026

Scope: the shipped hand-positions experience, not a repository-wide code-quality grade.

## Adversarial findings

The baseline browser shows a static Alpha pictograph with a Next button, then Beta, Gamma, and a comparison. A learner can reach Finish without placing either hand. The source's Review mode ignores the selected review presentation. Exploration is three clicks deep, and its 8/16-cell discovery tray records transformations rather than checking whether someone can construct a relationship. Timing synonyms add a second vocabulary before timing is taught. The entire application region intercepts arrow keys, including keys originating from child controls. On narrow layouts the comparison captions fall below the project's text-size floor.

| Interaction principle        | Baseline                                           | Redesign                                                                               |
| ---------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Hands on in five seconds     | Next is the only first-screen action.              | Live placement grid on entry.                                                          |
| Discovery before instruction | Names and definitions precede action.              | Actual placement determines the displayed name; examples are optional.                 |
| Mistakes teach               | No construction check exists in the live lesson.   | Keep the wrong placement, identify it, and give a valid one-hand correction. No timer. |
| Meaningful transformations   | Rotate/mirror/swap in a hidden playground.         | Keep transforms beside the editable board; canonical prop renderer owns motion.        |
| Difficulty ramp              | Three explanations, then optional transformations. | Three guided diamond builds followed by three box builds with optional reference.      |
| Restrained celebration       | Discovery counters reward button presses.          | A checkmark follows a checked construction; completion follows six. No interruptions.  |
| Spatial interaction          | Only transformations of preselected positions.     | Place and move each hand using the shared spatial interaction.                         |
| Earn complexity              | TKA and timing names presented together.           | Positions only; grid choice explicit; independent practice follows guided practice.    |

## Capability ownership ledger

| Capability / searches                    | Owner                                               | Current consumer           | Decision                                                                         |
| ---------------------------------------- | --------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| placement, onPlacementComplete, moveProp | PropPlacementGrid and its placement/aim state       | BuildStartPosition         | Compose unchanged, with external PanelButton move/undo controls.                 |
| position, location pair, grid derivation | grid-position-deriver                               | StartPositionDeriver       | Reuse; no lesson-local geometry classifier.                                      |
| rotateLocation, mirrorLocation, swapped  | rotation-helpers / mirror-vertical                  | motion-transforms          | Reuse canonical transforms.                                                      |
| pictograph, hand, preview                | PictographContainer / prop-placement-view-model     | PropPlacementGrid          | Reuse production render and hand identities.                                     |
| choice, selected, radiogroup             | SegmentedControl                                    | TimingDirectionIntro       | Reuse for grid mode; canonical PanelButton for actions.                          |
| heading, stage, controls                 | LessonStageFrame / LessonStageHeading               | GridConceptExperience      | Keep stage ownership; allow lesson scrolling and board/reference composition.    |
| phase, persistence, quiz                 | positions-experience-state / experience-persistence | legacy positions exercises | Extend state owner with the new self-paced workshop; isolate checkpoint version. |
| glyph, word identity                     | TKAWordGlyph                                        | Choreo Card headers        | Reuse glyph renderer, no raw notation text.                                      |

Visual contract: pictographs own their rectangles, with no second decorative card. All three examples remain inspectable before selection. The selected example's control has a full outline and aria-pressed. Wide/tablet use a board and reference band; phones stack the same capabilities, retaining target sizes through scrolling. Short screens scroll rather than compressing the board. Feedback reserves a text region. Shared prop motion and Crossfade own visual changes. Reduced motion reaches the same state.

## Verification

Passed 23 focused tests covering every same-grid location pair, transform invariance, valid one-hand corrections, invalid checkpoints, guarded progression, resumed rounds, review isolation, and exploration after completion. Svelte check: zero errors and zero warnings.

Direct browser verification completed all six rounds, including a deliberately wrong Beta answer to an Alpha challenge, correction without clearing, keyboard placement, an optional reference, and reload into round five with four rounds retained. Check focuses Next; advancing focuses the placement grid; completion focuses Continue. Keep exploring retains the Continue action.

Inspected all seven CSS viewport tiers: 375×667, 960×412, 820×1180, 1440×900, 1920×1080, 2560×1440, and 3840×2160. No horizontal overflow. Phone targets measured 51 CSS pixels; short-landscape targets 49. Phone references and controls remain reachable by scrolling. The shared frame has an opt-in natural-height workshop variant; existing square/wide consumers retain their sizing. Tablet board height is capped by its width so the prompt and controls do not drift away from the grid.

At a 640×450 CSS viewport (the reflow equivalent of a 1280×900 surface at 200%), controls remained reachable without horizontal overflow. This is a reflow check, not a claim of testing the browser's actual zoom setting. Reduced-motion emulation retained the correct classification after rotation, with prop transitions reduced to 0.00001 seconds.

The lesson remains BUILT until Austen's hands-on approval. No deployment or external-account mutation is included.
