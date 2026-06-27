/**
 * Dev-only "Illustrator mode" for the guide. Pages register every draggable
 * thing (arrow endpoints/shafts, text runs, paragraphs) as a Movable; the
 * ptDrag action wires pointer dragging, click-to-select, and per-drag undo.
 * Toggle with the on-screen button or the `E` key; Ctrl+Z / Ctrl+Shift+Z (or
 * Ctrl+Y) undo/redo; arrow keys nudge the selected item (Shift = ×10); Escape
 * deselects (or exits). The Copy button dumps all current coords to paste back.
 * Off by default → ships clean.
 */

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

const movables = new Map<string, Movable>();

// ── coords dump (Copy button) ───────────────────────────────────────────────
const dumpers = new Map<string, () => string>();
export function registerEditSource(key: string, dump: () => string): () => void {
  dumpers.set(key, dump);
  return () => dumpers.delete(key);
}
export function collectEditCoords(): string {
  if (dumpers.size === 0) return "(open a page in edit mode)";
  return [...dumpers.entries()].map(([k, d]) => `=== ${k} ===\n${d()}`).join("\n\n");
}

// ── selection ───────────────────────────────────────────────────────────────
export function select(id: string | null): void {
  guideEdit.selectedId = id;
  guideEdit.selectedLabel = id ? movables.get(id)?.label ?? null : null;
}

// ── undo / redo ─────────────────────────────────────────────────────────────
let undoStack: Array<Map<string, number[]>> = [];
let redoStack: Array<Map<string, number[]>> = [];
function snapAll(): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const [id, mv] of movables) m.set(id, mv.snapshot());
  return m;
}
function restoreAll(s: Map<string, number[]>): void {
  for (const [id, v] of s) movables.get(id)?.restore(v);
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
  const mv = guideEdit.selectedId ? movables.get(guideEdit.selectedId) : null;
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
  movables.set(m.id, m);
  let lastX = 0;
  let lastY = 0;
  let scale = { px: 1, py: 1 };

  function move(ev: Event) {
    const e = ev as PointerEvent;
    m.apply((e.clientX - lastX) * scale.px, (e.clientY - lastY) * scale.py);
    lastX = e.clientX;
    lastY = e.clientY;
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
    const e = ev as PointerEvent;
    e.preventDefault();
    e.stopPropagation();
    select(m.id);
    pushHistory();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    lastX = e.clientX;
    lastY = e.clientY;
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
      movables.set(m.id, m);
    },
    destroy() {
      movables.delete(m.id);
      if (guideEdit.selectedId === m.id) select(null);
      el.removeEventListener("pointerdown", down);
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
