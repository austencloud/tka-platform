<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import {
    InstancedMesh,
    ShaderMaterial,
    Color,
    Vector3,
    Matrix4,
    Object3D,
    InstancedBufferAttribute,
    DoubleSide,
    DataTexture,
    Data3DTexture,
    FloatType,
    HalfFloatType,
    RedFormat,
    RGBAFormat,
    LinearFilter,
    type BufferGeometry,
    type Texture,
  } from 'three';
  import type { ReefSDFData } from './ReefStructures.svelte';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
  import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
  import { FishEventSystem, type FishEventUniforms } from './FishEventSystem';
  import { RESIDENT_SPECIES, RESIDENT_FISH_COUNT, ALL_SPECIES, THREAT_MATRIX, HUNT_MATRIX, type FishSpeciesConfig } from './fish-species-config';
  import { LOCOMOTION_PARAMS, LocomotionMode } from './fish-locomotion-params';
  import { SpeciesRotationManager, type VisitorGroup } from './SpeciesRotationManager';
  import { velocityShader, positionShader, renderVertexShader, renderFragmentShader } from './fish-shaders';
  import { stateShader } from './fish-behavior-shader';
  import { userProportionsState } from '@austencloud/scene-3d';

  interface Props {
    targetSize?: number;
    swimHeight?: [number, number];
    speed?: [number, number];
    stageRadius?: number;
    boundRadius?: number;
    currentStrength?: number;
    scatterRadius?: number;
    perceptionAngle?: number;
    rayPosition?: Vector3;
    modelBasePath?: string;
    reefSdfData?: ReefSDFData | null;
  }

  let {
    targetSize = 0.08,
    swimHeight = [2, 7] as [number, number],
    speed = [0.5, 1.2] as [number, number],
    stageRadius = 5,
    boundRadius = 18,
    currentStrength = 0.3,
    scatterRadius = 4.0,
    perceptionAngle = 135,
    rayPosition = new Vector3(0, 0, 0),
    modelBasePath = '/models/ocean/pack/',
    reefSdfData = null,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);
  const { renderer } = useThrelte();

  const CLUSTER_SPREAD = 2.5;
  const VISITOR_RESERVE = 100;

  interface ExtractedModel {
    geometry: BufferGeometry;
    diffuseMap: Texture | null;
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

  function extractModel(scene: import('three').Group): ExtractedModel | null {
    let geo: BufferGeometry | null = null;
    let diffuseMap: Texture | null = null;
    scene.traverse((child: any) => {
      if (!child.isMesh) return;
      if (!geo) geo = child.geometry.clone();
      if (!diffuseMap && child.material) {
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        if (mat?.map) diffuseMap = mat.map;
      }
    });
    if (geo) {
      (geo as BufferGeometry).morphAttributes = {};
      (geo as BufferGeometry).morphTargetsRelative = false;
    }
    return geo ? { geometry: geo, diffuseMap } : null;
  }

  function getLocoUniforms(mode: LocomotionMode): Record<string, { value: number }> {
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

  function initCPUFallback(
    loadedResults: { species: FishSpeciesConfig; model: ExtractedModel }[],
    gy: number,
  ) {
    const FALLBACK_COUNT = 20;
    const firstModel = loadedResults[0]?.model;
    if (!firstModel) return;

    const geo = firstModel.geometry.clone();
    const mat = new ShaderMaterial({
      uniforms: {
        tPosition: { value: null },
        tVelocity: { value: null },
        uSize: { value: targetSize * 0.5 },
        uTime: { value: 0 },
        uMaxSpeed: { value: 1.0 },
        ...getLocoUniforms(LocomotionMode.Carangiform),
        tAlbedo: { value: firstModel.diffuseMap },
        uFallbackColor: { value: new Color('#5599bb') },
        uHasTexture: { value: firstModel.diffuseMap ? 1.0 : 0.0 },
        uLightDir: { value: new Vector3(0.3, 1.0, 0.2).normalize() },
        uAmbient: { value: 0.55 },
        uRoughness: { value: 0.5 },
        uFogColor: { value: new Color('#1a3040') },
        uFogNear: { value: 15 },
        uFogFar: { value: 25 },
      },
      vertexShader: renderVertexShader,
      fragmentShader: renderFragmentShader,
      side: DoubleSide,
    });

    const mesh = new InstancedMesh(geo, mat, FALLBACK_COUNT);
    mesh.frustumCulled = false;

    const dummy = new Object3D();
    const paths = Array.from({ length: FALLBACK_COUNT }, (_, i) => ({
      radius: 8 + Math.random() * 10,
      height: gy + 2 + Math.random() * 4,
      speed: 0.15 + Math.random() * 0.25,
      phase: (i / FALLBACK_COUNT) * Math.PI * 2,
      yOsc: 0.3 + Math.random() * 0.5,
      yFreq: 0.2 + Math.random() * 0.3,
    }));

    for (let i = 0; i < FALLBACK_COUNT; i++) {
      const p = paths[i]!;
      const angle = p.phase;
      dummy.position.set(
        Math.cos(angle) * p.radius,
        p.height,
        Math.sin(angle) * p.radius,
      );
      dummy.lookAt(
        Math.cos(angle + 0.1) * p.radius,
        p.height,
        Math.sin(angle + 0.1) * p.radius,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    fallbackMeshes = [mesh];

    let fbElapsed = 0;
    useTask((delta) => {
      fbElapsed += delta;
      mat.uniforms.uTime!.value = fbElapsed;
      for (let i = 0; i < FALLBACK_COUNT; i++) {
        const p = paths[i]!;
        const angle = fbElapsed * p.speed + p.phase;
        const x = Math.cos(angle) * p.radius;
        const z = Math.sin(angle) * p.radius;
        const y = p.height + Math.sin(fbElapsed * p.yFreq) * p.yOsc;
        dummy.position.set(x, y, z);
        const nextAngle = angle + 0.1;
        dummy.lookAt(
          Math.cos(nextAngle) * p.radius,
          y,
          Math.sin(nextAngle) * p.radius,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  /** Create a minimal 1x1x1 Data3DTexture with value 999 (far outside) */
  function createPlaceholder3DTexture(): Data3DTexture {
    const data = new Uint16Array(1);
    // HalfFloat encoding of 999.0 — approximate, but any large positive works
    // For simplicity we encode a large value; the shader checks dist > 998
    data[0] = 0x63E7; // ~999 in half-float
    const tex = new Data3DTexture(data, 1, 1, 1);
    tex.format = RedFormat;
    tex.type = HalfFloatType;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  let meshes = $state<InstancedMesh[]>([]);
  let gpuFailed = $state(false);
  let fallbackMeshes = $state<InstancedMesh[]>([]);
  let gpuCompute: GPUComputationRenderer | null = null;
  let posVar: any = null;
  let velVar: any = null;
  let stateVar: any = null;
  let materials: ShaderMaterial[] = [];
  let materialSizeMults: number[] = [];
  let storedTraitsData: Float32Array | null = null;
  let eventSystem: FishEventSystem | null = null;

  let rotationManager: SpeciesRotationManager | null = null;
  const modelCache = new Map<string, ExtractedModel>();
  let cachedGltfLoader: GLTFLoader | null = null;

  interface ActiveVisitorGroup {
    group: VisitorGroup;
    meshes: InstancedMesh[];
    materials: ShaderMaterial[];
    speciesIndices: number[];
  }

  let activeVisitors: ActiveVisitorGroup[] = [];
  let pendingSpawns: { group: VisitorGroup; speciesIdx: number[] }[] = [];
  let pendingDespawns: { startIndex: number; count: number }[] = [];
  let texSize = 0;
  let loadedSpeciesCount = 0;

  $effect(() => {
    const gy = groundY;
    const gl = (renderer as any)?.current ?? renderer;
    if (!gl) return;

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    cachedGltfLoader = gltfLoader;

    const species = RESIDENT_SPECIES;
    const totalFish = RESIDENT_FISH_COUNT;
    const localTexSize = Math.ceil(Math.sqrt(totalFish + VISITOR_RESERVE));
    texSize = localTexSize;

    const loadPromises = species.map(
      (sp) =>
        new Promise<{ species: FishSpeciesConfig; model: ExtractedModel | null }>((resolve) => {
          gltfLoader.load(
            modelBasePath + sp.modelFile,
            (gltf) => {
              const model = extractModel(gltf.scene);
              if (model) {
                normalizeGeometry(model.geometry);
                reorientToZ(model.geometry);
              }
              resolve({ species: sp, model });
            },
            undefined,
            () => resolve({ species: sp, model: null }),
          );
        }),
    );

    let cancelled = false;

    Promise.all(loadPromises).then((results) => {
      if (cancelled) return;

      const loaded = results.filter((r) => r.model !== null);
      if (loaded.length === 0) return;

      const gpu = new GPUComputationRenderer(texSize, texSize, gl);
      const posTex = gpu.createTexture();
      const velTex = gpu.createTexture();
      const posArr = posTex.image.data as Float32Array;
      const velArr = velTex.image.data as Float32Array;

      const minR = stageRadius + 3;
      const maxR = boundRadius * 0.8;
      const [hMin, hMax] = swimHeight;
      const [sMin, sMax] = speed;

      const clusterCenters: { x: number; y: number; z: number; angle: number }[] = [];
      for (let s = 0; s < loaded.length; s++) {
        const cAngle = (s / loaded.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const cR = minR + Math.random() * (maxR - minR);
        clusterCenters.push({
          x: Math.cos(cAngle) * cR,
          y: gy + hMin + Math.random() * (hMax - hMin),
          z: Math.sin(cAngle) * cR,
          angle: cAngle,
        });
      }

      let spawnOffset = 0;
      const speciesOffsets: number[] = [];
      for (let s = 0; s < loaded.length; s++) {
        speciesOffsets.push(spawnOffset);
        const { species: sp } = loaded[s]!;
        const sCount = sp.instanceCount;
        const cluster = clusterCenters[s]!;

        for (let j = 0; j < sCount; j++) {
          const i = spawnOffset + j;
          const idx = i * 4;

          const offAngle = Math.random() * Math.PI * 2;
          const offR = Math.random() * CLUSTER_SPREAD;
          const offY = (Math.random() - 0.5) * CLUSTER_SPREAD * 0.6;

          posArr[idx + 0] = cluster.x + Math.cos(offAngle) * offR;
          posArr[idx + 1] = cluster.y + offY;
          posArr[idx + 2] = cluster.z + Math.sin(offAngle) * offR;
          posArr[idx + 3] = s; // integer species index

          const perpAngle = cluster.angle + Math.PI / 2;
          const vSpeed = sMin + Math.random() * (sMax - sMin);
          const jitter = (Math.random() - 0.5) * 0.3;
          velArr[idx + 0] = Math.cos(perpAngle + jitter) * vSpeed;
          velArr[idx + 1] = (Math.random() - 0.5) * 0.15;
          velArr[idx + 2] = Math.sin(perpAngle + jitter) * vSpeed;
          velArr[idx + 3] = 0.6 + Math.random() * 0.8;
        }
        spawnOffset += sCount;
      }

      for (let i = spawnOffset; i < texSize * texSize; i++) {
        const idx = i * 4;
        posArr[idx + 0] = 9999;
        posArr[idx + 1] = 9999;
        posArr[idx + 2] = 9999;
        posArr[idx + 3] = 0;
      }

      const traitsData = new Float32Array(texSize * texSize * 4);
      let tOffset = 0;
      for (let s = 0; s < loaded.length; s++) {
        const { species: sp } = loaded[s]!;
        for (let j = 0; j < sp.instanceCount; j++) {
          const idx = (tOffset + j) * 4;
          traitsData[idx + 0] = sp.speed[0] + Math.random() * (sp.speed[1] - sp.speed[0]);
          traitsData[idx + 1] = sp.social[0] + Math.random() * (sp.social[1] - sp.social[0]);
          traitsData[idx + 2] = sp.bold[0] + Math.random() * (sp.bold[1] - sp.bold[0]);
          traitsData[idx + 3] = Math.random();
        }
        tOffset += sp.instanceCount;
      }
      const traitsTex = new DataTexture(traitsData, texSize, texSize, RGBAFormat, FloatType);
      traitsTex.needsUpdate = true;
      storedTraitsData = traitsData;

      const evtSys = new FishEventSystem(spawnOffset, traitsData);
      eventSystem = evtSys;

      posVar = gpu.addVariable('texturePosition', positionShader, posTex);
      velVar = gpu.addVariable('textureVelocity', velocityShader, velTex);

      const stateTex = gpu.createTexture();
      const stateArr = stateTex.image.data as Float32Array;
      for (let i = 0; i < texSize * texSize; i++) {
        stateArr[i * 4 + 0] = 0;
        stateArr[i * 4 + 1] = 0;
        stateArr[i * 4 + 2] = 0;
        stateArr[i * 4 + 3] = 0;
      }
      stateVar = gpu.addVariable('textureState', stateShader, stateTex);

      gpu.setVariableDependencies(posVar, [posVar, velVar]);
      gpu.setVariableDependencies(velVar, [posVar, velVar, stateVar]);
      gpu.setVariableDependencies(stateVar, [stateVar, posVar, velVar]);

      const schoolCenterVecs = clusterCenters.map((c) => new Vector3(c.x, c.y, c.z));
      while (schoolCenterVecs.length < 50) schoolCenterVecs.push(new Vector3(0, 0, 0));

      const velU = velVar.material.uniforms;
      velU.uDelta = { value: 0 };
      velU.uSepDist = { value: 0.8 };
      velU.uAliDist = { value: 4.0 };
      velU.uMaxSpeed = { value: sMax * 2.0 };
      velU.uMinSpeed = { value: sMin };
      velU.uMaxSteer = { value: 0.1 };
      velU.uGroundY = { value: gy };
      velU.uHeightMin = { value: hMin };
      velU.uHeightMax = { value: hMax };
      velU.uStageRadius = { value: stageRadius };
      velU.uBoundRadius = { value: boundRadius };
      velU.uFishCount = { value: spawnOffset };
      velU.tTraits = { value: traitsTex };
      velU.uTime = { value: 0 };
      velU.uCurrentStrength = { value: currentStrength };
      velU.uPerceptionCos = { value: Math.cos((perceptionAngle * Math.PI) / 180) };
      velU.uSchoolCenters = { value: schoolCenterVecs };
      velU.uSchoolRadius = { value: 6.0 };
      velU.uScatterOrigin = { value: new Vector3(0, 0, 0) };
      velU.uScatterRadius = { value: scatterRadius };
      velU.uScatterForce = { value: 3.0 };
      velU.uDartCount = { value: 0 };
      velU.uDartIndices = { value: new Int32Array(8).fill(-1) };
      velU.uDartStrength = { value: 2.0 };
      velU.uExcursionCount = { value: 0 };
      velU.uExcursionIndices = { value: new Int32Array(4).fill(-1) };
      velU.uExcursionBias = { value: new Float32Array(4) };

      // SDF obstacle avoidance uniforms — start with zero structures,
      // populated reactively when reefSdfData becomes available
      velU.uReefSDFCount = { value: 0 };
      velU.uReefAvoidDist = { value: 3.0 };
      velU.uReefAvoidForce = { value: 4.0 };

      // Placeholder 1x1x1 3D textures for unused SDF slots (avoids WebGL errors)
      const placeholderSDF = createPlaceholder3DTexture();
      const identityMat = new Matrix4();
      velU.uReefSDF0 = { value: placeholderSDF };
      velU.uReefSDF1 = { value: placeholderSDF };
      velU.uReefSDF2 = { value: placeholderSDF };
      velU.uReefSDF3 = { value: placeholderSDF };
      velU.uReefSDFInvMatrix0 = { value: identityMat.clone() };
      velU.uReefSDFInvMatrix1 = { value: identityMat.clone() };
      velU.uReefSDFInvMatrix2 = { value: identityMat.clone() };
      velU.uReefSDFInvMatrix3 = { value: identityMat.clone() };

      const posU = posVar.material.uniforms;
      posU.uDelta = { value: 0 };
      posU.uSpawnCount = { value: 0 };
      posU.uSpawnStartIdx = { value: 0 };
      posU.uSpawnPositions = { value: new Float32Array(64 * 4) };
      posU.uDespawnCount = { value: 0 };
      posU.uDespawnStartIdx = { value: 0 };

      velU.uSpawnCount = { value: 0 };
      velU.uSpawnStartIdx = { value: 0 };
      velU.uSpawnVelocities = { value: new Float32Array(64 * 4) };

      const trophicRoles = new Int32Array(50);
      for (let s = 0; s < loaded.length; s++) {
        trophicRoles[s] = loaded[s]!.species.trophicRole;
      }

      const stU = stateVar.material.uniforms;
      stU.uDelta = { value: 0 };
      stU.uTime = { value: 0 };
      stU.uFleeRange = { value: 5.0 };
      stU.uHuntRange = { value: 8.0 };
      stU.uPanicRadius = { value: 3.0 };
      stU.uHomeRadius = { value: 4.0 };
      stU.uPerceptionCos = { value: Math.cos((perceptionAngle * Math.PI) / 180) };
      stU.uTrophicRole = { value: trophicRoles };
      stU.uThreatMatrix = { value: THREAT_MATRIX };
      stU.uHuntMatrix = { value: HUNT_MATRIX };
      stU.uSchoolCenters = velU.uSchoolCenters;
      stU.uScatterOrigin = velU.uScatterOrigin;
      stU.uScatterRadius = { value: scatterRadius };

      const err = gpu.init();
      if (err !== null) {
        console.error('[FishSchool] GPUComputationRenderer init failed:', err);
        gpuFailed = true;
        const validResults = loaded
          .filter((r): r is { species: FishSpeciesConfig; model: ExtractedModel } => r.model !== null);
        initCPUFallback(validResults, gy);
        return;
      }
      console.log('[FishSchool] GPU init OK —', loaded.length, 'species,', spawnOffset, 'fish, texSize', localTexSize);

      const createdMeshes: InstancedMesh[] = [];
      const createdMaterials: ShaderMaterial[] = [];
      const createdSizeMults: number[] = [];
      const createdGeometries: BufferGeometry[] = [];

      let fishOffset = 0;
      for (let s = 0; s < loaded.length; s++) {
        const { species: sp, model } = loaded[s]!;
        if (!model) continue;
        const sCount = sp.instanceCount;
        if (sCount <= 0) continue;

        const geo = model.geometry;
        createdGeometries.push(geo);

        const refs = new Float32Array(sCount * 2);
        for (let i = 0; i < sCount; i++) {
          const globalIdx = fishOffset + i;
          const col = globalIdx % texSize;
          const row = Math.floor(globalIdx / texSize);
          refs[i * 2 + 0] = (col + 0.5) / texSize;
          refs[i * 2 + 1] = (row + 0.5) / texSize;
        }
        geo.setAttribute('aReference', new InstancedBufferAttribute(refs, 2));

        const diffuse = model.diffuseMap;
        const roughness = sp.trophicRole <= 1 ? 0.3 : sp.locomotionMode === LocomotionMode.Ostraciiform ? 0.6 : 0.5;

        const mat = new ShaderMaterial({
          uniforms: {
            tPosition: { value: null },
            tVelocity: { value: null },
            uSize: { value: targetSize * sp.sizeScale },
            uTime: { value: 0 },
            uMaxSpeed: { value: sMax * 2.0 },
            ...getLocoUniforms(sp.locomotionMode),
            tAlbedo: { value: diffuse },
            uFallbackColor: { value: new Color('#5599bb') },
            uHasTexture: { value: diffuse ? 1.0 : 0.0 },
            uLightDir: { value: new Vector3(0.3, 1.0, 0.2).normalize() },
            uAmbient: { value: 0.55 },
            uRoughness: { value: roughness },
            uFogColor: { value: new Color('#1a3040') },
            uFogNear: { value: 15 },
            uFogFar: { value: 25 },
          },
          vertexShader: renderVertexShader,
          fragmentShader: renderFragmentShader,
          side: DoubleSide,
        });

        const mesh = new InstancedMesh(geo, mat, sCount);
        mesh.frustumCulled = false;

        createdMeshes.push(mesh);
        createdMaterials.push(mat);
        createdSizeMults.push(sp.sizeScale);
        fishOffset += sCount;
      }

      gpu.compute();
      const initPosTex = gpu.getCurrentRenderTarget(posVar).texture;
      const initVelTex = gpu.getCurrentRenderTarget(velVar).texture;
      for (const mat of createdMaterials) {
        mat.uniforms.tPosition!.value = initPosTex;
        mat.uniforms.tVelocity!.value = initVelTex;
      }

      meshes = createdMeshes;
      materials = createdMaterials;
      materialSizeMults = createdSizeMults;
      gpuCompute = gpu;
      loadedSpeciesCount = loaded.length;

      rotationManager = new SpeciesRotationManager(texSize * texSize, fishOffset);
    });

    return () => {
      cancelled = true;
      for (const m of fallbackMeshes) {
        (m.material as ShaderMaterial).dispose();
        m.geometry.dispose();
        m.dispose();
      }
      fallbackMeshes = [];
      gpuFailed = false;
      if (gpuCompute) gpuCompute.dispose();
      storedTraitsData = null;
      eventSystem = null;
      rotationManager = null;
      for (const v of activeVisitors) {
        for (const mat of v.materials) mat.dispose();
        for (const m of v.meshes) { m.geometry.dispose(); m.dispose(); }
      }
      activeVisitors = [];
      pendingSpawns = [];
      pendingDespawns = [];
      for (const mat of materials) mat.dispose();
      for (const m of meshes) {
        m.geometry.dispose();
        m.dispose();
      }
      meshes = [];
      materials = [];
      materialSizeMults = [];
      gpuCompute = null;
      posVar = null;
      velVar = null;
      stateVar = null;
    };
  });

  // ── Reactive SDF uniform update ─────────────────────────────────────
  // When reefSdfData arrives (structures finished generating SDFs), bind
  // the 3D textures and inverse matrices to the velocity compute shader.
  $effect(() => {
    if (!velVar || !reefSdfData) return;
    const velU = velVar.material.uniforms;
    const results = reefSdfData.results;
    const count = Math.min(results.length, 4);

    velU.uReefSDFCount.value = count;

    const sdfKeys = ['uReefSDF0', 'uReefSDF1', 'uReefSDF2', 'uReefSDF3'] as const;
    const matKeys = ['uReefSDFInvMatrix0', 'uReefSDFInvMatrix1', 'uReefSDFInvMatrix2', 'uReefSDFInvMatrix3'] as const;

    for (let i = 0; i < count; i++) {
      const r = results[i]!;
      velU[sdfKeys[i]!].value = r.texture;
      velU[matKeys[i]!].value = r.inverseMatrix;
    }

    console.log(`[FishSchool] Bound ${count} reef SDF textures to velocity shader`);
  });

  function createVisitorMesh(
    sp: FishSpeciesConfig,
    model: ExtractedModel,
    slotStart: number,
    slotCount: number,
    sMax: number,
  ): { mesh: InstancedMesh; material: ShaderMaterial } {
    const geo = model.geometry.clone();
    const refs = new Float32Array(slotCount * 2);
    for (let i = 0; i < slotCount; i++) {
      const globalIdx = slotStart + i;
      const col = globalIdx % texSize;
      const row = Math.floor(globalIdx / texSize);
      refs[i * 2 + 0] = (col + 0.5) / texSize;
      refs[i * 2 + 1] = (row + 0.5) / texSize;
    }
    geo.setAttribute('aReference', new InstancedBufferAttribute(refs, 2));

    const diffuse = model.diffuseMap;
    const roughness = sp.trophicRole <= 1 ? 0.3 : sp.locomotionMode === LocomotionMode.Ostraciiform ? 0.6 : 0.5;

    const mat = new ShaderMaterial({
      uniforms: {
        tPosition: { value: gpuCompute ? gpuCompute.getCurrentRenderTarget(posVar).texture : null },
        tVelocity: { value: gpuCompute ? gpuCompute.getCurrentRenderTarget(velVar).texture : null },
        uSize: { value: targetSize * sp.sizeScale },
        uTime: { value: 0 },
        uMaxSpeed: { value: sMax * 2.0 },
        ...getLocoUniforms(sp.locomotionMode),
        tAlbedo: { value: diffuse },
        uFallbackColor: { value: new Color('#5599bb') },
        uHasTexture: { value: diffuse ? 1.0 : 0.0 },
        uLightDir: { value: new Vector3(0.3, 1.0, 0.2).normalize() },
        uAmbient: { value: 0.55 },
        uRoughness: { value: roughness },
        uFogColor: { value: new Color('#1a3040') },
        uFogNear: { value: 15 },
        uFogFar: { value: 25 },
      },
      vertexShader: renderVertexShader,
      fragmentShader: renderFragmentShader,
      side: DoubleSide,
    });

    const mesh = new InstancedMesh(geo, mat, slotCount);
    mesh.frustumCulled = false;
    return { mesh, material: mat };
  }

  function loadVisitorModel(modelFile: string): Promise<ExtractedModel | null> {
    if (modelCache.has(modelFile)) return Promise.resolve(modelCache.get(modelFile)!);
    const loader = cachedGltfLoader;
    if (!loader) return Promise.resolve(null);
    return new Promise((resolve) => {
      loader.load(
        modelBasePath + modelFile,
        (gltf) => {
          const model = extractModel(gltf.scene);
          if (model) {
            normalizeGeometry(model.geometry);
            reorientToZ(model.geometry);
            modelCache.set(modelFile, model);
          }
          resolve(model);
        },
        undefined,
        () => resolve(null),
      );
    });
  }

  let elapsed = 0;

  useTask((delta) => {
    if (!gpuCompute || !posVar || !velVar || !stateVar || materials.length === 0) return;

    const dt = Math.min(delta, 0.05);
    elapsed += dt;

    const posUni = posVar.material.uniforms;
    const velUni = velVar.material.uniforms;
    const stUni = stateVar.material.uniforms;

    velUni.uDelta.value = dt;
    velUni.uTime.value = elapsed;
    velUni.uCurrentStrength.value = currentStrength;
    velUni.uPerceptionCos.value = Math.cos((perceptionAngle * Math.PI) / 180);
    velUni.uScatterRadius.value = scatterRadius;
    posUni.uDelta.value = dt;

    stUni.uDelta.value = dt;
    stUni.uTime.value = elapsed;
    stUni.uScatterRadius.value = scatterRadius;

    if (eventSystem) {
      eventSystem.tick(dt, velUni as unknown as FishEventUniforms, rayPosition);
    }

    // ── Visitor spawn: write positions/velocities into GPU texture via uniforms ──
    if (pendingSpawns.length > 0) {
      const spawn = pendingSpawns.shift()!;
      const { group, speciesIdx } = spawn;
      const { slots, entryAngle, exitAngle } = group;
      const totalCount = Math.min(slots.count, 64);

      const posData = posUni.uSpawnPositions.value as Float32Array;
      const velData = velUni.uSpawnVelocities.value as Float32Array;

      const entryR = boundRadius * 0.85;
      const entryX = Math.cos(entryAngle) * entryR;
      const entryZ = Math.sin(entryAngle) * entryR;
      const exitDirX = Math.cos(exitAngle);
      const exitDirZ = Math.sin(exitAngle);

      const gy = groundY;
      let offset = 0;
      for (let si = 0; si < group.species.length; si++) {
        const sp = group.species[si]!;
        const spIdx = speciesIdx[si] ?? 0;
        for (let j = 0; j < sp.instanceCount && offset < totalCount; j++) {
          const idx = offset * 4;
          posData[idx + 0] = entryX + (Math.random() - 0.5) * 3;
          posData[idx + 1] = gy + 3 + Math.random() * 3;
          posData[idx + 2] = entryZ + (Math.random() - 0.5) * 3;
          posData[idx + 3] = spIdx;

          const spd = sp.speed[0] + Math.random() * (sp.speed[1] - sp.speed[0]);
          velData[idx + 0] = exitDirX * spd;
          velData[idx + 1] = 0;
          velData[idx + 2] = exitDirZ * spd;
          velData[idx + 3] = 0.6 + Math.random() * 0.8;
          offset++;
        }
      }

      posUni.uSpawnCount.value = offset;
      posUni.uSpawnStartIdx.value = slots.startIndex;
      velUni.uSpawnCount.value = offset;
      velUni.uSpawnStartIdx.value = slots.startIndex;

      // Update school centers for visitor species
      const centers = velUni.uSchoolCenters.value as Vector3[];
      for (let si = 0; si < group.species.length; si++) {
        const idx = speciesIdx[si];
        if (idx !== undefined && idx < centers.length) {
          centers[idx]!.set(entryX, gy + 4, entryZ);
        }
      }

      // Update trophic roles for visitor species
      const roles = stUni.uTrophicRole.value as Int32Array;
      for (let si = 0; si < group.species.length; si++) {
        const idx = speciesIdx[si];
        if (idx !== undefined && idx < roles.length) {
          roles[idx] = group.species[si]!.trophicRole;
        }
      }
    } else {
      posUni.uSpawnCount.value = 0;
      velUni.uSpawnCount.value = 0;
    }

    // ── Visitor despawn: write sentinel positions ──
    if (pendingDespawns.length > 0) {
      const despawn = pendingDespawns.shift()!;
      posUni.uDespawnCount.value = despawn.count;
      posUni.uDespawnStartIdx.value = despawn.startIndex;
    } else {
      posUni.uDespawnCount.value = 0;
    }

    // ── Rotation manager tick ──
    if (rotationManager) {
      const newGroup = rotationManager.tick(dt);

      // Detect despawned groups — remove from scene + queue sentinel write
      const currentSlots = new Set(rotationManager.activeGroups.map((g) => g.slots.startIndex));
      const removedMeshSet = new Set<InstancedMesh>();
      const removedMatSet = new Set<ShaderMaterial>();
      for (const v of activeVisitors) {
        if (!currentSlots.has(v.group.slots.startIndex)) {
          pendingDespawns.push({ startIndex: v.group.slots.startIndex, count: v.group.slots.count });
          for (const mat of v.materials) { mat.dispose(); removedMatSet.add(mat); }
          for (const m of v.meshes) { m.geometry.dispose(); m.dispose(); removedMeshSet.add(m); }
        }
      }
      if (removedMeshSet.size > 0) {
        meshes = meshes.filter((m) => !removedMeshSet.has(m));
        materials = materials.filter((m) => !removedMatSet.has(m));
      }
      activeVisitors = activeVisitors.filter((v) => currentSlots.has(v.group.slots.startIndex));

      // Handle new spawn
      if (newGroup) {
        const speciesIdx = newGroup.species.map((sp) => {
          const allIdx = ALL_SPECIES.indexOf(sp);
          return allIdx >= 0 ? allIdx : loadedSpeciesCount;
        });

        const [sMin, sMax] = speed;
        const loadProms = newGroup.species.map((sp) => loadVisitorModel(sp.modelFile));
        Promise.all(loadProms).then((models) => {
          if (!gpuCompute || !posVar || !velVar) return;
          const visitorMeshes: InstancedMesh[] = [];
          const visitorMats: ShaderMaterial[] = [];

          let slotOffset = newGroup.slots.startIndex;
          for (let si = 0; si < newGroup.species.length; si++) {
            const sp = newGroup.species[si]!;
            const model = models[si];
            if (!model) { slotOffset += sp.instanceCount; continue; }

            const { mesh, material } = createVisitorMesh(sp, model, slotOffset, sp.instanceCount, sMax);
            visitorMeshes.push(mesh);
            visitorMats.push(material);
            slotOffset += sp.instanceCount;
          }

          if (visitorMeshes.length > 0) {
            activeVisitors.push({
              group: newGroup,
              meshes: visitorMeshes,
              materials: visitorMats,
              speciesIndices: speciesIdx,
            });
            pendingSpawns.push({ group: newGroup, speciesIdx });
            meshes = [...meshes, ...visitorMeshes];
            materials = [...materials, ...visitorMats];
          }
        });
      }
    }

    gpuCompute.compute();

    const posTex = gpuCompute.getCurrentRenderTarget(posVar).texture;
    const velTex = gpuCompute.getCurrentRenderTarget(velVar).texture;

    for (let mi = 0; mi < materials.length; mi++) {
      const mat = materials[mi]!;
      mat.uniforms.tPosition!.value = posTex;
      mat.uniforms.tVelocity!.value = velTex;
      mat.uniforms.uTime!.value = elapsed;
      mat.uniforms.uSize!.value = targetSize * (materialSizeMults[mi] ?? 1.0);
    }

    // Visitor materials also need texture updates
    for (const v of activeVisitors) {
      for (const mat of v.materials) {
        mat.uniforms.tPosition!.value = posTex;
        mat.uniforms.tVelocity!.value = velTex;
        mat.uniforms.uTime!.value = elapsed;
      }
    }
  });
</script>

{#each meshes as mesh (mesh.id)}
  <T is={mesh} />
{/each}
{#each fallbackMeshes as mesh (mesh.id)}
  <T is={mesh} />
{/each}
