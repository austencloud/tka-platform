# Hand Positions UX audit, September 5, 2026

Scope: the shipped hand-positions experience, not a repository-wide code-quality grade.

## Automatic confirmation follow-up

Austen reported that a correctly built Gamma still required an unnecessary Check position click. Practice now evaluates each completed, committed placement through the existing workshop state owner. Correct answers immediately show the existing “Yes, {name}.” confirmation, checkmark, and updated built count. Next remains deliberate so the learner can inspect the result. The Check position action and its obsolete instruction are removed; existing approved placement and editing prompts are reused.

Selecting a hand to edit invalidates confirmation until its placement is committed again, including when recommitting the same point. Incorrect answers retain the existing identification and one-hand correction. Incomplete placements and free exploration are not graded. Automatic confirmation preserves grid focus; Next still focuses the grid for the following round. No timer, shared-grid changes, or layout redesign.

Verification: 30 focused tests passed; Svelte check reported zero errors and warnings. Browser checks covered all six builds through deliberate completion, Gamma correction and same-point recommit, and immediate progress updates. Inspected wide, 375×667 phone, and 1660×1540 tall-pane layouts with no horizontal overflow. The new behavior remains BUILT pending hands-on review.

## Proportion correction after hands-on rejection

Austen rejected the September 5 alignment pass: the oversized grid still left a largely empty right rail. The earlier measurements below established fit, not appropriate proportions, and do not constitute approval of that composition.

The follow-up keeps the existing `PropPlacementGrid` input/state owner, `PanelButton` actions, `SegmentedControl` choices, `TKAWordGlyph` notation, `PictographContainer` examples, and `Crossfade` feedback. Only the positions lesson's composition changes. Phones and viewports at or below a 6:5 aspect ratio use one vertical flow: task, bounded square grid, hand controls, feedback, three visible references, optional exploration tools, and lesson navigation. Instructions align with the grid. Practice has no empty exploration-tools row. Landscape keeps two columns but caps the grid at 32rem instead of 58rem and sizes the whole band to its content. No new panels, renderers, motion system, or explanatory copy.

Browser evidence: all seven required viewport tiers inspected, plus 1800×1950 and the user's actual 1660×1540 pane. The latter uses a roughly 431px grid rather than a 928px grid, with feedback and references below instead of a vacant right rail. Phone/tablet/short landscape preserve all controls through scrolling; desktop navigation remains in view. No horizontal overflow. Checked empty placement, a correct Alpha answer, exploration, keyboard example selection, and rotation with reduced motion. A 640×450 reflow check retains controls and a 16px root; this is the 200%-zoom viewport equivalent, not an actual browser-zoom test. Focused lesson tests: 23 passed. Svelte check: zero errors and warnings. This remains BUILT pending hands-on review.

## September 5 hands-on clarity follow-up

Austen confirmed the spatial construction pattern, then reported unclear hand identity, an unclear way to build another position, ambiguous progression, and poor balance in a tall half-screen browser on a 4K monitor. Approval: “I'll take all of your recommendations for the layout and wording and fixes”.

The approved revision keeps `PropPlacementGrid` and its state/keyboard/history owners. Its optional `promptText` prop lets the lesson position its approved instructions outside the board without hiding content through consumer CSS. The existing shared `LessonStageFrame` workshop presentation now centers the complete authored group in surplus height and provides a full-width navigation region. Square/wide lesson layouts remain unchanged. `PanelButton`, `SegmentedControl`, `PictographContainer`, `TKAWordGlyph`, and `Crossfade` remain the presentation owners.

The hand controls say Move left hand / Move right hand, with a persistent left/blue and right/red key. Clear both hands belongs with editing. Next: Practice belongs in lesson navigation. The unexplained exploration counter is removed without adding a completion requirement. The references align with the top of the grid; the oversized reference spacer is removed. Phones put the live result immediately after the board, retain every edit action, and keep navigation in a sticky footer.

Geometry: the board retains a fixed square, instructions reserve two text lines, and the optional reference uses the existing animated-height Crossfade. There are no decorative panels, custom pictographs, edge accents, or viewport-driven control magnification. The native wide composition uses a broader content band; a tall pane centers the whole lesson, not the reference column independently.

Focused checks: 34 tests passed across the lesson, placement state/view-model, canonical ownership, and decomposition contracts; Svelte check has zero errors and zero warnings.

Direct browser verification on the task-owned preview covered all seven CSS viewport tiers (375×667, 960×412, 820×1180, 1440×900, 1920×1080, 2560×1440, 3840×2160), plus the reported tall-pane shape at 1800×1950. No horizontal overflow. At 1440×900, exploration navigation ends at y=881 and the lesson has no vertical overflow. At 1800×1950, the grid and feedback both begin at y=601; the whole authored group runs from y=397 to y=1665, distributing surplus space above and below. The phone stacks feedback immediately after the grid, with all edit controls and references reachable above the sticky navigation; grid targets measure 46.7 CSS pixels. Browser inspection also caught and corrected low-contrast blue legend text, an underspaced key, and desktop navigation falling below the viewport.

Replayed Gamma construction, moving a hand, clearing both hands, entering practice, a wrong Beta answer corrected into Alpha without clearing, and all six rounds through completion. Correct-answer focus reaches Next, the next round focuses the grid, and completion focuses Continue to Hand Motions. The optional reference remains available in independent practice. Reduced-motion emulation retains these results. At 640×450, the 200%-zoom reflow equivalent, navigation remains reachable with no horizontal overflow; actual browser zoom was not tested. No primary dev server or other task's preview was restarted or stopped.

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
