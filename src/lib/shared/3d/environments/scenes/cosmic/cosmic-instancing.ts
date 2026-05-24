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
  type BufferGeometry,
  type Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  CylinderGeometry,
  ConeGeometry,
} from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  CRYSTAL_VERTEX_PARS,
  CRYSTAL_VERTEX_MAIN,
  CRYSTAL_FRAGMENT_PARS,
  CRYSTAL_FRAGMENT_EMISSIVE,
  GLB_CRYSTAL_VERTEX_PARS,
  GLB_CRYSTAL_VERTEX_MAIN,
  GLB_CRYSTAL_FRAGMENT_PARS,
  GLB_CRYSTAL_FRAGMENT_EMISSIVE,
} from './crystal-shaders';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrystalPlacement {
  x: number;
  z: number;
  y: number;
  scale: number;
  rotY: number;
  glowIntensity: number;
  glowPhase: number;
  color?: Color;
}

export type CrystalSpecies = 'spire' | 'cluster' | 'plate' | 'branch';

// ---------------------------------------------------------------------------
// Procedural geometry factories (fallback when GLBs not available)
// ---------------------------------------------------------------------------

function createSpireGeometry(): BufferGeometry {
  const shaft = new CylinderGeometry(0.08, 0.12, 1.0, 6, 1);
  const cap = new ConeGeometry(0.10, 0.35, 6, 1);
  cap.translate(0, 0.675, 0);
  const merged = BufferGeometryUtils.mergeGeometries([shaft, cap]);
  merged.translate(0, 0.5, 0);
  return merged;
}

function createClusterGeometry(): BufferGeometry {
  const shards: BufferGeometry[] = [];
  const rng = seedRng(77);
  for (let i = 0; i < 4; i++) {
    const h = 0.3 + rng() * 0.5;
    const r = 0.04 + rng() * 0.06;
    const shard = new ConeGeometry(r, h, 6, 1);
    shard.rotateX((rng() - 0.5) * 0.4);
    shard.rotateZ((rng() - 0.5) * 0.4);
    shard.translate((rng() - 0.5) * 0.15, h * 0.5, (rng() - 0.5) * 0.15);
    shards.push(shard);
  }
  return BufferGeometryUtils.mergeGeometries(shards);
}

function createPlateGeometry(): BufferGeometry {
  const plates: BufferGeometry[] = [];
  const rng = seedRng(123);
  for (let i = 0; i < 3; i++) {
    const plate = new CylinderGeometry(0.2 + rng() * 0.15, 0.25 + rng() * 0.1, 0.03, 8, 1);
    const angle = (i / 3) * Math.PI * 2 + rng() * 0.5;
    plate.rotateX(0.3 + rng() * 0.6);
    plate.rotateY(angle);
    plate.translate(Math.cos(angle) * 0.08, 0.1 + rng() * 0.15, Math.sin(angle) * 0.08);
    plates.push(plate);
  }
  return BufferGeometryUtils.mergeGeometries(plates);
}

function createBranchGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const trunk = new CylinderGeometry(0.05, 0.08, 0.8, 6, 1);
  trunk.translate(0, 0.4, 0);
  parts.push(trunk);
  const rng = seedRng(456);
  for (let i = 0; i < 3; i++) {
    const branchLen = 0.25 + rng() * 0.2;
    const branch = new CylinderGeometry(0.025, 0.04, branchLen, 6, 1);
    const angle = (i / 3) * Math.PI * 2 + rng() * 0.8;
    const height = 0.35 + rng() * 0.35;
    const tilt = 0.5 + rng() * 0.5;
    branch.rotateZ(tilt * (i % 2 === 0 ? 1 : -1));
    branch.rotateY(angle);
    branch.translate(Math.cos(angle) * 0.1, height, Math.sin(angle) * 0.1);
    parts.push(branch);
  }
  return BufferGeometryUtils.mergeGeometries(parts);
}

const GEOMETRY_FACTORIES: Record<CrystalSpecies, () => BufferGeometry> = {
  spire: createSpireGeometry,
  cluster: createClusterGeometry,
  plate: createPlateGeometry,
  branch: createBranchGeometry,
};

export function createCrystalGeometry(species: CrystalSpecies): BufferGeometry {
  return GEOMETRY_FACTORIES[species]();
}

// ---------------------------------------------------------------------------
// Procedural instancing (custom material, per-instance color)
// ---------------------------------------------------------------------------

export function createCrystalInstancedMesh(
  geometry: BufferGeometry,
  placements: CrystalPlacement[],
  baseMaterial?: MeshPhysicalMaterial,
): { mesh: InstancedMesh; material: MeshPhysicalMaterial } {
  const count = placements.length;

  const mat = baseMaterial?.clone() ?? new MeshPhysicalMaterial({
    transmission: 0.7,
    thickness: 0.4,
    roughness: 0.05,
    metalness: 0.0,
    ior: 1.45,
    iridescence: 0.5,
    iridescenceIOR: 1.3,
    transparent: true,
    opacity: 0.85,
    envMapIntensity: 1.5,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCrystalTime = { value: 0 };
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>', `#include <common>\n${CRYSTAL_VERTEX_PARS}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>', `#include <begin_vertex>\n${CRYSTAL_VERTEX_MAIN}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>', `#include <common>\n${CRYSTAL_FRAGMENT_PARS}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${CRYSTAL_FRAGMENT_EMISSIVE}`,
    );
    (mat as any).__crystalShader = shader;
  };

  const colors = new Float32Array(count * 3);
  const glowIntensities = new Float32Array(count);
  const glowPhases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const p = placements[i]!;
    const c = p.color ?? new Color(0x4488ff);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    glowIntensities[i] = p.glowIntensity;
    glowPhases[i] = p.glowPhase;
  }

  const geo = geometry.clone();
  geo.setAttribute('aInstanceColor', new InstancedBufferAttribute(colors, 3));
  geo.setAttribute('aGlowIntensity', new InstancedBufferAttribute(glowIntensities, 1));
  geo.setAttribute('aGlowPhase', new InstancedBufferAttribute(glowPhases, 1));

  const inst = new InstancedMesh(geo, mat, count);
  inst.frustumCulled = false;
  applyTransforms(inst, placements);

  return { mesh: inst, material: mat };
}

// ---------------------------------------------------------------------------
// GLB instancing (preserve baked textures, additive glow only)
// ---------------------------------------------------------------------------

export interface GLBExtraction {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
}

export function extractFromGLB(model: Object3D): GLBExtraction | null {
  model.updateMatrixWorld(true);
  let result: GLBExtraction | null = null;

  model.traverse((child) => {
    if (result) return;
    const m = child as Mesh;
    if (!m.isMesh || !m.geometry) return;
    const mat = Array.isArray(m.material) ? m.material[0]! : m.material;
    const geo = m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);
    result = {
      geometry: geo,
      material: (mat as MeshStandardMaterial).clone(),
    };
  });

  return result;
}

export function createGLBCrystalInstancedMesh(
  extraction: GLBExtraction,
  placements: CrystalPlacement[],
): { mesh: InstancedMesh; material: MeshStandardMaterial } {
  const count = placements.length;
  const mat = extraction.material;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCrystalTime = { value: 0 };
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>', `#include <common>\n${GLB_CRYSTAL_VERTEX_PARS}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>', `#include <begin_vertex>\n${GLB_CRYSTAL_VERTEX_MAIN}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>', `#include <common>\n${GLB_CRYSTAL_FRAGMENT_PARS}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${GLB_CRYSTAL_FRAGMENT_EMISSIVE}`,
    );
    (mat as any).__crystalShader = shader;
  };

  const glowIntensities = new Float32Array(count);
  const glowPhases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const p = placements[i]!;
    glowIntensities[i] = p.glowIntensity;
    glowPhases[i] = p.glowPhase;
  }

  const geo = extraction.geometry.clone();
  geo.setAttribute('aGlowIntensity', new InstancedBufferAttribute(glowIntensities, 1));
  geo.setAttribute('aGlowPhase', new InstancedBufferAttribute(glowPhases, 1));

  const inst = new InstancedMesh(geo, mat, count);
  inst.frustumCulled = false;
  applyTransforms(inst, placements);

  return { mesh: inst, material: mat };
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export function updateCrystalTime(mat: MeshStandardMaterial | MeshPhysicalMaterial, time: number): void {
  const shader = (mat as any).__crystalShader;
  if (shader?.uniforms?.uCrystalTime) {
    shader.uniforms.uCrystalTime.value = time;
  }
}

export function disposeCrystalMesh(inst: InstancedMesh | null): void {
  if (!inst) return;
  inst.geometry.dispose();
  const mat = inst.material;
  if (Array.isArray(mat)) {
    for (const m of mat) m.dispose();
  } else {
    mat.dispose();
  }
}

function applyTransforms(inst: InstancedMesh, placements: CrystalPlacement[]): void {
  const m4 = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const pos = new Vector3();
  const euler = new Euler();

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!;
    euler.set(0, p.rotY, 0);
    q.setFromEuler(euler);
    s.setScalar(p.scale);
    pos.set(p.x, p.y, p.z);
    m4.compose(pos, q, s);
    inst.setMatrixAt(i, m4);
  }
  inst.instanceMatrix.needsUpdate = true;
}

function seedRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
