import { getContext, setContext } from "svelte";

const SEQUENCE_SELECTION_KEY = Symbol("sequence-selection");

/**
 * Whole-sequence hover + single-select state, shared by any surface that lets the
 * user select a sequence (guide strips, choreo sheet). Keyed by an opaque group id —
 * every unit sharing a group id reacts together, so hovering or selecting any one
 * unit lights the whole sequence.
 *
 * Mirrors the shape of GuideActiveStep (_data/guide-active-step.svelte.ts): a $state
 * class provided via Symbol-keyed context. Null context = no scope = nothing
 * selectable (e.g. /print, /book), so the selection ring and hit button never render
 * on the printable frames.
 */
export class SequenceSelection {
  hoveredId = $state<string | null>(null);
  selectedId = $state<string | null>(null);

  isHovered(id: string): boolean {
    return this.hoveredId === id;
  }
  isSelected(id: string): boolean {
    return this.selectedId === id;
  }

  hover(id: string | null): void {
    this.hoveredId = id;
  }

  /** Single-select. Selecting a new id replaces the old one. */
  select(id: string): void {
    this.selectedId = id;
  }

  /** Click-to-toggle: select when unselected, clear when re-selected. */
  toggle(id: string): void {
    this.selectedId = this.selectedId === id ? null : id;
  }

  clear(): void {
    this.selectedId = null;
  }
}

export function setSequenceSelection(state: SequenceSelection): void {
  setContext(SEQUENCE_SELECTION_KEY, state);
}

export function getSequenceSelection(): SequenceSelection | null {
  return getContext<SequenceSelection | null>(SEQUENCE_SELECTION_KEY) ?? null;
}
