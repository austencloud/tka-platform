<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { useGltf, useDraco } from "@threlte/extras";
  import {
    InstancedMesh,
    ShaderMaterial,
    Color,
    Vector3,
    InstancedBufferAttribute,
    DoubleSide,
    type BufferGeometry,
  } from "three";
  import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    count?: number;
    targetSize?: number;
    swimHeight?: [number, number];
    speed?: [number, number];
    stageRadius?: number;
    boundRadius?: number;
    baseColor?: string;
  }

  let {
    count = 80,
    targetSize = 0.08,
    swimHeight = [2, 7] as [number, number],
    speed = [0.5, 1.2] as [number, number],
    stageRadius = 5,
    boundRadius = 18,
    baseColor = "#5599bb",
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);
  const { renderer } = useThrelte();

  const dracoLoader = useDraco("/draco/");

  // ── Load 3 fish models at top level ────────────────────────────────────
  const glbCommon = useGltf("/models/ocean/fish_common.glb", { dracoLoader });
  const glbButterfly = useGltf("/models/ocean/fish_butterfly.glb", { dracoLoader });
  const glbTrout = useGltf("/models/ocean/fish_trout.glb", { dracoLoader });

  const texSize = $derived(Math.ceil(Math.sqrt(count)));

  /** Number of sub-schools to cluster fish into */
  const CLUSTER_COUNT = 4;
  /** Radius of each cluster (meters) */
  const CLUSTER_SPREAD = 2.5;

  // ── Boids velocity shader ──────────────────────────────────────────────

  const velocityShader = /* glsl */ `
    uniform float uDelta;
    uniform float uSepDist;
    uniform float uAliDist;
    uniform float uMaxSpeed;
    uniform float uMinSpeed;
    uniform float uGroundY;
    uniform float uHeightMin;
    uniform float uHeightMax;
    uniform float uStageRadius;
    uniform float uBoundRadius;
    uniform float uFishCount;
    uniform float uMaxSteer;

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec3 pos = texture2D(texturePosition, uv).xyz;
      vec4 velData = texture2D(textureVelocity, uv);
      vec3 vel = velData.xyz;
      float instanceScale = velData.w;

      if (pos.x > 9000.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, instanceScale); return; }

      vec3 sep = vec3(0.0);
      vec3 ali = vec3(0.0);
      vec3 coh = vec3(0.0);
      float sepN = 0.0;
      float aliN = 0.0;
      float cohN = 0.0;

      for (float y = 0.0; y < resolution.y; y += 1.0) {
        for (float x = 0.0; x < resolution.x; x += 1.0) {
          vec2 ref = (vec2(x, y) + 0.5) / resolution.xy;
          vec3 op = texture2D(texturePosition, ref).xyz;
          if (op.x > 9000.0) continue;

          vec3 diff = pos - op;
          float d = length(diff);
          if (d < 0.001) continue;

          if (d < uSepDist) {
            sep += normalize(diff) * (1.0 - d / uSepDist);
            sepN += 1.0;
          }
          if (d < uAliDist) {
            ali += texture2D(textureVelocity, ref).xyz;
            aliN += 1.0;
          }
          if (d < uAliDist * 1.5) {
            coh += op;
            cohN += 1.0;
          }
        }
      }

      vec3 steer = vec3(0.0);
      if (sepN > 0.0) steer += normalize(sep / sepN) * 0.8;
      if (aliN > 0.0) steer += normalize(ali / aliN - vel) * 0.4;
      if (cohN > 0.0) steer += normalize(coh / cohN - pos) * 0.3;

      // Centering — soft pull toward origin
      vec2 toCenter = -pos.xz;
      float distXZ = length(pos.xz);
      if (distXZ > uBoundRadius * 0.6) {
        float t = (distXZ - uBoundRadius * 0.6) / (uBoundRadius * 0.4);
        steer.xz += normalize(toCenter) * t * 1.5;
      }

      // Height bounds
      float minY = uGroundY + uHeightMin;
      float maxY = uGroundY + uHeightMax;
      if (pos.y < minY + 0.5) steer.y += (minY + 0.5 - pos.y) * 2.0;
      if (pos.y > maxY - 0.5) steer.y -= (pos.y - maxY + 0.5) * 2.0;

      // Stage avoidance
      if (distXZ < uStageRadius + 2.5) {
        float pen = uStageRadius + 2.5 - distXZ;
        steer.xz += normalize(pos.xz + 0.001) * pen * 3.0;
      }

      // Clamp max steering force to prevent twitchy direction changes
      float steerLen = length(steer);
      if (steerLen > uMaxSteer) steer = steer / steerLen * uMaxSteer;

      // Apply steering with drag for smooth deceleration
      vel = vel * 0.97 + steer * uDelta;

      // Speed clamp
      float spd = length(vel);
      if (spd > uMaxSpeed) vel = vel / spd * uMaxSpeed;
      if (spd > 0.001 && spd < uMinSpeed) vel = vel / spd * uMinSpeed;

      gl_FragColor = vec4(vel, instanceScale);
    }
  `;

  // ── Position integration shader ────────────────────────────────────────

  const positionShader = /* glsl */ `
    uniform float uDelta;

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec4 posData = texture2D(texturePosition, uv);
      vec3 vel = texture2D(textureVelocity, uv).xyz;
      posData.xyz += vel * uDelta;
      gl_FragColor = posData;
    }
  `;

  // ── Render shaders ─────────────────────────────────────────────────────

  const renderVertexShader = /* glsl */ `
    attribute vec2 aReference;

    uniform sampler2D tPosition;
    uniform sampler2D tVelocity;
    uniform float uSize;
    uniform float uTime;

    varying vec3 vNormal;
    varying float vHue;
    varying vec3 vWorldPos;

    void main() {
      vec4 posData = texture2D(tPosition, aReference);
      vec3 fishPos = posData.xyz;
      vHue = posData.w;

      vec4 velData = texture2D(tVelocity, aReference);
      vec3 fishVel = velData.xyz;
      float instanceScale = velData.w;

      vec3 forward = length(fishVel) > 0.001 ? normalize(fishVel) : vec3(0.0, 0.0, 1.0);
      vec3 worldUp = vec3(0.0, 1.0, 0.0);
      if (abs(dot(forward, worldUp)) > 0.99) worldUp = vec3(1.0, 0.0, 0.0);

      vec3 right = normalize(cross(worldUp, forward));
      vec3 up = cross(forward, right);
      mat3 rot = mat3(right, up, forward);

      float fishScale = uSize * instanceScale;

      // Tail wiggle — sinusoidal bend along local Z (forward axis)
      vec3 localPos = position;
      float tailFactor = max(0.0, -localPos.z) * 0.15;
      float phase = uTime * (4.0 + vHue * 2.0) + aReference.x * 40.0;
      localPos.x += sin(phase) * tailFactor;

      vec3 transformed = rot * (localPos * fishScale) + fishPos;
      vWorldPos = transformed;
      vNormal = normalize(rot * normal);

      gl_Position = projectionMatrix * viewMatrix * vec4(transformed, 1.0);
    }
  `;

  const renderFragmentShader = /* glsl */ `
    uniform vec3 uBaseColor;
    uniform vec3 uLightDir;
    uniform float uAmbient;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;

    varying vec3 vNormal;
    varying float vHue;
    varying vec3 vWorldPos;

    vec3 hueShift(vec3 col, float shift) {
      float cosA = cos(shift);
      float sinA = sin(shift);
      vec3 k = vec3(0.57735);
      return col * cosA + cross(k, col) * sinA + k * dot(k, col) * (1.0 - cosA);
    }

    void main() {
      vec3 color = hueShift(uBaseColor, vHue);
      vec3 n = normalize(vNormal);
      float NdotL = max(dot(n, uLightDir), 0.0);
      vec3 lit = color * (uAmbient + NdotL * 0.6);

      float dist = length(vWorldPos.xz);
      float fog = smoothstep(uFogNear, uFogFar, dist);
      lit = mix(lit, uFogColor, fog);

      gl_FragColor = vec4(lit, 1.0);
    }
  `;

  // ── Geometry helpers ───────────────────────────────────────────────────

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

  function extractGeometry(
    scene: import("three").Group,
  ): BufferGeometry | null {
    let found: BufferGeometry | null = null;
    scene.traverse((child: any) => {
      if (child.isMesh && !found) found = child.geometry.clone();
    });
    return found;
  }

  // ── GPU System Setup ───────────────────────────────────────────────────

  let meshes = $state<InstancedMesh[]>([]);
  let gpuCompute: GPUComputationRenderer | null = null;
  let posVar: any = null;
  let velVar: any = null;
  let materials: ShaderMaterial[] = [];

  $effect(() => {
    const ren = renderer as unknown as import("three").WebGLRenderer;
    const gCommon = $glbCommon;
    const gButterfly = $glbButterfly;
    const gTrout = $glbTrout;
    const gy = groundY;
    if (!ren || !gCommon || !gButterfly || !gTrout) return;

    // Extract and normalize geometries
    const geoCommon = extractGeometry(gCommon.scene);
    const geoButterfly = extractGeometry(gButterfly.scene);
    const geoTrout = extractGeometry(gTrout.scene);
    if (!geoCommon || !geoButterfly || !geoTrout) return;

    normalizeGeometry(geoCommon);
    normalizeGeometry(geoButterfly);
    normalizeGeometry(geoTrout);

    const geometries = [geoCommon, geoButterfly, geoTrout];

    // ── Divide fish among 3 models ─────────────────────────────────────
    const perModel = Math.floor(count / 3);
    const modelCounts = [perModel, perModel, count - perModel * 2];

    // ── GPUComputationRenderer ─────────────────────────────────────────
    const gpu = new GPUComputationRenderer(texSize, texSize, ren);
    const posTex = gpu.createTexture();
    const velTex = gpu.createTexture();
    const posArr = posTex.image.data as Float32Array;
    const velArr = velTex.image.data as Float32Array;

    const minR = stageRadius + 3;
    const maxR = boundRadius * 0.8;
    const [hMin, hMax] = swimHeight;
    const [sMin, sMax] = speed;

    // ── Generate cluster centers ───────────────────────────────────────
    const clusterCenters: { x: number; y: number; z: number; angle: number }[] = [];
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const cAngle = (c / CLUSTER_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const cR = minR + Math.random() * (maxR - minR);
      clusterCenters.push({
        x: Math.cos(cAngle) * cR,
        y: gy + hMin + Math.random() * (hMax - hMin),
        z: Math.sin(cAngle) * cR,
        angle: cAngle,
      });
    }

    // ── Initialize positions & velocities with clustered spawning ──────
    for (let i = 0; i < texSize * texSize; i++) {
      const idx = i * 4;
      if (i < count) {
        // Assign to a cluster (round-robin)
        const cluster = clusterCenters[i % CLUSTER_COUNT]!;

        // Random offset within cluster radius
        const offAngle = Math.random() * Math.PI * 2;
        const offR = Math.random() * CLUSTER_SPREAD;
        const offY = (Math.random() - 0.5) * CLUSTER_SPREAD * 0.6;

        posArr[idx + 0] = cluster.x + Math.cos(offAngle) * offR;
        posArr[idx + 1] = cluster.y + offY;
        posArr[idx + 2] = cluster.z + Math.sin(offAngle) * offR;
        posArr[idx + 3] = (Math.random() - 0.5) * 1.2; // hue offset

        // Initial velocity: perpendicular to the cluster's radial direction
        // (so the sub-school is already swimming together in a circular path)
        const perpAngle = cluster.angle + Math.PI / 2;
        const vSpeed = sMin + Math.random() * (sMax - sMin);
        const jitter = (Math.random() - 0.5) * 0.3;
        velArr[idx + 0] = Math.cos(perpAngle + jitter) * vSpeed;
        velArr[idx + 1] = (Math.random() - 0.5) * 0.15;
        velArr[idx + 2] = Math.sin(perpAngle + jitter) * vSpeed;
        velArr[idx + 3] = 0.6 + Math.random() * 0.8; // instance scale
      } else {
        posArr[idx + 0] = 9999;
        posArr[idx + 1] = 9999;
        posArr[idx + 2] = 9999;
        posArr[idx + 3] = 0;
      }
    }

    posVar = gpu.addVariable("texturePosition", positionShader, posTex);
    velVar = gpu.addVariable("textureVelocity", velocityShader, velTex);
    gpu.setVariableDependencies(posVar, [posVar, velVar]);
    gpu.setVariableDependencies(velVar, [posVar, velVar]);

    const velUniforms = velVar.material.uniforms;
    velUniforms.uDelta = { value: 0 };
    velUniforms.uSepDist = { value: 1.5 };
    velUniforms.uAliDist = { value: 3.5 };
    velUniforms.uMaxSpeed = { value: sMax * 2.0 };
    velUniforms.uMinSpeed = { value: sMin };
    velUniforms.uMaxSteer = { value: 2.0 };
    velUniforms.uGroundY = { value: gy };
    velUniforms.uHeightMin = { value: hMin };
    velUniforms.uHeightMax = { value: hMax };
    velUniforms.uStageRadius = { value: stageRadius };
    velUniforms.uBoundRadius = { value: boundRadius };
    velUniforms.uFishCount = { value: count };

    posVar.material.uniforms.uDelta = { value: 0 };

    const err = gpu.init();
    if (err !== null) {
      console.error("[FishSchool] GPUComputationRenderer init failed:", err);
      return;
    }

    // ── Create one InstancedMesh per model ─────────────────────────────
    const createdMeshes: InstancedMesh[] = [];
    const createdMaterials: ShaderMaterial[] = [];
    let fishOffset = 0;

    for (let m = 0; m < 3; m++) {
      const mCount = modelCounts[m]!;
      const geo = geometries[m]!;

      // Build aReference attribute pointing to this model's subset of texels
      const refs = new Float32Array(mCount * 2);
      for (let i = 0; i < mCount; i++) {
        const globalIdx = fishOffset + i;
        const col = globalIdx % texSize;
        const row = Math.floor(globalIdx / texSize);
        refs[i * 2 + 0] = (col + 0.5) / texSize;
        refs[i * 2 + 1] = (row + 0.5) / texSize;
      }
      geo.setAttribute("aReference", new InstancedBufferAttribute(refs, 2));

      const mat = new ShaderMaterial({
        uniforms: {
          tPosition: { value: null },
          tVelocity: { value: null },
          uSize: { value: targetSize },
          uTime: { value: 0 },
          uBaseColor: { value: new Color(baseColor) },
          uLightDir: { value: new Vector3(0.3, 1.0, 0.2).normalize() },
          uAmbient: { value: 0.55 },
          uFogColor: { value: new Color("#1a3040") },
          uFogNear: { value: 15 },
          uFogFar: { value: 25 },
        },
        vertexShader: renderVertexShader,
        fragmentShader: renderFragmentShader,
        side: DoubleSide,
      });

      const mesh = new InstancedMesh(geo, mat, mCount);
      mesh.frustumCulled = false;

      createdMeshes.push(mesh);
      createdMaterials.push(mat);
      fishOffset += mCount;
    }

    meshes = createdMeshes;
    materials = createdMaterials;
    gpuCompute = gpu;

    return () => {
      gpu.dispose();
      for (const geo of geometries) geo.dispose();
      for (const mat of createdMaterials) mat.dispose();
      for (const mesh of createdMeshes) mesh.dispose();
      meshes = [];
      materials = [];
      gpuCompute = null;
      posVar = null;
      velVar = null;
    };
  });

  // ── Frame Update ───────────────────────────────────────────────────────

  let elapsed = 0;

  useTask((delta) => {
    if (!gpuCompute || !posVar || !velVar || materials.length === 0) return;

    const dt = Math.min(delta, 0.05);
    elapsed += dt;

    velVar.material.uniforms.uDelta.value = dt;
    posVar.material.uniforms.uDelta.value = dt;

    gpuCompute.compute();

    const posTex = gpuCompute.getCurrentRenderTarget(posVar).texture;
    const velTex = gpuCompute.getCurrentRenderTarget(velVar).texture;

    for (const mat of materials) {
      mat.uniforms.tPosition!.value = posTex;
      mat.uniforms.tVelocity!.value = velTex;
      mat.uniforms.uTime!.value = elapsed;
    }
  });
</script>

{#each meshes as mesh (mesh.id)}
  <T is={mesh} />
{/each}
