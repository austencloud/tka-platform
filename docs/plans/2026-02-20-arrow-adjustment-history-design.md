# Arrow Adjustment History & Undo System

**Date:** 2026-02-20
**Status:** Approved

## Problem

Arrow adjustments (WASD positioning) save directly to Firestore with no history, no undo, and no way to identify or revert recent changes. When you make a mistake, the only option is manually finding the document in the Firebase Console.

## Design

Three layers, each building on the last.

### Layer 1: Session Undo Stack

In-memory stack that tracks every WASD adjustment during the current session.

**Class:** `ArrowAdjustmentUndoStack` (singleton, session-scoped)

**Stack entry:**
```typescript
interface UndoEntry {
  targetKey: AdjustmentTargetKey;
  previousX: number;
  previousY: number;
  newX: number;
  newY: number;
  timestamp: number;
}
```

**Behavior:**
- Every `applyWASDMovement` pushes the *previous value* before applying the new one
- Ctrl+Z pops the stack, restores previous value locally, and persists revert to Firestore
- If previous value was (0, 0), the revert deletes the Firestore document (clean state)
- Plain Z still resets to factory default (different from undo — Z discards all adjustments, Ctrl+Z steps back one)
- Stack depth: 50 entries max (FIFO drop of oldest)
- Stack clears on page refresh — session-scoped only
- Ctrl+Shift+Z for redo (optional, lower priority)

**Integration point:** `ArrowAdjustmentPanel.svelte` handles Ctrl+Z keydown, calls `undoStack.pop()`, then calls `repo.saveAdjustmentLocal()` + `repo.saveAdjustment()` with the restored values.

### Layer 2: Persistent Firestore History

Every write to `global_arrow_adjustments` also appends a record to `global_arrow_adjustment_history`.

**Collection:** `global_arrow_adjustment_history`

**Document schema:**
```typescript
{
  // Same fields as the adjustment
  gridMode: string;
  oriKey: string;
  letter: string;
  turnsTuple: string;
  arrowKey: string;
  propType?: string;
  otherPropType?: string;

  // The change
  action: "save" | "delete" | "reset" | "undo";
  adjustmentX: number;      // New value
  adjustmentY: number;      // New value
  previousX: number;        // Value before this change
  previousY: number;        // Value before this change

  // Metadata
  timestamp: Timestamp;     // Server timestamp
  updatedBy: string;        // Admin email
  sourceKey: string;        // Document ID in global_arrow_adjustments (for joining)
}
```

**Write location:** `GlobalArrowAdjustmentPersister.saveAdjustment()` and `deleteAdjustment()` — add a second write to the history collection alongside the main write. Fire-and-forget (don't block on history write).

### Layer 3: History UI in Step Editor

Small expandable panel in the step editor header, visible only to admins when an arrow is selected.

**Location:** Below the `ArrowAdjustmentPanel` in the step editor header area.

**UI:**
- Collapsed by default — small "History" toggle button
- When expanded, shows last 10 history entries for the currently selected arrow's base key
- Each row: relative timestamp ("2m ago", "yesterday"), adjustment values, action badge
- "Revert" button on each row: restores that value (writes to main collection + appends to history with action "undo")
- Filters to the current arrow's key (same gridMode, oriKey, letter, turnsTuple, arrowKey)

**Data source:** Query `global_arrow_adjustment_history` ordered by `timestamp` desc, filtered by `sourceKey`, limit 10. Only fetched when panel is expanded (lazy).

### CLI Access

Service account key at `serviceAccountKey.json` (gitignored). Scripts use `firebase-admin` to query both collections directly.

Potential future script: `node scripts/arrow-adjustment-history.js --recent 20` to list recent changes from the terminal.

## Files to Create/Modify

### New files:
- `src/lib/shared/pictograph/arrow/positioning/global/state/ArrowAdjustmentUndoStack.ts` — Session undo stack
- `src/lib/features/create/shared/components/sequence-actions/ArrowAdjustmentHistory.svelte` — History UI panel

### Modified files:
- `GlobalArrowAdjustmentPersister.ts` — Add history writes alongside main writes
- `ArrowAdjustmentOrchestrator.ts` — Push to undo stack before applying movements
- `ArrowAdjustmentPanel.svelte` — Handle Ctrl+Z, render history panel toggle
- `IGlobalArrowAdjustmentPersister.ts` — Update interface if needed

## Non-goals

- Redo (Ctrl+Shift+Z) — nice to have, not in initial scope
- History pruning/cleanup — append-only for now, revisit if collection grows large
- Multi-user conflict resolution — single admin (Austen) for now
- Offline undo — requires network to persist reverts
