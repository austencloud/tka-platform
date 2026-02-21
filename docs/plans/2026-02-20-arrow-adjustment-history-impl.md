# Arrow Adjustment History & Undo — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add session undo (Ctrl+Z), persistent Firestore history, and a history UI panel for arrow adjustments in the step editor.

**Architecture:** Three layers — (1) in-memory undo stack pushed to on every WASD move, (2) Firestore history collection written fire-and-forget alongside every save/delete, (3) lazy-loaded history panel in the step editor header. Each layer is independently useful and builds on the last.

**Tech Stack:** Svelte 5 runes, Firebase Client SDK (firestore), existing ArrowAdjustment infrastructure.

**Design doc:** `docs/plans/2026-02-20-arrow-adjustment-history-design.md`

---

## Task 1: Create ArrowAdjustmentUndoStack

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/global/state/ArrowAdjustmentUndoStack.ts`

**Step 1: Create the undo stack module**

```typescript
// src/lib/shared/pictograph/arrow/positioning/global/state/ArrowAdjustmentUndoStack.ts

import type { AdjustmentTargetKey } from "$lib/features/create/shared/services/contracts/IArrowAdjustmentOrchestrator";

const MAX_STACK_SIZE = 50;

export interface UndoEntry {
  targetKey: AdjustmentTargetKey;
  previousX: number;
  previousY: number;
  newX: number;
  newY: number;
  timestamp: number;
}

let stack: UndoEntry[] = [];

export const arrowAdjustmentUndoStack = {
  push(entry: UndoEntry): void {
    stack.push(entry);
    if (stack.length > MAX_STACK_SIZE) {
      stack.shift(); // Drop oldest
    }
  },

  pop(): UndoEntry | null {
    return stack.pop() ?? null;
  },

  peek(): UndoEntry | null {
    return stack.length > 0 ? stack[stack.length - 1] : null;
  },

  get size(): number {
    return stack.length;
  },

  get isEmpty(): boolean {
    return stack.length === 0;
  },

  clear(): void {
    stack = [];
  },
};
```

**Step 2: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/global/state/ArrowAdjustmentUndoStack.ts
git commit -m "feat: add ArrowAdjustmentUndoStack for session undo"
```

---

## Task 2: Push to undo stack on WASD movement

**Files:**
- Modify: `src/lib/features/create/shared/services/implementations/ArrowAdjustmentOrchestrator.ts`

**Step 1: Import undo stack and push before applying**

At the top of the file, add the import:
```typescript
import { arrowAdjustmentUndoStack } from "$lib/shared/pictograph/arrow/positioning/global/state/ArrowAdjustmentUndoStack";
```

In `applyWASDMovement`, after the `getCurrentBaseValue` call resolves and before writing the new value, push the previous state onto the undo stack:

Find this block (around line 140-150):
```typescript
    // Calculate new total using reference-transformed adjustment
    const newX = currentX + referenceAdjustment.x;
    const newY = currentY + referenceAdjustment.y;

    // Save to global repo locally (NOT to Firestore yet)
    try {
```

Insert undo stack push between the calculation and the save:
```typescript
    // Calculate new total using reference-transformed adjustment
    const newX = currentX + referenceAdjustment.x;
    const newY = currentY + referenceAdjustment.y;

    // Push previous state to undo stack BEFORE saving
    arrowAdjustmentUndoStack.push({
      targetKey: targetKey!,
      previousX: currentX,
      previousY: currentY,
      newX,
      newY,
      timestamp: Date.now(),
    });

    // Save to global repo locally (NOT to Firestore yet)
    try {
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "ArrowAdjustmentOrchestrator"`
Expected: No errors from this file.

**Step 3: Commit**

```bash
git add src/lib/features/create/shared/services/implementations/ArrowAdjustmentOrchestrator.ts
git commit -m "feat: push to undo stack on every WASD arrow movement"
```

---

## Task 3: Handle Ctrl+Z in ArrowAdjustmentPanel

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/ArrowAdjustmentPanel.svelte`

**Step 1: Import the undo stack**

Add at the top of the `<script>` block:
```typescript
import { arrowAdjustmentUndoStack } from "$lib/shared/pictograph/arrow/positioning/global/state/ArrowAdjustmentUndoStack";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
```

**Step 2: Add Ctrl+Z handler in the keydown function**

In the `handleKeydown` function, add a new condition BEFORE the existing "z" handler (the order matters — Ctrl+Z must be checked before plain Z):

```typescript
    // Ctrl+Z: undo last adjustment (must be before plain Z check)
    if (key === "z" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleUndo();
      return; // Don't fall through to plain Z handler
    }
```

**Step 3: Implement handleUndo**

Add this function after `handleResetToDefault`:

```typescript
  async function handleUndo() {
    const entry = arrowAdjustmentUndoStack.pop();
    if (!entry) return;

    const repo = getGlobalAdjustmentRepository();
    if (!repo) return;

    hapticService?.trigger("selection");

    // Restore previous value locally
    if (entry.previousX === 0 && entry.previousY === 0) {
      // Previous state was "no adjustment" — delete it
      repo.deleteAdjustmentLocal(entry.targetKey);
    } else {
      repo.saveAdjustmentLocal({
        ...entry.targetKey,
        adjustmentX: entry.previousX,
        adjustmentY: entry.previousY,
      });
    }

    // Clear pictograph cache and trigger re-render
    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();

    // Persist to Firestore (fire-and-forget)
    try {
      if (entry.previousX === 0 && entry.previousY === 0) {
        await repo.deleteAdjustment(entry.targetKey);
      } else {
        await repo.saveAdjustment({
          ...entry.targetKey,
          adjustmentX: entry.previousX,
          adjustmentY: entry.previousY,
        });
      }
    } catch (error) {
      logger.warn("Failed to persist undo to Firestore:", error);
    }

    // Clear any pending auto-save since we just manually reverted
    clearTimers();
    saveState = 'idle';
  }
```

**Step 4: Add undo count indicator to the UI**

In the template, after the save state indicator and before the reset button, add an undo indicator:

```svelte
  <!-- Undo indicator (Ctrl+Z) -->
  {#if arrowAdjustmentUndoStack.size > 0}
    <button
      class="undo-btn"
      onclick={handleUndo}
      title="Undo last adjustment (Ctrl+Z) — {arrowAdjustmentUndoStack.size} in stack"
      aria-label="Undo last arrow adjustment"
    >
      <i class="fas fa-undo-alt" aria-hidden="true"></i>
      <span class="undo-count">{arrowAdjustmentUndoStack.size}</span>
    </button>
  {/if}
```

**Step 5: Add CSS for the undo button**

Add to the `<style>` block:
```css
  .undo-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 20px;
    border-radius: 10px;
    border: 1px solid rgba(96, 165, 250, 0.3);
    background: rgba(96, 165, 250, 0.1);
    color: #60a5fa;
    cursor: pointer;
    font-size: 0.6rem;
    padding: 0 6px;
    transition: all var(--duration-fast) ease;
  }

  .undo-btn:hover {
    background: rgba(96, 165, 250, 0.2);
    color: #93bbfd;
  }

  .undo-count {
    font-family: "SF Mono", Monaco, monospace;
    font-size: 0.6rem;
    font-weight: 600;
  }
```

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "ArrowAdjustmentPanel"`
Expected: No errors from this file.

**Step 7: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/ArrowAdjustmentPanel.svelte
git commit -m "feat: Ctrl+Z undo for arrow adjustments with visual indicator"
```

---

## Task 4: Add history writes to persister

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/global/services/implementations/GlobalArrowAdjustmentPersister.ts`
- Modify: `src/lib/shared/pictograph/arrow/positioning/global/services/contracts/IGlobalArrowAdjustmentPersister.ts`

**Step 1: Add history action type and collection constant**

In the persister implementation, add after the existing `COLLECTION_NAME`:
```typescript
const HISTORY_COLLECTION_NAME = "global_arrow_adjustment_history";

export type AdjustmentHistoryAction = "save" | "delete" | "reset" | "undo";
```

**Step 2: Add private helper to write history**

Add a private method to `GlobalArrowAdjustmentPersister`:
```typescript
  /**
   * Append a history record. Fire-and-forget — never blocks the main operation.
   */
  private async appendHistory(
    input: {
      gridMode: string;
      oriKey: string;
      letter: string;
      turnsTuple: string;
      arrowKey: string;
      propType?: string;
      otherPropType?: string;
    },
    action: AdjustmentHistoryAction,
    adjustmentX: number,
    adjustmentY: number,
    previousX: number,
    previousY: number,
    userEmail: string,
    sourceKey: string
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      // Use auto-generated ID for history entries (append-only)
      const colRef = collection(firestore, HISTORY_COLLECTION_NAME);
      const historyDoc = doc(colRef);

      await setDoc(historyDoc, {
        gridMode: input.gridMode,
        oriKey: input.oriKey,
        letter: input.letter,
        turnsTuple: input.turnsTuple,
        arrowKey: input.arrowKey,
        ...(input.propType && { propType: input.propType }),
        ...(input.otherPropType && { otherPropType: input.otherPropType }),
        action,
        adjustmentX,
        adjustmentY,
        previousX,
        previousY,
        timestamp: serverTimestamp(),
        updatedBy: userEmail,
        sourceKey,
      });
    } catch (error) {
      // Fire-and-forget: log but don't throw
      logger.warn("Failed to write adjustment history:", error);
    }
  }
```

**Step 3: Update the `save` method signature and add history write**

Update the interface in `IGlobalArrowAdjustmentPersister.ts`:
```typescript
  save(
    input: GlobalArrowAdjustmentInput,
    userEmail: string,
    previousX?: number,
    previousY?: number,
    action?: "save" | "delete" | "reset" | "undo"
  ): Promise<void>;
```

Update the implementation's `save` method signature:
```typescript
  async save(
    input: GlobalArrowAdjustmentInput,
    userEmail: string,
    previousX: number = 0,
    previousY: number = 0,
    action: AdjustmentHistoryAction = "save"
  ): Promise<void> {
```

After the existing `await setDoc(...)` call (line ~115), add:
```typescript
      // Fire-and-forget history write
      const keyString = generateAdjustmentKeyString({
        gridMode: input.gridMode,
        oriKey: input.oriKey,
        letter: input.letter,
        turnsTuple: input.turnsTuple,
        arrowKey: input.arrowKey,
      });
      this.appendHistory(
        input, action,
        input.adjustmentX, input.adjustmentY,
        previousX, previousY,
        userEmail, keyString
      );
```

**Step 4: Update the `delete` method to accept history params**

Update interface:
```typescript
  delete(
    keyString: string,
    previousX?: number,
    previousY?: number,
    userEmail?: string,
    historyInput?: {
      gridMode: string; oriKey: string; letter: string;
      turnsTuple: string; arrowKey: string;
      propType?: string; otherPropType?: string;
    }
  ): Promise<void>;
```

Update implementation to write history on delete:
```typescript
  async delete(
    keyString: string,
    previousX: number = 0,
    previousY: number = 0,
    userEmail: string = "unknown",
    historyInput?: {
      gridMode: string; oriKey: string; letter: string;
      turnsTuple: string; arrowKey: string;
      propType?: string; otherPropType?: string;
    }
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, COLLECTION_NAME, keyString);
      await deleteDoc(docRef);
      logger.success(`Deleted adjustment: ${keyString}`);

      // Fire-and-forget history write
      if (historyInput) {
        this.appendHistory(
          historyInput, "delete",
          0, 0,
          previousX, previousY,
          userEmail, keyString
        );
      }
    } catch (error) {
      logger.error(`Failed to delete adjustment ${keyString}:`, error);
      throw error;
    }
  }
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "Persister\|Repository"`
Expected: May need to update callers in `GlobalArrowAdjustmentRepository.ts` to pass the new optional params. The existing calls without the new params should still work since all new params have defaults.

**Step 6: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/global/services/implementations/GlobalArrowAdjustmentPersister.ts
git add src/lib/shared/pictograph/arrow/positioning/global/services/contracts/IGlobalArrowAdjustmentPersister.ts
git commit -m "feat: write to history collection on every arrow adjustment save/delete"
```

---

## Task 5: Create ArrowAdjustmentHistory UI panel

**Files:**
- Create: `src/lib/features/create/shared/components/sequence-actions/ArrowAdjustmentHistory.svelte`

**Step 1: Create the history panel component**

This is a collapsible panel that lazily queries `global_arrow_adjustment_history` when expanded.

```svelte
<!--
  ArrowAdjustmentHistory.svelte

  Collapsible history panel showing recent arrow adjustment changes.
  Admin-only. Lazy-loads from Firestore when expanded.
-->
<script lang="ts">
  import { selectedArrowState } from "../../state/selected-arrow-state.svelte";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
  } from "firebase/firestore";
  import { getGlobalAdjustmentRepository } from "$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton";
  import { globalAdjustmentVersion } from "$lib/shared/pictograph/arrow/positioning/global/state/global-adjustment-version.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";

  const logger = createComponentLogger("ArrowAdjustmentHistory");

  interface HistoryEntry {
    id: string;
    action: string;
    adjustmentX: number;
    adjustmentY: number;
    previousX: number;
    previousY: number;
    timestamp: Date | null;
    updatedBy: string;
    sourceKey: string;
  }

  let expanded = $state(false);
  let entries = $state<HistoryEntry[]>([]);
  let loading = $state(false);

  const selectedArrow = $derived(selectedArrowState.selectedArrow);

  // Reload when arrow changes and panel is expanded
  $effect(() => {
    const _ = selectedArrow;
    if (expanded) {
      loadHistory();
    }
  });

  async function loadHistory() {
    if (!selectedArrow) {
      entries = [];
      return;
    }

    loading = true;
    try {
      const firestore = await getFirestoreInstance();
      const q = query(
        collection(firestore, "global_arrow_adjustment_history"),
        where("arrowKey", "==", selectedArrow.color),
        orderBy("timestamp", "desc"),
        limit(10)
      );

      const snap = await getDocs(q);
      entries = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          action: d.action ?? "save",
          adjustmentX: d.adjustmentX ?? 0,
          adjustmentY: d.adjustmentY ?? 0,
          previousX: d.previousX ?? 0,
          previousY: d.previousY ?? 0,
          timestamp: d.timestamp?.toDate?.() ?? null,
          updatedBy: d.updatedBy ?? "unknown",
          sourceKey: d.sourceKey ?? "",
        };
      });
    } catch (error) {
      logger.error("Failed to load history:", error);
      entries = [];
    } finally {
      loading = false;
    }
  }

  function toggle() {
    expanded = !expanded;
    if (expanded) {
      loadHistory();
    }
  }

  function formatTime(date: Date | null): string {
    if (!date) return "?";
    const now = Date.now();
    const diff = now - date.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return date.toLocaleDateString();
  }

  async function revertTo(entry: HistoryEntry) {
    const repo = getGlobalAdjustmentRepository();
    if (!repo || !entry.sourceKey) return;

    try {
      // Parse the sourceKey back to a target key
      const parts = entry.sourceKey.split("|");
      if (parts.length < 5) return;

      const targetKey = {
        gridMode: parts[0],
        oriKey: parts[1],
        letter: parts[2],
        turnsTuple: parts[3],
        arrowKey: parts[4],
        ...(parts[5] ? { propType: parts[5] } : {}),
        ...(parts[6] ? { otherPropType: parts[6] } : {}),
      };

      // Restore the values from this history entry
      repo.saveAdjustmentLocal({
        ...targetKey,
        adjustmentX: entry.adjustmentX,
        adjustmentY: entry.adjustmentY,
      });

      pictographPreparer.clearCache();
      globalAdjustmentVersion.increment();

      // Persist
      await repo.saveAdjustment({
        ...targetKey,
        adjustmentX: entry.adjustmentX,
        adjustmentY: entry.adjustmentY,
      });

      // Reload history
      await loadHistory();
    } catch (error) {
      logger.error("Failed to revert:", error);
    }
  }
</script>

<div class="history-panel">
  <button class="toggle-btn" onclick={toggle} aria-expanded={expanded}>
    <i class="fas fa-history" aria-hidden="true"></i>
    {#if expanded}Hide{:else}History{/if}
  </button>

  {#if expanded}
    <div class="history-list">
      {#if loading}
        <span class="loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></span>
      {:else if entries.length === 0}
        <span class="empty">No history</span>
      {:else}
        {#each entries as entry (entry.id)}
          <div class="history-row">
            <span class="action-badge" class:save={entry.action === "save"} class:delete={entry.action === "delete"} class:undo={entry.action === "undo"}>
              {entry.action}
            </span>
            <span class="coords">({entry.adjustmentX}, {entry.adjustmentY})</span>
            <span class="time">{formatTime(entry.timestamp)}</span>
            <button class="revert-btn" onclick={() => revertTo(entry)} title="Revert to this value">
              <i class="fas fa-undo" aria-hidden="true"></i>
            </button>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .history-panel {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.65rem;
    transition: all var(--duration-fast) ease;
  }

  .toggle-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 200px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255,255,255,0.2)) transparent;
  }

  .history-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
    font-size: 0.65rem;
  }

  .action-badge {
    font-size: 0.55rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 1px 4px;
    border-radius: 2px;
    min-width: 32px;
    text-align: center;
  }

  .action-badge.save { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
  .action-badge.delete { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
  .action-badge.undo { background: rgba(96, 165, 250, 0.2); color: #60a5fa; }

  .coords {
    font-family: "SF Mono", Monaco, monospace;
    font-size: 0.65rem;
    color: white;
    min-width: 80px;
  }

  .time {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 0.6rem;
    flex: 1;
  }

  .revert-btn {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid rgba(251, 191, 36, 0.3);
    background: transparent;
    color: #fbbf24;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.5rem;
    padding: 0;
    transition: all var(--duration-fast) ease;
  }

  .revert-btn:hover {
    background: rgba(251, 191, 36, 0.2);
    color: #fcd34d;
  }

  .loading, .empty {
    font-size: 0.65rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    padding: 4px 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-btn, .revert-btn { transition: none; }
  }
</style>
```

**Step 2: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/ArrowAdjustmentHistory.svelte
git commit -m "feat: add ArrowAdjustmentHistory panel component"
```

---

## Task 6: Wire history panel into StepEditorPanel

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/StepEditorPanel.svelte`

**Step 1: Import and render the history panel**

Add import at top of `<script>`:
```typescript
import ArrowAdjustmentHistory from "./ArrowAdjustmentHistory.svelte";
```

In the template, find the ArrowAdjustmentPanel block (around line 277-283):
```svelte
      {#if isAdmin() && hasArrowSelected && displayedStepData}
        <ArrowAdjustmentPanel
          stepData={displayedStepData}
          onStepDataUpdate={handleStepDataUpdate}
          {onPushUndoSnapshot}
        />
      {/if}
```

Add the history panel right after:
```svelte
      {#if isAdmin() && hasArrowSelected && displayedStepData}
        <ArrowAdjustmentPanel
          stepData={displayedStepData}
          onStepDataUpdate={handleStepDataUpdate}
          {onPushUndoSnapshot}
        />
        <ArrowAdjustmentHistory />
      {/if}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "StepEditorPanel"`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/StepEditorPanel.svelte
git commit -m "feat: wire ArrowAdjustmentHistory into step editor header"
```

---

## Task 7: Verify everything works end-to-end

**Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new errors (the pre-existing `preset.svelte.ts:80` error is unrelated).

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Manual test checklist**

Ask user to verify in the running app:
1. Open step editor, select an arrow
2. Press WASD to move it — undo button should appear with count
3. Press Ctrl+Z — arrow should revert to previous position, count decrements
4. Click "History" toggle — should show recent changes (once Firestore history has entries)
5. Click "Revert" on a history entry — arrow should restore to that value
6. Switch props (P key) — arrow positions should now be prop-specific (from the earlier bug fix)

**Step 4: Final commit with all verification**

```bash
git add -A
git commit -m "feat: arrow adjustment history & undo system — session undo (Ctrl+Z), Firestore history, history UI panel"
```
