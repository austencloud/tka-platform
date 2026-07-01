/**
 * Choreo Sheet builder state — factory + context.
 *
 * Holds the sheet a user is assembling: which sequences are on it (in order),
 * the page layout, and a cache of the full sequence data needed to draw each
 * row of step-pictographs. A sheet only stores sequence *ids*; the actual steps
 * live in the user's library, so we hydrate them on demand and keep them cached
 * (re-ordering a row or toggling step numbers must never refetch).
 *
 * Both the on-screen preview and the PDF export read `pages` + `geo` from here,
 * so the printed sheet and the preview can never drift apart.
 *
 * Follows the module Factory + Context pattern (see the state-management skill):
 * `createChoreoSheetState()` returns getters (never raw `$state`), services come
 * in as arguments, and the context is set once in the builder root and consumed
 * by any descendant.
 */

import { getContext, setContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import {
  createEmptyChoreoSheet,
  DEFAULT_SHEET_LAYOUT,
  type ChoreoSheet,
  type ChoreoSheetLayout,
} from "../domain/types/choreo-sheet";
import { getSheetPageLayout, type SheetPageGeometry } from "../domain/sheet-page-layout";
import { planSheet, type SheetPage } from "../services/sheet-row-planner";
import type { ActData } from "../domain/types/write";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export interface ChoreoSheetStateDeps {
  /**
   * Loads one sequence id into its full, step-populated `SequenceData`. Wire
   * this to `getLibraryRepository().getSequence` at the builder root — that is
   * the hydrating read path. Do NOT pass the gallery/metadata loaders: those
   * return sequences with empty `steps`, which would draw blank rows.
   */
  loadSequence: (id: string) => Promise<SequenceData | null>;
  /** Optional seed sheet (e.g. a saved sheet being reopened). Defaults to a fresh empty sheet. */
  initialSheet?: ChoreoSheet;
  /**
   * localStorage key for an auto-saved draft. When set, the builder restores
   * from it on construction (unless `initialSheet` is passed) and re-saves on
   * every change, so a reload / HMR lands on the exact state the user left. The
   * heavy step data is NOT persisted — only ids + layout + name; steps rehydrate
   * via `loadSequence` on restore (so it must resolve both library and community
   * ids).
   */
  persistKey?: string;
}

// ── Draft persistence (localStorage) ─────────────────────────────────────────
// Lightweight: ids + layout + name + timestamps only. Mirrors the guarded
// load/persist pattern used across the state modules (e.g. practice-view-prefs).

function loadDraft(key: string): ChoreoSheet | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ChoreoSheet> & { sequenceIds?: unknown };
    if (!Array.isArray(p.sequenceIds)) return null;
    const now = new Date();
    return {
      id: typeof p.id === "string" && p.id ? p.id : crypto.randomUUID(),
      name: typeof p.name === "string" ? p.name : "Untitled Sheet",
      ownerId: typeof p.ownerId === "string" ? p.ownerId : "",
      sequenceIds: (p.sequenceIds as unknown[]).filter(
        (x): x is string => typeof x === "string"
      ),
      layout: { ...DEFAULT_SHEET_LAYOUT, ...(p.layout ?? {}) },
      createdAt: p.createdAt ? new Date(p.createdAt as unknown as string) : now,
      updatedAt: p.updatedAt ? new Date(p.updatedAt as unknown as string) : now,
    };
  } catch {
    return null;
  }
}

function persistDraft(key: string, sheet: ChoreoSheet): void {
  try {
    localStorage.setItem(key, JSON.stringify(sheet));
  } catch {
    // ignore storage errors (quota, private mode)
  }
}

export function createChoreoSheetState(deps: ChoreoSheetStateDeps) {
  // The sheet itself (ids + layout + metadata). Mutated by reassignment so the
  // `updatedAt` stamp and downstream `$derived`s refresh together. Restored from
  // the persisted draft when a persistKey is given and no explicit seed passed.
  let sheet = $state<ChoreoSheet>(
    deps.initialSheet ??
      (deps.persistKey ? loadDraft(deps.persistKey) : null) ??
      createEmptyChoreoSheet("")
  );

  // id -> hydrated SequenceData. A SvelteMap (not a plain Map) so `.set()`/`.get()`
  // are reactive — the moment a sequence finishes hydrating, the rows that need
  // it recompute. We keep entries even after a sequence is removed from the
  // sheet: re-adding it is then instant, and the cache is just keyed by id.
  const cache = new SvelteMap<string, SequenceData>();

  // True while a hydration round-trip is in flight, so the UI can show a spinner
  // on freshly-added rows instead of leaving them mysteriously blank.
  let isHydrating = $state(false);

  // The on-sheet sequences, in sheet order, with any not-yet-hydrated ones
  // skipped (their rows simply haven't drawn yet — they fill in as hydration
  // resolves). This is what the planner and preview consume.
  const hydratedSequences = $derived(
    sheet.sequenceIds
      .map((id) => cache.get(id))
      .filter((seq): seq is SequenceData => seq != null)
  );

  // Page geometry (cell size, margins, grid) and the paginated rows of cells.
  // Both recompute from ids + layout + cache, so preview and PDF stay in lockstep.
  const geo = $derived<SheetPageGeometry>(getSheetPageLayout(sheet.layout));
  const pages = $derived<SheetPage[]>(planSheet(hydratedSequences, sheet.layout));

  // Hydrate only the ids we don't already have, in parallel. A failed fetch for
  // one id never blocks the others or throws — that row just stays blank, which
  // a later add/retry can fill.
  async function ensureHydrated(ids: readonly string[]): Promise<void> {
    const missing = ids.filter((id) => !cache.has(id));
    if (missing.length === 0) return;

    isHydrating = true;
    try {
      await Promise.all(
        missing.map(async (id) => {
          try {
            const data = await deps.loadSequence(id);
            if (data) cache.set(id, data);
          } catch (error) {
            console.error(`[ChoreoSheetState] Failed to hydrate sequence ${id}:`, error);
          }
        })
      );
    } finally {
      isHydrating = false;
    }
  }

  // Append sequences to the sheet (one block per sequence, so ids already on the
  // sheet are skipped) and hydrate whatever isn't cached yet. The ids appear
  // immediately; the pictographs fill in as hydration resolves.
  async function addSequences(ids: readonly string[]): Promise<void> {
    const additions = ids.filter((id) => !sheet.sequenceIds.includes(id));
    if (additions.length > 0) {
      sheet = {
        ...sheet,
        sequenceIds: [...sheet.sequenceIds, ...additions],
        updatedAt: new Date(),
      };
    }
    await ensureHydrated(additions.length > 0 ? additions : ids);
  }

  // Append sequences we ALREADY hold fully hydrated (e.g. clicked in the shared
  // media browser, which loads from the public/gallery loader — not the user's
  // library). Seed the cache directly with the given data so we neither refetch
  // nor depend on the id existing in the library `loadSequence` path.
  function addHydratedSequences(seqs: readonly SequenceData[]): void {
    const additions: string[] = [];
    for (const seq of seqs) {
      if (!seq?.id) continue;
      cache.set(seq.id, seq);
      if (!sheet.sequenceIds.includes(seq.id) && !additions.includes(seq.id)) {
        additions.push(seq.id);
      }
    }
    if (additions.length > 0) {
      sheet = {
        ...sheet,
        sequenceIds: [...sheet.sequenceIds, ...additions],
        updatedAt: new Date(),
      };
    }
  }

  // Drop the row at `index`. The cached SequenceData is intentionally retained —
  // it's keyed by id and re-adding the sequence should not refetch.
  function removeAt(index: number): void {
    if (index < 0 || index >= sheet.sequenceIds.length) return;
    const next = sheet.sequenceIds.slice();
    next.splice(index, 1);
    sheet = { ...sheet, sequenceIds: next, updatedAt: new Date() };
  }

  // Reorder: pull the row out of `from` and drop it back in at `to`.
  function move(from: number, to: number): void {
    const ids = sheet.sequenceIds;
    if (
      from < 0 ||
      from >= ids.length ||
      to < 0 ||
      to >= ids.length ||
      from === to
    ) {
      return;
    }
    const next = ids.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    sheet = { ...sheet, sequenceIds: next, updatedAt: new Date() };
  }

  // Rename the sheet. Kept in state (not a local in the view) so the name is
  // part of the persisted draft and restores on reload.
  function setName(name: string): void {
    sheet = { ...sheet, name, updatedAt: new Date() };
  }

  // Patch one or more layout fields (e.g. toggle step numbers, change the group
  // separator). Merges over the current layout so callers only pass what changed.
  function setLayout(patch: Partial<ChoreoSheetLayout>): void {
    sheet = {
      ...sheet,
      layout: { ...sheet.layout, ...patch },
      updatedAt: new Date(),
    };
  }

  // Turn an Act into a sheet roster ("Send to Sheet"). An Act already carries a
  // fully-hydrated SequenceData per placement, so we seed the cache straight from
  // it and skip the library round-trip entirely. Duplicate placements collapse to
  // a single block (one block per sequence).
  function seedFromAct(act: ActData): void {
    const ids: string[] = [];
    for (const placement of act.sequences) {
      const data = placement.sequenceData;
      if (!data?.id) continue;
      cache.set(data.id, data);
      if (!ids.includes(data.id)) ids.push(data.id);
    }
    sheet = {
      ...sheet,
      name: act.name,
      sequenceIds: ids,
      updatedAt: new Date(),
    };
  }

  // Restore path: a draft loaded with ids needs its steps hydrated now (via the
  // loader dep, which must resolve both community and library ids).
  if (sheet.sequenceIds.length > 0) {
    void ensureHydrated(sheet.sequenceIds);
  }

  // Auto-save the draft on every sheet change, so reload / HMR restores the
  // exact state the user left. Cache/hydration mutations don't reassign `sheet`,
  // so they don't trigger a redundant write.
  if (deps.persistKey) {
    const key = deps.persistKey;
    $effect(() => {
      persistDraft(key, sheet);
    });
  }

  return {
    get sheet() {
      return sheet;
    },
    get sequenceIds() {
      return sheet.sequenceIds;
    },
    get layout() {
      return sheet.layout;
    },
    get hydratedSequences() {
      return hydratedSequences;
    },
    get geo() {
      return geo;
    },
    get pages() {
      return pages;
    },
    get isHydrating() {
      return isHydrating;
    },

    addSequences,
    addHydratedSequences,
    removeAt,
    move,
    setName,
    setLayout,
    seedFromAct,
  };
}

export type ChoreoSheetState = ReturnType<typeof createChoreoSheetState>;

// ── Context ──────────────────────────────────────────────────────────────────
// Set once in the builder root (ChoreoSheetView / WriteTab), consumed by any
// descendant (preview, picker, settings strip) without prop-drilling.

export interface ChoreoSheetContext {
  state: ChoreoSheetState;
}

const CHOREO_SHEET_CONTEXT_KEY = Symbol("choreo-sheet");

export function setChoreoSheetContext(context: ChoreoSheetContext): void {
  setContext(CHOREO_SHEET_CONTEXT_KEY, context);
}

export function getChoreoSheetContext(): ChoreoSheetContext {
  const context = getContext<ChoreoSheetContext>(CHOREO_SHEET_CONTEXT_KEY);

  if (!context) {
    throw new Error(
      "ChoreoSheetContext not found. Ensure you're calling getChoreoSheetContext() " +
        "within a component that is a descendant of the choreo sheet builder root."
    );
  }

  return context;
}
