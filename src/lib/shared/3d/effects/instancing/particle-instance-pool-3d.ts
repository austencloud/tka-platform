import {
  AdditiveBlending,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  NormalBlending,
  Object3D,
  ShaderMaterial,
  type Blending,
  type BufferGeometry,
  type Texture,
} from "three";

export interface ParticleInstancePoolOptions {
  capacity: number;
  geometry: BufferGeometry;
  billboard?: boolean;
  texture?: Texture | null;
  wireframe?: boolean;
  additive?: boolean;
  renderOrder?: number;
}

export interface ParticleInstanceWrite {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  quaternionX?: number;
  quaternionY?: number;
  quaternionZ?: number;
  quaternionW?: number;
  red: number;
  green: number;
  blue: number;
  alpha: number;
  uvX?: number;
  uvY?: number;
  uvWidth?: number;
  uvHeight?: number;
}

const orientedVertexShader = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aScale;
  attribute vec4 aQuaternion;
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute vec4 aUvRect;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 rotateByQuaternion(vec3 value, vec4 quaternion) {
    vec3 offset = 2.0 * cross(quaternion.xyz, value);
    return value + quaternion.w * offset + cross(quaternion.xyz, offset);
  }

  void main() {
    vUv = aUvRect.xy + uv * aUvRect.zw;
    vColor = aColor;
    vAlpha = aAlpha;

    vec3 local = rotateByQuaternion(position * aScale, aQuaternion);
    vec4 viewPosition = modelViewMatrix * vec4(aCenter + local, 1.0);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const billboardVertexShader = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aScale;
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute vec4 aUvRect;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vUv = aUvRect.xy + uv * aUvRect.zw;
    vColor = aColor;
    vAlpha = aAlpha;

    vec4 viewPosition = modelViewMatrix * vec4(aCenter, 1.0);
    viewPosition.xy += position.xy * aScale.xy;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const texturedFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 sampleColor = texture2D(uMap, vUv);
    float alpha = sampleColor.a * vAlpha;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(sampleColor.rgb * vColor, alpha);
  }
`;

const solidFragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.004) discard;
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

/**
 * One GPU draw for a whole effect pool.
 *
 * Renderers write directly into stable typed attributes. There are no
 * per-particle Svelte components, object arrays, matrices, colors, or
 * quaternions to allocate in the frame loop.
 */
export class ParticleInstancePool3D {
  readonly capacity: number;
  readonly mesh: InstancedMesh;

  private readonly centers: Float32Array;
  private readonly scales: Float32Array;
  private readonly quaternions: Float32Array;
  private readonly colors: Float32Array;
  private readonly alphas: Float32Array;
  private readonly uvRects: Float32Array;
  private readonly attributes: readonly InstancedBufferAttribute[];
  private readonly material: ShaderMaterial;
  private visibleCount = 0;
  private parent: Object3D | null = null;

  constructor(options: ParticleInstancePoolOptions) {
    this.capacity = options.capacity;
    this.centers = new Float32Array(this.capacity * 3);
    this.scales = new Float32Array(this.capacity * 3);
    this.quaternions = new Float32Array(this.capacity * 4);
    this.colors = new Float32Array(this.capacity * 3);
    this.alphas = new Float32Array(this.capacity);
    this.uvRects = new Float32Array(this.capacity * 4);

    const centerAttribute = new InstancedBufferAttribute(
      this.centers,
      3
    ).setUsage(DynamicDrawUsage);
    const scaleAttribute = new InstancedBufferAttribute(
      this.scales,
      3
    ).setUsage(DynamicDrawUsage);
    const quaternionAttribute = new InstancedBufferAttribute(
      this.quaternions,
      4
    ).setUsage(DynamicDrawUsage);
    const colorAttribute = new InstancedBufferAttribute(
      this.colors,
      3
    ).setUsage(DynamicDrawUsage);
    const alphaAttribute = new InstancedBufferAttribute(
      this.alphas,
      1
    ).setUsage(DynamicDrawUsage);
    const uvRectAttribute = new InstancedBufferAttribute(
      this.uvRects,
      4
    ).setUsage(DynamicDrawUsage);
    this.attributes = [
      centerAttribute,
      scaleAttribute,
      quaternionAttribute,
      colorAttribute,
      alphaAttribute,
      uvRectAttribute,
    ];

    options.geometry.setAttribute("aCenter", centerAttribute);
    options.geometry.setAttribute("aScale", scaleAttribute);
    options.geometry.setAttribute("aQuaternion", quaternionAttribute);
    options.geometry.setAttribute("aColor", colorAttribute);
    options.geometry.setAttribute("aAlpha", alphaAttribute);
    options.geometry.setAttribute("aUvRect", uvRectAttribute);

    const blending: Blending = options.additive
      ? AdditiveBlending
      : NormalBlending;
    this.material = new ShaderMaterial({
      uniforms: options.texture ? { uMap: { value: options.texture } } : {},
      vertexShader: options.billboard
        ? billboardVertexShader
        : orientedVertexShader,
      fragmentShader: options.texture
        ? texturedFragmentShader
        : solidFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      wireframe: options.wireframe ?? false,
      blending,
    });

    this.mesh = new InstancedMesh(
      options.geometry,
      this.material,
      this.capacity
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = options.renderOrder ?? 100;
  }

  initialize(parent: Object3D): void {
    if (this.parent === parent) return;
    this.parent?.remove(this.mesh);
    this.parent = parent;
    parent.add(this.mesh);
  }

  beginFrame(): void {
    this.visibleCount = 0;
  }

  write(instance: ParticleInstanceWrite): boolean {
    const index = this.visibleCount;
    if (index >= this.capacity) return false;

    const i3 = index * 3;
    const i4 = index * 4;
    this.centers[i3] = instance.x;
    this.centers[i3 + 1] = instance.y;
    this.centers[i3 + 2] = instance.z;
    this.scales[i3] = instance.scaleX;
    this.scales[i3 + 1] = instance.scaleY;
    this.scales[i3 + 2] = instance.scaleZ;
    this.quaternions[i4] = instance.quaternionX ?? 0;
    this.quaternions[i4 + 1] = instance.quaternionY ?? 0;
    this.quaternions[i4 + 2] = instance.quaternionZ ?? 0;
    this.quaternions[i4 + 3] = instance.quaternionW ?? 1;
    this.colors[i3] = instance.red;
    this.colors[i3 + 1] = instance.green;
    this.colors[i3 + 2] = instance.blue;
    this.alphas[index] = instance.alpha;
    this.uvRects[i4] = instance.uvX ?? 0;
    this.uvRects[i4 + 1] = instance.uvY ?? 0;
    this.uvRects[i4 + 2] = instance.uvWidth ?? 1;
    this.uvRects[i4 + 3] = instance.uvHeight ?? 1;
    this.visibleCount++;
    return true;
  }

  commit(): void {
    // An empty material variant has no changed instance data to upload. This
    // matters for the full roster: normal/emissive variants coexist, but only
    // the active one should touch the GPU on a given frame.
    if (this.visibleCount > 0) {
      for (const attribute of this.attributes) {
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, this.visibleCount * attribute.itemSize);
        attribute.needsUpdate = true;
      }
    }
    this.mesh.count = this.visibleCount;
  }

  clear(): void {
    this.visibleCount = 0;
    this.mesh.count = 0;
  }

  dispose(): void {
    this.parent?.remove(this.mesh);
    this.parent = null;
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
