import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { calculate as calculateMandalaGeometry } from "$lib/shared/mandala/services/mandala-geometry-calculator";
import {
  getTipPoints,
  type TipPoint,
} from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import { getDefaultTrailPointConfig } from "$lib/shared/animation-engine/domain/types/trail-point-types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { resolveRotationStyleArchetypes } from "./rotation-style-archetypes";
import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { buildFlowerSequence } from "$lib/features/lab/vtg-lab/services/build-flower-sequence";
import {
  buildShapeMatrixAxis,
  flowerKey,
  type Flower,
} from "../domain/flower-signature";
import { resolveFlowerArchetype } from "./flower-archetype";

export interface ShapeMatrixData {
  axis: Flower[];
  /** flowerKey → blue-hand MandalaPaths (its .blue populated). */
  left: Map<string, MandalaPaths>;
  /** flowerKey → red-hand MandalaPaths (its .red populated). */
  right: Map<string, MandalaPaths>;
  propType?: PropType;
  /** Canonical single tracked source used by paths, parity, and live trails. */
  tipPoint?: TipPoint;
  /** Radial reach retained for the existing canvas painters. */
  clubTipDx: number;
}

const cache = new Map<PropType, Promise<ShapeMatrixData>>();

class LazyPathMap extends Map<string, MandalaPaths> {
  constructor(
    private readonly resolvePath: (key: string) => MandalaPaths | undefined
  ) {
    super();
  }

  override get(key: string): MandalaPaths | undefined {
    const cached = super.get(key);
    if (cached) return cached;

    const resolved = this.resolvePath(key);
    if (resolved) super.set(key, resolved);
    return resolved;
  }
}

export function loadShapeMatrix(
  propType: PropType = PropType.STAFF
): Promise<ShapeMatrixData> {
  const cached = cache.get(propType);
  if (cached) return cached;
  const pending = build(propType);
  cache.set(propType, pending);
  return pending;
}

export function shapeMatrixTipPoint(propType: PropType): TipPoint | null {
  const points = getTipPoints(propType).points;
  const source = getDefaultTrailPointConfig(propType, points).right;
  if (source.type === "tip") return points[source.index] ?? null;
  if (source.type === "custom") return { dx: source.dx, dy: source.dy };
  return null;
}

async function build(propType: PropType): Promise<ShapeMatrixData> {
  const [matrices, edges] = await Promise.all([
    resolveRotationStyleArchetypes("diamond"),
    loadDiamondEdges(),
  ]);
  const proArch = resolveFlowerArchetype(matrices, "pro");
  const antiArch = resolveFlowerArchetype(matrices, "anti");
  const tip = shapeMatrixTipPoint(propType);
  if (!tip)
    throw new Error(`Prop ${propType} has no tracked Shape Matrix source`);
  const clubTipDx = Math.hypot(tip.dx, tip.dy);

  const axis = buildShapeMatrixAxis();
  const flowerByKey = new Map(
    axis.map((flower) => [flowerKey(flower), flower])
  );
  const canonicalPaths = new Map<string, MandalaPaths>();
  const pathsFor = (key: string): MandalaPaths | undefined => {
    const cached = canonicalPaths.get(key);
    if (cached) return cached;

    const f = flowerByKey.get(key);
    if (!f) return undefined;
    const startedAt = import.meta.env.DEV ? performance.now() : 0;
    const arch = f.style === "anti" ? antiArch : proArch;
    // ONE canonical locus per flower descriptor (computed from the left hand),
    // reused on both axes so the row header, the column header, and the diagonal
    // cell are geometrically identical — only the stroke color differs.
    // Computing the right axis from its own hand point-reflects the shape (the
    // hands are anchored at opposite points), which desyncs the two axes and
    // stops the diagonal from overlapping into a clean purple pictograph.
    const seq = buildFlowerSequence(arch, f, "left", edges, propType);
    const paths = calculateMandalaGeometry(
      seq.steps,
      undefined,
      undefined,
      { tipEnds: 1, pathShape: "arc" },
      tip
    );
    canonicalPaths.set(key, paths);
    if (import.meta.env.DEV) {
      performance.measure(`shape-matrix:path:${propType}:${key}`, {
        start: startedAt,
        end: performance.now(),
      });
    }
    return paths;
  };

  // The explorer only displays one turn band per axis. Materializing all 108
  // descriptors here made every cold visit pay for paths the user might never
  // open. These maps retain the same geometry owner while computing a flower
  // on first use and sharing that locus between the blue and red axes.
  const left = new LazyPathMap(pathsFor);
  const right = new LazyPathMap((key) => {
    const paths = pathsFor(key);
    return paths ? { left: [], right: paths.left, purple: [] } : undefined;
  });

  return { axis, left, right, propType, tipPoint: tip, clubTipDx };
}
