export function detectPlaneSplit(
  leftPropY: number,
  rightPropY: number,
  bodyCenterY: number,
  threshold: number,
): boolean {
  return leftPropY > bodyCenterY + threshold || rightPropY > bodyCenterY + threshold;
}
