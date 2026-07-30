---
status: shipped
value: 3
effort: L
remaining: ""
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-29
---
# Viewer / Scan Chrome Unification — Design

**Date:** 2026-07-02
**Status:** Shipped
**Topic:** Make the QR-scan viewer (`/q/[code]`) and the full sequence viewer
(`SequenceViewerDrawerHost`) render their chrome from one shared schema so they
stop drifting — while keeping the scan page lightweight and fast to first paint.

> **QUEUE CLOSE-OUT 2026-07-29.** The shared shell shipped in `fcd3a516d8`,
> and `tests/unit/sequence-viewer-shell-contract.test.ts` protects both hosts.
> The grandfathered `/sequence/[id]` route is a later migration seam recorded
> in `.claude/rules/sequence-viewer-shell.md`; it is not unfinished scope from
> this two-host unification.


---

## Problem

Two pages present the "watch a sequence" experience:

- **App viewer** — `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`
  (~800 lines). Full header (save/favorite/remix/practice/publish/delete/video/
  copy/close), per-mode control panels, mode switchers, practice workstation.
- **QR scan** — `src/routes/q/[code]/+page.svelte` (~1150 lines). Bare
  `+layout@.svelte` breakout (skips the app shell), lazy chunks, `forceGuest`,
  no 3D, a single floating "…" overflow (remix/download/open).

Both already share the **brain** (`SequenceViewerOrchestrator`), the **mode
list** (`viewer-modes.ts`), the **mode switchers** (`ViewerContentRail` /
`ViewerModeBottomBar`), the **media pane** (`ViewerSplitPane`), and the
**per-mode control panels** (`AnimationPanel`, `ExportImagePanel`, and — pane
internal — `ArtPane`→`ArtSettingsPanel`). The divergence is **not** in the brain
or the panels. It lives in exactly two hand-wired-twice places:

1. **Host wiring** — which control panel mounts for which mode, coded
   imperatively in both hosts.
2. **Action / header surface** — the app viewer's full header vs the scan
   floating "…", each with its own action definitions. Plus scan hard-`forceGuest`s,
   so a signed-in owner scanning their own card never sees owner actions.

This is the drift source. A recent layout bug (the scan bottom bar collapsing to
12px) is a symptom of the two hosts diverging in code that should be one thing.

### Goal

Total parity of the *content* surface (same modes, same per-mode controls, same
auth-gated action set) drawn from **one schema**, while:

- the scan page stays lightweight and paints instantly (no app-shell import,
  heavy capabilities lazy),
- a signed-in user who scans their own card is shown as signed in (owner
  actions available),
- the primary app viewer is not destabilized.

---

## Approach — shared components for the two drift spots (not a host merge)

Rejected alternatives:

- **One merged host.** The scan page's lightness lives in its *route* (bare
  `+layout@` + per-mode lazy `import()`); the app viewer statically imports every
  panel into one chunk. Merging render loops means re-threading the primary
  viewer's imports as lazy — destabilizing the constantly-used surface to serve
  the secondary one. The two layout *shells* (full drawer vs bare immersive scan)
  also legitimately differ; one render loop fights the lightness. Wrong risk trade.
- **Incremental only, no schema.** Moves actions to a catalog but leaves per-mode
  panel mounting forked in two files — under-delivers the "don't drift" goal.

Chosen: the two drift spots become **two shared, capability-profiled
components** that both hosts drop into their own layout. Parity of content, not
of literal render loop. Layout shells stay per-host (protects lightness + the
immersive scan feel).

---

## Architecture

### 1. `viewer-chrome-profile.ts` (new — pure data)

`src/lib/shared/sequence-viewer/services/viewer-chrome-profile.ts`

A static capability descriptor. Two instances:

```ts
export interface ViewerChromeProfile {
  /** 'full' → app-viewer header; 'floating' → scan "…" overflow. */
  header: 'full' | 'floating';
  /** Heavy capabilities. Scan sets these on but lazy (loaded on demand). */
  enable3D: boolean;
  enablePractice: boolean;
  enableVideo: boolean;
  /** 'eager' keeps today's app-viewer import behavior; 'lazy' = scan. */
  panelLoad: 'eager' | 'lazy';
}

export const FULL_PROFILE: ViewerChromeProfile = { header: 'full',    enable3D: true, enablePractice: true, enableVideo: true, panelLoad: 'eager' };
export const SCAN_PROFILE: ViewerChromeProfile = { header: 'floating', enable3D: true, enablePractice: true, enableVideo: false, panelLoad: 'lazy' };
```

It does **not** re-declare the mode list — modes stay in `viewer-modes.ts`
(already the shared source). `enable3D` on scan feeds the real
`webgl2Available`/`viewportFits3D` gate (3D is already lazy inside
`ViewerSplitPane`), replacing the current hardcoded `webgl2Available={false}`.
`enableVideo` false on scan because upload is an owner/library workflow; it can
flip true later behind auth without touching the schema shape.

**Justification (never-hand-roll):** grepped `profile`, `capabilities`,
`ViewerChrome`, `chrome-config` under `src/lib/shared/sequence-viewer/` — no
existing viewer capability descriptor. `viewer-modes.ts` is the only adjacent
config and covers modes only. New file justified.

### 2. `viewer-actions.ts` (new — the action catalog, single source)

`src/lib/shared/sequence-viewer/services/viewer-actions.ts`

One declarative entry per viewer action, each with a capability **gate** read
off `ctx`, and a `run(ctx)`:

```ts
export type ActionGate = 'always' | 'gated' | 'loggedIn' | 'owner' | 'admin';

export interface ViewerAction {
  id: string;
  label: string;
  icon: string;            // FontAwesome fragment
  gate: ActionGate;
  run: (ctx: OrchestratorContext) => void;
  /** Optional: where 'full' header prefers to place it (inline vs overflow). */
  headerSlot?: 'inline' | 'overflow';
}
```

Gate semantics (grounded in `SequenceViewerOrchestrator.svelte`):

| gate | predicate | source |
|---|---|---|
| `always` | always shown | remix, download, open |
| `gated` | shown; `ctx.invokeGatedAction` prompts guest login on tap | save, favorite |
| `loggedIn` | `ctx.isLoggedIn` | video upload |
| `owner` | `ctx.isOwned && ctx.isSaved` | publish, unpublish, delete |
| `admin` | `authState.isAdmin` | copy-for-Claude |

Catalog covers the union of both pages' actions: `remix`, `save`, `favorite`,
`publish`, `unpublish`, `delete`, `video`, `copy`, `download`, `open`. Each host
passes the subset relevant to it (scan omits `copy`; `download`/`open` are
scan-funnel actions the app viewer maps to its own equivalents). The *gates* mean
one list serves both — a signed-in owner on scan sees owner actions with no extra
wiring, because `isOwned` already = `sequence.ownerId === authState.user.uid`
(`SequenceViewerOrchestrator.svelte:400`).

**Justification:** grepped `actions`, `ViewerAction`, `action-catalog`,
`overflow` under the viewer feature — the actions today are inline in
DrawerHost's header markup (`:422-549`) and in `ViewerOverflowMenu` props. No
catalog exists. New file justified; it becomes the single source both
presentations read.

### 3. `ViewerActions.svelte` (new — renders the catalog)

`src/lib/shared/sequence-viewer/components/ViewerActions.svelte`

Props: `{ surface: 'full' | 'floating'; actions: ViewerAction[]; ctx }`.

- `surface='full'` → the app-viewer header layout: `headerSlot:'inline'` actions
  as header buttons, the rest folded into the existing `ViewerOverflowMenu`
  (reused, not rebuilt).
- `surface='floating'` → the scan floating "…" — the existing `ViewerOverflowMenu`
  in `variant="header" dropDown`, fed the gated catalog.

Filters the catalog by each action's gate against `ctx`. Replaces DrawerHost's
~120 lines of inline header action markup (`:422-549`) and `/q`'s floating
overflow block (`+page.svelte:761-771`). `ViewerOverflowMenu` is reused as the
menu primitive in both surfaces (never-hand-roll: it already exists and both
pages already use it).

### 4. `ViewerControls.svelte` (new — per-mode host-mounted control panel)

`src/lib/shared/sequence-viewer/components/ViewerControls.svelte`

Props: `{ mode: ViewerMode; profile: ViewerChromeProfile; ctx; ...panel wiring }`.

Given the active mode + profile, mounts the correct **host-level** control panel,
lazily when `profile.panelLoad === 'lazy'`:

| mode | panel | note |
|---|---|---|
| `animation` (2D) | `AnimationPanel` | already shared; both pages mount it today |
| `card` | `ExportImagePanel` | already shared |
| `practice` | practice workstation (`PracticeSetupBar` + `PracticeBar`) | app-viewer-only today; becomes lazy-on-tap for scan |
| `split` / `mandala` / `tunnel` / `animation-3d` | **nothing here** | controls are pane-internal (`ArtPane`→`ArtSettingsPanel` at `ArtPane.svelte:199`; RightRail 3D) and arrive through `ViewerSplitPane` |

This is the exact per-mode host divergence, collapsed to one component. The
mandala/tunnel/3D controls are confirmed pane-internal, so no host wiring is
needed for them on either page — `/q` already surfaces them.

### Unchanged (already shared)

`SequenceViewerOrchestrator` (brain/`ctx`), `viewer-modes.ts`,
`ViewerContentRail`, `ViewerModeBottomBar`, `ViewerSplitPane`,
`ArtPane`/`ArtSettingsPanel`, `AnimationPanel`, `ExportImagePanel`,
`ViewerOverflowMenu`. No new state is introduced — the profile is static config;
all live state stays on `ctx`.

## Data flow

```
SequenceViewerOrchestrator ──ctx──┐
                                  ├─→ <ViewerActions surface ctx actions>
static ViewerChromeProfile ──────┤
                                  └─→ <ViewerControls mode profile ctx>
```

Each host composes: its own layout shell + the shared switchers +
`<ViewerActions>` + `<ViewerControls>`. The host layout shells stay separate
(full drawer vs bare immersive scan). That separation is deliberate — it is what
keeps the scan route's lazy boundaries and immersive look intact.

---

## Implementation increments (ship order — each independently verifiable)

Each increment is committed and verified on its own; no big-bang.

### Increment 1 — Action catalog + `ViewerActions`
Extract both pages' action surfaces to `viewer-actions.ts` + `ViewerActions.svelte`.
Behavior-preserving de-drift.
**Verify:** app-viewer header and scan "…" render the same actions as before (per
gate); DevTools screenshot both at mobile width; `npm run check`.

### Increment 2 — `ViewerControls`
Extract per-mode host panel mounting to one component; both hosts adopt it.
**Verify:** parity screenshots — 2D-animation dock and card dock render identically
on both pages before/after; app viewer practice unaffected.

### Increment 3 — Auth-aware `/q`
Drop `forceGuest` on the scan route; lazy-init Firebase auth on the bare route
(async, non-blocking — the glyph loader / first paint must not wait on it). When
auth resolves to a signed-in owner (`uid === seq.ownerId`), owner actions surface
automatically via the existing `isOwned` derivation.
**Verify:** signed-out scan = funnel actions only; signed-in owner scan = owner
actions appear after auth resolves, first paint timing unchanged (measure).

### Increment 4 — Lazy 3D + Practice on `/q`
Feed real `webgl2Available`/`viewportFits3D` (via `SCAN_PROFILE.enable3D`) so the
3D mode appears in the scan switcher and pulls Three.js only on tap (already lazy
in `ViewerSplitPane`). Practice workstation lazy-loads on tap via `ViewerControls`.
**Verify:** scan first-paint chunk unchanged (3D/practice not in it); tapping 3D
or Practice loads and works; measure initial route chunk before/after to prove no
bloat.

---

## Testing

- **Layout / parity:** DevTools MCP at mobile (375–500px) and a desktop width,
  before/after each increment, on both `/q/<code>` and the app viewer. Confirm the
  scan bottom bar stays full-width (the just-fixed regression) and the two pages'
  control surfaces match.
- **Auth:** signed-out vs signed-in-owner vs signed-in-non-owner scan — assert the
  visible action set per gate.
- **Lightness:** record the `/q` route's initial JS chunk size (network panel /
  build output) at the start and after increment 4; it must not grow materially.
  3D and practice chunks must load only on interaction.
- **Types:** `npm run check` green before each commit.
- Component tests are **not** mandated here (per `component-test-discipline` —
  test-on-fix, not a coverage push); add one only if an increment fixes a specific
  interactive-component regression worth locking.

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Auth init on the bare `/q` route pulls the app shell | Lazy-init **only** Firebase auth, async; never block first paint. The route already re-wires just the singletons it needs (`+page.svelte:428-444`) — add auth the same way. |
| Extraction regresses the primary app viewer | Increments 1–2 are behavior-preserving; before/after parity screenshot the app viewer each step. |
| Scan first-paint weight creep | Keep per-mode lazy imports (`profile.panelLoad='lazy'`); measure the initial chunk before/after increment 4. |
| Action gate mismatch (an owner action leaking to guests) | Gates are pure predicates over `ctx`; unit-assert the gate table against `isOwned/isSaved/isLoggedIn/isAdmin` combinations. |

## Out of scope

- Merging the two host *layout shells* into one component (explicitly rejected).
- Redesigning any individual control panel (`AnimationPanel`, `ExportImagePanel`,
  `ArtSettingsPanel`) — they are reused as-is.
- `MandalaControlDock` dedup vs `ArtSettingsPanel.mandalaRail` — a known separate
  drift point (legacy standalone dock), tracked independently, not part of this
  unification.
