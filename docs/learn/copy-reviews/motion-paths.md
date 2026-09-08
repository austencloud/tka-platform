# Motion paths

Review state: DRAFT

## Proposed page copy

### Motion paths

Keep the sequence. Change how the hands travel between its positions.

### Compare the paths

Arc follows the circle. Linear connects the endpoints with a straight line. Concave curves inward between the endpoints.

Hybrid chooses a path for each motion: pro uses Arc and anti uses Concave. Dashes stay straight. Static hands stay in place.

Switch paths while the sequence plays. Compare the hand trace with the mandala. The same sequence can produce different drawings when you change its paths.

### Which setting am I changing?

Choosing a path in the viewer previews it for this sequence, including steps with saved path exceptions. Restore saved paths returns to the original choices.

Save paths keeps the preview on a sequence you own. Make default sets the starting choice for sequences without a saved path setting. In Composer, you can set a different path for either hand on an individual step, or let it inherit the sequence setting.

Show path lines controls the drawn guides. It does not change the movement.

### Motion paths and third order

One way to explore the connection is to build the path itself from moving parts, then add the prop's rotation. The Third Order toy lets you move smaller grids along a sequence or a flower path and play sequences inside those grids.

Arc and Concave are useful starting points for comparing circular and inward-curving travel. The current Concave setting is not an exact four-petal antispin construction. Comparing it with a constructed flower is part of the exploration.

### When a path feels awkward

A mandala shows the accumulated drawing. Watch the movement too, especially where one step meets the next. A drawing you like may come from a transition you would choose to change.

## Evidence map

- Path interpolation, pro/anti mapping and dash/static behavior: `src/lib/shared/animation-engine/services/prop-interpolator.ts`.
- Preview/save/default descriptions: this task's viewer path-session implementation and tests. Verify before publishing.
- Per-hand editing: `StepEditorCoordinator.svelte`, `PropTurnsControl.svelte`, `path-shape-handler.ts`.
- Path-line visibility: `DisplayPanel.svelte`, separate from interpolation policy.
- Third-order composition: `third-order-composition.ts`, `third-order-flower-path.ts`, `ThirdOrderCompositionSampler.ts`.
- Exact antispin equivalence is deliberately not asserted: Concave currently uses `2 * straightPoint - circlePoint`, not the flower decomposition.
- Awkward sequences and differing mandalas: Austen's September 8 request; no claim of physical ease or feasibility.
- Current-turn Flow Arts MCP glossary checks did not contain “concave” or “third order”; these are application behavior descriptions, not newly asserted canonical TKA definitions.

## Pending

Austen's approval of the exact wording. No approval recorded yet.
