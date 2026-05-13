export interface Point2D {
  x: number;
  y: number;
}

export function computeTargetRotation(
  leftProp: Point2D,
  rightProp: Point2D,
  bodyCenter: Point2D,
  behindThreshold: number,
): number | null {
  const lBehind = leftProp.y > bodyCenter.y + behindThreshold;
  const rBehind = rightProp.y > bodyCenter.y + behindThreshold;

  if (lBehind && rBehind) return null;

  let mx: number, my: number;
  if (lBehind) {
    mx = rightProp.x;
    my = rightProp.y;
  } else if (rBehind) {
    mx = leftProp.x;
    my = leftProp.y;
  } else {
    mx = (leftProp.x + rightProp.x) / 2;
    my = (leftProp.y + rightProp.y) / 2;
  }

  const dx = mx - bodyCenter.x;
  const dy = my - bodyCenter.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 0;
  const angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  return Math.max(-90, Math.min(90, angle));
}

export function stepRotation(
  current: number,
  target: number,
  maxSpeed: number,
): number {
  let diff = target - current;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;

  if (Math.abs(diff) <= maxSpeed) return target;
  return current + Math.sign(diff) * maxSpeed;
}
