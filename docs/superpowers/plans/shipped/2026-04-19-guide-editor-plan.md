# TKA Guide In-Browser Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of an in-browser WYSIWYG editor for the 47-page Level 1 guide. Phase 1 delivers the data layer, route shell, autosave, undo, and a hand-migrated Page 5 demonstrating the pattern. Drag/resize, asset picker, bake pipeline, and bulk migration follow in later phases.

**Architecture:** Hybrid template + JSON sidecar. Each guide page = a Svelte template (defines layout, typography, decorative elements) + a `page-NN.json` sidecar (text content as TipTap JSON, placed assets array, per-instance overrides). Editor mutates only sidecars + baked image files. Templates remain code edits via VS Code. New `/edit` route, admin-gated, three-region layout (page nav | canvas | library+inspector). Debounced autosave to disk via Node fs endpoint, in-memory undo snapshot stack capped at 50.

**Tech Stack:** SvelteKit 5 (runes mode), TipTap (ProseMirror), interact.js (Phase 2+), existing PictographRenderer / StepEditor / SequenceActionsPanel components, Vitest for unit tests, existing `generate_pictograph` and `generate_sequence` MCP tooling for the bake pipeline (Phase 4).

**Spec:** `docs/superpowers/specs/2026-04-19-guide-editor-design.md` (commit 2399a74b19)

---

## Phase 1 — Foundation

Phase 1 ships an editor with: text editing on Page 5 (TipTap), JSON sidecar persistence, undo/redo, save indicator, /edit route shell with 3-region layout. Drag/resize and the library/inspector are stubbed (placeholder panels) and built out in Phase 2+. **Phase 1 is "you can edit Page 5's text and it saves to disk."**

### File structure for Phase 1

**Create:**
- `src/routes/(public)/guide/level-1/_data/page-05.json` — Page 5 sidecar (extracted from current Page05TableOfContents.svelte)
- `src/routes/(public)/guide/level-1/_lib/sidecar-schema.ts` — TypeScript types + runtime validator
- `src/routes/(public)/guide/level-1/_lib/sidecar-schema.test.ts` — schema validation tests
- `src/routes/(public)/guide/level-1/_lib/UndoStack.svelte.ts` — in-memory snapshot stack
- `src/routes/(public)/guide/level-1/_lib/UndoStack.test.ts` — undo stack tests
- `src/routes/(public)/guide/level-1/_lib/AutosaveCoordinator.svelte.ts` — debounced save + status state
- `src/routes/(public)/guide/level-1/_lib/AutosaveCoordinator.test.ts` — coordinator tests
- `src/routes/(public)/guide/level-1/_lib/EditorContext.svelte.ts` — Svelte 5 reactive context for editor state (sidecar, undo, save status, selected asset, mode)
- `src/routes/(public)/guide/level-1/_lib/EditableText.svelte` — TipTap-bound editable text primitive
- `src/routes/(public)/guide/level-1/_lib/PlacedAssetsLayer.svelte` — positioned overlay (Phase 1 = render-only, no drag)
- `src/routes/(public)/guide/level-1/edit/+page.server.ts` — admin gate
- `src/routes/(public)/guide/level-1/edit/+page.svelte` — editor route entry, owns EditorContext
- `src/routes/(public)/guide/level-1/edit/EditorShell.svelte` — three-region layout component
- `src/routes/(public)/guide/level-1/edit/PageNav.svelte` — left region: page list
- `src/routes/(public)/guide/level-1/edit/EditorTopBar.svelte` — top bar: page title, undo/redo, save indicator
- `src/routes/(public)/guide/level-1/edit/SaveIndicator.svelte` — save status badge
- `src/routes/(public)/guide/level-1/edit/RightSidebarStub.svelte` — Phase 1 placeholder (future Library + Inspector)
- `src/routes/api/guide/level-1/page/[n]/+server.ts` — autosave PUT endpoint

**Modify:**
- `src/routes/(public)/guide/level-1/_pages/Page05TableOfContents.svelte` — refactor to consume sidecar JSON via EditableText
- `src/routes/(public)/guide/level-1/_lib/page-manifest.ts` — no functional change; add type marker if needed for editor-mode rendering
- `package.json` / `pnpm-lock.yaml` — add @tiptap deps

---

### Task 1: Add TipTap dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install TipTap packages**

```bash
pnpm add @tiptap/core@^2.11.0 @tiptap/starter-kit@^2.11.0 @tiptap/extension-color@^2.11.0 @tiptap/extension-text-style@^2.11.0 @tiptap/extension-link@^2.11.0
```

- [ ] **Step 2: Verify install**

Run: `pnpm list @tiptap/core`
Expected: shows `@tiptap/core 2.11.x` in the list.

- [ ] **Step 3: Verify build still passes**

Run: `pnpm run check`
Expected: `0 errors, 0 warnings` (or pre-existing warnings unchanged).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add TipTap for guide editor inline text editing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Define sidecar schema (types + validator)

**Files:**
- Create: `src/routes/(public)/guide/level-1/_lib/sidecar-schema.ts`
- Create: `src/routes/(public)/guide/level-1/_lib/sidecar-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// sidecar-schema.test.ts
import { describe, it, expect } from 'vitest';
import { validateSidecar, isPlacedAsset, type PageSidecar } from './sidecar-schema';

describe('validateSidecar', () => {
  it('accepts a minimal valid sidecar', () => {
    const sidecar: PageSidecar = {
      pageNumber: 5,
      text: { header: { type: 'doc', content: [] } },
      placedAssets: []
    };
    expect(() => validateSidecar(sidecar)).not.toThrow();
  });

  it('rejects sidecar missing pageNumber', () => {
    const bad: any = { text: {}, placedAssets: [] };
    expect(() => validateSidecar(bad)).toThrow(/pageNumber/);
  });

  it('rejects sidecar with non-integer pageNumber', () => {
    const bad: any = { pageNumber: 5.5, text: {}, placedAssets: [] };
    expect(() => validateSidecar(bad)).toThrow(/pageNumber/);
  });

  it('rejects placedAsset missing required fields', () => {
    const bad: any = {
      pageNumber: 5,
      text: {},
      placedAssets: [{ id: 'a', type: 'pictograph' }] // missing position, size, sourceData
    };
    expect(() => validateSidecar(bad)).toThrow(/placedAssets/);
  });
});

describe('isPlacedAsset', () => {
  it('accepts a complete placed asset', () => {
    const asset = {
      id: 'abc',
      type: 'pictograph' as const,
      sourceData: {},
      position: { x: 100, y: 200, unit: 'px' as const },
      size: { width: 150, height: 150, unit: 'px' as const },
      overrides: {},
      bake: { path: '', stale: true, lastBakedAt: 0 }
    };
    expect(isPlacedAsset(asset)).toBe(true);
  });

  it('rejects asset with invalid type', () => {
    expect(isPlacedAsset({ type: 'banana' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/\(public\)/guide/level-1/_lib/sidecar-schema.test.ts -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the schema + validator**

```typescript
// sidecar-schema.ts
// Sidecar JSON shape for a guide page. Mutated by the editor; written to
// disk by the autosave endpoint. Templates import this JSON by static path.

// TipTap ProseMirror document JSON. Loosely typed because TipTap schema can
// vary per editor instance; full structural validation lives in TipTap itself.
export type TipTapJSONDoc = {
  type: 'doc';
  content?: TipTapNode[];
};

export type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

export type Position = { x: number; y: number; unit: 'px' | 'pct' };
export type Size = { width: number; height: number; unit: 'px' | 'pct' };

export type AssetOverrides = {
  visibility?: Record<string, boolean>;
  columnsOverride?: number;
  propOverride?: string;
  cardOptions?: Record<string, unknown>;
};

export type AssetBakeState = {
  path: string;        // empty string = never baked yet
  stale: boolean;
  lastBakedAt: number; // unix ms
};

export type PlacedAsset = {
  id: string;
  type: 'pictograph' | 'sequence';
  libraryId?: string;
  sourceData: unknown;
  position: Position;
  size: Size;
  rotation?: number;
  zIndex?: number;
  overrides: AssetOverrides;
  bake: AssetBakeState;
};

export type PageSidecar = {
  pageNumber: number;
  text: Record<string, TipTapJSONDoc>;
  placedAssets: PlacedAsset[];
};

const VALID_ASSET_TYPES = new Set(['pictograph', 'sequence']);
const VALID_UNITS = new Set(['px', 'pct']);

function isPosition(v: unknown): v is Position {
  if (!v || typeof v !== 'object') return false;
  const p = v as Position;
  return typeof p.x === 'number' && typeof p.y === 'number' && VALID_UNITS.has(p.unit);
}

function isSize(v: unknown): v is Size {
  if (!v || typeof v !== 'object') return false;
  const s = v as Size;
  return typeof s.width === 'number' && typeof s.height === 'number' && VALID_UNITS.has(s.unit);
}

export function isPlacedAsset(v: unknown): v is PlacedAsset {
  if (!v || typeof v !== 'object') return false;
  const a = v as PlacedAsset;
  if (typeof a.id !== 'string' || a.id.length === 0) return false;
  if (!VALID_ASSET_TYPES.has(a.type)) return false;
  if (!isPosition(a.position)) return false;
  if (!isSize(a.size)) return false;
  if (!a.overrides || typeof a.overrides !== 'object') return false;
  if (!a.bake || typeof a.bake !== 'object') return false;
  return true;
}

export function validateSidecar(v: unknown): asserts v is PageSidecar {
  if (!v || typeof v !== 'object') {
    throw new Error('Sidecar must be an object');
  }
  const s = v as PageSidecar;
  if (!Number.isInteger(s.pageNumber) || s.pageNumber < 1 || s.pageNumber > 999) {
    throw new Error(`Sidecar pageNumber must be a positive integer; got ${JSON.stringify(s.pageNumber)}`);
  }
  if (!s.text || typeof s.text !== 'object') {
    throw new Error('Sidecar text must be an object map');
  }
  if (!Array.isArray(s.placedAssets)) {
    throw new Error('Sidecar placedAssets must be an array');
  }
  for (let i = 0; i < s.placedAssets.length; i++) {
    if (!isPlacedAsset(s.placedAssets[i])) {
      throw new Error(`Sidecar placedAssets[${i}] is not a valid PlacedAsset`);
    }
  }
}

export function emptySidecar(pageNumber: number): PageSidecar {
  return { pageNumber, text: {}, placedAssets: [] };
}

export function emptyTipTapDoc(): TipTapJSONDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/routes/\(public\)/guide/level-1/_lib/sidecar-schema.test.ts -- --run`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(public)/guide/level-1/_lib/sidecar-schema.ts" "src/routes/(public)/guide/level-1/_lib/sidecar-schema.test.ts"
git commit -m "feat(guide-editor): sidecar JSON schema + validator

Defines PageSidecar shape with text (TipTap JSON map) + placedAssets
array. Includes runtime validators that throw with pinpoint errors and
helpers for empty doc/sidecar construction. Tests cover valid + invalid
shapes for the validator and asset predicate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Build the undo snapshot stack

**Files:**
- Create: `src/routes/(public)/guide/level-1/_lib/UndoStack.svelte.ts`
- Create: `src/routes/(public)/guide/level-1/_lib/UndoStack.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// UndoStack.test.ts
import { describe, it, expect } from 'vitest';
import { UndoStack } from './UndoStack.svelte';

describe('UndoStack', () => {
  it('starts empty with no undo/redo available', () => {
    const stack = new UndoStack<{ v: number }>(50);
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });

  it('records snapshots and supports undo', () => {
    const stack = new UndoStack<{ v: number }>(50);
    stack.record({ v: 1 });
    stack.record({ v: 2 });
    expect(stack.canUndo).toBe(true);
    const undone = stack.undo();
    expect(undone).toEqual({ v: 1 });
  });

  it('supports redo after undo', () => {
    const stack = new UndoStack<{ v: number }>(50);
    stack.record({ v: 1 });
    stack.record({ v: 2 });
    stack.undo();
    expect(stack.canRedo).toBe(true);
    const redone = stack.redo();
    expect(redone).toEqual({ v: 2 });
  });

  it('clears redo stack on new record', () => {
    const stack = new UndoStack<{ v: number }>(50);
    stack.record({ v: 1 });
    stack.record({ v: 2 });
    stack.undo();
    stack.record({ v: 3 });
    expect(stack.canRedo).toBe(false);
  });

  it('caps stack at maxSize, dropping oldest entries', () => {
    const stack = new UndoStack<{ v: number }>(3);
    stack.record({ v: 1 });
    stack.record({ v: 2 });
    stack.record({ v: 3 });
    stack.record({ v: 4 });
    // Stack now holds 4, 3, 2 (oldest dropped)
    stack.undo();
    stack.undo();
    expect(stack.undo()).toEqual({ v: 2 });
    expect(stack.canUndo).toBe(false);
  });

  it('returns undefined when undo/redo not possible', () => {
    const stack = new UndoStack<{ v: number }>(50);
    expect(stack.undo()).toBeUndefined();
    expect(stack.redo()).toBeUndefined();
  });

  it('clears all history with clear()', () => {
    const stack = new UndoStack<{ v: number }>(50);
    stack.record({ v: 1 });
    stack.record({ v: 2 });
    stack.clear();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/\(public\)/guide/level-1/_lib/UndoStack.test.ts -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement UndoStack**

```typescript
// UndoStack.svelte.ts
// In-memory snapshot undo stack. Generic over the snapshot type so it can
// hold a PageSidecar (or any other immutable state object). Each snapshot
// is a reference; the caller is responsible for ensuring snapshots are
// immutable (e.g., structuredClone before recording).

export class UndoStack<T> {
  private undoBuf: T[] = $state([]);
  private redoBuf: T[] = $state([]);
  private readonly maxSize: number;
  private current: T | undefined = undefined;

  constructor(maxSize: number) {
    if (!Number.isInteger(maxSize) || maxSize < 1) {
      throw new Error(`UndoStack maxSize must be a positive integer; got ${maxSize}`);
    }
    this.maxSize = maxSize;
  }

  get canUndo(): boolean {
    return this.undoBuf.length > 0;
  }

  get canRedo(): boolean {
    return this.redoBuf.length > 0;
  }

  /**
   * Record a new snapshot. The snapshot becomes the "current" state. The
   * previous current state is pushed onto the undo buffer. Redo buffer is
   * cleared (any forward history is invalidated by a new edit).
   */
  record(snapshot: T): void {
    if (this.current !== undefined) {
      this.undoBuf.push(this.current);
      while (this.undoBuf.length > this.maxSize) {
        this.undoBuf.shift();
      }
    }
    this.current = snapshot;
    this.redoBuf = [];
  }

  /**
   * Pop the most recent snapshot from the undo buffer and return it. The
   * current state is pushed onto the redo buffer. Returns undefined if no
   * undo is available.
   */
  undo(): T | undefined {
    if (this.undoBuf.length === 0) return undefined;
    if (this.current !== undefined) {
      this.redoBuf.push(this.current);
    }
    this.current = this.undoBuf.pop();
    return this.current;
  }

  /**
   * Pop from redo buffer back to current. Inverse of undo().
   */
  redo(): T | undefined {
    if (this.redoBuf.length === 0) return undefined;
    if (this.current !== undefined) {
      this.undoBuf.push(this.current);
    }
    this.current = this.redoBuf.pop();
    return this.current;
  }

  clear(): void {
    this.undoBuf = [];
    this.redoBuf = [];
    this.current = undefined;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/routes/\(public\)/guide/level-1/_lib/UndoStack.test.ts -- --run`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(public)/guide/level-1/_lib/UndoStack.svelte.ts" "src/routes/(public)/guide/level-1/_lib/UndoStack.test.ts"
git commit -m "feat(guide-editor): undo/redo snapshot stack

Generic UndoStack class with bounded size. Records snapshots, exposes
canUndo/canRedo as reactive \$state, supports undo/redo/clear. Tests
cover empty state, basic round-trip, redo invalidation on new record,
capacity eviction, and idempotent failure modes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Build the autosave coordinator

**Files:**
- Create: `src/routes/(public)/guide/level-1/_lib/AutosaveCoordinator.svelte.ts`
- Create: `src/routes/(public)/guide/level-1/_lib/AutosaveCoordinator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// AutosaveCoordinator.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutosaveCoordinator, type SaveStatus } from './AutosaveCoordinator.svelte';

describe('AutosaveCoordinator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle state', () => {
    const c = new AutosaveCoordinator(async () => {}, 800);
    expect(c.status).toBe('idle');
  });

  it('debounces rapid edits, only saving once after debounce window', async () => {
    const save = vi.fn(async () => {});
    const c = new AutosaveCoordinator(save, 800);
    c.notifyEdit();
    c.notifyEdit();
    c.notifyEdit();
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reports saving then saved status', async () => {
    let resolveSave: () => void = () => {};
    const save = vi.fn(() => new Promise<void>(r => { resolveSave = r; }));
    const c = new AutosaveCoordinator(save, 100);
    const statuses: SaveStatus[] = [];
    c.notifyEdit();
    statuses.push(c.status); // idle (debouncing)
    await vi.advanceTimersByTimeAsync(100);
    statuses.push(c.status); // saving
    resolveSave();
    await Promise.resolve(); // flush microtask
    statuses.push(c.status); // saved
    expect(statuses).toEqual(['idle', 'saving', 'saved']);
  });

  it('reports error status when save throws', async () => {
    const save = vi.fn(async () => { throw new Error('disk full'); });
    const c = new AutosaveCoordinator(save, 100);
    c.notifyEdit();
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    await Promise.resolve();
    expect(c.status).toBe('error');
    expect(c.lastError?.message).toBe('disk full');
  });

  it('flushes pending save immediately on flushNow()', async () => {
    const save = vi.fn(async () => {});
    const c = new AutosaveCoordinator(save, 800);
    c.notifyEdit();
    expect(save).not.toHaveBeenCalled();
    await c.flushNow();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/\(public\)/guide/level-1/_lib/AutosaveCoordinator.test.ts -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement AutosaveCoordinator**

```typescript
// AutosaveCoordinator.svelte.ts
// Debounced autosave coordinator. Wraps a user-provided async save
// function. Tracks status as reactive $state for UI binding.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type SaveFn = () => Promise<void>;

export class AutosaveCoordinator {
  status: SaveStatus = $state('idle');
  lastSavedAt: number | null = $state(null);
  lastError: Error | null = $state(null);

  private readonly saveFn: SaveFn;
  private readonly debounceMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(saveFn: SaveFn, debounceMs: number) {
    this.saveFn = saveFn;
    this.debounceMs = debounceMs;
  }

  /**
   * Signal that the underlying state changed. Schedules a debounced save.
   * Multiple calls within debounceMs collapse to a single save.
   */
  notifyEdit(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.runSave();
    }, this.debounceMs);
  }

  /**
   * Force any pending save to run now and return its promise.
   * Useful for "save before navigate away" flows.
   */
  async flushNow(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.runSave();
  }

  private async runSave(): Promise<void> {
    if (this.inFlight) {
      await this.inFlight;
    }
    this.status = 'saving';
    this.lastError = null;
    const promise = this.saveFn()
      .then(() => {
        this.status = 'saved';
        this.lastSavedAt = Date.now();
      })
      .catch((err: unknown) => {
        this.status = 'error';
        this.lastError = err instanceof Error ? err : new Error(String(err));
      })
      .finally(() => {
        this.inFlight = null;
      });
    this.inFlight = promise;
    await promise;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/routes/\(public\)/guide/level-1/_lib/AutosaveCoordinator.test.ts -- --run`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(public)/guide/level-1/_lib/AutosaveCoordinator.svelte.ts" "src/routes/(public)/guide/level-1/_lib/AutosaveCoordinator.test.ts"
git commit -m "feat(guide-editor): debounced autosave coordinator

Wraps a user-provided async save fn with debounce + status tracking
(idle/saving/saved/error). Reactive \$state fields drive the save
indicator UI. flushNow() forces a pending save (for navigate-away).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Autosave server endpoint

**Files:**
- Create: `src/routes/api/guide/level-1/page/[n]/+server.ts`
- Create: `src/routes/api/guide/level-1/page/[n]/+server.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// +server.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from './+server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

vi.mock('node:fs', () => ({
  promises: {
    writeFile: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {})
  }
}));

function makeReq(body: unknown, n: string) {
  return {
    request: new Request('http://localhost/api/guide/level-1/page/' + n, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }),
    params: { n }
  } as any;
}

describe('PUT /api/guide/level-1/page/[n]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes valid sidecar to disk via atomic rename', async () => {
    const sidecar = { pageNumber: 5, text: { header: { type: 'doc' as const, content: [] } }, placedAssets: [] };
    const res = await PUT(makeReq(sidecar, '5'));
    expect(res.status).toBe(200);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.rename).toHaveBeenCalledTimes(1);
    const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
    expect(String(writeCall[0])).toMatch(/page-05\.json\.tmp$/);
  });

  it('rejects mismatched pageNumber in body vs URL', async () => {
    const sidecar = { pageNumber: 7, text: {}, placedAssets: [] };
    const res = await PUT(makeReq(sidecar, '5'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/pageNumber/i);
  });

  it('rejects invalid sidecar shape with 400', async () => {
    const bad = { pageNumber: 5, text: 'not an object', placedAssets: [] };
    const res = await PUT(makeReq(bad, '5'));
    expect(res.status).toBe(400);
  });

  it('rejects non-numeric page param with 400', async () => {
    const res = await PUT(makeReq({ pageNumber: 5, text: {}, placedAssets: [] }, 'abc'));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/api/guide/level-1/page -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement endpoint**

```typescript
// +server.ts
import { json, error } from '@sveltejs/kit';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { validateSidecar } from '../../../../../routes/(public)/guide/level-1/_lib/sidecar-schema';
import type { RequestHandler } from './$types';

const DATA_ROOT = path.join(process.cwd(), 'src', 'routes', '(public)', 'guide', 'level-1', '_data');

export const PUT: RequestHandler = async ({ request, params }) => {
  const n = Number(params.n);
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw error(400, `Invalid page param: ${params.n}`);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Body must be JSON');
  }

  try {
    validateSidecar(body);
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'Invalid sidecar');
  }

  if (body.pageNumber !== n) {
    throw error(400, `Body pageNumber ${body.pageNumber} does not match URL param ${n}`);
  }

  const finalPath = path.join(DATA_ROOT, `page-${String(n).padStart(2, '0')}.json`);
  const tmpPath = `${finalPath}.tmp`;
  await fs.mkdir(DATA_ROOT, { recursive: true });
  await fs.writeFile(tmpPath, JSON.stringify(body, null, 2), 'utf8');
  await fs.rename(tmpPath, finalPath);

  return json({ ok: true, pageNumber: n });
};
```

The relative import path back to `_lib/sidecar-schema` is awkward. Verify it resolves correctly during the next step; if it fails, switch to a `$lib`-style alias or compute the path more carefully.

- [ ] **Step 4: Verify import path resolves**

Run: `pnpm run check`
Expected: 0 new errors. If TypeScript complains about the import path, adjust until clean. If unable to resolve, copy the schema types into a `src/lib/guide/sidecar-schema.ts` shared location and import from both places.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/routes/api/guide/level-1/page -- --run`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/api/guide/level-1/page/[n]/+server.ts" "src/routes/api/guide/level-1/page/[n]/+server.test.ts"
git commit -m "feat(guide-editor): autosave PUT endpoint

PUT /api/guide/level-1/page/[n] validates body against sidecar schema,
verifies pageNumber matches URL, atomically writes to _data/page-NN.json
via tmp+rename. Rejects mismatched pageNumber and invalid shapes with
400. Tests cover happy path, mismatched pageNumber, invalid body,
non-numeric param.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: EditorContext (Svelte 5 reactive context)

**Files:**
- Create: `src/routes/(public)/guide/level-1/_lib/EditorContext.svelte.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// EditorContext.svelte.ts
// Editor-wide reactive state container. Created once per /edit route load
// (in +page.svelte). Pages and primitives consume it via getContext().
//
// Holds: the live sidecar for the currently-loaded page, undo stack,
// autosave coordinator, current selection, and editor mode flag.

import { getContext, setContext } from 'svelte';
import { UndoStack } from './UndoStack.svelte';
import { AutosaveCoordinator } from './AutosaveCoordinator.svelte';
import { validateSidecar, type PageSidecar } from './sidecar-schema';

const KEY = Symbol('GuideEditorContext');

export type EditorMode = 'edit' | 'preview';

export class EditorContext {
  pageNumber: number = $state(0);
  sidecar: PageSidecar = $state({ pageNumber: 0, text: {}, placedAssets: [] });
  mode: EditorMode = $state('edit');
  selectedAssetId: string | null = $state(null);

  readonly undo: UndoStack<PageSidecar>;
  readonly autosave: AutosaveCoordinator;

  constructor(initial: PageSidecar) {
    validateSidecar(initial);
    this.pageNumber = initial.pageNumber;
    this.sidecar = initial;
    this.undo = new UndoStack<PageSidecar>(50);
    this.undo.record(structuredClone(initial));
    this.autosave = new AutosaveCoordinator(() => this.persist(), 800);
  }

  /**
   * Apply a mutation to the sidecar. Records a snapshot for undo and
   * schedules an autosave. The mutator receives a deep clone of the
   * current sidecar and returns the new sidecar.
   */
  mutate(fn: (draft: PageSidecar) => PageSidecar): void {
    const next = fn(structuredClone(this.sidecar));
    validateSidecar(next);
    this.sidecar = next;
    this.undo.record(structuredClone(next));
    this.autosave.notifyEdit();
  }

  performUndo(): void {
    const prev = this.undo.undo();
    if (prev !== undefined) {
      this.sidecar = structuredClone(prev);
      this.autosave.notifyEdit();
    }
  }

  performRedo(): void {
    const next = this.undo.redo();
    if (next !== undefined) {
      this.sidecar = structuredClone(next);
      this.autosave.notifyEdit();
    }
  }

  private async persist(): Promise<void> {
    const res = await fetch(`/api/guide/level-1/page/${this.pageNumber}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(this.sidecar)
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Save failed: ${err}`);
    }
  }
}

export function provideEditorContext(initial: PageSidecar): EditorContext {
  const ctx = new EditorContext(initial);
  setContext(KEY, ctx);
  return ctx;
}

export function useEditorContext(): EditorContext {
  const ctx = getContext<EditorContext | undefined>(KEY);
  if (!ctx) throw new Error('useEditorContext called outside of /edit route');
  return ctx;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm run check`
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(public)/guide/level-1/_lib/EditorContext.svelte.ts"
git commit -m "feat(guide-editor): EditorContext reactive container

Holds live sidecar, undo stack, autosave coordinator, selection. Exposes
mutate(fn) which clones, applies, validates, snapshots, and schedules
save in one call. provideEditorContext / useEditorContext for hierarchy
access via Svelte context.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: EditableText TipTap primitive

**Files:**
- Create: `src/routes/(public)/guide/level-1/_lib/EditableText.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import TextStyle from '@tiptap/extension-text-style';
  import Color from '@tiptap/extension-color';
  import Link from '@tiptap/extension-link';
  import { useEditorContext } from './EditorContext.svelte';
  import { emptyTipTapDoc, type TipTapJSONDoc } from './sidecar-schema';

  interface Props {
    field: string;          // dot path into sidecar.text, e.g. "header"
    fallbackHtml?: string;  // rendered if sidecar has no entry for `field` yet
    class?: string;
    multiline?: boolean;    // if false, Enter blurs instead of inserting newline
  }

  let { field, fallbackHtml = '', class: klass = '', multiline = true }: Props = $props();

  const ctx = useEditorContext();

  let host: HTMLDivElement | undefined = $state();
  let editor: Editor | undefined;

  // Live read of the current TipTap doc for this field, fallback to empty doc.
  const currentDoc = $derived<TipTapJSONDoc>(ctx.sidecar.text[field] ?? emptyTipTapDoc());

  onMount(() => {
    if (!host) return;
    editor = new Editor({
      element: host,
      extensions: [
        StarterKit.configure({ heading: false, bulletList: false, orderedList: false, blockquote: false }),
        TextStyle,
        Color,
        Link.configure({ openOnClick: false })
      ],
      content: currentDoc,
      editable: ctx.mode === 'edit',
      onUpdate({ editor }) {
        const next = editor.getJSON() as TipTapJSONDoc;
        ctx.mutate(draft => {
          draft.text[field] = next;
          return draft;
        });
      }
    });

    if (!multiline) {
      host.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      });
    }
  });

  // Sync external doc changes (undo/redo, hot reload) back into the editor
  // without firing onUpdate, to avoid loops.
  $effect(() => {
    if (!editor) return;
    const incoming = currentDoc;
    const live = editor.getJSON();
    if (JSON.stringify(incoming) !== JSON.stringify(live)) {
      editor.commands.setContent(incoming, false);
    }
  });

  $effect(() => {
    if (!editor) return;
    editor.setEditable(ctx.mode === 'edit');
  });

  onDestroy(() => {
    editor?.destroy();
  });
</script>

<div class="editable-text {klass}" bind:this={host}>
  {#if !editor}
    {@html fallbackHtml}
  {/if}
</div>

<style>
  .editable-text :global(.ProseMirror) {
    outline: none;
    min-height: 1em;
  }
  .editable-text :global(.ProseMirror:focus) {
    outline: 2px solid #4ea7e8;
    outline-offset: 2px;
    border-radius: 2px;
  }
</style>
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm run check`
Expected: 0 new errors. Resolve any TipTap typing complaints (cast as needed; their types are notoriously loose).

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(public)/guide/level-1/_lib/EditableText.svelte"
git commit -m "feat(guide-editor): EditableText TipTap primitive

Mounts a TipTap editor on the host element bound to a sidecar.text.<field>
path. onUpdate writes back through ctx.mutate (snapshot + autosave).
Reactive \$effect syncs external sidecar changes (undo/redo) back into
the editor. Supports single-line mode (Enter blurs) for headings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: PlacedAssetsLayer (Phase 1 = render-only)

**Files:**
- Create: `src/routes/(public)/guide/level-1/_lib/PlacedAssetsLayer.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import type { PlacedAsset } from './sidecar-schema';

  interface Props {
    assets: PlacedAsset[];
  }
  let { assets }: Props = $props();
</script>

<div class="placed-assets-layer" aria-hidden={assets.length === 0}>
  {#each assets as asset (asset.id)}
    <div
      class="placed-asset"
      class:stale={asset.bake.stale}
      style:left={asset.position.x + (asset.position.unit === 'pct' ? '%' : 'px')}
      style:top={asset.position.y + (asset.position.unit === 'pct' ? '%' : 'px')}
      style:width={asset.size.width + (asset.size.unit === 'pct' ? '%' : 'px')}
      style:height={asset.size.height + (asset.size.unit === 'pct' ? '%' : 'px')}
      style:transform={asset.rotation ? `rotate(${asset.rotation}deg)` : undefined}
      style:z-index={asset.zIndex ?? 1}
    >
      {#if asset.bake.path}
        <img src={asset.bake.path} alt="" draggable="false" />
      {:else}
        <div class="placeholder">
          <span>{asset.type}</span>
          <small>not yet baked</small>
        </div>
      {/if}
      {#if asset.bake.stale}
        <span class="stale-badge" title="Source changed since last bake">↻ stale</span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .placed-assets-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .placed-asset {
    position: absolute;
    pointer-events: auto;
  }
  .placed-asset img {
    width: 100%;
    height: 100%;
    display: block;
    user-select: none;
  }
  .placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-content: center;
    background: repeating-linear-gradient(45deg, #f4f4f4, #f4f4f4 8px, #ececec 8px, #ececec 16px);
    color: #555;
    font-family: system-ui, sans-serif;
    font-size: 0.7rem;
    text-align: center;
    border: 1px dashed #aaa;
  }
  .placeholder span { font-weight: 600; }
  .placeholder small { color: #888; }
  .stale-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(255, 200, 0, 0.95);
    color: #1a1a1a;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-family: system-ui, sans-serif;
    font-size: 0.65rem;
    font-weight: 600;
    pointer-events: none;
  }
</style>
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm run check`
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(public)/guide/level-1/_lib/PlacedAssetsLayer.svelte"
git commit -m "feat(guide-editor): PlacedAssetsLayer render-only primitive

Phase 1 stub: positions and renders placed assets from sidecar JSON. No
drag/resize yet (Phase 2). Shows a striped placeholder for unbaked
assets and a 'stale' badge when sourceData changed since last bake.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Hand-author Page 5 sidecar JSON

**Files:**
- Create: `src/routes/(public)/guide/level-1/_data/page-05.json`

- [ ] **Step 1: Read the current Page 5 to identify text regions**

Run: `cat "src/routes/(public)/guide/level-1/_pages/Page05TableOfContents.svelte"`

Identify each piece of editable text. The current page has:
- Page title: "Table of Contents" (rendered by `<PageFrame title="...">`)
- Two columns of TOC entries with chapter headings, entries, and the footer URL.

Decide on field naming convention: `text.title`, `text.col1Chapter1`, `text.col1Entries1`, `text.col1Chapter2`, `text.col1Entries2`, `text.col2Chapter1`, `text.col2Entries1`, etc., and `text.footerUrl`.

- [ ] **Step 2: Author the sidecar JSON**

Each `text.<field>` is a TipTap doc. For Phase 1, store each entry as a single paragraph with the existing rendered text. Marks (color, bold, italic) are encoded as TipTap mark arrays.

The full file is verbose (each TOC entry becomes a TipTap paragraph). The exact content can be derived mechanically from the current Page05TableOfContents.svelte template by extracting each text node into a TipTap paragraph node. Example shape for one entry:

```json
{
  "pageNumber": 5,
  "text": {
    "title": {
      "type": "doc",
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "Table of Contents" }] }
      ]
    },
    "col1Chapter1": {
      "type": "doc",
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "1.0 - Positions / Motions" }] }
      ]
    },
    "col1Entries1": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "The Grid ............................................. 1" }
          ]
        }
      ]
    },
    "footerUrl": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "TheKineticAlphabet.com",
              "marks": [
                { "type": "link", "attrs": { "href": "https://thekineticalphabet.com" } }
              ]
            }
          ]
        }
      ]
    }
  },
  "placedAssets": []
}
```

For the full file: extract each text run from Page05TableOfContents.svelte and translate to the same shape. Color marks (the type-color spans for Dual-Shifts, Shifts, etc.) become TipTap `textStyle` marks with a `color` attribute, e.g.:

```json
{
  "type": "text",
  "text": "Dual-Shifts",
  "marks": [{ "type": "textStyle", "attrs": { "color": "#2272d6" } }]
}
```

The leader-dot rendering is currently a CSS `border-bottom: dotted` — keep that as a layout concern in the template, not in the sidecar text.

- [ ] **Step 3: Verify the JSON validates**

Add a quick smoke test or use `node -e` to require + validate:

```bash
node -e "
const sidecar = require('./src/routes/(public)/guide/level-1/_data/page-05.json');
const { validateSidecar } = require('./src/routes/(public)/guide/level-1/_lib/sidecar-schema.ts');
"
```

Or wire a small test that imports the JSON and asserts validateSidecar doesn't throw — see Task 10.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(public)/guide/level-1/_data/page-05.json"
git commit -m "feat(guide-editor): hand-author Page 5 sidecar JSON

Extracts every text region from Page05TableOfContents.svelte into TipTap
JSON docs keyed by field paths (title, col1Chapter1..N, col1Entries1..N,
col2Chapter1..N, col2Entries1..N, footerUrl). Type-color spans become
textStyle marks with color attrs. Layout (leader dots, columns, vertical
rule) stays in the template.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Refactor Page05TableOfContents.svelte to consume sidecar

**Files:**
- Modify: `src/routes/(public)/guide/level-1/_pages/Page05TableOfContents.svelte`
- Create: `src/routes/(public)/guide/level-1/_pages/Page05TableOfContents.test.ts`

- [ ] **Step 1: Write a smoke test for the sidecar import**

```typescript
// Page05TableOfContents.test.ts
import { describe, it, expect } from 'vitest';
import sidecar from '../_data/page-05.json';
import { validateSidecar } from '../_lib/sidecar-schema';

describe('Page 5 sidecar', () => {
  it('validates against the schema', () => {
    expect(() => validateSidecar(sidecar)).not.toThrow();
  });

  it('has pageNumber 5', () => {
    expect((sidecar as any).pageNumber).toBe(5);
  });

  it('has expected text fields', () => {
    const text = (sidecar as any).text;
    expect(text.title).toBeDefined();
    expect(text.footerUrl).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test src/routes/\(public\)/guide/level-1/_pages/Page05TableOfContents.test.ts -- --run`
Expected: 3 tests pass.

- [ ] **Step 3: Refactor the page template**

Replace the hard-coded text in Page05TableOfContents.svelte with `<EditableText>` instances. The structural CSS stays unchanged; only text nodes are swapped.

```svelte
<script lang="ts">
  import PageFrame from '../_lib/PageFrame.svelte';
  import EditableText from '../_lib/EditableText.svelte';
  import PlacedAssetsLayer from '../_lib/PlacedAssetsLayer.svelte';
  import sidecar from '../_data/page-05.json';

  // Static structural data — which entries are indented, which are bold,
  // which have leader-dots layout. The TEXT inside each entry is editable
  // via the sidecar; this array just provides field keys + layout hints.
  const col1 = [
    { kind: 'chapter', field: 'col1Chapter1' },
    { kind: 'entries', field: 'col1Entries1' },
    { kind: 'chapter', field: 'col1Chapter2' },
    { kind: 'entries', field: 'col1Entries2' }
  ];
  const col2 = [
    { kind: 'chapter', field: 'col2Chapter1' },
    { kind: 'entries', field: 'col2Entries1' },
    { kind: 'chapter', field: 'col2Chapter2' },
    { kind: 'entries', field: 'col2Entries2' }
  ];
</script>

<PageFrame pageNumber={5}>
  {#snippet title()}
    <EditableText field="title" class="page-title-text" multiline={false} />
  {/snippet}

  <div class="toc">
    <div class="col">
      {#each col1 as block}
        <EditableText field={block.field} class={block.kind === 'chapter' ? 'chapter' : 'entries'} />
      {/each}
    </div>
    <div class="rule" aria-hidden="true"></div>
    <div class="col">
      {#each col2 as block}
        <EditableText field={block.field} class={block.kind === 'chapter' ? 'chapter' : 'entries'} />
      {/each}
      <p class="footer-url">
        <EditableText field="footerUrl" multiline={false} />
      </p>
    </div>
  </div>

  <PlacedAssetsLayer assets={sidecar.placedAssets} />
</PageFrame>

<style>
  /* CSS unchanged from previous version; preserved verbatim. */
  .toc { display: grid; grid-template-columns: 1fr 1px 1fr; column-gap: 0.4in; padding: 0 0.1in; position: relative; }
  .rule { background: #1a1a1a; width: 1px; align-self: stretch; }
  .col { min-width: 0; }
  :global(.chapter) { font-family: Cambria, 'Hoefler Text', Georgia, serif; font-weight: 700; font-size: 1.55rem; text-align: center; margin: 0.4rem 0 0.55rem; }
  :global(.entries) { font-size: 1rem; line-height: 1.45; }
  :global(.page-title-text) { display: inline-block; }
  .footer-url { text-align: center; margin: 1.4rem 0 0; font-family: 'Monotype Corsiva', 'Apple Chancery', cursive; font-style: italic; font-size: 1.5rem; font-weight: 700; }
  .footer-url :global(a) { color: #2c3da6; text-decoration: none; }
</style>
```

The PageFrame `title` snippet may need adjustment — check the existing PageFrame's interface; if it accepts `title` as a string only, extend it to accept a snippet OR render the title inside the body. For Phase 1, the simpler route is to drop `title=` and render the title inside the body wrapped in a positioned div with the page-title styling.

- [ ] **Step 4: Verify the page still renders**

Open `http://localhost:5173/guide/level-1/compare`, scroll to page 5. The page should render visually identically to before — the only difference is that text is now editor-driven.

State explicitly: I cannot verify this visually myself. Open the URL and confirm Page 5 still looks like the previous Svelte rebuild. If the title is missing or layout drifted, address before proceeding.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(public)/guide/level-1/_pages/Page05TableOfContents.svelte" "src/routes/(public)/guide/level-1/_pages/Page05TableOfContents.test.ts"
git commit -m "refactor(guide): Page 5 reads text from sidecar JSON

Replaces all hard-coded text in Page05TableOfContents.svelte with
<EditableText field=...> bound to page-05.json. Layout, CSS, and
structural decisions remain in the template. Read-only render is visually
identical (TipTap renders to the same HTML when not editing).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Admin gate via +page.server.ts

**Files:**
- Create: `src/routes/(public)/guide/level-1/edit/+page.server.ts`

- [ ] **Step 1: Inspect existing admin gate pattern**

Run: `find src/routes -name "+page.server.ts" -exec grep -l "admin\|isAdmin\|adminUid" {} \; | head -5`

Read whichever file the grep finds and copy the pattern. If none exist, fall back to a simple env-var check.

- [ ] **Step 2: Implement the gate**

```typescript
// +page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const ADMIN_UIDS = new Set<string>([
  // Austen's Firebase UID — fill in the actual value before merging.
  // For now this gate is a placeholder; if the deployment doesn't have
  // server-side auth context, the gate can fall back to letting the page
  // render and rely on a client-side check inside +page.svelte.
]);

export const load: PageServerLoad = async ({ locals }) => {
  // If the project's hooks.server.ts populates locals.user with a Firebase
  // user, use it. Otherwise this is a no-op gate (dev mode).
  const user = (locals as { user?: { uid?: string } }).user;
  if (process.env.NODE_ENV === 'production' && user?.uid && !ADMIN_UIDS.has(user.uid)) {
    throw redirect(302, '/guide/level-1/compare');
  }
  return {};
};
```

For Phase 1, this gate is permissive — it only blocks in production with a known UID. Local dev access is unrestricted. Tighten in a later phase once the auth context is mapped.

- [ ] **Step 3: Verify it compiles**

Run: `pnpm run check`
Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(public)/guide/level-1/edit/+page.server.ts"
git commit -m "feat(guide-editor): admin gate (permissive Phase 1 placeholder)

Server load checks locals.user.uid against ADMIN_UIDS only in production;
dev unrestricted. Tighten with real Firebase UID in Phase 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Editor route shell

**Files:**
- Create: `src/routes/(public)/guide/level-1/edit/+page.svelte`
- Create: `src/routes/(public)/guide/level-1/edit/EditorShell.svelte`
- Create: `src/routes/(public)/guide/level-1/edit/PageNav.svelte`
- Create: `src/routes/(public)/guide/level-1/edit/EditorTopBar.svelte`
- Create: `src/routes/(public)/guide/level-1/edit/SaveIndicator.svelte`
- Create: `src/routes/(public)/guide/level-1/edit/RightSidebarStub.svelte`

- [ ] **Step 1: Write SaveIndicator**

```svelte
<!-- SaveIndicator.svelte -->
<script lang="ts">
  import { useEditorContext } from '../_lib/EditorContext.svelte';

  const ctx = useEditorContext();

  const label = $derived.by(() => {
    switch (ctx.autosave.status) {
      case 'idle': return ctx.autosave.lastSavedAt ? `Saved ${secondsAgo(ctx.autosave.lastSavedAt)}s ago` : 'Not yet saved';
      case 'saving': return 'Saving…';
      case 'saved': return `Saved ${secondsAgo(ctx.autosave.lastSavedAt)}s ago`;
      case 'error': return 'Save failed — click to retry';
    }
  });

  function secondsAgo(t: number | null): number {
    if (t === null) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / 1000));
  }

  // Re-render the "Xs ago" label every second.
  let tick = $state(0);
  $effect(() => {
    const id = setInterval(() => { tick++; }, 1000);
    return () => clearInterval(id);
  });

  function onClick() {
    if (ctx.autosave.status === 'error') {
      ctx.autosave.flushNow();
    }
  }
</script>

<button class="save-indicator" data-status={ctx.autosave.status} onclick={onClick} title={ctx.autosave.lastError?.message ?? ''}>
  {label} <span style="display:none">{tick}</span>
</button>

<style>
  .save-indicator {
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 999px;
    padding: 0.25rem 0.7rem;
    font-family: system-ui, sans-serif;
    font-size: 0.78rem;
    cursor: default;
  }
  .save-indicator[data-status='saving']  { color: #b48a00; }
  .save-indicator[data-status='saved']   { color: #1a8e3a; }
  .save-indicator[data-status='error']   { color: #c1272d; cursor: pointer; }
  .save-indicator[data-status='idle']    { color: #777; }
</style>
```

- [ ] **Step 2: Write PageNav**

```svelte
<!-- PageNav.svelte -->
<script lang="ts">
  import { pages } from '../_lib/page-manifest';

  interface Props {
    activePage: number;
    onJump: (n: number) => void;
  }
  let { activePage, onJump }: Props = $props();
</script>

<nav class="page-nav">
  <header><strong>Level 1</strong><span>{pages.length} pages</span></header>
  <ol>
    {#each pages as p}
      <li>
        <button class:active={activePage === p.pageNumber} onclick={() => onJump(p.pageNumber)}>
          <span class="num">{p.pageNumber}</span>
          <span class="label">{p.label}</span>
        </button>
      </li>
    {/each}
  </ol>
</nav>

<style>
  .page-nav { background: #11151c; color: #e6e8ec; height: 100%; overflow-y: auto; padding: 1rem; font-family: system-ui, sans-serif; font-size: 0.85rem; }
  header { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 0.75rem; border-bottom: 1px solid #1f2530; margin-bottom: 0.5rem; }
  header span { color: #6a7280; font-size: 0.72rem; }
  ol { list-style: none; padding: 0; margin: 0; }
  button { display: grid; grid-template-columns: 28px 1fr; gap: 0.5rem; align-items: center; width: 100%; background: transparent; color: inherit; border: none; padding: 0.45rem 0.5rem; text-align: left; cursor: pointer; border-radius: 4px; font: inherit; }
  button:hover { background: #1c222d; }
  button.active { background: #2a3344; }
  .num { color: #6a7280; font-variant-numeric: tabular-nums; }
</style>
```

- [ ] **Step 3: Write EditorTopBar**

```svelte
<!-- EditorTopBar.svelte -->
<script lang="ts">
  import { useEditorContext } from '../_lib/EditorContext.svelte';
  import SaveIndicator from './SaveIndicator.svelte';
  import { pages } from '../_lib/page-manifest';

  const ctx = useEditorContext();
  const label = $derived(pages.find(p => p.pageNumber === ctx.pageNumber)?.label ?? '');
</script>

<header class="topbar">
  <div class="left">
    <strong>Page {ctx.pageNumber}</strong>
    <span class="page-label">{label}</span>
  </div>
  <div class="actions">
    <button onclick={() => ctx.performUndo()} disabled={!ctx.undo.canUndo} title="Undo (Ctrl+Z)">↶</button>
    <button onclick={() => ctx.performRedo()} disabled={!ctx.undo.canRedo} title="Redo (Ctrl+Shift+Z)">↷</button>
    <SaveIndicator />
    <a href="/guide/level-1/compare" class="exit">Exit ›</a>
  </div>
</header>

<style>
  .topbar { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 1rem; background: #11151c; color: #e6e8ec; border-bottom: 1px solid #1f2530; font-family: system-ui, sans-serif; font-size: 0.85rem; }
  .left { display: flex; gap: 0.6rem; align-items: baseline; }
  .page-label { color: #cdd1d9; }
  .actions { display: flex; gap: 0.6rem; align-items: center; }
  .actions button { background: transparent; color: inherit; border: 1px solid #2a3344; border-radius: 4px; padding: 0.25rem 0.55rem; cursor: pointer; font: inherit; }
  .actions button:disabled { opacity: 0.4; cursor: default; }
  .exit { color: #6cb6f0; text-decoration: none; }
</style>
```

- [ ] **Step 4: Write RightSidebarStub**

```svelte
<!-- RightSidebarStub.svelte -->
<aside class="right-sidebar-stub">
  <div class="region">
    <h3>Library</h3>
    <p class="muted">Phase 2 will mount the Sequence Library + Pictograph Picker here. For now, text editing only.</p>
  </div>
  <div class="region">
    <h3>Inspector</h3>
    <p class="muted">Select a placed asset to inspect its settings (Phase 3).</p>
  </div>
</aside>

<style>
  .right-sidebar-stub { background: #11151c; color: #e6e8ec; height: 100%; padding: 1rem; font-family: system-ui, sans-serif; font-size: 0.85rem; display: flex; flex-direction: column; gap: 1rem; }
  .region h3 { margin: 0 0 0.5rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: #cdd1d9; }
  .muted { color: #6a7280; line-height: 1.4; }
</style>
```

- [ ] **Step 5: Write EditorShell**

```svelte
<!-- EditorShell.svelte -->
<script lang="ts">
  interface Props {
    activePage: number;
    onJump: (n: number) => void;
    children?: import('svelte').Snippet;
  }
  let { activePage, onJump, children }: Props = $props();

  /* Lazy imports keep PageNav/RightSidebarStub from blocking the first paint */
  import PageNav from './PageNav.svelte';
  import EditorTopBar from './EditorTopBar.svelte';
  import RightSidebarStub from './RightSidebarStub.svelte';
</script>

<div class="editor-shell">
  <EditorTopBar />
  <div class="body">
    <aside class="left"><PageNav {activePage} {onJump} /></aside>
    <main class="canvas">
      <div class="page-stage">
        {@render children?.()}
      </div>
    </main>
    <aside class="right"><RightSidebarStub /></aside>
  </div>
</div>

<style>
  .editor-shell { display: grid; grid-template-rows: auto 1fr; height: 100vh; background: #0d1117; color: #e6e8ec; }
  .body { display: grid; grid-template-columns: 240px 1fr 320px; min-height: 0; }
  .left { border-right: 1px solid #1f2530; min-height: 0; }
  .right { border-left: 1px solid #1f2530; min-height: 0; }
  .canvas { background: #1c2230; overflow: auto; padding: 2rem 1rem; }
  .page-stage { display: flex; justify-content: center; }
  :global(.canvas .page) { box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
</style>
```

- [ ] **Step 6: Write the route entry**

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { pages } from '../_lib/page-manifest';
  import { provideEditorContext } from '../_lib/EditorContext.svelte';
  import { validateSidecar, type PageSidecar } from '../_lib/sidecar-schema';
  import EditorShell from './EditorShell.svelte';

  let activePage = $state(5);

  // Lazy-load the active page's sidecar JSON. Only Page 5 has a sidecar
  // in Phase 1; other pages render their existing pre-edit Svelte until
  // the migration script runs in Phase 5.
  let sidecar: PageSidecar | null = $state(null);
  let editorCtx: ReturnType<typeof provideEditorContext> | null = $state(null);

  $effect(() => {
    loadSidecar(activePage);
  });

  async function loadSidecar(n: number) {
    if (n !== 5) {
      sidecar = null;
      editorCtx = null;
      return;
    }
    const mod = await import('../_data/page-05.json');
    const data = mod.default as PageSidecar;
    validateSidecar(data);
    sidecar = data;
    editorCtx = provideEditorContext(data);
  }

  function onJump(n: number) {
    activePage = n;
  }

  onMount(() => {
    const splash = document.getElementById('app-loading');
    if (splash) splash.style.display = 'none';
    (window as any).__tkaLoadProgress = () => {};
  });

  // Keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z) live here so they survive
  // child component remounts.
  function onKeydown(e: KeyboardEvent) {
    if (!editorCtx) return;
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const meta = isMac ? e.metaKey : e.ctrlKey;
    if (!meta) return;
    if (e.key === 'z' && !e.shiftKey) {
      // Don't intercept undo while a TipTap editor has focus — let TipTap handle text-level undo first.
      const active = document.activeElement as HTMLElement | null;
      if (active?.classList.contains('ProseMirror')) return;
      e.preventDefault();
      editorCtx.performUndo();
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      const active = document.activeElement as HTMLElement | null;
      if (active?.classList.contains('ProseMirror')) return;
      e.preventDefault();
      editorCtx.performRedo();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />
<svelte:head>
  <title>Guide Editor — Level 1 Page {activePage}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
</svelte:head>

{#if sidecar && editorCtx}
  <EditorShell {activePage} {onJump}>
    {#await import('../_pages/Page05TableOfContents.svelte') then Mod}
      <Mod.default />
    {/await}
  </EditorShell>
{:else}
  <EditorShell {activePage} {onJump}>
    <div class="not-yet-migrated">
      <h2>Page {activePage} — not yet editable</h2>
      <p>Only Page 5 has been migrated to the editor in Phase 1. Other pages render via the existing <code>/guide/level-1</code> route.</p>
      <p><a href="/guide/level-1#page-{activePage}">View this page in read-only mode</a></p>
    </div>
  </EditorShell>
{/if}

<style>
  :global(body) { margin: 0; }
  .not-yet-migrated { color: #cdd1d9; max-width: 40ch; padding: 2rem; font-family: system-ui, sans-serif; line-height: 1.5; }
  .not-yet-migrated h2 { color: #fff; margin: 0 0 1rem; }
  .not-yet-migrated a { color: #6cb6f0; }
</style>
```

- [ ] **Step 7: Verify the route loads**

Run: `pnpm run check`
Expected: 0 new errors.

Open: `http://localhost:5173/guide/level-1/edit`
Expected: Editor shell renders. Left panel shows page list. Top bar shows "Page 5" with undo/redo + save indicator. Center renders Page 5. Right panel shows the stub.

State explicitly: I cannot verify this visually myself. Open the URL and confirm the layout, then click into a TOC entry, type a few characters, and watch the save indicator change from "saving" → "saved." Reload the page; the typed text should persist (proves the autosave round-trip).

- [ ] **Step 8: Commit**

```bash
git add "src/routes/(public)/guide/level-1/edit/+page.svelte" \
        "src/routes/(public)/guide/level-1/edit/EditorShell.svelte" \
        "src/routes/(public)/guide/level-1/edit/PageNav.svelte" \
        "src/routes/(public)/guide/level-1/edit/EditorTopBar.svelte" \
        "src/routes/(public)/guide/level-1/edit/SaveIndicator.svelte" \
        "src/routes/(public)/guide/level-1/edit/RightSidebarStub.svelte"
git commit -m "feat(guide-editor): /edit route shell

Three-region layout (PageNav | canvas | RightSidebarStub) with topbar
hosting undo/redo + SaveIndicator. Page 5 mounts inside the canvas with
EditorContext provided. Ctrl+Z/Ctrl+Shift+Z trigger undo/redo
(suppressed when a TipTap editor has focus so text-level undo wins).
Other pages show 'not yet migrated' placeholder.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Phase 1 acceptance check

**Files:** none (verification only)

- [ ] **Step 1: Run all new tests**

Run: `pnpm test src/routes/\(public\)/guide/level-1/_lib src/routes/api/guide -- --run`
Expected: All tests pass (sidecar-schema: 5, UndoStack: 7, AutosaveCoordinator: 5, autosave endpoint: 4, page 5 sidecar smoke: 3 = 24 tests).

- [ ] **Step 2: Build check**

Run: `pnpm run check`
Expected: 0 new errors.

- [ ] **Step 3: Manual smoke test (verbalize what to verify)**

I cannot verify this visually myself. Verify the following round-trips:

1. Open `http://localhost:5173/guide/level-1/edit`. Editor renders with Page 5 in the center.
2. Click on any TOC entry's text. TipTap focus ring appears.
3. Type a character. Save indicator shows "Saving…" then "Saved Xs ago" within 1s.
4. Hard reload the page. The typed character is still there (read from disk).
5. Press Ctrl+Z. The character disappears.
6. Press Ctrl+Shift+Z. The character returns.
7. Look at `git status` — `_data/page-05.json` is the only changed file (besides the typed text that was reverted).

- [ ] **Step 4: Final Phase 1 commit and tag**

```bash
git tag -a phase-1-complete-guide-editor -m "Guide editor Phase 1: text editing + autosave + undo + page 5 migration"
```

---

## Phase 2 — Drag, Resize, Sequence Library (sketch)

After Phase 1 ships and is reviewed, Phase 2 adds:

- **interact.js dependency** (`pnpm add interactjs`).
- **DraggableAsset wrapper** with `use:interact` action — reposition + resize, snap to 8px grid + page edges, aspect ratio lock with Shift.
- **Library data store**: `static/guide/level-1/library.json` flat array; service to read/write entries; instance count tracking.
- **Save-to-Guide button** in the existing app's Save-to-Library dialog (admin-only conditional render). Writes to library.json via a new `POST /api/guide/level-1/library` endpoint.
- **Library browse panel** in the right sidebar: replaces `RightSidebarStub`. Tile grid with thumbnails, instance badges, drag-onto-canvas. Right-click "Add copy to pool".
- **PlacedAssetsLayer upgrade**: each asset becomes a `<DraggableAsset>` with selection handles. Click-empty-canvas deselects.
- **Asset inspector skeleton**: shows position/size numeric inputs, columnsOverride for sequences. Full StepEditor / SequenceActionsPanel mounting comes in Phase 3.

Estimated tasks: 8-10. Each follows the same Test → Implement → Commit shape.

## Phase 3 — Inspector + Pictograph Picker (sketch)

- **Mount existing StepEditorPanel** in Inspector when a pictograph is selected. Bind onChange to `ctx.mutate` updating `asset.sourceData` + `asset.overrides` + bumping `bake.stale`.
- **Mount existing SequenceActionsPanel** in Inspector when a sequence is selected. Same binding shape.
- **Pictograph Picker mode** in the library region: letter selector grid → variations grid → settings panel → "Place" button.
- **Per-instance overrides UI**: visibility toggles surfaced as a collapsible section in the inspector, bound to `asset.overrides.visibility`.

Estimated tasks: 6-8. Risk: existing StepEditor/SequenceActionsPanel may have implicit dependencies on the main app's state context that need a thin "guide-mode" wrapper.

## Phase 4 — Bake Pipeline (sketch)

- **`POST /api/guide/level-1/bake`** endpoint — accepts `{assetId, sourceData, overrides}`, calls the existing pictograph/sequence rendering server-side, writes SVG to `static/guide/level-1/baked/<assetId>.svg`, returns the path.
- **"Bake" button** per asset in the inspector + **"Bake all stale"** button in the topbar.
- **Stale tracking**: every override change bumps `bake.stale = true`. UI badge already in PlacedAssetsLayer.

Estimated tasks: 4-5.

## Phase 5 — Migration Script (sketch)

- **`scripts/migrate-guide-page.cjs <pageNumber>`** — Node script that reads a `Page<NN>*.svelte`, extracts text nodes (regex on quoted strings + AST parse with `svelte/compiler`), produces a sidecar JSON.
- **Idempotent**: rerunning on a migrated page is a no-op.
- **Visual review loop**: run script, open compare view, verify parity, hand-tune any glitches.
- **Once 47 pages migrated**, the read-only `/guide/level-1` and `/compare` routes should render identically to before.

Estimated tasks: 3-4 for the script, then mechanical execution per page.

## Phase 6 — Polish (sketch)

- **Right-click context menus** on placed assets, library tiles, text regions, empty canvas.
- **Alignment guides** (snap-to-edge of other placed assets, with visual guide lines).
- **PDF reference slide-over** in the left region (collapsible 600px overlay showing original PDF page).
- **Keyboard shortcuts**: arrow keys nudge selected asset 1px, Shift+arrows nudge 10px.
- **Save indicator UX polish**: tooltip showing last save time, error retry click handler.

Estimated tasks: 6-8.

---

## Spec Coverage Map

| Spec section | Plan task(s) |
|---|---|
| 2.1 Three-route surface | Task 12 (creates `/edit`) |
| 2.2 Page model — template + JSON sidecar | Tasks 9, 10 |
| 2.3 JSON sidecar shape | Task 2 |
| 2.4 Persistence | Tasks 3, 4, 5, 6 |
| 2.5 Bake pipeline | Phase 4 |
| 3.1 Three-region layout | Task 12 |
| 3.2 Top bar | Task 12 |
| 4 TipTap config | Task 7 |
| 5.1-5.5 Asset pipeline | Phases 2-3 |
| 6 Drag/place | Phase 2 |
| 7 Save & undo | Tasks 3, 4, 5, 6, 12 |
| 8 Migration | Phase 5 |
| 11 Phased implementation | This entire plan |
