/**
 * Guide Codex live state — the shared reactive source of truth for the
 * interactive Codex reader page (GuideCodexPage.svelte) and its companion
 * controls (GuideCodexControls.svelte). The PAGE renders the printable sheet
 * from this state; the COMPANION's controls mutate it. Neither owns the
 * other — both read/write the same module-level singleton (the factory +
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
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
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
  type GuideCodexVisibility,
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

/** Every cell id across both printed sheets — the transform's working set. */
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

class GuideCodexState {
  propType = $state<PropType>(defaultGuideCodexPrefs().propType);
  visibility = $state<GuideCodexVisibility>(defaultGuideCodexPrefs().visibility);
  #transformed = $state<Map<string, PictographData> | null>(null);

  constructor() {
    this.#restore();
  }

  #restore(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const prefs = restoreGuideCodexPrefs(localStorage.getItem(GUIDE_CODEX_STORAGE_KEY));
      this.propType = prefs.propType;
      this.visibility = prefs.visibility;
    } catch {
      // private mode / quota — fall back to defaults, not worth surfacing
    }
  }

  #persist(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(
        GUIDE_CODEX_STORAGE_KEY,
        serializeGuideCodexPrefs({
          version: 2,
          propType: this.propType,
          visibility: $state.snapshot(this.visibility),
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

  /** Rotate/mirror/color-swap the WHOLE codex — composes across repeated calls. */
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
   *  been applied, else the baseline dataset — always with the selected prop
   *  family applied. Returns null for an unknown id. */
  dataFor(id: string): PictographData | null {
    const base = this.#transformed?.get(id) ?? codexData(id);
    if (!base) return null;
    return withPropType(base, this.propType);
  }
}

let instance: GuideCodexState | null = null;

export function getGuideCodexState(): GuideCodexState {
  return (instance ??= new GuideCodexState());
}
