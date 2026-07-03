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
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import {
  createEmptyAnnotations,
  createEmptyChoreoSheet,
  DEFAULT_SHEET_LAYOUT,
  type ChoreoSheet,
  type ChoreoSheetAnnotations,
  type ChoreoSheetLayout,
  type CueMark,
  type NoteMark,
} from "../domain/types/choreo-sheet";
import { getSheetPageLayout, type SheetPageGeometry } from "../domain/sheet-page-layout";
import { planBands, planSheet, type SheetBandPage, type SheetPage } from "../services/sheet-row-planner";
import { prefillTimestamps as computePrefill } from "../services/timestamp-prefill";
import { buildActSequence } from "../services/sheet-act-sequence";
import {
  connects,
  endStateOf,
  loopStatus,
  normalizeToStart,
  type LoopStatus,
} from "../services/sheet-continuity";
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

// JSON round-trips Date fields as ISO strings, so a restored draft's timestamps
// arrive as `unknown`-shaped values. Narrow at runtime instead of casting.
function parseDraftDate(value: unknown, fallback: Date): Date {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

export function loadDraft(key: string): ChoreoSheet | null {
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
      annotations: p.annotations ?? createEmptyAnnotations(),
      bpm: typeof p.bpm === "number" ? p.bpm : undefined,
      createdAt: parseDraftDate(p.createdAt, now),
      updatedAt: parseDraftDate(p.updatedAt, now),
    };
  } catch {
    return null;
  }
}

export function persistDraft(key: string, sheet: ChoreoSheet): void {
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

  // Dirty = the live sheet object differs from the construction / last-loaded
  // baseline. Every mutator reassigns `sheet` to a fresh object (bumping
  // `updatedAt`), so reference identity is an exact, allocation-cheap dirty
  // signal with no timestamp races. Exposed via a getter that reads both
  // `$state`s live, so component consumers still track it. Reset the baseline on
  // load/new-sheet so a freshly opened or freshly created sheet reads clean.
  let pristineSheet = $state<ChoreoSheet>(sheet);

  // id -> hydrated SequenceData. A SvelteMap (not a plain Map) so `.set()`/`.get()`
  // are reactive — the moment a sequence finishes hydrating, the rows that need
  // it recompute. We keep entries even after a sequence is removed from the
  // sheet: re-adding it is then instant, and the cache is just keyed by id.
  const cache = new SvelteMap<string, SequenceData>();

  // True while a hydration round-trip is in flight, so the UI can show a spinner
  // on freshly-added rows instead of leaving them mysteriously blank.
  let isHydrating = $state(false);

  // Ids whose hydration failed (fetch threw, or the loader returned null). A
  // SvelteSet — the reactive sibling of the cache's SvelteMap — so the UI can
  // put an error badge + retry on the affected rows instead of a silent blank.
  const failedIds = new SvelteSet<string>();

  // Which sequence block (by id) is selected in the preview / rail — powers
  // select-then-remove (click the whole sequence, see it highlighted, remove it).
  let selectedSequenceId = $state<string | null>(null);

  // The on-sheet sequences, in sheet order, with any not-yet-hydrated ones
  // skipped (their rows simply haven't drawn yet — they fill in as hydration
  // resolves). This is what the planner and preview consume.
  const hydratedSequences = $derived(
    sheet.sequenceIds
      .map((id) => cache.get(id))
      .filter((seq): seq is SequenceData => seq != null)
  );

  // Each row (after the first) is normalized to start where the previous row's
  // normalized form ends — so "fill from collections" auto-connects. The fold is
  // order-dependent, so it lives here (not in the id-keyed cache).
  const normalizedRows = $derived.by<SequenceData[]>(() => {
    const out: SequenceData[] = [];
    for (let i = 0; i < hydratedSequences.length; i++) {
      const seq = hydratedSequences[i]!;
      if (i === 0) {
        out.push(seq);
        continue;
      }
      const prevEnd = endStateOf(out[i - 1]!);
      out.push(prevEnd ? normalizeToStart(seq, prevEnd) : seq);
    }
    return out;
  });

  // boundaries[i] = does row i connect to row i+1 (after normalization)?
  const boundaries = $derived(
    normalizedRows.slice(1).map((seq, i) => connects(normalizedRows[i]!, seq))
  );

  // Ids of rows that begin a break (don't connect to the row above). The preview
  // and PDF mark a block start whose sequence id is in this set.
  const breakSequenceIds = $derived(
    new Set(
      normalizedRows
        .filter((seq, i) => i > 0 && !connects(normalizedRows[i - 1]!, seq))
        .map((seq) => seq.id)
    )
  );

  const sheetLoopStatus = $derived<LoopStatus>(loopStatus(normalizedRows));

  // Page geometry (cell size, margins, grid) and the paginated rows of cells.
  // Both recompute from the normalized rows + layout, so preview and PDF stay in
  // lockstep with what connects.
  const geo = $derived<SheetPageGeometry>(getSheetPageLayout(sheet.layout));
  const pages = $derived<SheetPage[]>(planSheet(normalizedRows, sheet.layout));

  // Annotated-branch planner output: row-aligned, height-packed bands carrying
  // their resolved cue + notes. Only computed in "aligned" packing — flow sheets
  // keep using `pages` above. Preview and PDF read this so they stay in lockstep.
  const bandPages = $derived<SheetBandPage[]>(
    sheet.layout.packing === "aligned"
      ? planBands({
          sequences: normalizedRows,
          geo,
          cues: sheet.annotations.cues,
          notes: sheet.annotations.notes,
        })
      : []
  );

  // The whole sheet as ONE continuous sequence, for act playback. Recomputes only
  // when the normalized rows or the name change.
  const actSequence = $derived(buildActSequence(normalizedRows, sheet.name));

  // Hydrate only the ids we don't already have, in parallel. A failed fetch for
  // one id never blocks the others or throws — the id lands in `failedIds` so
  // the row can show an error + retry instead of a mysterious blank.
  async function ensureHydrated(ids: readonly string[]): Promise<void> {
    const missing = ids.filter((id) => !cache.has(id));
    if (missing.length === 0) return;

    isHydrating = true;
    try {
      await Promise.all(
        missing.map(async (id) => {
          failedIds.delete(id); // a retry attempt clears the stale error first
          try {
            const data = await deps.loadSequence(id);
            if (data) {
              cache.set(id, data);
            } else {
              failedIds.add(id); // loader resolved but found nothing
            }
          } catch (error) {
            console.error(`[ChoreoSheetState] Failed to hydrate sequence ${id}:`, error);
            failedIds.add(id);
          }
        })
      );
    } finally {
      isHydrating = false;
    }
  }

  // Re-attempt hydration for one failed id, or all failed ids when none given.
  async function retryHydration(id?: string): Promise<void> {
    const targets = id ? [id] : [...failedIds];
    if (targets.length === 0) return;
    await ensureHydrated(targets);
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
      failedIds.delete(seq.id); // directly seeded — any earlier failure is moot
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
    const removedId = sheet.sequenceIds[index];
    const next = sheet.sequenceIds.slice();
    next.splice(index, 1);
    sheet = { ...sheet, sequenceIds: next, updatedAt: new Date() };
    if (removedId === selectedSequenceId) selectedSequenceId = null;
  }

  // Remove a whole sequence block by id (the preview selects by id, not index).
  function removeById(id: string): void {
    const index = sheet.sequenceIds.indexOf(id);
    if (index >= 0) removeAt(index);
  }

  // Selection: which sequence block is highlighted for select-then-remove.
  function selectSequence(id: string | null): void {
    selectedSequenceId = id;
  }
  function toggleSequenceSelection(id: string): void {
    selectedSequenceId = selectedSequenceId === id ? null : id;
  }
  function clearSelection(): void {
    selectedSequenceId = null;
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

  // ── Annotation editing ───────────────────────────────────────────────────────
  // Each mutator reassigns `sheet` with a bumped `updatedAt` (same pattern as the
  // roster/layout mutators above), so `isDirty` and every downstream `$derived`
  // refresh together.

  // Patch the page header (song/choreographer/tagline/title-block toggle).
  function setHeader(patch: Partial<ChoreoSheetAnnotations["header"]>): void {
    sheet = {
      ...sheet,
      annotations: {
        ...sheet.annotations,
        header: { ...sheet.annotations.header, ...patch },
      },
      updatedAt: new Date(),
    };
  }

  // Upsert a cue by its band key: patch the existing cue for that band, or seed
  // a fresh one (blank timestamp/text) with the patch applied.
  function setCue(band: string, patch: Partial<Omit<CueMark, "band">>): void {
    const cues = sheet.annotations.cues.slice();
    const idx = cues.findIndex((c) => c.band === band);
    if (idx === -1) cues.push({ band, timestamp: "", text: "", ...patch });
    else cues[idx] = { ...cues[idx]!, ...patch };
    sheet = {
      ...sheet,
      annotations: { ...sheet.annotations, cues },
      updatedAt: new Date(),
    };
  }

  // Add a blank note pinned to `count` (a column index, or null for a full-width
  // bullet) and return its stable id so the caller can immediately edit/remove it.
  function addNote(band: string, count: number | null): string {
    const id = crypto.randomUUID();
    const notes = [...sheet.annotations.notes, { id, band, count, text: "" }];
    sheet = {
      ...sheet,
      annotations: { ...sheet.annotations, notes },
      updatedAt: new Date(),
    };
    return id;
  }

  // Patch a note (text and/or count) by id.
  function setNote(id: string, patch: Partial<Omit<NoteMark, "id">>): void {
    const notes = sheet.annotations.notes.map((n) =>
      n.id === id ? { ...n, ...patch } : n
    );
    sheet = {
      ...sheet,
      annotations: { ...sheet.annotations, notes },
      updatedAt: new Date(),
    };
  }

  // Remove a note by id.
  function removeNote(id: string): void {
    const notes = sheet.annotations.notes.filter((n) => n.id !== id);
    sheet = {
      ...sheet,
      annotations: { ...sheet.annotations, notes },
      updatedAt: new Date(),
    };
  }

  // Fill blank cue timestamps from each band's first-step beat index at the
  // sheet's BPM (1 step = 1 beat). Never overwrites a timestamp the user typed —
  // the pure helper only returns keys for blank bands; a no-op when BPM is unset.
  function prefillTimestamps(): void {
    const bands = bandPages
      .flatMap((p) => p.bands)
      .map((b) => ({
        key: b.key,
        firstBeatIndex: b.firstBeatIndex,
        timestamp: b.cue?.timestamp ?? "",
      }));
    const filled = computePrefill(bands, sheet.bpm);
    for (const [band, timestamp] of Object.entries(filled)) setCue(band, { timestamp });
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
      failedIds.delete(data.id); // directly seeded — any earlier failure is moot
      if (!ids.includes(data.id)) ids.push(data.id);
    }
    sheet = {
      ...sheet,
      name: act.name,
      sequenceIds: ids,
      updatedAt: new Date(),
    };
  }

  // Load a saved sheet into the builder (the Acts dock's "open"). Replaces the
  // whole sheet — the persist $effect then snapshots it as the live draft — and
  // hydrates whatever steps aren't cached yet. Selection is cleared because it
  // referenced the outgoing roster.
  function replaceSheet(next: ChoreoSheet): void {
    sheet = { ...next, sequenceIds: [...next.sequenceIds] };
    pristineSheet = sheet; // a freshly loaded sheet is clean
    selectedSequenceId = null;
    if (sheet.sequenceIds.length > 0) void ensureHydrated(sheet.sequenceIds);
  }

  // Start a fresh act. The hydration cache is retained on purpose (keyed by id —
  // re-adding a sequence must not refetch).
  function newSheet(): void {
    sheet = createEmptyChoreoSheet("");
    pristineSheet = sheet; // a freshly created sheet is clean
    selectedSequenceId = null;
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
    get bandPages() {
      return bandPages;
    },
    get isDirty() {
      return sheet !== pristineSheet;
    },
    get actSequence() {
      return actSequence;
    },
    get normalizedRows() {
      return normalizedRows;
    },
    get boundaries() {
      return boundaries;
    },
    get breakSequenceIds() {
      return breakSequenceIds;
    },
    get loopStatus() {
      return sheetLoopStatus;
    },
    get isHydrating() {
      return isHydrating;
    },
    get failedSequenceIds(): ReadonlySet<string> {
      return failedIds;
    },
    get selectedSequenceId() {
      return selectedSequenceId;
    },

    addSequences,
    retryHydration,
    addHydratedSequences,
    replaceSheet,
    newSheet,
    removeAt,
    removeById,
    selectSequence,
    toggleSequenceSelection,
    clearSelection,
    move,
    setName,
    setLayout,
    seedFromAct,
    setHeader,
    setCue,
    addNote,
    setNote,
    removeNote,
    prefillTimestamps,
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
