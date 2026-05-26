# No Assumption Without Evidence — ENFORCED

## The Problem This Solves

Claude saw `backgroundType: "ocean"` + `canvases: 2` in a script query and declared "ocean 3D scene is active" — when the 3D scene had never been loaded. No screenshot, no DOM query, no WebGL context check, no scene initialization log. Pure pattern-matching fabrication. This wasted time and eroded trust.

## The Rule

Before claiming ANY runtime state exists, you MUST have tool output in the current turn proving it.

### Claims that require evidence

| Claim | Required evidence |
|-------|-------------------|
| "The 3D scene is active/loaded" | Query for WebGL2 rendering context, Threlte DOM nodes, or scene feature state |
| "The component is mounted" | DOM query showing the component's elements exist |
| "The error is occurring" | Console log, network request, or error event captured |
| "The page loaded successfully" | DOM query showing app content rendered, not just HTTP 200 |
| "The fix is working" | Before/after evidence showing the broken behavior is gone |
| "X is causing Y" | Causal evidence, not correlation between two numbers |

### The test

Before stating a runtime claim, ask: **"What tool output in THIS turn proves this?"**

If the answer is "none" or "it seems likely because..." — STOP. Run the query. Get the evidence. Then state the claim.

### Forbidden

- Inferring 3D scene state from 2D background settings
- Inferring component mount state from localStorage values  
- Inferring WebGL activity from canvas element count
- Declaring ANY runtime state from indirect signals without direct verification
- Saying "X is active" without a query that specifically checks for X

### backgroundType vs 3D scene — permanent distinction

- `backgroundType: "ocean"` in localStorage = 2D CSS background theme (gradient + canvas animation)
- 3D ocean scene = Threlte/Three.js environment inside Viewer3DCanvas, only loads when sequence viewer's 3D animation pane is open with a sequence loaded
- These are completely independent systems. One does not imply the other.
