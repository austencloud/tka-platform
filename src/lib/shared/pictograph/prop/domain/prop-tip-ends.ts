import { PropType } from "./enums/prop-type";

/**
 * Props with TWO mirror-symmetric tracked ends — both prop tips trace a tip
 * path in the mandala. Everything else is single-ended: one weighted/grip tip.
 *
 * The staff family is the canonical two-ended prop; buugeng (S-staff), big
 * chicken, doublestar, eightrings, and double contact ball are the other
 * twin-ended, point-symmetric families. Regular (small) chicken is
 * single-ended — only BIG chicken presents two symmetric ends. Clubs, fans,
 * triads, hoops, hands, swords, etc. trace a single tip. Add a prop here only
 * if it genuinely presents two symmetric ends to track.
 */
const TWO_ENDED_PROPS: ReadonlySet<PropType> = new Set([
  PropType.STAFF,
  PropType.SIMPLESTAFF,
  PropType.BIGSTAFF,
  PropType.STAFF2,
  PropType.BUUGENG,
  PropType.BIGBUUGENG,
  PropType.BIGCHICKEN,
  PropType.DOUBLESTAR,
  PropType.BIGDOUBLESTAR,
  PropType.EIGHTRINGS,
  PropType.BIGEIGHTRINGS,
  PropType.DOUBLECONTACTBALL,
  PropType.BIGDOUBLECONTACTBALL,
]);

/**
 * How many prop tips the mandala traces for a prop: 2 = staff-like (both ends),
 * 1 = club-like (one end). Undefined defaults to 2 — staff is TKA's canonical
 * prop, so an unspecified prop keeps the historical two-tip render.
 */
export function propTipEnds(propType: PropType | string | undefined): 1 | 2 {
  if (!propType) return 2;
  return TWO_ENDED_PROPS.has(propType as PropType) ? 2 : 1;
}

/**
 * Tip count for a blue/red hand pair. The geometry calculator applies one tip
 * count to BOTH hands, so a pair is two-ended if EITHER hand carries a
 * two-ended prop (the staff hand's second tip is preserved; a same-prop pair —
 * two clubs or two staves — resolves cleanly to 1 or 2).
 */
export function pairTipEnds(
  blue: PropType | string | undefined,
  red: PropType | string | undefined,
): 1 | 2 {
  return propTipEnds(blue) === 2 || propTipEnds(red) === 2 ? 2 : 1;
}
