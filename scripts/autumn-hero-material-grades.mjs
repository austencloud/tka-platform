/**
 * Foreground tree families share geometry detail, not source photography.
 * Hero B's pale neutral atlas needs a stronger copper factor than Hero A's
 * naturally red atlas or adjacent trees look as though they occupy different
 * lighting conditions.
 */
export const AUTUMN_HERO_MATERIAL_GRADES = Object.freeze({
  heroA: Object.freeze({
    prefix: "Autumn Hero A PBR",
    tint: Object.freeze([0.84, 0.89, 0.97, 1.0]),
    normalScale: 0.76,
    roughnessFloor: 0.76,
  }),
  heroB: Object.freeze({
    prefix: "Autumn Hero B PBR",
    tint: Object.freeze([0.82, 0.56, 0.34, 1.0]),
    normalScale: 0.72,
    roughnessFloor: 0.8,
  }),
});
