/**
 * Guide Codex live state - the shared reactive source of truth for the
 * interactive Codex reader page (GuideCodexPage.svelte) and its companion
 * controls (GuideCodexControls.svelte). The PAGE renders the printable sheet
 * from this state; the COMPANION's controls mutate it. Neither owns the
 * other - both read/write the same module-level singleton (the factory +
 * context-free singleton pattern this codebase uses for durable client state).
 *
 * Three knobs, same semantics as the old Learn-tab CodexExplorer:
 *  - propType: re-skins every rendered pictograph's motions with a prop family
 *  - visibility: show/hide layers (glyph/grid/TKA/positions/reversals/non-radial)
 *  - transform (rotate/mirror/colorswap): applied codex-wide, composes across
 *    repeated calls (rotate then rotate = 90°), resettable
 *
 * propType + visibility persist to localStorage (durable reading prefs); the
 * transform is deliberately ephemeral (a "browse variations" scratch state,
 * not a saved preference) and resets on reload.
 */
import { MotionColor, RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { applyPendingTurnsToOption } from "$lib/shared/create/services/apply-turns-to-motion";
import {
  rotateAllPictographs,
  mirrorAllPictographs,
  colorSwapAllPictographs,
} from "$lib/features/learn/codex/services/codex-pictograph-updater";
import { codexData, SHEET1, SHEET2, type CodexSheetDef } from "../../codex/_data/codex-groups";
import {
  GUIDE_CODEX_STORAGE_KEY,
  defaultGuideCodexPrefs,
  restoreGuideCodexPrefs,
  serializeGuideCodexPrefs,
  normalizeGuideCodexTurns,
  type GuideCodexVisibility,
  type GuideCodexTurns,
} from "./guide-codex-persistence";

export type CodexTransformOp = "rotate" | "mirror" | "colorswap";

function idsOf(sheet: CodexSheetDef): string[] {
  const ids: string[] = [];
  for (const type of sheet.types) {
    for (const box of type.boxes) {
      for (const cell of box.cells) ids.push(cell.id);
    }
  }
  return ids;
}

/** Every cell id across both printed sheets - the transform's working set. */
const ALL_CELL_IDS: string[] = [...idsOf(SHEET1), ...idsOf(SHEET2)];

function baselineMap(): Map<string, PictographData> {
  const m = new Map<string, PictographData>();
  for (const id of ALL_CELL_IDS) {
    const d = codexData(id);
    if (d) m.set(id, d);
  }
  return m;
}

/** Re-skin a pictograph's blue/red motions with a different prop family. */
function withPropType(p: PictographData, type: PropType): PictographData {
  const blue = p.motions?.[MotionColor.BLUE];
  const red = p.motions?.[MotionColor.RED];
  return {
    ...p,
    motions: {
      blue: blue ? createMotionData({ ...blue, propType: type }) : blue,
      red: red ? createMotionData({ ...red, propType: type }) : red,
    },
  };
}

/** Set each hand's turn count (SETTING, not adding - the canonical option-picker
 *  path recomputes rotation + end orientation). Spin direction only matters for
 *  dash/static hands carrying turns; CW matches the option picker's default. */
function withTurns(p: PictographData, blueTurns: GuideCodexTurns, redTurns: GuideCodexTurns): PictographData {
  return applyPendingTurnsToOption(
    p,
    blueTurns,
    redTurns,
    RotationDirection.CLOCKWISE,
    RotationDirection.CLOCKWISE
  );
}


class GuideCodexState {
  propType = $state<PropType>(defaultGuideCodexPrefs().propType);
  visibility = $state<GuideCodexVisibility>(defaultGuideCodexPrefs().visibility);
  blueTurns = $state<GuideCodexTurns>(defaultGuideCodexPrefs().blueTurns);
  redTurns = $state<GuideCodexTurns>(defaultGuideCodexPrefs().redTurns);
  #transformed = $state<Map<string, PictographData> | null>(null);
  /** The cell the companion is currently animating (ephemeral, like the
   *  transform). Shared here because the codex spans two reader pages: the
   *  page whose sheet contains the cell re-emits the animation strip whenever
   *  this selection OR anything dataFor() reads (turns/prop/transform)
   *  changes - so a turn adjustment restyles the playing animation live, not
   *  just the static cells (see CodexPageBody's emit effect). */
  selectedCellId = $state<string | null>(null);

  constructor() {
    this.#restore();
  }

  #restore(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const prefs = restoreGuideCodexPrefs(localStorage.getItem(GUIDE_CODEX_STORAGE_KEY));
      this.propType = prefs.propType;
      this.visibility = prefs.visibility;
      this.blueTurns = prefs.blueTurns;
      this.redTurns = prefs.redTurns;
    } catch {
      // private mode / quota - fall back to defaults, not worth surfacing
    }
  }

  #persist(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(
        GUIDE_CODEX_STORAGE_KEY,
        serializeGuideCodexPrefs({
          version: 3,
          propType: this.propType,
          visibility: $state.snapshot(this.visibility),
          blueTurns: this.blueTurns,
          redTurns: this.redTurns,
        })
      );
    } catch {
      // ignore
    }
  }

  setPropType(type: PropType): void {
    if (type === this.propType) return;
    this.propType = type;
    this.#persist();
  }

  toggleVisibility(key: keyof GuideCodexVisibility): void {
    this.visibility = { ...this.visibility, [key]: !this.visibility[key] };
    this.#persist();
  }

  /** Bump a hand's turns by a signed delta (the stepper's unit), clamped 0..3.
   *  A "fl" (float) current value is treated as 0 for stepping. */
  adjustTurns(color: MotionColor, delta: number): void {
    const cur = color === MotionColor.BLUE ? this.blueTurns : this.redTurns;
    const base = cur === "fl" ? 0 : cur;
    const next = normalizeGuideCodexTurns(base + delta);
    if (color === MotionColor.BLUE) this.blueTurns = next;
    else this.redTurns = next;
    this.#persist();
  }

  /** Rotate/mirror/color-swap the WHOLE codex - composes across repeated calls. */
  applyTransform(op: CodexTransformOp): void {
    const base = this.#transformed ?? baselineMap();
    const ids = [...base.keys()];
    const arr = ids.map((id) => base.get(id)!);
    const out =
      op === "rotate"
        ? rotateAllPictographs(arr)
        : op === "mirror"
          ? mirrorAllPictographs(arr)
          : colorSwapAllPictographs(arr);
    const next = new Map<string, PictographData>();
    ids.forEach((id, i) => next.set(id, out[i]!));
    this.#transformed = next;
  }

  resetTransform(): void {
    this.#transformed = null;
  }

  get hasTransform(): boolean {
    return this.#transformed !== null;
  }

  /** Resolved pictograph for a cell id: transformed data if a transform has
   *  been applied, else the baseline dataset - always with the selected prop
   *  family applied. Returns null for an unknown id. */
  dataFor(id: string): PictographData | null {
    const base = this.#transformed?.get(id) ?? codexData(id);
    if (!base) return null;
    // Turns first (recomputes rotation/orientation off the canonical motion),
    // then re-skin with the selected prop family.
    return withPropType(withTurns(base, this.blueTurns, this.redTurns), this.propType);
  }
}

let instance: GuideCodexState | null = null;

export function getGuideCodexState(): GuideCodexState {
  return (instance ??= new GuideCodexState());
}
