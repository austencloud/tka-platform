import {
  InstancedMesh,
  ShaderMaterial,
  Color,
  Vector3,
  Object3D,
  InstancedBufferAttribute,
  DoubleSide,
  type BufferGeometry,
  type Texture,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { LOCOMOTION_PARAMS, LocomotionMode } from "./fish-locomotion";
import type { FishSpeciesConfig } from "./fish-species";
import vertexShader from "../../../shaders/fish/fish-vertex.vert?raw";
import fragmentShader from "../../../shaders/fish/fish-fragment.frag?raw";


export interface ExtractedModel {
  geometry: BufferGeometry;
  diffuseMap: Texture | null;
}


export interface FishRenderSystem {
  meshes: InstancedMesh[];
  materials: ShaderMaterial[];
  materialSizeMults: number[];
  gltfLoader: GLTFLoader;
  modelCache: Map<string, ExtractedModel>;
  loadModels(
    species: FishSpeciesConfig[],
    modelBasePath: string
  ): Promise<{ species: FishSpeciesConfig; model: ExtractedModel | null }[]>;
  createResidentMeshes(
    loadedResults: { species: FishSpeciesConfig; model: ExtractedModel }[],
    texSize: number,
    targetSize: number,
    sMax: number,
    positionTex: Texture | null,
    velocityTex: Texture | null,
    stateTex: Texture | null
  ): void;
  createVisitorMesh(
    sp: FishSpeciesConfig,
    model: ExtractedModel,
    slotStart: number,
    slotCount: number,
    texSize: number,
    targetSize: number,
    sMax: number,
    positionTex: Texture | null,
    velocityTex: Texture | null,
    stateTex: Texture | null
  ): { mesh: InstancedMesh; material: ShaderMaterial };
  updateTextures(
    positionTex: Texture,
    velocityTex: Texture,
    stateTex: Texture,
    elapsed: number,
    targetSize: number
  ): void;
  createCPUFallback(
    loadedResults: { species: FishSpeciesConfig; model: ExtractedModel }[],
    targetSize: number,
    groundY: number
  ): InstancedMesh[];
  dispose(): void;
}


function normalizeGeometry(geo: BufferGeometry): BufferGeometry {
  geo.computeBoundingBox();
  const size = new Vector3();
  geo.boundingBox!.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0.001) geo.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);
  geo.computeBoundingBox();
  const center = new Vector3();
  geo.boundingBox!.getCenter(center);
  geo.translate(-center.x, -center.y, -center.z);
  return geo;
}

function reorientToZ(geo: BufferGeometry): BufferGeometry {
  geo.computeBoundingBox();
  const size = new Vector3();
  geo.boundingBox!.getSize(size);
  if (size.x > size.z && size.x >= size.y) {
    geo.rotateY(-Math.PI / 2);
  } else if (size.y > size.z && size.y > size.x) {
    geo.rotateX(Math.PI / 2);
  }
  return geo;
}

function extractModel(scene: import("three").Group): ExtractedModel | null {
  let geo: BufferGeometry | null = null;
  let diffuseMap: Texture | null = null;
  scene.traverse((child: any) => {
    if (!child.isMesh) return;
    if (!geo) geo = child.geometry.clone();
    if (!diffuseMap && child.material) {
      const mat = Array.isArray(child.material)
        ? child.material[0]
        : child.material;
      if (mat?.map) diffuseMap = mat.map;
    }
  });
  if (geo) {
    (geo as BufferGeometry).morphAttributes = {};
    (geo as BufferGeometry).morphTargetsRelative = false;
  }
  return geo ? { geometry: geo, diffuseMap } : null;
}

const sharedFishModelPromises = new Map<
  string,
  Promise<ExtractedModel | null>
>();

function loadSharedFishModel(
  loader: GLTFLoader,
  url: string
): Promise<ExtractedModel | null> {
  const existing = sharedFishModelPromises.get(url);
  if (existing) return existing;

  const pending = new Promise<ExtractedModel | null>((resolve) => {
    loader.load(
      url,
      (gltf) => {
        const model = extractModel(gltf.scene);
        if (model) {
          normalizeGeometry(model.geometry);
          reorientToZ(model.geometry);
        }
        resolve(model);
      },
      undefined,
      () => resolve(null)
    );
  }).then((model) => {
    if (!model) sharedFishModelPromises.delete(url);
    return model;
  });
  sharedFishModelPromises.set(url, pending);
  return pending;
}

function getLocoUniforms(
  mode: LocomotionMode
): Record<string, { value: number }> {
  const p = LOCOMOTION_PARAMS[mode];
  return {
    uSwimFreq: { value: p.swimFreq },
    uWaveK: { value: p.waveK },
    uBaseAmplitude: { value: p.baseAmplitude },
    uStiffness: { value: p.stiffness },
    uAmpExponent: { value: p.ampExponent },
    uStrideAmp: { value: p.strideAmp },
    uRollAmp: { value: p.rollAmp },
    uPectoralFreq: { value: p.pectoralFreq },
    uPectoralAmp: { value: p.pectoralAmp },
  };
}

function createFishMaterial(
  sp: FishSpeciesConfig,
  diffuse: Texture | null,
  targetSize: number,
  sMax: number,
  positionTex: Texture | null,
  velocityTex: Texture | null,
  stateTex: Texture | null
): ShaderMaterial {
  const roughness =
    sp.trophicRole <= 1
      ? 0.3
      : sp.locomotionMode === LocomotionMode.Ostraciiform
        ? 0.6
        : 0.5;

  return new ShaderMaterial({
    uniforms: {
      tPosition: { value: positionTex },
      tVelocity: { value: velocityTex },
      tState: { value: stateTex },
      uSize: { value: targetSize * sp.sizeScale },
      uTime: { value: 0 },
      uMaxSpeed: { value: sMax },
      uWorldOffset: { value: new Vector3() },
      ...getLocoUniforms(sp.locomotionMode),
      tAlbedo: { value: diffuse },
      uFallbackColor: { value: new Color("#5599bb") },
      uHasTexture: { value: diffuse ? 1.0 : 0.0 },
      uLightDir: { value: new Vector3(0.3, 1.0, 0.2).normalize() },
      uAmbient: { value: 0.55 },
      uRoughness: { value: roughness },
      uFogColor: { value: new Color("#1a3040") },
      uFogNear: { value: 15 },
      uFogFar: { value: 25 },
    },
    vertexShader,
    fragmentShader,
    side: DoubleSide,
  });
}


export function createFishRenderSystem(): FishRenderSystem {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  const modelCache = new Map<string, ExtractedModel>();

  const meshes: InstancedMesh[] = [];
  const materials: ShaderMaterial[] = [];
  const materialSizeMults: number[] = [];

  const system: FishRenderSystem = {
    meshes,
    materials,
    materialSizeMults,
    gltfLoader,
    modelCache,

    async loadModels(species, modelBasePath) {
      return Promise.all(
        species.map(async (sp) => {
          const local = modelCache.get(sp.modelFile);
          if (local) return { species: sp, model: local };

          const model = await loadSharedFishModel(
            gltfLoader,
            modelBasePath + sp.modelFile
          );
          if (model) modelCache.set(sp.modelFile, model);
          return { species: sp, model };
        })
      );
    },

    createResidentMeshes(
      loadedResults,
      texSize,
      targetSize,
      sMax,
      positionTex,
      velocityTex,
      stateTex
    ) {
      let fishOffset = 0;
      for (let s = 0; s < loadedResults.length; s++) {
        const { species: sp, model } = loadedResults[s]!;
        const sCount = sp.instanceCount;
        if (sCount <= 0) continue;

        const geo = model.geometry.clone();

        const refs = new Float32Array(sCount * 2);
        for (let i = 0; i < sCount; i++) {
          const globalIdx = fishOffset + i;
          const col = globalIdx % texSize;
          const row = Math.floor(globalIdx / texSize);
          refs[i * 2 + 0] = (col + 0.5) / texSize;
          refs[i * 2 + 1] = (row + 0.5) / texSize;
        }
        geo.setAttribute("aReference", new InstancedBufferAttribute(refs, 2));

        const mat = createFishMaterial(
          sp,
          model.diffuseMap,
          targetSize,
          sMax,
          positionTex,
          velocityTex,
          stateTex
        );
        const mesh = new InstancedMesh(geo, mat, sCount);
        mesh.frustumCulled = false;

        meshes.push(mesh);
        materials.push(mat);
        materialSizeMults.push(sp.sizeScale);
        fishOffset += sCount;
      }
    },

    createVisitorMesh(
      sp,
      model,
      slotStart,
      slotCount,
      texSize,
      targetSize,
      sMax,
      positionTex,
      velocityTex,
      stateTex
    ) {
      const geo = model.geometry.clone();
      const refs = new Float32Array(slotCount * 2);
      for (let i = 0; i < slotCount; i++) {
        const globalIdx = slotStart + i;
        const col = globalIdx % texSize;
        const row = Math.floor(globalIdx / texSize);
        refs[i * 2 + 0] = (col + 0.5) / texSize;
        refs[i * 2 + 1] = (row + 0.5) / texSize;
      }
      geo.setAttribute("aReference", new InstancedBufferAttribute(refs, 2));

      const mat = createFishMaterial(
        sp,
        model.diffuseMap,
        targetSize,
        sMax,
        positionTex,
        velocityTex,
        stateTex
      );
      const mesh = new InstancedMesh(geo, mat, slotCount);
      mesh.frustumCulled = false;
      return { mesh, material: mat };
    },

    updateTextures(positionTex, velocityTex, stateTex, elapsed, targetSize) {
      for (let mi = 0; mi < materials.length; mi++) {
        const mat = materials[mi]!;
        mat.uniforms.tPosition!.value = positionTex;
        mat.uniforms.tVelocity!.value = velocityTex;
        mat.uniforms.tState!.value = stateTex;
        mat.uniforms.uTime!.value = elapsed;
        mat.uniforms.uSize!.value = targetSize * (materialSizeMults[mi] ?? 1.0);
      }
    },

    createCPUFallback(loadedResults, targetSize, groundY) {
      const FALLBACK_COUNT = 20;
      const firstModel = loadedResults[0]?.model;
      if (!firstModel) return [];

      const geo = firstModel.geometry.clone();
      const mat = new ShaderMaterial({
        uniforms: {
          tPosition: { value: null },
          tVelocity: { value: null },
          uSize: { value: targetSize * 0.5 },
          uTime: { value: 0 },
          uMaxSpeed: { value: 1.0 },
          uWorldOffset: { value: new Vector3() },
          ...getLocoUniforms(LocomotionMode.Carangiform),
          tAlbedo: { value: firstModel.diffuseMap },
          uFallbackColor: { value: new Color("#5599bb") },
          uHasTexture: { value: firstModel.diffuseMap ? 1.0 : 0.0 },
          uLightDir: { value: new Vector3(0.3, 1.0, 0.2).normalize() },
          uAmbient: { value: 0.55 },
          uRoughness: { value: 0.5 },
          uFogColor: { value: new Color("#1a3040") },
          uFogNear: { value: 15 },
          uFogFar: { value: 25 },
        },
        vertexShader,
        fragmentShader,
        side: DoubleSide,
      });

      const mesh = new InstancedMesh(geo, mat, FALLBACK_COUNT);
      mesh.frustumCulled = false;

      const dummy = new Object3D();
      for (let i = 0; i < FALLBACK_COUNT; i++) {
        const angle = (i / FALLBACK_COUNT) * Math.PI * 2;
        const radius = 8 + Math.random() * 10;
        const height = groundY + 2 + Math.random() * 4;
        dummy.position.set(
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius
        );
        dummy.lookAt(
          Math.cos(angle + 0.1) * radius,
          height,
          Math.sin(angle + 0.1) * radius
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;

      return [mesh];
    },

    dispose() {
      for (const mat of materials) mat.dispose();
      for (const m of meshes) {
        m.geometry.dispose();
        m.dispose();
      }
      meshes.length = 0;
      materials.length = 0;
      materialSizeMults.length = 0;
    },
  };

  return system;
}
