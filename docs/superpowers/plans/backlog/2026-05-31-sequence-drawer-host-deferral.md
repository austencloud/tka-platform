# SequenceDrawerHost Deferral Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `SequenceDrawerHost`'s 297-file export/animation subtree out of the Create module's eager first-paint graph (554 → ~257 files) while preserving export, animation export, `?sheet=animation` deep-links, back/forward URL behavior, and the view-sequence redirect.

**Architecture:** `SequenceDrawerHost` stays eager today only because it owns two always-on listeners whose deps pull a 135-file navigator subtree. Extract both into a tiny always-mounted `SequenceDrawerLauncher` that statically imports only light deps and **dynamic-imports** the heavy navigator on the redirect click. Then `LazyMount` the host on `panelState.isExportPanelOpen` with `prefetch` so its 297-file chunk idle-warms after first paint and the first export-open is instant.

**Tech Stack:** Svelte 5 (runes), SvelteKit, existing `LazyMount.svelte` primitive, existing `ExportUrlManager` primitive, `scripts/trace-create-three.cjs` (graph analyzer), Chrome DevTools MCP (runtime proof).

**Spec:** `docs/superpowers/specs/2026-05-31-create-module-eager-graph-deferral-design.md`

**Note on verification model:** This is a structural deferral of a Svelte composition root — there is no meaningful unit-test seam (no pure function changes behavior). Proof is (a) `scripts/trace-create-three.cjs` showing the eager graph shrank — a structural guarantee, (b) `npm run build` emitting the host + navigator as separate lazy chunks, and (c) interactive Chrome DevTools on `:5173` exercising every preserved path. Each task ends with the concrete proof for that task.

**Branching:** Work on `main` (global rule bans branches/worktrees). The writing-plans "dedicated worktree" default is overridden.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/features/create/shared/components/coordinators/SequenceDrawerLauncher.svelte` | Always-mounted, light. Opens export panel on deep-link/back-forward; dynamic-imports the navigator on the view-sequence redirect. | **Create** |
| `src/lib/features/create/shared/components/coordinators/SequenceDrawerHost.svelte` | Export/animation drawer host. Loses the redirect `$effect` + its two now-dead imports. Otherwise unchanged. | **Modify** |
| `src/lib/features/create/shared/components/CreateModule.svelte` | Composition root. Swaps the eager `<SequenceDrawerHost />` for `<SequenceDrawerLauncher />` + a `LazyMount` of the host. | **Modify** |

---

## Task 1: Create `SequenceDrawerLauncher.svelte`

**Files:**
- Create: `src/lib/features/create/shared/components/coordinators/SequenceDrawerLauncher.svelte`

The launcher reproduces, verbatim, the two responsibilities lifted from the host:
1. The host's `onMount` `urlManager.initialize({...})` (host lines 434–456) — but with `onStateRestore` as a no-op, since the host registers its OWN `ExportUrlManager` once mounted and that one (which has `playbackController`) does the speed/beat restore.
2. The host's `isSequenceViewerOpen` redirect `$effect` (host lines 261–281) — but the two heavy modules (`sequence-viewer-navigator`, `sequence-handoff.svelte`) become **dynamic** imports inside the effect.

- [ ] **Step 1: Create the launcher file**

Create `src/lib/features/create/shared/components/coordinators/SequenceDrawerLauncher.svelte` with EXACTLY this content:

```svelte
<script lang="ts">
  /**
   * SequenceDrawerLauncher
   *
   * Tiny always-mounted companion to the (now lazy) SequenceDrawerHost. It owns
   * the two responsibilities that must stay live even before the export drawer's
   * heavy 297-file subtree has loaded:
   *
   *  1. `?sheet=animation` deep-link / back-forward → open the export panel.
   *     Opening flips `panelState.isExportPanelOpen`, which mounts the host via
   *     LazyMount in CreateModule.
   *  2. View-sequence redirect: when `panelState.isSequenceViewerOpen` flips true,
   *     dynamic-import the sequence-viewer navigator (135-file subtree) and open
   *     the viewer — so that subtree loads ONLY on the click, never at boot.
   *
   * Static imports here are deliberately light (context + auth + url-manager).
   * The heavy navigator + handoff are dynamic-imported inside the effect.
   */
  import { onMount } from "svelte";
  import { getCreateModuleContext } from "../../context/create-module-context";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { ExportUrlManager } from "$lib/shared/export-panel/services/export-url-manager";

  const { CreateModuleState, panelState } = getCreateModuleContext();

  const currentSequence = $derived(
    CreateModuleState.sequenceState.currentSequence
  );

  // --- 1. Deep-link / back-forward → open export panel -----------------------
  // Reuse the existing ExportUrlManager primitive (light deps: sheet-router +
  // $app/navigation). The host registers its OWN ExportUrlManager once mounted,
  // which performs the speed/beat restore (it has the playbackController the
  // launcher lacks); here onStateRestore is a deliberate no-op.
  const urlManager = new ExportUrlManager();
  let cleanupUrlManager: (() => void) | undefined;

  onMount(() => {
    cleanupUrlManager = urlManager.initialize({
      onAnimationPanelOpen: () => {
        if (!panelState.isExportPanelOpen) {
          panelState.openExportPanel("animation");
        }
      },
      onStateRestore: () => {
        // No-op: the host's urlManager performs speed/beat restore once mounted.
      },
    });
    return () => cleanupUrlManager?.();
  });

  // --- 2. View-sequence redirect (heavy navigator loaded on demand) ----------
  $effect(() => {
    if (!panelState.isSequenceViewerOpen || !currentSequence) return;

    // Clear the flag immediately so this fires once per request.
    panelState.closeSequenceViewer();

    // Stamp ownership so the viewer shows Save/Edit/Delete for create-built
    // sequences that haven't been persisted to Firestore yet.
    const seq = currentSequence;
    const sequenceWithOwner = seq.ownerId
      ? seq
      : {
          ...seq,
          ownerId: authState.user?.uid ?? undefined,
          ownerDisplayName: authState.user?.displayName ?? undefined,
        };

    void (async () => {
      const [{ openSequenceViewer }, { getReturnContext }] = await Promise.all([
        import("$lib/shared/sequence-viewer/services/sequence-viewer-navigator"),
        import("$lib/shared/coordinators/sequence-handoff.svelte"),
      ]);
      const { returnPath, returnLabel } = getReturnContext();
      openSequenceViewer(sequenceWithOwner, { returnPath, returnLabel });
    })();
  });
</script>
```

Notes locking the design:
- `getCreateModuleContext()` returns `{ CreateModuleState, panelState, ... }` (same destructure the host uses at line 63–64). `CreateModuleState.sequenceState.currentSequence` is the host's `currentSequence` source (host line 138–140).
- `openExportPanel(format?: "animation" | "static")` is the real signature (`panel-coordination-state.svelte.ts:612`). Passing `"animation"` sets `requestedExportFormat`, which the host's existing `$effect` (host line 130–135) reads to set `selectedFormat = "animation"`. The launcher must NOT touch `selectedFormat` — it is host-owned.
- `openSequenceViewer(sequence, { returnPath, returnLabel })` matches the navigator's exported signature (`sequence-viewer-navigator.ts:47`; `returnPath` required, `returnLabel` optional).
- Dynamic import path for handoff is `"$lib/shared/coordinators/sequence-handoff.svelte"` (no `.ts`) — identical to the host's static specifier at line 43; the file on disk is `sequence-handoff.svelte.ts`.

- [ ] **Step 2: Confirm the launcher's static imports are light**

The launcher must not statically pull anything heavy. Verify its four static imports:

Run:
```bash
grep -nE "^\s*import" src/lib/features/create/shared/components/coordinators/SequenceDrawerLauncher.svelte
```
Expected: exactly `svelte` (`onMount`), `getCreateModuleContext`, `authState`, `ExportUrlManager`. No `sequence-viewer-navigator`, no `sequence-handoff`, no `SequenceDrawer`. (Those two appear only inside the `import(...)` calls in the effect.)

- [ ] **Step 3: Typecheck the new file (warm checker)**

Start the warm checker once if not already running, then read its output. Per `fast-iteration-loop.md`, do NOT cold-run `npm run check` here.

Run (background, once per session):
```bash
npm run check:watch
```
Expected: no NEW errors referencing `SequenceDrawerLauncher.svelte`. (Pre-existing unrelated errors in background-builder/admin/ocean are not introduced by this task — ignore them.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/shared/components/coordinators/SequenceDrawerLauncher.svelte
git commit -m "feat(create): add SequenceDrawerLauncher (deep-link open + on-demand view-sequence redirect)" -- src/lib/features/create/shared/components/coordinators/SequenceDrawerLauncher.svelte
```

(Explicit pathspec per `commit-only-your-own-changes.md` — the shared index may hold other agents' work.)

---

## Task 2: Strip the redirect `$effect` + dead imports from `SequenceDrawerHost.svelte`

**Files:**
- Modify: `src/lib/features/create/shared/components/coordinators/SequenceDrawerHost.svelte`

The launcher now owns the `isSequenceViewerOpen` redirect. Remove it from the host along with the two imports that become unused (`openSequenceViewer`, `getReturnContext`). `authState` and `navigationState` STAY — `authState` is still used in `performExport` (host line 667) and `navigationState` in the init effect (host line 287).

- [ ] **Step 1: Remove the redirect `$effect`**

Delete the entire block at host lines 261–281 (the comment + the `$effect`):

```svelte
  // When panelState.isSequenceViewerOpen becomes true, open the sequence viewer
  $effect(() => {
    if (panelState.isSequenceViewerOpen && currentSequence) {
      // Clear the flag immediately
      panelState.closeSequenceViewer();

      // Stamp ownership on the sequence so the viewer shows Save/Edit/Delete actions.
      // Sequences built in the create module don't have ownerId since they haven't
      // been persisted to Firestore yet.
      const sequenceWithOwner = currentSequence.ownerId
        ? currentSequence
        : {
            ...currentSequence,
            ownerId: authState.user?.uid ?? undefined,
            ownerDisplayName: authState.user?.displayName ?? undefined,
          };

      const { returnPath, returnLabel } = getReturnContext();
      openSequenceViewer(sequenceWithOwner, { returnPath, returnLabel });
    }
  });
```

Replace it with a one-line breadcrumb so the next reader knows where it went:

```svelte
  // View-sequence redirect (panelState.isSequenceViewerOpen → openSequenceViewer)
  // lives in SequenceDrawerLauncher.svelte so the heavy navigator subtree loads
  // on-demand and stays out of the Create module's eager graph.
```

- [ ] **Step 2: Remove the two now-dead imports**

Delete host line 42 and line 43:

```svelte
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
  import { getReturnContext } from "$lib/shared/coordinators/sequence-handoff.svelte";
```

Leave the surrounding imports (`authState` line 40, `navigationState` line 41) intact.

- [ ] **Step 3: Update the stale trailing comment**

At host line 760, replace:

```svelte
<!-- Sequence Details Modal removed - $effect intercept at line 314 redirects to /sequence/[id] route -->
```
with:
```svelte
<!-- View-sequence redirect moved to SequenceDrawerLauncher.svelte (on-demand navigator import). -->
```

- [ ] **Step 4: Verify the removed symbols are no longer referenced anywhere in the host**

Run:
```bash
grep -nE "openSequenceViewer|getReturnContext" src/lib/features/create/shared/components/coordinators/SequenceDrawerHost.svelte
```
Expected: **no matches**. (If `authState` or `navigationState` show as unused that's a bug — they must still be referenced; re-check Steps only removed the redirect.)

Run:
```bash
grep -nE "authState|navigationState" src/lib/features/create/shared/components/coordinators/SequenceDrawerHost.svelte
```
Expected: `authState` still appears (≥ the import + `performExport`), `navigationState` still appears (≥ the import + init effect). Confirms we didn't strip a still-live import.

- [ ] **Step 5: Read the warm checker output**

Check the already-running `check:watch` terminal.
Expected: no NEW errors in `SequenceDrawerHost.svelte` (no "declared but never read" for `openSequenceViewer`/`getReturnContext` — they're gone; no "cannot find name" — nothing else used them).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/create/shared/components/coordinators/SequenceDrawerHost.svelte
git commit -m "refactor(create): move view-sequence redirect out of SequenceDrawerHost into launcher" -- src/lib/features/create/shared/components/coordinators/SequenceDrawerHost.svelte
```

---

## Task 3: Wire launcher + LazyMount the host in `CreateModule.svelte`

**Files:**
- Modify: `src/lib/features/create/shared/components/CreateModule.svelte`

`LazyMount` is already imported here (line 74). Swap the host's static import for the launcher's, and replace the eager render with launcher + lazy host.

- [ ] **Step 1: Swap the static import**

At CreateModule line 70, replace:

```svelte
  import SequenceDrawerHost from "./coordinators/SequenceDrawerHost.svelte";
```
with:
```svelte
  import SequenceDrawerLauncher from "./coordinators/SequenceDrawerLauncher.svelte";
```

(The host is now reached only via the `import(...)` literal in the LazyMount loader below, so it must NOT remain a static import — that would defeat the deferral.)

- [ ] **Step 2: Replace the eager render with launcher + LazyMount**

At CreateModule lines 752–753, replace:

```svelte
  <!-- Sequence Drawer Host (eager: owns animation deep-link restore + view-sequence redirect) -->
  <SequenceDrawerHost />
```
with:
```svelte
  <!-- Always-mounted launcher (light): owns deep-link open + view-sequence redirect.
       The heavy export/animation drawer host is deferred until first open via
       LazyMount, then idle-prefetched so the first open is instant. -->
  <SequenceDrawerLauncher />
  <LazyMount
    loader={() => import("./coordinators/SequenceDrawerHost.svelte")}
    active={panelState.isExportPanelOpen}
    prefetch
  />
```

`panelState` is already in template scope here (e.g. line 749 `active={panelState.isVideoRecordPanelOpen}`), so `active={panelState.isExportPanelOpen}` resolves with no new wiring.

- [ ] **Step 3: Confirm the host is no longer statically imported**

Run:
```bash
grep -nE "SequenceDrawerHost|SequenceDrawerLauncher" src/lib/features/create/shared/components/CreateModule.svelte
```
Expected:
- the new `import SequenceDrawerLauncher ...` line,
- the `<SequenceDrawerLauncher />` render,
- the `import("./coordinators/SequenceDrawerHost.svelte")` INSIDE the LazyMount loader,
- and NO bare `import SequenceDrawerHost from ...` static line.

- [ ] **Step 4: Read the warm checker output**

Check the `check:watch` terminal.
Expected: no NEW errors in `CreateModule.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/components/CreateModule.svelte
git commit -m "perf(create): defer SequenceDrawerHost via LazyMount + idle prefetch" -- src/lib/features/create/shared/components/CreateModule.svelte
```

---

## Task 4: Structural + build proof (the deferral actually happened)

**Files:** none (verification only)

- [ ] **Step 1: Re-run the eager-graph analyzer**

Run:
```bash
node scripts/trace-create-three.cjs
```
Expected: the Create module's eager first-paint file count drops from **554 to ~257** (the 297-file `SequenceDrawerHost` subtree is gone from the static graph). If it still reports ~554, the host is still statically reachable — re-check Task 3 Step 1 (a lingering static `import SequenceDrawerHost`) and Task 1 Step 2 (a heavy import accidentally made static in the launcher).

- [ ] **Step 2: Capture the number for the record**

Note the exact eager count the script prints (it is the success metric). Paste it into the verification report at the end.

- [ ] **Step 3: Full prod build (ship gate)**

Run:
```bash
npm run build
```
Expected: exit 0. The build must emit `SequenceDrawerHost` and the `sequence-viewer-navigator` subtree as **separate lazy chunks** (because they're now reached only through `import(...)`). 

- [ ] **Step 4: Confirm the lazy chunks exist in the manifest**

Run:
```bash
grep -rE "SequenceDrawerHost|sequence-viewer-navigator" .svelte-kit/output/client/.vite/manifest.json | head
```
Expected: entries appear as their own chunk records (proof they split out of the create chunk rather than inlining into it).

- [ ] **Step 5: Commit (only if the analyzer left a generated artifact you intend to keep — otherwise skip)**

This task creates no source changes. Do NOT run a bare commit. If `trace-create-three.cjs` wrote a report file you want to keep, commit only that explicit path; otherwise there is nothing to commit.

---

## Task 5: Interactive runtime proof (every preserved path)

**Files:** none (verification only). Per `verification-protocol.md` + `automate-verification-fast`, drive Chrome DevTools MCP on the user's `:5173` yourself. Interactive DevTools commands (`navigate_page`, `click`, etc.) require explicit verbal permission in the conversation — if not already granted this turn, ask once: *"OK to drive your browser on :5173 to verify the 6 paths?"* Read-only (`take_snapshot`, `evaluate_script`, `list_console_messages`) needs no permission.

Each check below maps to a behavior the deferral must not break.

- [ ] **Step 1: Create boots on construct, no regression, host NOT yet in the graph**

Navigate to `http://localhost:5173/create`. Confirm the construct tab renders.
Then prove the host chunk has NOT loaded at boot:
```js
// evaluate_script
performance.getEntriesByType("resource")
  .filter(r => /SequenceDrawerHost/.test(r.name))
  .map(r => r.name);
```
Expected: empty array at first paint (the prefetch fires on idle a beat later — that's fine; the point is it's not in the synchronous boot graph). Also confirm no console errors mentioning `SequenceDrawerLauncher` via `list_console_messages`.

- [ ] **Step 2: Open the export panel → host mounts + renders**

Build/open a sequence so `currentSequence` is non-null, then trigger the export/animation panel (the existing export entry point). 
Expected: the drawer mounts and renders; the animation preview plays. Confirm the host chunk is now present:
```js
// evaluate_script
performance.getEntriesByType("resource")
  .some(r => /SequenceDrawerHost/.test(r.name));
```
Expected: `true`.

- [ ] **Step 3: View-sequence redirect loads the navigator on the click**

With a sequence present, trigger the "view sequence" action (whatever flips `panelState.isSequenceViewerOpen` — e.g. the construct-tab view button).
Expected: the sequence viewer overlay opens. Confirm the navigator subtree loaded as a result of the click (not at boot):
```js
// evaluate_script
performance.getEntriesByType("resource")
  .some(r => /sequence-viewer-navigator/.test(r.name));
```
Expected: `true` after the click. The viewer must show the create-built sequence with ownership actions (Save/Edit/Delete), proving the ownership stamp survived the move to the launcher.

- [ ] **Step 4: `?sheet=animation` deep-link opens + restores**

Navigate to `http://localhost:5173/create?sheet=animation` (optionally with `&animSpeed=2&animStep=4`).
Expected: the export/animation panel opens on load (launcher's `onAnimationPanelOpen` fired → opened panel → host mounted). If speed/step params were included, they restore (host's own urlManager performs the restore once mounted). Confirm via snapshot that the animation panel is open.

- [ ] **Step 5: Back/forward across the animation sheet**

From the deep-linked open state, press the browser Back button, then Forward.
Expected: Back closes the animation sheet; Forward re-opens it. The launcher's `onRouteChange` (via `ExportUrlManager`) handles both directions. No console errors.

- [ ] **Step 6: Animation export still works end-to-end**

With the animation panel open, run a single animation export (the existing Export/Download Animation control).
Expected: export completes (toast "Export complete!"), file downloads. Confirms the host's export pipeline is intact after losing the redirect effect.

- [ ] **Step 7: Write the verification report**

Summarize in the final message: the trace count (Task 4 Step 2), `npm run build` exit code, and pass/fail for each of the 6 runtime checks with the `evaluate_script` outputs as evidence. No "should work" language — only observed results (`verification-protocol.md`).

---

## Self-Review (run before handing off)

**Spec coverage** (against `2026-05-31-create-module-eager-graph-deferral-design.md` §"Remaining work"):
- Launcher owns deep-link open → Task 1 Step 1 (`onAnimationPanelOpen`). ✅
- Launcher owns view-sequence redirect with on-demand navigator import → Task 1 Step 1 (`$effect`). ✅
- Host loses redirect effect, keeps ExportUrlManager → Task 2. ✅
- CreateModule swaps to launcher + LazyMount(host, prefetch) → Task 3. ✅
- 554 → ~257 eager files → Task 4 Step 1. ✅
- Export, animation export, deep-link, back/forward, view-sequence preserved → Task 5 Steps 2–6. ✅

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to" — all code is verbatim. ✅

**Type/name consistency:** `panelState.openExportPanel("animation")`, `isExportPanelOpen`, `isSequenceViewerOpen`, `closeSequenceViewer()` all match `panel-coordination-state.svelte.ts`. `openSequenceViewer(seq, {returnPath, returnLabel})` matches `sequence-viewer-navigator.ts:47`. `getReturnContext()` returns `{returnPath, returnLabel}` (`sequence-handoff.svelte.ts:224`). `CreateModuleState.sequenceState.currentSequence` matches host line 138. ✅

**Out of scope (do NOT touch):** merging `AnimationSheetCoordinator`, the two module-persistence keys, three.js vendor chunk, CLS 0.17. ✅
