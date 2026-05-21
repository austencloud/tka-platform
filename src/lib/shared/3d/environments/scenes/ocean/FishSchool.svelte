<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import {
    InstancedMesh,
    ShaderMaterial,
    Color,
    Vector3,
    InstancedBufferAttribute,
    DoubleSide,
    DataTexture,
    FloatType,
    RGBAFormat,
    type BufferGeometry,
    type Texture,
  } from 'three';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
  import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
  import { FishEventSystem, type FishEventUniforms } from './FishEventSystem';
  import { RESIDENT_SPECIES, RESIDENT_FISH_COUNT, type FishSpeciesConfig } from './fish-species-config';
  import { LOCOMOTION_PARAMS, LocomotionMode, type LocomotionModeParams } from './fish-locomotion-params';
  import { velocityShader, positionShader, renderVertexShader, renderFragmentShader } from './fish-shaders';
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
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);
  const { renderer: rendererRef } = useThrelte();

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

  function buildLocoUniformArrays(): Record<string, number[]> {
    const keys: (keyof LocomotionModeParams)[] = [
      'swimFreq', 'waveK', 'baseAmplitude', 'stiffness', 'ampExponent',
      'strideAmp', 'rollAmp', 'pectoralFreq', 'pectoralAmp',
    ];
    const result: Record<string, number[]> = {};
    for (const key of keys) {
      const arr: number[] = [];
      for (let m = 0; m < Object.keys(LocomotionMode).length / 2; m++) {
        arr.push(LOCOMOTION_PARAMS[m as LocomotionMode][key]);
      }
      result[key] = arr;
    }
    return result;
  }

  let meshes = $state<InstancedMesh[]>([]);
  let gpuCompute: GPUComputationRenderer | null = null;
  let posVar: any = null;
  let velVar: any = null;
  let materials: ShaderMaterial[] = [];
  let materialSizeMults: number[] = [];
  let materialLocoModes: number[] = [];
  let storedTraitsData: Float32Array | null = null;
  let eventSystem: FishEventSystem | null = null;

  $effect(() => {
    const ren = rendererRef.current;
    const gy = groundY;
    if (!ren) return;

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    const species = RESIDENT_SPECIES;
    const totalFish = RESIDENT_FISH_COUNT;
    const texSize = Math.ceil(Math.sqrt(totalFish + VISITOR_RESERVE));

    const loadPromises = species.map(
      (sp) =>
        new Promise<{ species: FishSpeciesConfig; model: ExtractedModel | null }>((resolve) => {
          gltfLoader.load(
            modelBasePath + sp.modelFile,
            (gltf) => {
              const model = extractModel(gltf.scene);
              if (model) normalizeGeometry(model.geometry);
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

      const gpu = new GPUComputationRenderer(texSize, texSize, ren);
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
      gpu.setVariableDependencies(posVar, [posVar, velVar]);
      gpu.setVariableDependencies(velVar, [posVar, velVar]);

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

      posVar.material.uniforms.uDelta = { value: 0 };

      const err = gpu.init();
      if (err !== null) {
        console.error('[FishSchool] GPUComputationRenderer init failed:', err);
        return;
      }

      const locoArrays = buildLocoUniformArrays();

      const createdMeshes: InstancedMesh[] = [];
      const createdMaterials: ShaderMaterial[] = [];
      const createdSizeMults: number[] = [];
      const createdLocoModes: number[] = [];
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
            uLocoMode: { value: sp.locomotionMode },
            uSwimFreq: { value: locoArrays['swimFreq'] },
            uWaveK: { value: locoArrays['waveK'] },
            uBaseAmplitude: { value: locoArrays['baseAmplitude'] },
            uStiffness: { value: locoArrays['stiffness'] },
            uAmpExponent: { value: locoArrays['ampExponent'] },
            uStrideAmp: { value: locoArrays['strideAmp'] },
            uRollAmp: { value: locoArrays['rollAmp'] },
            uPectoralFreq: { value: locoArrays['pectoralFreq'] },
            uPectoralAmp: { value: locoArrays['pectoralAmp'] },
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
          vertexColors: true,
          side: DoubleSide,
        });

        const mesh = new InstancedMesh(geo, mat, sCount);
        mesh.frustumCulled = false;

        createdMeshes.push(mesh);
        createdMaterials.push(mat);
        createdSizeMults.push(sp.sizeScale);
        createdLocoModes.push(sp.locomotionMode);
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
      materialLocoModes = createdLocoModes;
      gpuCompute = gpu;
    });

    return () => {
      cancelled = true;
      if (gpuCompute) gpuCompute.dispose();
      storedTraitsData = null;
      eventSystem = null;
      for (const mat of materials) mat.dispose();
      for (const m of meshes) {
        m.geometry.dispose();
        m.dispose();
      }
      meshes = [];
      materials = [];
      materialSizeMults = [];
      materialLocoModes = [];
      gpuCompute = null;
      posVar = null;
      velVar = null;
    };
  });

  let elapsed = 0;

  useTask((delta) => {
    if (!gpuCompute || !posVar || !velVar || materials.length === 0) return;

    const dt = Math.min(delta, 0.05);
    elapsed += dt;

    velVar.material.uniforms.uDelta.value = dt;
    velVar.material.uniforms.uTime.value = elapsed;
    velVar.material.uniforms.uCurrentStrength.value = currentStrength;
    velVar.material.uniforms.uPerceptionCos.value = Math.cos(
      (perceptionAngle * Math.PI) / 180,
    );
    velVar.material.uniforms.uScatterRadius.value = scatterRadius;
    posVar.material.uniforms.uDelta.value = dt;

    if (eventSystem) {
      eventSystem.tick(dt, velVar.material.uniforms as unknown as FishEventUniforms, rayPosition);
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
  });
</script>

{#each meshes as mesh (mesh.id)}
  <T is={mesh} />
{/each}
