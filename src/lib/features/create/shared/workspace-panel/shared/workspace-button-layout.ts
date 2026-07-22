/**
 * Workspace button layout — the single source of truth for which workspace
 * action buttons exist, which zone they live in, and their order.
 *
 * Consumed by BOTH:
 *  - `ButtonPanel.svelte` — renders the real buttons grouped by zone/order.
 *  - the create tutorial's `ReadyStep.svelte` — renders a labelled diagram of
 *    the workspace.
 *
 * Because both read this one array, the tutorial diagram can never drift from
 * the real panel. Move a button here and it moves in both places.
 */

export type WorkspaceButtonId =
  | "undo"
  | "clear"
  | "view"
  | "sequence-actions"
  | "save"
  | "step-editor";

/**
 * Zones map to the real ButtonPanel layout. `grid` is NOT a real button — the
 * user taps a step in the grid to edit it; it exists only so the tutorial can
 * label that affordance. ButtonPanel ignores the `grid` zone.
 */
export type WorkspaceButtonZone = "left" | "center" | "right" | "grid";

export interface WorkspaceButtonLayoutEntry {
  id: WorkspaceButtonId;
  zone: WorkspaceButtonZone;
  /** 1-based reading order — also the badge number in the tutorial diagram. */
  order: number;
}

/** THE source of truth. Order = left-to-right reading order across the panel. */
export const WORKSPACE_BUTTON_LAYOUT: WorkspaceButtonLayoutEntry[] = [
  { id: "undo", zone: "left", order: 1 },
  { id: "clear", zone: "left", order: 2 },
  { id: "view", zone: "center", order: 3 },
  { id: "sequence-actions", zone: "right", order: 4 },
  { id: "save", zone: "right", order: 5 },
  { id: "step-editor", zone: "grid", order: 6 },
];

/** Buttons in a zone, in reading order. */
export function workspaceButtonsInZone(
  zone: WorkspaceButtonZone
): WorkspaceButtonLayoutEntry[] {
  return WORKSPACE_BUTTON_LAYOUT.filter((b) => b.zone === zone).sort(
    (a, b) => a.order - b.order
  );
}

/**
 * Canonical glyph for each button — THE single icon source. The real workspace
 * buttons each render `<i class="fa-solid {WORKSPACE_BUTTON_ICON[id].icon}">`
 * (icon stays inline so their scoped `i` CSS keeps working), and the create
 * tutorial's diagram renders from the same map. So a button's icon can never
 * drift between the live toolbar and the tutorial that teaches it — change it
 * here and it changes in both places. (The broom-vs-eraser bug was exactly this
 * drift before the icon string was centralized.)
 */
export interface WorkspaceButtonGlyph {
  /** FontAwesome class (e.g. "fa-eraser"), or the "undo-svg" sentinel for the
   *  one button (Undo) whose glyph is an inline SVG, not a FontAwesome icon. */
  icon: string;
  iconType: "fa" | "svg";
}

export const WORKSPACE_BUTTON_ICON: Record<
  WorkspaceButtonId,
  WorkspaceButtonGlyph
> = {
  undo: { icon: "undo-svg", iconType: "svg" },
  clear: { icon: "fa-eraser", iconType: "fa" },
  view: { icon: "fa-expand", iconType: "fa" },
  "sequence-actions": { icon: "fa-tools", iconType: "fa" },
  save: { icon: "fa-bookmark", iconType: "fa" },
  "step-editor": { icon: "fa-hand-pointer", iconType: "fa" },
};

/**
 * Tutorial-only presentation for each button (legend text + diagram color).
 * The real buttons own their own labels/colors; this drives the tutorial's
 * labelled diagram, legend, and accordion. Icons are NOT here — they live in
 * WORKSPACE_BUTTON_ICON above (shared with the real buttons). ButtonPanel does
 * not depend on this map.
 */
export interface WorkspaceButtonTutorialMeta {
  label: string;
  description: string;
  colorClass: "accent" | "success" | "error" | "info";
}

export const WORKSPACE_BUTTON_TUTORIAL: Record<
  WorkspaceButtonId,
  WorkspaceButtonTutorialMeta
> = {
  undo: {
    label: "Undo",
    description: "Removes the last step you added.",
    colorClass: "accent",
  },
  clear: {
    label: "Clear",
    description: "Wipes the sequence so you can start fresh.",
    colorClass: "error",
  },
  view: {
    label: "View and Share",
    description: "Watch your sequence animated with props, or share it.",
    colorClass: "success",
  },
  "sequence-actions": {
    label: "Sequence Actions",
    description: "Mirror, flip, rotate, and transform your sequence.",
    colorClass: "success",
  },
  save: {
    label: "Save to Library",
    description: "Stores your sequence so you can find it later.",
    colorClass: "accent",
  },
  "step-editor": {
    label: "Step Editor",
    description: "Tap any step to adjust turns, rotation, and duration.",
    colorClass: "info",
  },
};
