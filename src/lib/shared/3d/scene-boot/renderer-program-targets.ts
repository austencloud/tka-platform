import type { Object3D } from "three";

interface CompileTarget extends Object3D {
  geometry?: {
    attributes?: Record<string, { itemSize?: number }>;
    morphAttributes?: Record<string, unknown[]>;
  };
  instanceColor?: unknown;
  isInstancedMesh?: boolean;
  isPoints?: boolean;
  isSkinnedMesh?: boolean;
  material?: unknown | unknown[];
}

const TEXTURE_PROGRAM_FIELDS = [
  "alphaMap",
  "anisotropyMap",
  "aoMap",
  "bumpMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "displacementMap",
  "emissiveMap",
  "envMap",
  "gradientMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
  "lightMap",
  "map",
  "matcap",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "specularColorMap",
  "specularIntensityMap",
  "specularMap",
  "thicknessMap",
  "transmissionMap",
] as const;

const VALUE_PROGRAM_FIELDS = [
  "alphaHash",
  "alphaTest",
  "alphaToCoverage",
  "anisotropy",
  "blending",
  "clearcoat",
  "combine",
  "depthPacking",
  "dispersion",
  "dithering",
  "flatShading",
  "fog",
  "glslVersion",
  "iridescence",
  "normalMapType",
  "precision",
  "premultipliedAlpha",
  "sheen",
  "side",
  "sizeAttenuation",
  "toneMapped",
  "transmission",
  "transparent",
  "type",
  "vertexColors",
  "wireframe",
] as const;

function stableRecord(value: unknown): string {
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return JSON.stringify(
    Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    )
  );
}

function materialProgramSignature(material: unknown): string {
  if (!material || typeof material !== "object") return String(material);
  const candidate = material as Record<string, unknown>;
  const values = VALUE_PROGRAM_FIELDS.map((field) => candidate[field]);
  const textures = TEXTURE_PROGRAM_FIELDS.map((field) => {
    const texture = candidate[field] as { channel?: number; mapping?: number };
    return texture ? [field, texture.channel ?? 0, texture.mapping ?? 0] : null;
  });
  const customProgramCacheKey = candidate.customProgramCacheKey;
  return JSON.stringify([
    values,
    textures,
    candidate.vertexShader,
    candidate.fragmentShader,
    stableRecord(candidate.defines),
    typeof customProgramCacheKey === "function"
      ? customProgramCacheKey.call(material)
      : "",
  ]);
}

function objectProgramSignature(object: CompileTarget): string | null {
  if (!object.material) return null;
  const materials = Array.isArray(object.material)
    ? object.material
    : [object.material];
  const attributes = object.geometry?.attributes ?? {};
  const morphAttributes = object.geometry?.morphAttributes ?? {};
  return JSON.stringify([
    materials.map(materialProgramSignature),
    Object.keys(attributes).sort(),
    attributes.color?.itemSize ?? 0,
    Object.entries(morphAttributes)
      .map(([name, values]) => [name, values.length])
      .sort(([left], [right]) => String(left).localeCompare(String(right))),
    object.isInstancedMesh === true,
    object.instanceColor != null,
    object.isPoints === true,
    object.isSkinnedMesh === true,
  ]);
}

/**
 * Finds one object for each shader program shape the renderer will need.
 * Keeping this signature owner shared prevents the main-thread and worker
 * warm-up paths from silently compiling different subsets of the same scene.
 */
export function collectUniqueCompileTargets(root: Object3D): Object3D[] {
  const signatures = new Set<string>();
  const targets: Object3D[] = [];
  root.traverse((object) => {
    const signature = objectProgramSignature(object as CompileTarget);
    if (!signature || signatures.has(signature)) return;
    signatures.add(signature);
    targets.push(object);
  });
  return targets;
}
