import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { calculate as calculateMandalaGeometry } from "$lib/shared/mandala/services/mandala-geometry-calculator";
import { getTipPoints } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import { resolveRotationStyleMatrices } from "./resolve-rotation-style-matrices";
import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { buildFlowerSequence } from "./build-flower-sequence";
import { buildFlowerAxis, flowerKey, type Flower } from "../domain/flower-signature";

export interface ShapeMatrixData {
  axis: Flower[];
  /** flowerKey → blue-hand MandalaPaths (its .blue populated). */
  blue: Map<string, MandalaPaths>;
  /** flowerKey → red-hand MandalaPaths (its .red populated). */
  red: Map<string, MandalaPaths>;
  clubTipDx: number;
}

let cache: Promise<ShapeMatrixData> | null = null;

export function loadShapeMatrix(): Promise<ShapeMatrixData> {
  if (!cache) cache = build();
  return cache;
}

async function build(): Promise<ShapeMatrixData> {
  const [matrices, edges] = await Promise.all([
    resolveRotationStyleMatrices("diamond"),
    loadDiamondEdges(),
  ]);
  const archetypeFor = (style: "pro" | "anti") => {
    const id = style === "pro" ? "iso" : "antispin";
    const m = matrices.find((x) => x.style === id);
    if (!m) throw new Error(`no ${id} archetype matrix`);
    const base = m.byTurn.get("0|0");
    if (!base) throw new Error(`no 0-turn rep for ${id}`);
    return base;
  };
  const proArch = archetypeFor("pro");
  const antiArch = archetypeFor("anti");
  const clubTipDx = getTipPoints("club").points[0]?.dx ?? 130;
  const tip = { dx: clubTipDx, dy: 0 };

  const axis = buildFlowerAxis();
  const blue = new Map<string, MandalaPaths>();
  const red = new Map<string, MandalaPaths>();

  for (const f of axis) {
    const arch = f.style === "pro" ? proArch : antiArch;
    // ONE canonical locus per flower descriptor (computed from the blue hand),
    // reused on both axes so the row header, the column header, and the diagonal
    // cell are geometrically identical — only the stroke color differs.
    // Computing the red axis from its own hand point-reflects the shape (the
    // hands are anchored at opposite points), which desyncs the two axes and
    // stops the diagonal from overlapping into a clean purple pictograph.
    const seq = buildFlowerSequence(arch, f, "blue", edges);
    const paths = calculateMandalaGeometry(seq.steps, undefined, undefined, { tipEnds: 1, pathShape: "arc" }, tip);
    blue.set(flowerKey(f), paths);
    red.set(flowerKey(f), { blue: [], red: paths.blue, purple: [] });
  }
  return { axis, blue, red, clubTipDx };
}
