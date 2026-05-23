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
): { geometry: BufferGeometry; material: Material } | null {
  let result: { geometry: BufferGeometry; material: Material } | null = null;
  root.traverse((child) => {
    if (result) return;
    const m = child as Mesh;
    if (!m.isMesh || !m.geometry) return;
    const mat = Array.isArray(m.material) ? m.material[0]! : m.material;
    result = { geometry: m.geometry, material: mat };
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
  const clonedMat = (extracted.material as import('three').MeshStandardMaterial).clone();
  const inst = new InstancedMesh(geo, clonedMat, placements.length);
  inst.frustumCulled = false;

  const mat = new Matrix4();
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
    mat.compose(pos, q, s);
    inst.setMatrixAt(i, mat);
  }

  inst.instanceMatrix.needsUpdate = true;
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
  const colors = new Float32Array(placements.length * 3);
  for (let i = 0; i < placements.length; i++) {
    const c = placements[i]!.color;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('aInstanceColor', new InstancedBufferAttribute(colors, 3));

  const inst = new InstancedMesh(geo, instanceMat, placements.length);
  inst.frustumCulled = false;

  const mat = new Matrix4();
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
    mat.compose(pos, q, s);
    inst.setMatrixAt(i, mat);
  }

  inst.instanceMatrix.needsUpdate = true;
  return inst;
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
