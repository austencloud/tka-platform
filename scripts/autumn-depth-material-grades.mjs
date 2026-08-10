/**
 * Imported tree families that only appear outside the hero ring.
 *
 * Their source textures came from different asset packs. Neutral factors let
 * the violet moon wash those textures toward silver, making the middle grove
 * look borrowed from the Winter scene. These grades retain each texture and
 * normal map while placing every family in one restrained Autumn depth range.
 */
export const AUTUMN_DEPTH_MATERIAL_GRADES = Object.freeze({
  birch: Object.freeze({
    prefix: "Autumn Birch PBR",
    tint: Object.freeze([0.82, 0.5, 0.3, 1.0]),
    normalScale: 0.64,
    roughnessFloor: 0.84,
  }),
  larch: Object.freeze({
    prefix: "Autumn Larch PBR",
    tint: Object.freeze([1.0, 0.62, 0.28, 1.0]),
    normalScale: 0.66,
    roughnessFloor: 0.84,
  }),
  snag: Object.freeze({
    prefix: "Autumn Snag PBR",
    tint: Object.freeze([0.48, 0.34, 0.38, 1.0]),
    normalScale: 0.58,
    roughnessFloor: 0.88,
  }),
  willow: Object.freeze({
    prefix: "Autumn Willow PBR",
    tint: Object.freeze([0.68, 0.56, 0.32, 1.0]),
    normalScale: 0.62,
    roughnessFloor: 0.86,
  }),
});

