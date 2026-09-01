import { Color, MeshPhysicalMaterial, Vector2, type Texture } from "three";

const WATER_BODY_COLOR = "#283650";

/**
 * Owns the authored Autumn pond surface response.
 *
 * A non-zero physical transmission value makes Three render every opaque
 * object a second time before drawing the pond. The recessed basin already
 * supplies the visible bed through this alpha-blended surface, so transmission
 * adds a full-scene render without adding information the shot needs.
 */
export function createAutumnPondSurfaceMaterial(
  bodyNormal: Texture,
  coatNormal: Texture
): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: new Color(WATER_BODY_COLOR),
    emissive: new Color("#0b1d2d"),
    emissiveIntensity: 0.18,
    roughness: 0.46,
    metalness: 0.04,
    transparent: true,
    opacity: 0.76,
    transmission: 0,
    clearcoat: 0.1,
    clearcoatRoughness: 0.48,
    specularIntensity: 0.24,
    specularColor: new Color("#7786a8"),
    normalMap: bodyNormal,
    normalScale: new Vector2(0.16, 0.16),
    clearcoatNormalMap: coatNormal,
    clearcoatNormalScale: new Vector2(0.08, 0.08),
    envMapIntensity: 0.25,
    depthWrite: false,
  });
}
