/**
 * GPU-accelerated SDF texture generator for reef obstacle avoidance.
 *
 * Uses three-mesh-bvh's GPU BVH traversal (MeshBVHUniformStruct +
 * bvhClosestPointToPoint GLSL) to compute signed distance on the GPU.
 * Each Z-slice of the 3D volume is rendered as a fullscreen quad —
 * the fragment shader runs the BVH closest-point query per texel.
 *
 * ~50-100ms on GPU vs multi-second on CPU.
 */

import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Data3DTexture,
  FloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH, MeshBVHUniformStruct, BVHShaderGLSL } from 'three-mesh-bvh';

const { common_functions, bvh_struct_definitions, bvh_distance_functions } = BVHShaderGLSL;

export interface SDFResult {
  texture: Data3DTexture;
  inverseMatrix: Matrix4;
  bounds: Box3;
}

export interface SDFGeneratorOptions {
  resolution?: number;
  padding?: number;
}

const sdfVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sdfFragmentShader = /* glsl */ `
  precision highp float;
  precision highp usampler2D;

  ${common_functions}
  ${bvh_struct_definitions}
  ${bvh_distance_functions}

  uniform BVH bvh;
  uniform vec3 uBoundsMin;
  uniform vec3 uBoundsSize;
  uniform float uZSlice;

  varying vec2 vUv;

  void main() {
    vec3 worldPos = uBoundsMin + vec3(vUv.x, vUv.y, uZSlice) * uBoundsSize;

    uvec4 faceIndices = uvec4(0u);
    vec3 faceNormal = vec3(0.0);
    vec3 barycoord = vec3(0.0);
    float side = 1.0;
    vec3 outPoint = vec3(0.0);

    float distSq = bvhClosestPointToPoint(
      bvh,
      worldPos, INFINITY,
      faceIndices, faceNormal, barycoord, side, outPoint
    );

    float dist = sqrt(distSq) * side;
    gl_FragColor = vec4(dist, 0.0, 0.0, 1.0);
  }
`;

let sharedQuadScene: Scene | null = null;
let sharedCamera: OrthographicCamera | null = null;
let sharedQuadMesh: Mesh | null = null;

function getQuadSetup(): { scene: Scene; camera: OrthographicCamera; mesh: Mesh } {
  if (!sharedQuadScene) {
    sharedQuadScene = new Scene();
    sharedCamera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
    const geo = new PlaneGeometry(1, 1);
    sharedQuadMesh = new Mesh(geo);
    sharedQuadScene.add(sharedQuadMesh);
  }
  return { scene: sharedQuadScene, camera: sharedCamera!, mesh: sharedQuadMesh! };
}

export function generateSDFTexture(
  object: Object3D,
  renderer: WebGLRenderer,
  options: SDFGeneratorOptions = {},
): SDFResult {
  const resolution = options.resolution ?? 64;
  const padding = options.padding ?? 1.5;

  object.updateMatrixWorld(true);

  const geometries: BufferGeometry[] = [];
  object.traverse((child) => {
    if (!(child as Mesh).isMesh) return;
    const mesh = child as Mesh;
    if (!mesh.geometry) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    // GLTF models use InterleavedBufferAttribute whose .count is read-only.
    // Extract to a plain BufferAttribute so MeshBVH can operate on it.
    const srcPos = geo.getAttribute('position');
    const count = srcPos.count;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = srcPos.getX(i);
      arr[i * 3 + 1] = srcPos.getY(i);
      arr[i * 3 + 2] = srcPos.getZ(i);
    }
    const indexAttr = geo.getIndex();
    const stripped = new BufferGeometry();
    stripped.setAttribute('position', new BufferAttribute(arr, 3));
    if (indexAttr) stripped.setIndex(indexAttr);
    geometries.push(stripped);
  });

  if (geometries.length === 0) {
    throw new Error('[sdf-generator] No meshes found in the provided Object3D');
  }

  const merged = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries, false);
  if (!merged) {
    throw new Error('[sdf-generator] mergeGeometries returned null');
  }

  const bvh = new MeshBVH(merged);

  const bounds = new Box3();
  bvh.getBoundingBox(bounds);
  bounds.expandByScalar(padding);

  const size = new Vector3();
  bounds.getSize(size);

  const inverseMatrix = new Matrix4();
  inverseMatrix.set(
    1 / size.x, 0, 0, -bounds.min.x / size.x,
    0, 1 / size.y, 0, -bounds.min.y / size.y,
    0, 0, 1 / size.z, -bounds.min.z / size.z,
    0, 0, 0, 1,
  );

  const bvhStruct = new MeshBVHUniformStruct();
  bvhStruct.updateFrom(bvh);

  // MeshBVHUniformStruct exposes index, position, bvhBounds, bvhContents
  // at runtime but the type declarations don't list them.
  const bvhAny = bvhStruct as any;

  const material = new ShaderMaterial({
    vertexShader: sdfVertexShader,
    fragmentShader: sdfFragmentShader,
    uniforms: {
      'bvh.index': { value: bvhAny.index },
      'bvh.position': { value: bvhAny.position },
      'bvh.bvhBounds': { value: bvhAny.bvhBounds },
      'bvh.bvhContents': { value: bvhAny.bvhContents },
      uBoundsMin: { value: bounds.min },
      uBoundsSize: { value: size },
      uZSlice: { value: 0 },
    },
  });

  const dim = resolution;

  // Render each Z-slice to a 2D target and read pixels back to CPU.
  // WebGL3DRenderTarget textures are framebuffer-backed (image.data = null),
  // so using them as shader uniforms causes per-frame texSubImage3D errors.
  const readbackTarget = new WebGLRenderTarget(dim, dim, {
    type: FloatType,
    depthBuffer: false,
    stencilBuffer: false,
  });

  const { scene, camera, mesh } = getQuadSetup();
  mesh.material = material;

  const savedRenderTarget = renderer.getRenderTarget();
  const savedAutoClear = renderer.autoClear;
  renderer.autoClear = false;

  const sliceTexels = dim * dim;
  const cpuData = new Float32Array(sliceTexels * dim);
  const sliceBuffer = new Float32Array(sliceTexels * 4);

  for (let z = 0; z < dim; z++) {
    material.uniforms.uZSlice!.value = (z + 0.5) / dim;
    renderer.setRenderTarget(readbackTarget);
    renderer.clear();
    renderer.render(scene, camera);

    renderer.readRenderTargetPixels(readbackTarget, 0, 0, dim, dim, sliceBuffer);
    for (let i = 0; i < sliceTexels; i++) {
      cpuData[z * sliceTexels + i] = sliceBuffer[i * 4]!;
    }
  }

  renderer.setRenderTarget(savedRenderTarget);
  renderer.autoClear = savedAutoClear;
  renderer.resetState();

  const texture = new Data3DTexture(cpuData, dim, dim, dim);
  texture.format = RedFormat;
  texture.type = FloatType;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  readbackTarget.dispose();
  material.dispose();
  bvhStruct.dispose();
  for (const geo of geometries) geo.dispose();
  merged.dispose();

  return { texture, inverseMatrix, bounds };
}
