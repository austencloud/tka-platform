/**
 * Dev-only "Illustrator mode" for the guide. Pages register every draggable
 * thing (arrow endpoints/shafts, text runs, paragraphs) as a Movable; the
 * ptDrag action wires pointer dragging, click-to-select, and per-drag undo.
 * Toggle with the on-screen button or the `E` key; Ctrl+Z / Ctrl+Shift+Z (or
 * Ctrl+Y) undo/redo; arrow keys nudge the selected item (Shift = ×10); Delete
 * hides the selected item (undoable; the Copy dump lists deletions so they can
 * be made permanent in source); Escape deselects (or exits). The Copy button
 * dumps all current coords to paste back. Off by default → ships clean.
 */

import { tick } from "svelte";

export type Movable = {
  id: string;
  label: string;
  apply: (dx: number, dy: number) => void; // move by delta (guide-points)
  snapshot: () => number[]; // current coords
  restore: (s: number[]) => void; // write coords back (undo/redo)
};

export const guideEdit = $state<{
  on: boolean;
  selectedId: string | null;
  selectedLabel: string | null;
}>({ on: false, selectedId: null, selectedLabel: null });

// Reactive history depth, for enabling/labelling the undo/redo buttons.
export const hist = $state({ undo: 0, redo: 0 });

type Registered = { m: Movable; node: HTMLElement | SVGElement };
const movables = new Map<string, Registered>();

// ── inline text editing (double-click a paragraph to retype it) ──────────────
// A text node registers a getter/setter for its HTML; the editText action wires
// double-click-to-edit. Commits join the shared undo stack and the Copy dump.
export type Editable = {
  id: string;
  label: string;
  get: () => string;
  set: (value: string) => void;
  /** Plain-text run (reads/writes textContent) vs rich html (innerHTML). */
  plain?: boolean;
};
type RegisteredText = { e: Editable; node: HTMLElement; begin: () => void };
const editables = new Map<string, RegisteredText>();
const editedTextIds = new Set<string>();

/** True when the id maps to an editable text node (drives the panel affordance). */
export function isEditable(id: string | null): boolean {
  return !!id && editables.has(id);
}
/** Programmatically enter text-edit on an id (defaults to the current selection). */
export function beginTextEdit(id: string | null = guideEdit.selectedId): void {
  (id ? editables.get(id) : null)?.begin();
}

// ── delete (hide) support ────────────────────────────────────────────────────
// Deleted items are hidden live (display:none) and listed in the Copy dump so
// the removal can be made permanent in source. Undo restores them.
const deletedIds = new Set<string>();

function applyHidden(id: string, hidden: boolean): void {
  if (hidden) deletedIds.add(id);
  else deletedIds.delete(id);
  const node = movables.get(id)?.node as HTMLElement | undefined;
  if (node?.style) node.style.display = hidden ? "none" : "";
}

/** Hide the selected item (undoable). */
export function deleteSelected(): void {
  const id = guideEdit.selectedId;
  if (!id || !movables.has(id)) return;
  pushHistory();
  applyHidden(id, true);
  select(null);
}

// ── coords dump (Copy button) ───────────────────────────────────────────────
const dumpers = new Map<string, () => string>();
export function registerEditSource(key: string, dump: () => string): () => void {
  dumpers.set(key, dump);
  return () => dumpers.delete(key);
}
export function collectEditCoords(): string {
  if (dumpers.size === 0) return "(open a page in edit mode)";
  const pages = [...dumpers.entries()].map(([k, d]) => `=== ${k} ===\n${d()}`).join("\n\n");
  const prefix: string[] = [];
  if (editedTextIds.size > 0) {
    const txt = [...editedTextIds]
      .map((id) => {
        const e = editables.get(id)?.e;
        return `  ${id} — ${e?.label ?? "?"}\n    ${JSON.stringify(e?.get() ?? "")}`;
      })
      .join("\n");
    prefix.push(`=== EDITED TEXT (make permanent in source) ===\n${txt}`);
  }
  if (deletedIds.size > 0) {
    const del = [...deletedIds]
      .map((id) => `  ${id} — ${movables.get(id)?.m.label ?? "?"}`)
      .join("\n");
    prefix.push(`=== DELETED (make permanent in source) ===\n${del}`);
  }
  return [...prefix, pages].join("\n\n");
}

// ── selection ───────────────────────────────────────────────────────────────
export function select(id: string | null): void {
  guideEdit.selectedId = id;
  guideEdit.selectedLabel = id ? movables.get(id)?.m.label ?? null : null;
}

/** Live coords of the selected movable — reactive (reads the page $state). */
export function selectedSnapshot(): number[] | null {
  const id = guideEdit.selectedId;
  if (!id) return null;
  return movables.get(id)?.m.snapshot() ?? null;
}

// ── undo / redo ─────────────────────────────────────────────────────────────
type Snapshot = {
  mv: Map<string, { c: number[]; hidden: boolean }>;
  tx: Map<string, string>;
};
let undoStack: Snapshot[] = [];
let redoStack: Snapshot[] = [];
function snapAll(): Snapshot {
  const mv = new Map<string, { c: number[]; hidden: boolean }>();
  for (const [id, r] of movables) mv.set(id, { c: r.m.snapshot(), hidden: deletedIds.has(id) });
  const tx = new Map<string, string>();
  for (const [id, r] of editables) tx.set(id, r.e.get());
  return { mv, tx };
}
function restoreAll(s: Snapshot): void {
  for (const [id, v] of s.mv) {
    const r = movables.get(id);
    if (!r) continue;
    r.m.restore(v.c);
    applyHidden(id, v.hidden);
  }
  for (const [id, html] of s.tx) editables.get(id)?.e.set(html);
}
function sync(): void {
  hist.undo = undoStack.length;
  hist.redo = redoStack.length;
}
/** Capture a restore point BEFORE a mutation (drag start / nudge). */
export function pushHistory(): void {
  undoStack.push(snapAll());
  if (undoStack.length > 200) undoStack.shift();
  redoStack = [];
  sync();
}
export function undo(): void {
  const prev = undoStack.pop();
  if (!prev) return;
  redoStack.push(snapAll());
  restoreAll(prev);
  sync();
}
export function redo(): void {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(snapAll());
  restoreAll(next);
  sync();
}

// ── nudge the selected item ─────────────────────────────────────────────────
export function nudge(dx: number, dy: number): void {
  const mv = guideEdit.selectedId ? movables.get(guideEdit.selectedId)?.m : null;
  if (!mv) return;
  pushHistory();
  mv.apply(dx, dy);
}

// ── toggle + init ───────────────────────────────────────────────────────────
const LS = "guide-edit-on";
export function setEdit(on: boolean): void {
  guideEdit.on = on;
  if (!on) select(null);
  try {
    localStorage.setItem(LS, on ? "1" : "0");
  } catch {
    /* no storage */
  }
}
export function toggleEdit(): void {
  setEdit(!guideEdit.on);
}
/** Seed on-state from `?edit` OR the last localStorage choice. */
export function initEdit(urlHasEdit: boolean): void {
  let on = urlHasEdit;
  try {
    if (localStorage.getItem(LS) === "1") on = true;
  } catch {
    /* no storage */
  }
  guideEdit.on = on;
}

// ── pt helper: a Movable for an object's two numeric coord keys ──────────────
export function pt(id: string, label: string, o: any, kx = "x", ky = "y"): Movable {
  return {
    id,
    label,
    apply: (dx, dy) => {
      o[kx] += dx;
      o[ky] += dy;
    },
    snapshot: () => [o[kx], o[ky]],
    restore: ([x, y]) => {
      o[kx] = x;
      o[ky] = y;
    },
  };
}

// ── drag action ─────────────────────────────────────────────────────────────
// The sheet is 612×792 guide-points; map client px → points via the live rect of
// the nearest .guide-page so it's correct at any zoom or render scale.
function ptPerPx(node: Element): { px: number; py: number } {
  const sheet = node.closest(".guide-page");
  const r = (sheet ?? document.documentElement).getBoundingClientRect();
  return { px: 612 / r.width, py: 792 / r.height };
}

export function ptDrag(node: HTMLElement | SVGElement, movable: Movable) {
  let m = movable;
  movables.set(m.id, { m, node });
  // A re-mounted element that was deleted this session stays hidden.
  if (deletedIds.has(m.id)) applyHidden(m.id, true);
  let startX = 0;
  let startY = 0;
  let appliedX = 0; // guide-points already applied this drag
  let appliedY = 0;
  let scale = { px: 1, py: 1 };

  function move(ev: Event) {
    const e = ev as PointerEvent;
    // Total wanted delta from the drag origin (guide-points), so Shift can lock
    // to one axis and un-Shift mid-drag re-frees the other — both recompute
    // from the origin rather than accumulating capped increments.
    let wantX = (e.clientX - startX) * scale.px;
    let wantY = (e.clientY - startY) * scale.py;
    if (e.shiftKey) {
      if (Math.abs(wantX) >= Math.abs(wantY)) wantY = 0;
      else wantX = 0;
    }
    m.apply(wantX - appliedX, wantY - appliedY);
    appliedX = wantX;
    appliedY = wantY;
  }
  function up(ev: Event) {
    const e = ev as PointerEvent;
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      /* not captured */
    }
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  }
  function down(ev: Event) {
    if (!guideEdit.on) return;
    // While a text box is being edited, the pointer belongs to text selection.
    if ((node as HTMLElement).isContentEditable) return;
    const e = ev as PointerEvent;
    e.preventDefault();
    e.stopPropagation();
    select(m.id);
    pushHistory();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    appliedX = 0;
    appliedY = 0;
    scale = ptPerPx(node);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const el = node as HTMLElement;
  el.addEventListener("pointerdown", down);
  return {
    update(next: Movable) {
      if (next.id !== m.id) movables.delete(m.id);
      m = next;
      movables.set(m.id, { m, node });
    },
    destroy() {
      movables.delete(m.id);
      if (guideEdit.selectedId === m.id) select(null);
      el.removeEventListener("pointerdown", down);
    },
  };
}

// ── inline text edit action ──────────────────────────────────────────────────
// Double-click a registered text node (edit mode on) to retype it. Enter or a
// click outside commits; Escape reverts. Commits join the shared undo stack and
// are listed in the Copy dump so they can be made permanent in source.
export function editText(node: HTMLElement, editable: Editable) {
  let e = editable;
  let original = ""; // raw content at edit start
  let cancelled = false;
  let editing = false;

  // Plain runs read/write textContent (so `{r.t}` doesn't double-escape); rich
  // paragraphs read/write innerHTML (keeps <br>/<strong>).
  const read = () => (e.plain ? node.textContent ?? "" : node.innerHTML);

  function teardown() {
    node.removeEventListener("keydown", key);
    node.removeEventListener("blur", commit);
    window.removeEventListener("pointerdown", outside, true);
  }
  async function commit() {
    if (!editing) return;
    editing = false;
    node.setAttribute("contenteditable", "false");
    node.classList.remove("guide-text-editing");
    teardown();
    if (cancelled) {
      // Discard: the source value never changed while typing, so re-assigning it
      // is a no-op that won't re-render the contenteditable DOM. Flip through a
      // blank via tick() to force Svelte to re-render the original (this keeps
      // Svelte's text / {@html} anchors intact — clobbering the DOM would not).
      e.set("");
      await tick();
      e.set(original);
      return;
    }
    const val = read().trim();
    if (val !== original.trim()) {
      pushHistory();
      e.set(val);
      editedTextIds.add(e.id);
    }
  }
  function key(ev: KeyboardEvent) {
    if (ev.key === "Escape") {
      ev.preventDefault();
      cancelled = true;
      node.blur();
    } else if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault(); // Enter commits; Shift+Enter inserts a line break
      node.blur();
    }
  }
  function outside(ev: PointerEvent) {
    if (ev.target !== node && !node.contains(ev.target as Node)) node.blur();
  }
  function begin() {
    if (!guideEdit.on || editing) return;
    editing = true;
    select(e.id);
    original = read();
    cancelled = false;
    // plaintext-only stops single-line runs eating pasted markup; where a
    // browser lacks it, it falls back to a normal editable.
    node.setAttribute("contenteditable", e.plain ? "plaintext-only" : "true");
    node.classList.add("guide-text-editing");
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    node.addEventListener("keydown", key);
    node.addEventListener("blur", commit);
    // Capture-phase so a click anywhere else commits before it does its own thing.
    window.addEventListener("pointerdown", outside, true);
  }
  function dbl(ev: Event) {
    if (!guideEdit.on) return;
    ev.preventDefault();
    ev.stopPropagation();
    begin();
  }

  editables.set(e.id, { e, node, begin });
  node.addEventListener("dblclick", dbl);
  return {
    update(next: Editable) {
      if (next.id !== e.id) editables.delete(e.id);
      e = next;
      editables.set(e.id, { e, node, begin });
    },
    destroy() {
      editables.delete(e.id);
      node.removeEventListener("dblclick", dbl);
      teardown();
    },
  };
}

// ── global hotkeys ──────────────────────────────────────────────────────────
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}
export function installEditHotkeys(): () => void {
  function key(e: KeyboardEvent) {
    if (isTyping(e)) return;
    const mod = e.ctrlKey || e.metaKey;

    // `E` toggles edit mode whether on or off.
    if (!mod && (e.key === "e" || e.key === "E")) {
      e.preventDefault();
      toggleEdit();
      return;
    }
    if (!guideEdit.on) return;

    if (mod && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if (mod && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      redo();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      guideEdit.selectedId ? select(null) : setEdit(false);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && guideEdit.selectedId) {
      e.preventDefault();
      deleteSelected();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudge(-step, 0);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nudge(step, 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nudge(0, -step);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      nudge(0, step);
    }
  }
  window.addEventListener("keydown", key);
  return () => window.removeEventListener("keydown", key);
}
