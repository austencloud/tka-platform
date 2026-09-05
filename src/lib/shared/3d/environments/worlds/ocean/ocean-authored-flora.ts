import {
  Box3,
  Mesh,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  type Camera,
  type InstancedMesh,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
} from "three";
import {
  createInstanceFrustumCuller,
  type InstanceFrustumCullingStats,
} from "../../../rendering/instance-frustum-culling";
import { patchCausticsMaterial } from "../../scenes/ocean/runtime/atmosphere/seabed-caustics";

const SWAY_STRENGTH = 0.18;
const TALL_REF = 3;
const SWAY_ASPECT_MIN = 1.4;
const CURRENT_DIR = new Vector2(0.8, 0.6).normalize();

interface SwayUniforms {
  uTime: { value: number };
  uGroundY: { value: number };
  uTallRef: { value: number };
  uSwayStrength: { value: number };
  uCurrentDir: { value: Vector2 };
}

export interface OceanAuthoredFloraController {
  object: Object3D;
  update(delta: number, camera: Camera): InstanceFrustumCullingStats;
  setGroundY(groundY: number): void;
  setSwayEnabled(enabled: boolean): void;
  dispose(): void;
}

function patchSwayMaterial(
  material: MeshStandardMaterial,
  uniforms: SwayUniforms,
): SwayUniforms {
  if (material.userData.swayPatched) {
    return material.userData.swayUniforms as SwayUniforms;
  }
  material.userData.swayPatched = true;
  material.userData.swayUniforms = uniforms;

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uGroundY = uniforms.uGroundY;
    shader.uniforms.uTallRef = uniforms.uTallRef;
    shader.uniforms.uSwayStrength = uniforms.uSwayStrength;
    shader.uniforms.uCurrentDir = uniforms.uCurrentDir;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      /* glsl */ `#include <common>
        uniform float uTime;
        uniform float uGroundY;
        uniform float uTallRef;
        uniform float uSwayStrength;
        uniform vec2 uCurrentDir;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `#include <begin_vertex>
        {
          vec3 worldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          float w = smoothstep(uGroundY, uGroundY + uTallRef, worldPos.y);
          float phase = dot(worldPos.xz, uCurrentDir);
          float primary = sin(uTime * 0.6 + phase * 0.35);
          float flutter = sin(uTime * 1.9 + phase * 0.9) * 0.25;
          float swayAmt = (primary + flutter) * w * uSwayStrength;
          vec3 worldOffset = vec3(
            uCurrentDir.x * swayAmt,
            abs(swayAmt) * 0.12,
            uCurrentDir.y * swayAmt
          );
          mat3 m3 = mat3(modelMatrix);
          vec3 invSq = vec3(
            1.0 / max(dot(m3[0], m3[0]), 1e-6),
            1.0 / max(dot(m3[1], m3[1]), 1e-6),
            1.0 / max(dot(m3[2], m3[2]), 1e-6)
          );
          vec3 objOffset = (transpose(m3) * worldOffset) * invSq;
          transformed += objOffset;
        }`,
    );
  };
  material.needsUpdate = true;
  return uniforms;
}

/**
 * Applies the exact production Ocean flora behavior to an authored GLB graph.
 * Loading stays with each renderer; sway, caustics, shadow policy, and culling
 * live here so main-thread and worker worlds cannot diverge.
 */
export function createOceanAuthoredFloraController(
  scene: Object3D,
  options: { groundY: number; swayEnabled?: boolean },
): OceanAuthoredFloraController {
  let swayUniforms: SwayUniforms = {
    uTime: { value: 0 },
    uGroundY: { value: options.groundY },
    uTallRef: { value: TALL_REF },
    uSwayStrength: {
      value: options.swayEnabled === false ? 0 : SWAY_STRENGTH,
    },
    uCurrentDir: { value: CURRENT_DIR },
  };
  const box = new Box3();
  const size = new Vector3();

  scene.updateWorldMatrix(true, true);
  scene.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;

    box.setFromObject(mesh);
    box.getSize(size);
    const footprint = Math.max(size.x, size.z);
    const aspect = box.isEmpty()
      ? 0
      : footprint > 1e-6
        ? size.y / footprint
        : Number.POSITIVE_INFINITY;
    const isPlant = aspect >= SWAY_ASPECT_MIN;
    const isInstanced = (mesh as InstancedMesh).isInstancedMesh === true;
    mesh.castShadow = !isInstanced && mesh.name !== "Seabed";
    mesh.receiveShadow = true;

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.envMapIntensity = 1;
      if (isPlant) swayUniforms = patchSwayMaterial(material, swayUniforms);
      patchCausticsMaterial(material);
    }
  });

  const culler = createInstanceFrustumCuller(scene);

  return {
    object: scene,
    update(delta, camera) {
      swayUniforms.uTime.value += delta;
      return culler.update(camera);
    },
    setGroundY(groundY) {
      swayUniforms.uGroundY.value = groundY;
    },
    setSwayEnabled(enabled) {
      swayUniforms.uSwayStrength.value = enabled ? SWAY_STRENGTH : 0;
    },
    dispose() {
      culler.restore();
    },
  };
}

/** Exact production shadow, IBL, and caustic policy for the seabed GLB. */
export function enhanceOceanSeabed(
  scene: Object3D,
  options: { enableCaustics: boolean },
): void {
  scene.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.envMapIntensity = 1;
      if (options.enableCaustics) patchCausticsMaterial(material);
    }
  });
}
