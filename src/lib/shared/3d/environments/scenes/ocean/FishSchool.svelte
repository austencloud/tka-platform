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
    DataTexture,
    FloatType,
    RGBAFormat,
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
    currentStrength?: number;
    swimFrequency?: number;
    waveAmplitude?: number;
    scatterRadius?: number;
    perceptionAngle?: number;
    rayPosition?: Vector3;
  }

  let {
    count = 80,
    targetSize = 0.08,
    swimHeight = [2, 7] as [number, number],
    speed = [0.5, 1.2] as [number, number],
    stageRadius = 5,
    boundRadius = 18,
    baseColor = "#5599bb",
    currentStrength = 0.3,
    swimFrequency = 5.0,
    waveAmplitude = 0.08,
    scatterRadius = 4.0,
    perceptionAngle = 135,
    rayPosition = new Vector3(0, 0, 0),
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
  uniform float uTime;
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
  uniform float uCurrentStrength;
  uniform float uPerceptionCos;
  uniform sampler2D tTraits;

  // Scatter uniforms
  uniform vec3 uScatterOrigin;
  uniform float uScatterRadius;
  uniform float uScatterForce;

  // Dart impulse uniforms
  uniform int uDartCount;
  uniform int uDartIndices[8];
  uniform float uDartStrength;

  // Vertical excursion uniforms
  uniform int uExcursionCount;
  uniform int uExcursionIndices[4];
  uniform float uExcursionBias[4];

  // ── Simplex 3D noise (Stefan Gustavson / Ashima Arts) ─────────────
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  vec3 curlNoise(vec3 p) {
    float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    float px = snoise(p + dx) - snoise(p - dx);
    float py = snoise(p + dy) - snoise(p - dy);
    float pz = snoise(p + dz) - snoise(p - dz);
    return vec3(py - pz, pz - px, px - py) / (2.0 * e);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec4 velData = texture2D(textureVelocity, uv);
    vec3 vel = velData.xyz;
    float instanceScale = velData.w;

    if (pos.x > 9000.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, instanceScale); return; }

    // Read per-fish traits
    vec4 traits = texture2D(tTraits, uv);
    float speedMult = traits.r;
    float socialMult = traits.g;
    float boldness = traits.b;

    vec3 sep = vec3(0.0);
    vec3 ali = vec3(0.0);
    vec3 coh = vec3(0.0);
    float sepN = 0.0;
    float aliN = 0.0;
    float cohN = 0.0;

    vec3 forward = length(vel) > 0.001 ? normalize(vel) : vec3(0.0, 0.0, 1.0);

    for (float y = 0.0; y < resolution.y; y += 1.0) {
      for (float x = 0.0; x < resolution.x; x += 1.0) {
        vec2 ref = (vec2(x, y) + 0.5) / resolution.xy;
        vec3 op = texture2D(texturePosition, ref).xyz;
        if (op.x > 9000.0) continue;

        vec3 toNeighbor = op - pos;
        float d = length(toNeighbor);
        if (d < 0.001 || d > uAliDist * 1.5) continue;

        // Perception cone: reject neighbors behind (270 deg FOV)
        float cosAngle = dot(forward, normalize(toNeighbor));
        if (cosAngle < uPerceptionCos) continue;

        if (d < uSepDist) {
          sep += normalize(pos - op) * (1.0 - d / uSepDist);
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
    if (aliN > 0.0) steer += normalize(ali / aliN - vel) * 0.4 * socialMult;
    if (cohN > 0.0) steer += normalize(coh / cohN - pos) * 0.3 * socialMult;

    // Curl noise flow field
    vec3 curlForce = curlNoise(pos * 0.15 + uTime * 0.02) * uCurrentStrength;
    steer += curlForce;

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

    // Stage avoidance — bold fish tolerate closer proximity
    float avoidDist = (uStageRadius + 2.5) * (1.5 - boldness * 0.4);
    if (distXZ < avoidDist) {
      float pen = avoidDist - distXZ;
      steer.xz += normalize(pos.xz + 0.001) * pen * 3.0;
    }

    // Ray scatter — continuous avoidance when ray passes through school
    float distToRay = distance(pos, uScatterOrigin);
    if (distToRay < uScatterRadius && uScatterForce > 0.0) {
      vec3 away = normalize(pos - uScatterOrigin + vec3(0.001));
      float proximity = 1.0 - distToRay / uScatterRadius;
      steer += away * uScatterForce * proximity * proximity;
    }

    // Clamp max steering force
    float steerLen = length(steer);
    if (steerLen > uMaxSteer) steer = steer / steerLen * uMaxSteer;

    // Apply steering with drag
    vel = vel * 0.97 + steer * uDelta;

    // Per-fish speed clamp using trait-modulated range
    float adjMax = uMaxSpeed * speedMult;
    float adjMin = uMinSpeed * speedMult;
    float spd = length(vel);
    if (spd > adjMax) vel = vel / spd * adjMax;
    if (spd > 0.001 && spd < adjMin) vel = vel / spd * adjMin;

    // Dart impulses — AFTER speed clamp so velocity spike is visible to
    // the vertex shader C-start detection. Drag decays it next frame.
    int fishIdx = int(gl_FragCoord.y) * int(resolution.x) + int(gl_FragCoord.x);
    for (int i = 0; i < 8; i++) {
      if (i >= uDartCount) break;
      if (fishIdx == uDartIndices[i]) {
        vel += normalize(vel + vec3(0.001)) * uDartStrength;
      }
    }

    // Vertical excursions — also after clamp
    for (int i = 0; i < 4; i++) {
      if (i >= uExcursionCount) break;
      if (fishIdx == uExcursionIndices[i]) {
        vel.y += uExcursionBias[i];
      }
    }

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
  uniform float uSwimFreq;
  uniform float uWaveNumber;
  uniform float uBaseAmplitude;
  uniform float uMaxSpeed;

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
    vec3 localPos = position;

    // Undulatory propulsion — cosine wave traveling head to tail
    float perInstanceJitter = aReference.x * 2.0;
    float bodyPhase = uTime * (uSwimFreq + perInstanceJitter) + localPos.z * uWaveNumber;
    float bodyLength = 1.0;
    float amplitude = uBaseAmplitude * (0.2 + 0.8 * max(0.0, -localPos.z / bodyLength));
    float swimSpeed = length(fishVel);
    amplitude *= 0.5 + swimSpeed * 0.8;
    localPos.x += sin(bodyPhase) * amplitude;

    // C-start escape — sharp body bend when darting (velocity > 2x normal)
    float speedRatio = swimSpeed / (uMaxSpeed * 0.5);
    float cStartIntensity = smoothstep(1.5, 2.5, speedRatio);
    float cBend = cStartIntensity * sin(localPos.z * 1.5) * 0.3;
    localPos.x += cBend;

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
  let storedTraitsData: Float32Array | null = null;

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
    const SPECIES = [
      { name: "common",    fraction: 0.35,  speed: [0.8, 1.2] as [number, number], social: [0.7, 1.3] as [number, number], bold: [0.6, 1.0] as [number, number] },
      { name: "butterfly", fraction: 0.325, speed: [0.6, 0.9] as [number, number], social: [1.0, 1.5] as [number, number], bold: [0.5, 0.8] as [number, number] },
      { name: "trout",     fraction: 0.325, speed: [1.1, 1.6] as [number, number], social: [0.5, 0.9] as [number, number], bold: [0.9, 1.3] as [number, number] },
    ] as const;

    const commonCount = Math.ceil(count * SPECIES[0].fraction);
    const butterflyCount = Math.floor(count * SPECIES[1].fraction);
    const troutCount = count - commonCount - butterflyCount;
    const modelCounts = [commonCount, butterflyCount, troutCount];

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

    // ── Traits DataTexture (static, per-fish personality) ─────────────
    const traitsData = new Float32Array(texSize * texSize * 4);
    let speciesOffset = 0;
    for (let s = 0; s < 3; s++) {
      const sp = SPECIES[s]!;
      const sCount = modelCounts[s]!;
      for (let j = 0; j < sCount; j++) {
        const gi = speciesOffset + j;
        const idx = gi * 4;
        const rand = () => Math.random();
        traitsData[idx + 0] = sp.speed[0] + rand() * (sp.speed[1] - sp.speed[0]);
        traitsData[idx + 1] = sp.social[0] + rand() * (sp.social[1] - sp.social[0]);
        traitsData[idx + 2] = sp.bold[0] + rand() * (sp.bold[1] - sp.bold[0]);
        traitsData[idx + 3] = rand();
      }
      speciesOffset += sCount;
    }
    const traitsTex = new DataTexture(traitsData, texSize, texSize, RGBAFormat, FloatType);
    traitsTex.needsUpdate = true;
    storedTraitsData = traitsData;

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
    velUniforms.tTraits = { value: traitsTex };
    velUniforms.uTime = { value: 0 };
    velUniforms.uCurrentStrength = { value: currentStrength };
    velUniforms.uPerceptionCos = { value: Math.cos(perceptionAngle * Math.PI / 180) };
    velUniforms.uScatterOrigin = { value: new Vector3(0, 0, 0) };
    velUniforms.uScatterRadius = { value: scatterRadius };
    velUniforms.uScatterForce = { value: 3.0 };
    velUniforms.uDartCount = { value: 0 };
    velUniforms.uDartIndices = { value: new Int32Array(8).fill(-1) };
    velUniforms.uDartStrength = { value: 2.0 };
    velUniforms.uExcursionCount = { value: 0 };
    velUniforms.uExcursionIndices = { value: new Int32Array(4).fill(-1) };
    velUniforms.uExcursionBias = { value: new Float32Array(4) };

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
          uSwimFreq: { value: swimFrequency },
          uWaveNumber: { value: 3.0 },
          uBaseAmplitude: { value: waveAmplitude },
          uMaxSpeed: { value: sMax * 2.0 },
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
      traitsTex.dispose();
      storedTraitsData = null;
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
    velVar.material.uniforms.uTime.value = elapsed;
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
