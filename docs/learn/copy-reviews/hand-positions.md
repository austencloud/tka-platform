# Hand Positions copy review

State: DRAFT (implemented under the September 5 autonomous audit-and-implement request; exact-wording approval is not claimed).

## Domain evidence

Current-turn Flow Arts Knowledge MCP queries for Alpha, Beta, Gamma confirmed opposite points, same point, and right angle. The canonical written Guide is `src/routes/(public)/guide/level-1/_data/content/hand-positions.content.ts` (Level 1 page 8).

| Exact text                                                    | Evidence                                                                                                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| In Alpha, the hands occupy the points across from each other. | Verbatim Guide definition; Alpha MCP result: 180 degrees.                                                                                          |
| In Beta, the hands occupy the same point.                     | Verbatim Guide definition; Beta MCP result: same location.                                                                                         |
| In Gamma, the hands form a right angle.                       | Verbatim Guide definition; Gamma MCP result: 90 degrees.                                                                                           |
| Tap two grid points. You can use the same point twice.        | Placement interaction accepts repeated locations; Beta evidence above.                                                                             |
| Place the hands. See which position you make.                 | Implemented placement/classification interaction.                                                                                                  |
| Place both hands, then check your position.                   | Implemented explicit-check workflow.                                                                                                               |
| Keep the blue hand where it is. Move the red hand to {point}. | Guide: Blue = Left, Red = Right. Destination selected through canonical position lookup; exhaustively tested for every wrong answer on both grids. |
| You built {name}. / Yes, {name}. / Still {name}.              | Derived from actual canonical location pair, not an assumed orientation.                                                                           |
| The hands are already in those locations. Still {name}.       | Exact equality of before/after transform, plus canonical family derivation.                                                                        |
| Alpha, Beta, and Gamma on both grids.                         | Completion requires all six authored challenges.                                                                                                   |
| Keep exploring, or continue to Hand Motions.                  | Both actions implemented; next concept is hand-motions-intro.                                                                                      |

Other UI text names controls, modes, and measured progress: Explore, Your position, Your turn, With a reference, On your own, Practice complete, All six built, Build {name}, Diamond grid, Box grid, Try an example, Reference, Need a reminder?, Show reference, Move blue, Move red, Undo, Rotate, Mirror, Swap, Clear grid, Practice positions, Resume practice, Check position, Next position, Finish practice, Keep exploring, Continue to Hand Motions, Ready to check, Try again.

No claims that a position is easier, natural, or smoother. Timing vocabulary is not introduced here. Only construction challenges have answer concealment; exploration examples remain visible before selection.

## Outstanding review

Austen has not yet interacted with this redesign or approved its exact microcopy. Keep the lesson BUILT, not CONFIRMED. The explicit request to audit and implement while Austen is asleep authorizes implementation without the skill's usual intermediate approval pause.
