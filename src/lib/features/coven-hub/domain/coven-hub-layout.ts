/** One coven's placement in the hub clearing. */
export interface CovenSlot {
  id: string;
  kind: "seed" | "satellite";
  /** Effect id for satellites; null for the seed coven. */
  effectId: string | null;
  x: number;
  z: number;
}

/** Min center-to-center spacing (meters) so coven platforms never overlap. */
const FOOTPRINT = 8;
const MIN_RING_RADIUS = 10;

/**
 * Place a seed coven at the origin and one satellite per effect on a ring
 * sized so adjacent satellites stay at least FOOTPRINT apart.
 */
export function computeCovenLayout(effectIds: readonly string[]): CovenSlot[] {
  const slots: CovenSlot[] = [
    { id: "coven-seed", kind: "seed", effectId: null, x: 0, z: 0 },
  ];
  const n = effectIds.length;
  if (n === 0) return slots;

  // chord = 2 r sin(pi/n) >= FOOTPRINT  ->  r >= FOOTPRINT / (2 sin(pi/n))
  const radius = Math.max(MIN_RING_RADIUS, FOOTPRINT / (2 * Math.sin(Math.PI / n)));

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    slots.push({
      id: `coven-${effectIds[i]}`,
      kind: "satellite",
      effectId: effectIds[i]!,
      x: Math.sin(angle) * radius,
      z: Math.cos(angle) * radius,
    });
  }
  return slots;
}
