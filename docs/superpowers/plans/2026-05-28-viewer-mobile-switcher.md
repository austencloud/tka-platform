# Mobile View-Switcher Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give mobile (portrait, width < 768px) the same view-switching capability as desktop's left rail — pick Side-by-Side or any single view (2D / 3D / Card / Mandala) plus a Practice toggle — via a thumb-reachable bottom bar.

**Architecture:** Extract the view-mode list (currently inlined in `ViewerContentRail.svelte`) into a shared config `viewer-modes.ts` so the rail and a new `ViewerModeBottomBar.svelte` share one source of truth. Lift the rail's inline select handlers into named functions in `SequenceViewerDrawerHost.svelte` and pass the same function references to both the rail (desktop) and the bottom bar (mobile) — no duplicated routing logic. The bottom bar is built from the existing `NavButton` primitive and reproduces the global `BottomNavigation` container-query label pattern. Split orientation and 3D gating are unchanged.

**Tech Stack:** Svelte 5 runes, existing `NavButton.svelte` primitive, CSS container queries, `env(safe-area-inset-bottom)`.

---

## File Structure

- **Create** `src/lib/shared/sequence-viewer/services/viewer-modes.ts` — shared `ViewerModeOption` interface, `VIEWER_MODE_OPTIONS` (5 modes), `PRACTICE_OPTION`. Single source of truth for both switchers.
- **Create** `src/lib/shared/sequence-viewer/components/ViewerModeBottomBar.svelte` — horizontal bottom bar (portrait only) built from `NavButton`. Presentational; consumes shared config + host handlers.
- **Modify** `src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte` — import the shared config instead of the inlined list. Appearance and behavior unchanged.
- **Modify** `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` — lift the rail's inline `onSelectMode` / `onSelectSplit` / `onPracticeToggle` arrows into named functions; pass the same refs to the rail and (when `isMobileWidth`) to a new `<ViewerModeBottomBar>` rendered as the last child of the viewer column.

---

## Task 1: Shared view-mode config

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/viewer-modes.ts`

- [ ] **Step 1: Create the shared config module**

```ts
import type { ViewerMode } from '../state/viewer-state.svelte';

/** One switchable view in the sequence viewer (rail + mobile bottom bar). */
export interface ViewerModeOption {
	/** The ViewerMode this option selects. */
	id: ViewerMode;
	/** Font Awesome class fragment, e.g. 'fa-play'. */
	icon: string;
	label: string;
	/** When true, the option is hidden unless WebGL2 is available. */
	requiresWebgl2?: boolean;
}

/**
 * Single source of truth for the viewer's switchable views.
 * Consumed by ViewerContentRail (desktop) and ViewerModeBottomBar (mobile).
 * Order is intentional: Side-by-Side first, then single views by value.
 */
export const VIEWER_MODE_OPTIONS: ViewerModeOption[] = [
	{ id: 'split', icon: 'fa-columns', label: 'Side by Side' },
	{ id: 'animation', icon: 'fa-play', label: '2D Animation' },
	{ id: 'animation-3d', icon: 'fa-cube', label: '3D Animation', requiresWebgl2: true },
	{ id: 'card', icon: 'fa-grip', label: 'Card' },
	{ id: 'mandala', icon: 'fa-dharmachakra', label: 'Mandala' }
];

/** Practice is a toggle, not a ViewerMode. Rendered as its own item in both switchers. */
export const PRACTICE_OPTION = { icon: 'fa-signal', label: 'Practice' } as const;

/** Filter helper: drops WebGL2-only options when WebGL2 is unavailable. */
export function viewerModeOptions(webgl2Available: boolean): ViewerModeOption[] {
	return webgl2Available
		? VIEWER_MODE_OPTIONS
		: VIEWER_MODE_OPTIONS.filter((m) => !m.requiresWebgl2);
}
```

- [ ] **Step 2: Type-check the new module**

Run: `npm run check:fast`
Expected: no new errors referencing `viewer-modes.ts`. (`ViewerMode` is re-exported from `viewer-state.svelte`, confirmed in that file's export list.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/viewer-modes.ts
git commit -m "feat(viewer): extract shared view-mode config for rail + mobile bar"
```

---

## Task 2: Rail consumes the shared config (behavior unchanged)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte`

The rail currently inlines `allModes` (6 items including `practice`) and derives `modes` by filtering `animation-3d`. Replace the inlined list with the shared config, reconstructing the practice item locally so the rendered output (6 buttons, practice last, keyboard nav over all 6) stays byte-identical.

- [ ] **Step 1: Import the shared config**

Replace the import block at the top of the `<script>` (currently line 2):

```ts
import type { ContentType, ViewerMode } from '../state/viewer-state.svelte';
import { viewerModeOptions, PRACTICE_OPTION } from '../services/viewer-modes';
```

- [ ] **Step 2: Replace the inlined `allModes` + `modes` derivation**

Delete the `allModes` array (currently lines 22-29) and the `modes` derivation (currently lines 31-33). Replace both with:

```ts
const railItems = $derived([
	...viewerModeOptions(webgl2Available).map((m) => ({ id: m.id, icon: m.icon, label: m.label })),
	{ id: 'practice' as const, icon: PRACTICE_OPTION.icon, label: PRACTICE_OPTION.label }
]);
```

- [ ] **Step 3: Point the template + keyboard nav at `railItems`**

In the markup, change the `{#each}` (currently line 118) from `modes as mode, i` to:

```svelte
{#each railItems as mode, i (mode.id)}
```

In `focusAt` / `handleKeydown` (currently lines 90, 102), replace both `modes.length` references with `railItems.length`.

- [ ] **Step 4: One-shot type check**

Run: `npm run check:fast`
Expected: no errors in `ViewerContentRail.svelte`. The `onclick` branch still narrows: `mode.id === 'split'` → `onSelectSplit()`, `mode.id === 'practice'` → `onPracticeToggle?.()`, else `onSelectMode(mode.id as ContentType)`. `ContentType` import retained for that cast.

- [ ] **Step 5: Runtime smoke (desktop rail unchanged)**

Dev server already on :5173. Ask the user (or via DevTools if permission granted) to open the sequence viewer at desktop width and confirm the rail still shows all 6 buttons in order (Side by Side, 2D, 3D, Card, Mandala, Practice), arrow-key nav still cycles all 6, and selecting each still switches the view. If you cannot drive the browser, state: "I cannot verify this visually — please open the viewer at desktop width and confirm the rail is unchanged."

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte
git commit -m "refactor(viewer): rail consumes shared view-mode config"
```

---

## Task 3: Lift host select handlers into named functions

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`

Currently the rail receives inline arrow handlers (lines ~432-449). To share identical routing with the bottom bar without duplication, extract them into named functions in the host `<script>` and pass the refs to the rail.

- [ ] **Step 1: Add named handlers to the host script**

Add near the other handler definitions in the `<script>` (e.g. after `handleCopyForClaude`, around line 130). Replicates the rail's existing routing exactly:

```ts
function selectSplitMode() {
	ctx.viewerState.exitExport();
	ctx.viewerState.setViewerMode('split');
	setTimeout(() => rerenderTrigger++, 280);
}

function selectViewerMode(mode: ContentType) {
	if (mode === 'animation') {
		ctx.viewerState.enterExport('animation-export', 'animation');
	} else if (mode === 'animation-3d') {
		ctx.viewerState.enterExport('animation-export', 'animation-3d');
	} else if (mode === 'card') {
		ctx.viewerState.enterExport('image-export');
	} else if (mode === 'mandala') {
		ctx.viewerState.exitExport();
		ctx.viewerState.setViewerMode('mandala');
	}
}

function togglePractice() {
	ctx.practiceActive ? ctx.handlePracticeStop() : ctx.handlePracticeStart();
}
```

Confirm `ContentType` is imported in this file; if not, add it to the existing import from the viewer-state module. Grep first: `import type { ... } from` referencing `viewer-state`.

- [ ] **Step 2: Repoint the rail to the named handlers**

Replace the rail's inline handler props (currently lines ~432-449) so the `<ViewerContentRail>` reads:

```svelte
<ViewerContentRail
	activeMode={ctx.viewerState.viewerMode}
	webgl2Available={ctx.viewer3DState.webgl2Available}
	practiceActive={ctx.practiceActive}
	onPracticeToggle={togglePractice}
	onSelectSplit={selectSplitMode}
	onSelectMode={selectViewerMode}
/>
```

- [ ] **Step 3: One-shot type check**

Run: `npm run check:fast`
Expected: no errors in `SequenceViewerDrawerHost.svelte`. Behavior is identical — only the call sites moved.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "refactor(viewer): extract rail select handlers into named host functions"
```

---

## Task 4: Build `ViewerModeBottomBar`

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/ViewerModeBottomBar.svelte`

Horizontal bottom bar for portrait. Built from `NavButton` (icon passed as an HTML `<i>` string, since `NavButton` renders `icon` via `{@html}`). Reproduces the global `BottomNavigation` container-query label pattern (`NavButton` hides `.nav-label-full` / `.nav-label-compact` by default; the parent reveals them via `@container`). Filters `animation-3d` when `!webgl2Available`. Pinned bottom with `env(safe-area-inset-bottom)`.

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
	import type { ContentType, ViewerMode } from '../state/viewer-state.svelte';
	import { viewerModeOptions, PRACTICE_OPTION } from '../services/viewer-modes';
	import NavButton from '$lib/shared/navigation/components/buttons/NavButton.svelte';

	interface Props {
		activeMode: ViewerMode;
		webgl2Available?: boolean;
		practiceActive?: boolean;
		onSelectMode: (mode: ContentType) => void;
		onSelectSplit: () => void;
		onPracticeToggle?: () => void;
	}

	let {
		activeMode,
		webgl2Available = true,
		practiceActive = false,
		onSelectMode,
		onSelectSplit,
		onPracticeToggle
	}: Props = $props();

	const modes = $derived(viewerModeOptions(webgl2Available));

	function selectMode(id: ViewerMode) {
		if (id === 'split') onSelectSplit();
		else onSelectMode(id as ContentType);
	}
</script>

<nav class="viewer-bottom-bar" aria-label="View switcher">
	{#each modes as mode (mode.id)}
		<NavButton
			icon={`<i class="fas ${mode.icon}"></i>`}
			label={mode.label}
			ariaLabel={mode.label}
			active={activeMode === mode.id}
			onClick={() => selectMode(mode.id)}
		/>
	{/each}
	{#if onPracticeToggle}
		<NavButton
			icon={`<i class="fas ${practiceActive ? 'fa-stop' : PRACTICE_OPTION.icon}"></i>`}
			label={practiceActive ? 'Stop' : PRACTICE_OPTION.label}
			ariaLabel={practiceActive ? 'Stop practice' : 'Practice'}
			active={practiceActive}
			onClick={onPracticeToggle}
		/>
	{/if}
</nav>

<style>
	.viewer-bottom-bar {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		justify-content: space-around;
		gap: var(--spacing-xs, 4px);
		width: 100%;
		flex-shrink: 0;
		padding: 4px 6px;
		padding-bottom: calc(4px + env(safe-area-inset-bottom));
		background: var(--theme-panel-bg, #0a0a14);
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));

		/* Mirror BottomNavigation: container queries drive NavButton label visibility */
		container-type: inline-size;
		container-name: viewer-bottom-bar;
	}

	.viewer-bottom-bar :global(.nav-button) {
		flex: 1 1 0%;
		min-height: var(--min-touch-target, 44px);
	}

	/* Full labels (520px+) */
	@container viewer-bottom-bar (min-width: 520px) {
		.viewer-bottom-bar :global(.nav-label-full) {
			display: block;
		}
	}

	/* Compact labels (400-519px) */
	@container viewer-bottom-bar (min-width: 400px) and (max-width: 519px) {
		.viewer-bottom-bar :global(.nav-label-compact) {
			display: block;
		}
	}

	/* <400px: icons only (NavButton default — labels stay hidden) */

	/* Fallback where container queries are unsupported */
	@supports not (container-type: inline-size) {
		@media (min-width: 520px) {
			.viewer-bottom-bar :global(.nav-label-full) {
				display: block;
			}
		}
		@media (min-width: 400px) and (max-width: 519px) {
			.viewer-bottom-bar :global(.nav-label-compact) {
				display: block;
			}
		}
	}
</style>
```

- [ ] **Step 2: One-shot type check**

Run: `npm run check:fast`
Expected: no errors in `ViewerModeBottomBar.svelte`. `NavButton` prop names verified against source: `icon`, `label`, `ariaLabel`, `active`, `onClick`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerModeBottomBar.svelte
git commit -m "feat(viewer): add ViewerModeBottomBar for mobile portrait switching"
```

---

## Task 5: Render the bottom bar on mobile

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`

Render `<ViewerModeBottomBar>` when `isMobileWidth`, as the last child of the `.viewer-and-export` column, wired to the same named handlers the rail uses. (Playback transport is per-pane inside `ViewerSplitPane`, not a global bottom element, so the switcher sits cleanly below the viewer content.)

- [ ] **Step 1: Import the component**

Add to the import block near the other viewer imports (alongside line 16's `ViewerContentRail`):

```ts
import ViewerModeBottomBar from "./ViewerModeBottomBar.svelte";
```

- [ ] **Step 2: Render the bar inside the viewer column**

Inside the `.viewer-and-export` div, after the `{#if showRail}...ViewerContentRail...{/if}` block and the split/video content, add as the last child before the closing `</div>` of `.viewer-and-export` (the close-paren context: after the `{#if isSidebarExportActive}` export-panel block, still inside `.viewer-and-export`):

```svelte
{#if isMobileWidth && !isAnyExportActive}
	<ViewerModeBottomBar
		activeMode={ctx.viewerState.viewerMode}
		webgl2Available={ctx.viewer3DState.webgl2Available}
		practiceActive={ctx.practiceActive}
		onPracticeToggle={togglePractice}
		onSelectSplit={selectSplitMode}
		onSelectMode={selectViewerMode}
	/>
{/if}
```

Rationale for the `!isAnyExportActive` guard: when an export/edit panel is active the viewer is in a modal sub-flow with its own chrome; the switcher would compete with it. Hidden during export, matching the rail's effective role (the rail's single-view selections enter export contexts; on mobile the user re-enters via the same bar once export closes).

- [ ] **Step 3: Ensure the column lays out the bar at the bottom**

Confirm `.viewer-and-export` is `display: flex; flex-direction: column;` on mobile so the bar pins to the bottom. Grep the `<style>` block for `.viewer-and-export`. If the mobile rule is not already column with the viewer content set to `flex: 1`, add (scoped to the existing mobile/non-desktop selector — do NOT alter the `.desktop` rule):

```css
.viewer-and-export:not(.desktop) {
	display: flex;
	flex-direction: column;
}
```

Read the existing `.viewer-and-export` rules first and adapt to the established selectors rather than introducing a conflicting one.

- [ ] **Step 4: One-shot full type check (cross-file)**

Run: `npm run check > /tmp/check.log 2>&1` then `grep -niE "error" /tmp/check.log`
Expected: zero errors. (Full check because Tasks 1-5 touched shared symbols across files.)

- [ ] **Step 5: Runtime verification — REQUIRED (explicitly not assumed)**

With the dev server on :5173, request browser verification (DevTools if permission granted, else hand off to the user) at a narrow portrait viewport (e.g. 390×844):

1. Bottom bar appears in portrait; hidden at ≥768px (rail shows instead).
2. Each button switches the view: Side-by-Side → split; 2D / 3D / Card / Mandala → that single view; Practice toggles and the label flips to "Stop".
3. In Side-by-Side, the `ComparisonModeBar` still floats top-center.
4. The bar clears the iOS home indicator (safe-area padding) and does not overlap the per-pane progress bar / transport. **Confirm stacking visually — do not assume.**
5. 3D button is present (3D stays enabled on mobile); it disappears only when `webgl2Available` is false.

If you cannot drive the browser, state explicitly: "I cannot verify this visually — please open the viewer on a portrait phone viewport and confirm: (1) bottom bar visible, (2) each mode switches, (3) no overlap with the transport, (4) safe-area clearance."

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "feat(viewer): render mobile view-switcher bottom bar in portrait"
```

---

## Self-Review

**Spec coverage:**
- Bottom bar in portrait, rail in landscape/desktop (≥768px) → Task 5 (`isMobileWidth` gate; rail untouched via existing `showRail`).
- Same capability as desktop (split + 4 single views + practice) → shared config Task 1, consumed by both Tasks 2 & 4.
- 3D stays enabled on mobile → `VIEWER_MODE_OPTIONS` keeps `animation-3d`; only `requiresWebgl2` filtering, identical to rail.
- Split auto-orientation unchanged → no edits to `ViewerSplitPane` media queries (out of scope, honored).
- `ComparisonModeBar` still shows in split → untouched; verified in Task 5 runtime step 3.
- Built from `NavButton`, not hand-rolled → Task 4 imports the primitive; container-query labels mirror `BottomNavigation`.
- Single source of truth → `viewer-modes.ts`; rail + bar both import it.
- No new state → both switchers call existing `viewerState` setters via shared host handlers (Task 3).

**Placeholder scan:** none — all code blocks are concrete; line references point at current source.

**Type consistency:** `ViewerModeOption.id: ViewerMode`; rail casts non-split/practice ids to `ContentType` (unchanged); bottom bar casts the same way; `viewerModeOptions(webgl2Available)` filters via `requiresWebgl2`; `PRACTICE_OPTION` shape `{ icon, label }` used identically in rail (`railItems`) and bar. Host handler names `selectSplitMode` / `selectViewerMode` / `togglePractice` are referenced consistently in Tasks 3 and 5.

**Scope:** single subsystem (the viewer switcher). One plan is correct.
