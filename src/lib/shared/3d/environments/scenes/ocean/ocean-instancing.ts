import {
  InstancedMesh,
  InstancedBufferAttribute,
  Matrix4,
  Vector3,
  Quaternion,
  Euler,
  Color,
  Object3D,
  Mesh,
  Sphere,
  type BufferGeometry,
  type Material,
  MeshStandardMaterial,
} from 'three';

export interface InstancePlacement {
  x: number;
  z: number;
  y: number;
  scale: number;
  rotY: number;
}

export interface ColoredInstancePlacement extends InstancePlacement {
  color: Color;
}

function extractFirstMeshGeometryAndMaterial(
  root: Object3D,
): { geometry: BufferGeometry; material: Material; meshWorldMatrix: Matrix4 } | null {
  root.updateMatrixWorld(true);
  let result: { geometry: BufferGeometry; material: Material; meshWorldMatrix: Matrix4 } | null = null;
  root.traverse((child) => {
    if (result) return;
    const m = child as Mesh;
    if (!m.isMesh || !m.geometry) return;
    const mat = Array.isArray(m.material) ? m.material[0]! : m.material;
    result = { geometry: m.geometry, material: mat, meshWorldMatrix: m.matrixWorld.clone() };
  });
  return result;
}

export function createInstancedMeshFromModel(
  model: Object3D,
  placements: InstancePlacement[],
): InstancedMesh | null {
  if (placements.length === 0) return null;

  const extracted = extractFirstMeshGeometryAndMaterial(model);
  if (!extracted) return null;

  const geo = extracted.geometry.clone();
  geo.applyMatrix4(extracted.meshWorldMatrix);
  const clonedMat = (extracted.material as import('three').MeshStandardMaterial).clone();
  const inst = new InstancedMesh(geo, clonedMat, placements.length);
  inst.frustumCulled = true;

  const mat = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const pos = new Vector3();
  const euler = new Euler();

  let maxDist = 0;
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!;
    euler.set(0, p.rotY, 0);
    q.setFromEuler(euler);
    s.setScalar(p.scale);
    pos.set(p.x, p.y, p.z);
    mat.compose(pos, q, s);
    inst.setMatrixAt(i, mat);
    const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) + p.scale * 2;
    if (dist > maxDist) maxDist = dist;
  }

  inst.instanceMatrix.needsUpdate = true;
  inst.geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), maxDist);
  return inst;
}

export function createColoredInstancedMesh(
  model: Object3D,
  placements: ColoredInstancePlacement[],
): InstancedMesh | null {
  if (placements.length === 0) return null;

  const extracted = extractFirstMeshGeometryAndMaterial(model);
  if (!extracted) return null;

  const baseMat = extracted.material as MeshStandardMaterial;
  const instanceMat = baseMat.clone();

  instanceMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      attribute vec3 aInstanceColor;
      varying vec3 vInstanceColor;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vInstanceColor = aInstanceColor;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vInstanceColor;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb *= vInstanceColor;`,
    );
  };

  const geo = extracted.geometry.clone();
  geo.applyMatrix4(extracted.meshWorldMatrix);
  const colors = new Float32Array(placements.length * 3);
  for (let i = 0; i < placements.length; i++) {
    const c = placements[i]!.color;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('aInstanceColor', new InstancedBufferAttribute(colors, 3));

  const inst = new InstancedMesh(geo, instanceMat, placements.length);
  inst.frustumCulled = true;

  const mat = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const pos = new Vector3();
  const euler = new Euler();

  let maxDist = 0;
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!;
    euler.set(0, p.rotY, 0);
    q.setFromEuler(euler);
    s.setScalar(p.scale);
    pos.set(p.x, p.y, p.z);
    mat.compose(pos, q, s);
    inst.setMatrixAt(i, mat);
    const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) + p.scale * 2;
    if (dist > maxDist) maxDist = dist;
  }

  inst.instanceMatrix.needsUpdate = true;
  inst.geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), maxDist);
  return inst;
}

export interface SwayConfig {
  speed: number;
  amplitude: number;
  currentDirection?: [number, number];
}

export interface SwayingInstancedMeshResult {
  mesh: InstancedMesh;
  timeUniform: { value: number };
}

export function createSwayingInstancedMesh(
  model: Object3D,
  placements: InstancePlacement[],
  sway: SwayConfig,
): SwayingInstancedMeshResult | null {
  if (placements.length === 0) return null;

  const extracted = extractFirstMeshGeometryAndMaterial(model);
  if (!extracted) return null;

  const geo = extracted.geometry.clone();
  geo.applyMatrix4(extracted.meshWorldMatrix);

  const bbox = geo.boundingBox ?? (geo.computeBoundingBox(), geo.boundingBox!);
  const modelHeight = Math.max(bbox.max.y - bbox.min.y, 0.01);
  const modelBaseY = bbox.min.y;

  // Per-instance random phase offset so kelps don't sway in lockstep
  const phaseOffsets = new Float32Array(placements.length);
  for (let i = 0; i < placements.length; i++) {
    phaseOffsets[i] = Math.random() * Math.PI * 2;
  }
  geo.setAttribute('aPhaseOffset', new InstancedBufferAttribute(phaseOffsets, 1));

  const baseMat = (extracted.material as MeshStandardMaterial).clone();
  baseMat.customProgramCacheKey = () => 'kelp-sway';

  const timeUniform = { value: 0 };
  const currentDir = sway.currentDirection ?? [0.6, 0.3];

  baseMat.onBeforeCompile = (shader) => {
    shader.uniforms.uSwayTime = timeUniform;
    shader.uniforms.uSwaySpeed = { value: sway.speed };
    shader.uniforms.uSwayAmplitude = { value: sway.amplitude };
    shader.uniforms.uModelBaseY = { value: modelBaseY };
    shader.uniforms.uModelHeight = { value: modelHeight };
    shader.uniforms.uCurrentDir = { value: [currentDir[0], currentDir[1]] };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uSwayTime;
      uniform float uSwaySpeed;
      uniform float uSwayAmplitude;
      uniform float uModelBaseY;
      uniform float uModelHeight;
      uniform vec2 uCurrentDir;
      attribute float aPhaseOffset;`,
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `float heightFactor = clamp((transformed.y - uModelBaseY) / uModelHeight, 0.0, 1.0);
      heightFactor *= heightFactor;
      float t = uSwayTime * uSwaySpeed + aPhaseOffset;
      float phase = transformed.x * 0.3 + transformed.z * 0.2;
      // Primary sway
      float swayX = sin(t + phase) * uSwayAmplitude * heightFactor;
      float swayZ = cos(t * 0.7 + phase + 1.57) * uSwayAmplitude * 0.6 * heightFactor;
      // Second octave — slower drift underneath
      swayX += sin(t * 0.3 + phase * 0.5) * uSwayAmplitude * 0.4 * heightFactor;
      swayZ += cos(t * 0.2 + phase * 0.5 + 2.3) * uSwayAmplitude * 0.3 * heightFactor;
      // Bias toward current direction
      swayX += uCurrentDir.x * heightFactor * uSwayAmplitude * 0.5;
      swayZ += uCurrentDir.y * heightFactor * uSwayAmplitude * 0.5;
      transformed.x += swayX;
      transformed.z += swayZ;
      #include <project_vertex>`,
    );
  };

  const inst = new InstancedMesh(geo, baseMat, placements.length);
  inst.frustumCulled = true;

  const mat = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const pos = new Vector3();
  const euler = new Euler();

  let maxDist = 0;
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!;
    euler.set(0, p.rotY, 0);
    q.setFromEuler(euler);
    s.setScalar(p.scale);
    pos.set(p.x, p.y, p.z);
    mat.compose(pos, q, s);
    inst.setMatrixAt(i, mat);
    const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) + p.scale * 2;
    if (dist > maxDist) maxDist = dist;
  }

  inst.instanceMatrix.needsUpdate = true;
  // Extra padding for sway amplitude displacement
  inst.geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), maxDist + sway.amplitude * 3);
  return { mesh: inst, timeUniform };
}

export function disposeInstancedMesh(inst: InstancedMesh | null): void {
  if (!inst) return;
  inst.geometry.dispose();
  const mat = inst.material;
  if (Array.isArray(mat)) {
    for (const m of mat) m.dispose();
  } else {
    mat.dispose();
  }
}
