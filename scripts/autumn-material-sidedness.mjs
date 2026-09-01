/** Opaque, closed, outward-wound solids proven safe for front-side rasterization. */
export const AUTUMN_FRONT_SIDE_MATERIAL_PREFIXES = [
  "Autumn Living Forest Floor",
  "Autumn Fog Apron",
  "Damp Pond Bank",
  "Autumn Woodland Cabin PBR",
  "Autumn Fallen Log PBR",
  "Autumn Rounded Rock PBR",
  "Autumn Field Stone PBR",
  "Autumn Boulder PBR",
  "Autumn Owl PBR",
];

export function isAutumnFrontSideMaterial(name) {
  return AUTUMN_FRONT_SIDE_MATERIAL_PREFIXES.some((prefix) =>
    name.startsWith(prefix)
  );
}
