import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from "three";

import type { EmberSceneConfig } from "../../domain/models/scene-configs";
import {
  isEmberGroundDetailSurface,
  patchEmberGroundDetailMaterial,
  type EmberGroundDetailPatch,
} from "../../scenes/ember/ember-ground-detail";
import { createEmberSurfacePlateGeometry } from "../../scenes/ember/ember-surface-plate-geometry";
import {
  createEmberHorizonApron,
  createEmberSurfaceEcology,
  createEmberTerrainHeightField,
  type EmberSurfacePlacement,
} from "../../scenes/ember/ember-surface-ecology";
import type { EmberEnvironmentAssets } from "./ember-environment-assets";

const BASIN_NODE_NAME = "Ember_Volcanic_Basin_living_caldera";
const BURIED_FISSURE_DECAL_ROLES = new Set(["cooled-fissure", "live-fissure"]);
const TREATMENT_PRECEDENCE = [
  "playableSurface",
  "mineral",
  "meshyGeology",
  "world",
] as const;
type EmberTreatmentKey = (typeof TREATMENT_PRECEDENCE)[number];
const FAMILIES = ["cold", "iron", "glass"] as const;
type EmberSurfaceFamily = (typeof FAMILIES)[number];
const COLORS: Record<EmberSurfaceFamily, string> = {
  cold: "#16191a",
  iron: "#3a1a12",
  glass: "#242b2e",
};

export interface EmberAuthoredSurfaceOptions {
  assets: EmberEnvironmentAssets;
  config: EmberSceneConfig;
  groundY: number;
  stageRadius: number;
  shadows: boolean;
  groundDetailEnabled?: boolean;
}

export interface EmberAuthoredSurface {
  object: Object3D;
  setGroundY(groundY: number): void;
  dispose(): void;
}

function resolveTreatmentKey(
  role: string | undefined,
  materialName: string
): EmberTreatmentKey {
  if (
    role === "playable-surface" ||
    role === "playable-shelf" ||
    role === "shelf-stratum" ||
    role === "stage-crust-transition"
  ) {
    return "playableSurface";
  }
  if (role?.startsWith("meshy-")) return "meshyGeology";
  if (
    materialName.includes("iron-contact") ||
    materialName.includes("windborne-ash") ||
    materialName.includes("Mineral") ||
    materialName.includes("Ash_Deposit")
  ) {
    return "mineral";
  }
  return "world";
}

function compoundedBlend(blend: number, applications: number): number {
  return 1 - Math.pow(1 - blend, applications);
}

function configureProductionSlice(
  asset: Object3D,
  config: EmberSceneConfig,
  shadows: boolean,
  valleyRock: Texture
): void {
  if (asset.getObjectByName("EMBER_Terrain")) {
    asset.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      if (child.userData.ember_backdrop === true) {
        if (child.userData.ember_distant_flow_surface === true) {
          // Keep its standard material until the shared lava owner attaches
          // the same thermal crust used upstream. Only rock uses baked colour.
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          return;
        }
        const source = mesh.material as MeshStandardMaterial;
        // Distant ridges carry baked light and haze. The near-field fog would
        // erase them, and dynamic lights/shadows buy no useful detail here.
        const backdrop = new MeshBasicMaterial({
          name: source.name,
          map: source.map,
          vertexColors: true,
          fog: false,
        });
        if (source.map) {
          // The atlas carries large-scale light. Project the existing basalt
          // texture onto all three axes so cliff faces don't stretch it.
          backdrop.onBeforeCompile = (shader) => {
            shader.uniforms.uValleyRock = { value: valleyRock };
            shader.vertexShader = shader.vertexShader
              .replace(
                "#include <common>",
                `#include <common>
varying vec3 vValleyWorld;
varying vec3 vValleyNormal;`
              )
              .replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>
vValleyWorld = (modelMatrix * vec4(position, 1.0)).xyz;
vValleyNormal = normalize(mat3(modelMatrix) * normal);`
              );
            shader.fragmentShader = shader.fragmentShader
              .replace(
                "#include <common>",
                `#include <common>
uniform sampler2D uValleyRock;
varying vec3 vValleyWorld;
varying vec3 vValleyNormal;`
              )
              .replace(
                "#include <map_fragment>",
                `#include <map_fragment>
vec3 weights = pow(abs(normalize(vValleyNormal)), vec3(4.0));
weights /= max(dot(weights, vec3(1.0)), 0.0001);
vec3 rock = texture2D(uValleyRock, vValleyWorld.yz / 24.0).rgb * weights.x
          + texture2D(uValleyRock, vValleyWorld.xz / 24.0).rgb * weights.y
          + texture2D(uValleyRock, vValleyWorld.xy / 24.0).rgb * weights.z;
float grain = clamp(dot(rock, vec3(0.2126, 0.7152, 0.0722)) * 5.5 + 0.48, 0.52, 1.45);
float detail = 0.8 * (1.0 - smoothstep(300.0, 1250.0, length(vValleyWorld.xz)));
diffuseColor.rgb *= mix(1.0, grain, detail);`
              );
          };
          backdrop.customProgramCacheKey = () => "ember-valley-basalt-r2";
        }
        mesh.material = backdrop;
        source.dispose();
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        return;
      }
      mesh.receiveShadow = true;
      // Thin surface skins receive the mountain's shadows; casting their own
      // makes the cooled plate look like a floating ledge at grazing angles.
      mesh.castShadow =
        shadows &&
        child.name !== "EMBER_Terrain" &&
        child.userData.tka_role !== "playable-surface" &&
        child.userData.tka_role !== "stage-crust-transition";
    });
    return;
  }
  const routed = new Map<
    MeshStandardMaterial,
    Map<EmberTreatmentKey, number>
  >();

  asset.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const role = child.userData.tka_role as string | undefined;
    if (role && BURIED_FISSURE_DECAL_ROLES.has(role)) {
      child.visible = false;
      return;
    }
    mesh.receiveShadow = true;
    mesh.castShadow =
      shadows &&
      role !== "playable-surface" &&
      role !== "playable-shelf" &&
      role !== "volcanic-basin" &&
      role !== "lava-channel-levee";

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const candidate of materials) {
      const material = candidate as MeshStandardMaterial;
      if (!material.isMeshStandardMaterial) continue;
      const key = resolveTreatmentKey(role, material.name);
      const counts =
        routed.get(material) ?? new Map<EmberTreatmentKey, number>();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      routed.set(material, counts);
    }
  });

  for (const [material, counts] of routed) {
    for (const key of TREATMENT_PRECEDENCE) {
      const applications = counts.get(key);
      if (!applications) continue;
      const treatment = config.atmosphere.materials[key];
      material.color.lerp(
        new Color(treatment.tint),
        compoundedBlend(treatment.tintBlend, applications)
      );
      material.emissive.lerp(
        new Color(treatment.emissive),
        compoundedBlend(treatment.emissiveBlend, applications)
      );
    }
    const dominant = TREATMENT_PRECEDENCE.find((key) => counts.has(key));
    if (!dominant) continue;
    const treatment = config.atmosphere.materials[dominant];
    material.emissiveIntensity = treatment.emissiveIntensity;
    material.roughness = Math.min(
      1,
      material.roughness * treatment.roughnessScale
    );
    material.metalness = Math.max(
      0,
      Math.min(1, material.metalness + treatment.metalnessAdd)
    );
    material.needsUpdate = true;
  }
  asset.userData.emberAtmosphereLook = config.atmosphere.id;
}

function worldHeightField(asset: Object3D, groundY: number) {
  const basin = asset.getObjectByName(BASIN_NODE_NAME) as Mesh | undefined;
  const attribute = basin?.geometry?.getAttribute("position");
  if (!basin?.isMesh || !attribute) return { basin: null, field: null };
  basin.updateWorldMatrix(true, false);
  const point = new Vector3();
  const world = new Float32Array(attribute.count * 3);
  for (let index = 0; index < attribute.count; index += 1) {
    point.fromBufferAttribute(attribute, index).applyMatrix4(basin.matrixWorld);
    world[index * 3] = point.x;
    world[index * 3 + 1] = point.y;
    world[index * 3 + 2] = point.z;
  }
  return {
    basin,
    field: createEmberTerrainHeightField(world, groundY),
  };
}

function placementsFor(
  placements: EmberSurfacePlacement[],
  family: EmberSurfaceFamily
): EmberSurfacePlacement[] {
  return placements.filter((placement) => placement.family === family);
}

function fillInstances(
  mesh: InstancedMesh,
  placements: EmberSurfacePlacement[],
  groundY: number
): void {
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const euler = new Euler();
  const scale = new Vector3();
  for (const [index, placement] of placements.entries()) {
    position.set(
      placement.position[0],
      groundY + placement.position[1],
      placement.position[2]
    );
    euler.set(...placement.rotation);
    rotation.setFromEuler(euler);
    scale.set(...placement.scale);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/** Exact baked world treatment, detail synthesis, apron, and surface ecology. */
export function createEmberAuthoredSurface(
  options: EmberAuthoredSurfaceOptions
): EmberAuthoredSurface {
  const object = options.assets.productionSlice;
  object.name ||= "ember-production-slice";
  object.position.y = options.groundY;
  object.updateWorldMatrix(true, true);
  configureProductionSlice(
    object,
    options.config,
    options.shadows,
    options.assets.detailMaps.fracturedBasalt
  );

  const patches = new Set<EmberGroundDetailPatch>();
  if (options.groundDetailEnabled !== false) {
    object.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const role = child.userData.tka_role as string | undefined;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const candidate of materials) {
        const material = candidate as MeshStandardMaterial;
        if (!material.isMeshStandardMaterial) continue;
        if (!isEmberGroundDetailSurface(role, material)) continue;
        patches.add(
          patchEmberGroundDetailMaterial(
            material,
            options.assets.detailMaps,
            options.assets.familyMask,
            options.assets.surfaceMaps,
            0.92,
            { preserveColor: material.color }
          )
        );
      }
    });
  }

  const { basin, field } = worldHeightField(object, options.groundY);
  const generated = new Group();
  if (object.getObjectByName("EMBER_Terrain")) {
    generated.name = "ember-baked-midflank-surface";
    return {
      object: generated,
      setGroundY(value) {
        object.position.y = value;
      },
      dispose() {
        for (const patch of patches) patch.dispose();
      },
    };
  }
  generated.name = "ember-surface-ecology";
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const instances: Array<{
    mesh: InstancedMesh;
    placements: EmberSurfacePlacement[];
  }> = [];

  if (field && basin) {
    const apronData = createEmberHorizonApron(field);
    const apronGeometry = new BufferGeometry();
    apronGeometry.setAttribute(
      "position",
      new BufferAttribute(apronData.positions, 3)
    );
    apronGeometry.setAttribute(
      "normal",
      new BufferAttribute(apronData.normals, 3)
    );
    apronGeometry.setAttribute("uv", new BufferAttribute(apronData.uvs, 2));
    apronGeometry.setIndex(new BufferAttribute(apronData.indices, 1));
    apronGeometry.computeBoundingSphere();
    const apron = new Mesh(apronGeometry, basin.material);
    apron.name = "ember-horizon-apron";
    apron.position.y = options.groundY;
    apron.castShadow = false;
    apron.receiveShadow = false;
    generated.add(apron);
    geometries.add(apronGeometry);
  }

  const ecology = createEmberSurfaceEcology(options.stageRadius, 9413, field);
  const plateGeometry = createEmberSurfacePlateGeometry();
  geometries.add(plateGeometry);
  for (const family of FAMILIES) {
    const rubble = placementsFor(
      [...ecology.rubble, ...ecology.outcrops],
      family
    );
    if (rubble.length > 0) {
      const geometry = new IcosahedronGeometry(1, 2);
      const material = new MeshStandardMaterial({
        color: COLORS[family],
        roughness: family === "glass" ? 0.66 : 0.92,
        metalness: family === "glass" ? 0.14 : 0.02,
        flatShading: true,
      });
      const mesh = new InstancedMesh(geometry, material, rubble.length);
      mesh.name = `ember-${family}-rubble`;
      mesh.receiveShadow = true;
      fillInstances(mesh, rubble, options.groundY);
      generated.add(mesh);
      geometries.add(geometry);
      materials.add(material);
      instances.push({ mesh, placements: rubble });
    }

    const plates = placementsFor(ecology.plates, family);
    if (plates.length > 0) {
      const material = new MeshStandardMaterial({
        color: COLORS[family],
        emissive: family === "iron" ? "#2a0904" : "#050708",
        emissiveIntensity: family === "iron" ? 0.1 : 0.025,
        roughness: family === "glass" ? 0.62 : 0.9,
        metalness: family === "glass" ? 0.18 : 0.02,
        flatShading: true,
      });
      const mesh = new InstancedMesh(plateGeometry, material, plates.length);
      mesh.name = `ember-${family}-plates`;
      mesh.receiveShadow = true;
      fillInstances(mesh, plates, options.groundY);
      generated.add(mesh);
      materials.add(material);
      instances.push({ mesh, placements: plates });
    }
  }

  let groundY = options.groundY;
  return {
    object: generated,
    setGroundY(value) {
      if (value === groundY) return;
      groundY = value;
      object.position.y = value;
      const apron = generated.getObjectByName("ember-horizon-apron");
      if (apron) apron.position.y = value;
      for (const instance of instances) {
        fillInstances(instance.mesh, instance.placements, value);
      }
    },
    dispose() {
      for (const patch of patches) patch.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      generated.clear();
    },
  };
}
