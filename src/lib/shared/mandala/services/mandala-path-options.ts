import type { MandalaPathShape } from "../domain/mandala-types";
import type { MandalaPathOptions } from "./types";

export function getMandalaPathOptions(
  shape: MandalaPathShape,
  tipEnds?: 1 | 2
): MandalaPathOptions | undefined {
  const options: MandalaPathOptions = {};

  if (shape === "hybrid") options.motionAware = true;
  else if (shape !== "arc") options.pathShape = shape;
  if (tipEnds === 1) options.tipEnds = 1;

  return Object.keys(options).length > 0 ? options : undefined;
}
