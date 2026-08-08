# Museum Scene Gate Contracts

## Contents

1. Authority and ownership
2. Gate states
3. Gate deliverables
4. Approval record
5. Exceptions and regressions

## Authority and ownership

Use one owner for each kind of truth:

| Truth | Owner |
|---|---|
| User direction and creative decisions | Museum tracker, following the `museum` skill |
| Story canon | Current accepted tracker decisions, then the story bible; flag conflicts |
| TKA motion and notation | Flow Arts MCP calls made in the current turn |
| Selected museum sequences | Exact live sequence IDs and their canonical source digests |
| Room dimensions and placed geometry | A room-relative plan contract in code |
| Review drawing | Generated from or directly consuming the plan contract |
| Blender coordinates and collections | A derived Blender contract and artist manifest |
| Runtime behavior | The integrated application plus captured runtime evidence |
| Gate progression | `scene-gates.json` evidence index |

Never use `scene-gates.json` to duplicate coordinates, motion definitions, or
creative prose. Store paths, fingerprints, checks, and approval provenance.

Classify every environmental interpretation of performance data:

- `literal`: directly supported by MCP or the selected sequence source.
- `metaphor`: a visual translation of a literal property.
- `invention`: authored interaction, narrative, or spectacle.

Literal claims need current evidence. Metaphors and inventions remain proposals
until the user explicitly approves the gate that uses them.

## Gate states

Use `pending`, `in-progress`, `ready-for-review`, `approved`, `verified`, or
`rejected`.

- Gate 0 is automated and finishes as `verified`.
- Gates 1 through 6 require human approval and finish as `approved`.
- Keep every later gate `pending` with no evidence until the preceding gate is
  complete.
- Move `currentGate` as soon as a gate completes.
- Preserve rejected evidence and record what failed. Revise at the same gate.

## Gate deliverables

### Gate 0: Evidence preflight

Prove the current room shell, entry and exit, adjacent transitions, performer
roster, current production stack, accepted creative direction, and conflicting
documents. When performers drive the room, fingerprint the exact selected
sequence source and capture each live loop with a visible path diagnostic.

Required evidence: `canon-audit`, `room-shell`, and `motion-proof` when domain
proof is required.

Required checks: `canon-conflicts`, `source-digests`, and
`sequence-fingerprints` when domain proof is required.

### Gate 1: Measured plan

Show a top-down plan and vertical section at readable scale. Mark entry, exit,
doors, ceiling, player eye height, accessible route width, hero footprint,
performer zones, interaction zones, occluders, every required reveal, and the
final view. Add a numbered route strip that answers what the player sees, does,
and understands at each point.

Required evidence: `floor-plan`, `vertical-section`, `route-storyboard`,
`sightline-study`.

Required checks: `walkability`, `clearance`, `sightlines`, `final-view`.

### Gate 2: Playable graybox

Build Blender primitives from the approved plan and derived coordinate contract.
Use the real camera height, collision, doors, performers, interaction volumes,
and vertical changes. Include fixed review cameras and a first-person route.
Decoration may communicate function or guidance but cannot hide spatial faults.

Required evidence: `blender-source`, `coordinate-manifest`, `graybox-glb`,
`first-person-walk`, `review-contact-sheet`.

Required checks: `artifact-digest`, `collision`, `route-duration`,
`sequence-parity`.

### Gate 3: Registered visual target

Create visual studies only from approved graybox cameras. Preserve composition,
scale, doors, performers, and sightlines. Approve the hero silhouette, material
families, lighting logic, atmosphere, density, and visual hierarchy.

Required evidence: `locked-camera-set`, `visual-target-board`,
`material-lighting-brief`.

Required checks: `camera-registration`, `silhouette-read`.

### Gate 4: Production slice

Finish one representative section containing the hero material treatment,
performer relationship, environment response, audio response, and state changes.
Judge it in motion and in the target runtime, not as a Blender beauty render.

Required evidence: `vertical-slice-build`, `interaction-capture`,
`performance-report`.

Required checks: `interaction-state`, `runtime-console`, `performance`.

### Gate 5: Integrated room

Integrate the complete room with both adjacent spaces. Verify entry and exit
transitions, all performers, audio boundaries, backtracking, re-entry, saved
state, collision, lighting budgets, draw calls, and frame time.

Required evidence: `integrated-walk`, `transition-captures`, `audio-review`,
`performance-report`.

Required checks: `museum-connectivity`, `backtracking`, `state-persistence`,
`runtime-console`, `performance`.

### Gate 6: Final acceptance

Walk the complete experience from the preceding room through the following room.
Show all required viewport evidence and focused regression output. Record any
known limitation instead of hiding it behind polish.

Required evidence: `acceptance-walk`, `viewport-evidence`, `regression-report`.

Required checks: `focused-tests`, `typecheck`, `runtime-console`, `performance`.

## Approval record

Record the approver, ISO timestamp, exact approving quote, museum tracker item,
and `visualComprehensionConfirmed: true`. The quote must approve the named gate
or its named artifact. Do not require a magic phrase, but do not infer approval
from enthusiasm.

Before requesting approval, ask the user to state the route or spatial
relationship they now understand. If their description differs from the
artifact, keep the gate open and improve the visual bridge.

## Exceptions and regressions

Use an exemption only when a requirement does not apply. Record its gate,
requirement type, requirement name, rationale, user approval, timestamp, and
museum tracker item. Convenience and schedule pressure are not rationales.

If a later change alters geometry, route, sightlines, hero composition,
interaction semantics, sequence fingerprint, or adjacent transition, invalidate
the earliest affected gate and every gate after it. Re-run their checks and ask
for approval again.
