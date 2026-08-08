import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  PointLight,
  Quaternion,
  ShaderMaterial,
  StaticDrawUsage,
  Vector3,
  type Material,
  type Object3D,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const FIRST_FIRE_EXPECTED_FLAME_COUNT = 126;

export type FirstFireFlamePalette = 0 | 1 | 2;

export interface FirstFireFlameAnchor {
  position: [number, number, number];
  scale: [number, number, number];
  palette: FirstFireFlamePalette;
  seed: number;
}

const FLAME_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  attribute float aSeed;
  attribute float aPalette;
  attribute float aLayer;

  varying vec2 vUv;
  varying float vSeed;
  varying float vPalette;
  varying float vLayer;

  void main() {
    vUv = uv;
    vSeed = aSeed;
    vPalette = aPalette;
    vLayer = aLayer;

    vec4 worldCenter = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float flameWidth = length(instanceMatrix[0].xyz);
    float flameHeight = length(instanceMatrix[1].xyz);

    vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

    float isMain = 1.0 - step(0.5, aLayer);
    float isLeft = step(0.5, aLayer) * (1.0 - step(1.5, aLayer));
    float isRight = step(1.5, aLayer) * (1.0 - step(2.5, aLayer));
    float isHalo = step(2.5, aLayer);

    float layerWidth =
      isMain * 0.88 + isLeft * 0.46 + isRight * 0.39 + isHalo * 1.35;
    float layerHeight =
      isMain * 0.78 + isLeft * 1.18 + isRight * 0.94 + isHalo * 1.24;
    float layerOffsetX = isLeft * -0.21 + isRight * 0.25;
    float layerOffsetY = isMain * -0.09 + isLeft * 0.08 + isRight * 0.01;

    float tipWeight = smoothstep(0.04, 1.0, uv.y);
    float layerPhase = aLayer * 7.31;
    float slowSway = sin(uTime * (2.8 + aLayer * 0.17) + aSeed * 17.0 + layerPhase);
    float fastSway = sin(uTime * 7.7 + aSeed * 31.0 + layerPhase) * 0.38;
    float sway =
      (slowSway + fastSway) * flameWidth * 0.16 * tipWeight * tipWeight *
      (1.0 - isHalo * 0.55);

    vec3 billboardOffset =
      cameraRight *
        (position.x * flameWidth * layerWidth + flameWidth * layerOffsetX + sway) +
      cameraUp *
        (position.y * flameHeight * layerHeight + flameHeight * layerOffsetY);
    worldCenter.xyz += billboardOffset;

    gl_Position = projectionMatrix * viewMatrix * worldCenter;
  }
`;

const FLAME_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;

  varying vec2 vUv;
  varying float vSeed;
  varying float vPalette;
  varying float vLayer;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
      value += amplitude * noise(p);
      p *= 2.07;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    float y = clamp(vUv.y, 0.0, 1.0);
    float centeredX = (vUv.x - 0.5) * 2.0;
    float layerSeed = vSeed + vLayer * 0.173;
    float n = fbm(
      vec2(vUv.x * 3.1 + layerSeed * 9.0, y * 4.6 - uTime * (2.45 + vLayer * 0.12))
    );
    float sideWarp =
      (n - 0.5) * 0.55 * y +
      sin(y * 8.0 + uTime * 3.1 + layerSeed * 27.0) * 0.08 * y;
    float x = abs(centeredX + sideWarp);

    float roundedBase = smoothstep(0.0, 0.12, y);
    float bodyWidth =
      pow(1.0 - y, 0.66) * roundedBase * (0.82 + (n - 0.5) * 0.42);
    float body = 1.0 - smoothstep(bodyWidth - 0.11, bodyWidth + 0.08, x);

    float tongueCenter = sin(vSeed * 41.0 + uTime * 1.9) * 0.2;
    float tongueWidth = (1.0 - y) * 0.34 + 0.025;
    float tongue = 1.0 - smoothstep(
      tongueWidth,
      tongueWidth + 0.09,
      abs(centeredX - tongueCenter)
    );
    tongue *= smoothstep(0.42, 0.66, y) * (1.0 - smoothstep(0.9, 1.0, y));

    float verticalFade =
      smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.9, 1.0, y));
    float flame = max(body, tongue * 0.78) * verticalFade * (0.72 + n * 0.36);
    float alpha = smoothstep(0.08, 0.7, flame);

    if (vLayer > 2.5) {
      float haloWidth = bodyWidth + 0.24;
      float halo =
        (1.0 - smoothstep(haloWidth - 0.04, haloWidth + 0.34, x)) *
        verticalFade;
      vec3 haloColor = vPalette < 1.5
        ? vec3(1.0, 0.19, 0.012)
        : vec3(0.92, 0.035, 0.018);
      gl_FragColor = vec4(haloColor * uIntensity, halo * (0.08 + n * 0.035));
      return;
    }

    if (alpha < 0.025) discard;

    vec3 djCool = vec3(1.0, 0.11, 0.012);
    vec3 djWarm = vec3(1.0, 0.51, 0.055);
    vec3 ekCool = vec3(1.0, 0.2, 0.008);
    vec3 ekWarm = vec3(1.0, 0.68, 0.08);
    vec3 flCool = vec3(0.92, 0.035, 0.018);
    vec3 flWarm = vec3(1.0, 0.34, 0.035);

    vec3 cool = vPalette < 0.5 ? djCool : (vPalette < 1.5 ? ekCool : flCool);
    vec3 warm = vPalette < 0.5 ? djWarm : (vPalette < 1.5 ? ekWarm : flWarm);
    float heat = clamp(flame * 0.72 + (1.0 - y) * 0.22, 0.0, 1.0);
    float bodyRatio = x / max(bodyWidth, 0.05);
    float innerCore =
      (1.0 - smoothstep(0.08, 0.62, bodyRatio)) *
      (1.0 - smoothstep(0.22, 0.72, y));
    vec3 color = mix(cool, warm, smoothstep(0.16, 0.72, heat));
    color = mix(color, vec3(1.0, 0.72, 0.1), innerCore * 0.62);
    color = mix(
      color,
      vec3(1.0, 0.9, 0.58),
      pow(innerCore, 4.0) * 0.28 * (1.0 - step(0.5, vLayer))
    );
    float layerGain = vLayer < 0.5 ? 0.92 : 0.78;
    color *= (0.94 + n * 0.22) * uIntensity * layerGain;

    gl_FragColor = vec4(color, alpha * (vLayer < 0.5 ? 0.88 : 0.72));
  }
`;

const paletteLightColors = ["#ff4d17", "#ff7424", "#ff3219"] as const;
const corridorLightCount = 6;

function materialNames(material: Material | Material[]): string {
  const materials = Array.isArray(material) ? material : [material];
  return materials.map((candidate) => candidate.name).join(" ");
}

function resolvePalette(sourceName: string): FirstFireFlamePalette | null {
  if (/DJ Flame/i.test(sourceName)) return 0;
  if (/EK Flame/i.test(sourceName)) return 1;
  if (/FL Flame/i.test(sourceName)) return 2;
  return null;
}

function deterministicSeed(position: Vector3, index: number): number {
  const value = Math.sin(
    position.x * 12.9898 +
      position.y * 37.719 +
      position.z * 78.233 +
      index * 0.37
  );
  return value - Math.floor(value);
}

function createLayeredFlameGeometry(): BufferGeometry {
  const layers = Array.from({ length: 4 }, (_, layer) => {
    const geometry = new PlaneGeometry(1, 1, 1, 5);
    const values = new Float32Array(geometry.getAttribute("position").count);
    values.fill(layer);
    geometry.setAttribute("aLayer", new Float32BufferAttribute(values, 1));
    return geometry;
  });
  const merged = mergeGeometries(layers, false);
  layers.forEach((geometry) => geometry.dispose());
  if (!merged)
    throw new Error("Unable to build the First Fire layered flame geometry");
  return merged;
}

/**
 * Replaces the GLB's static cone guides with runtime anchors. The optimized GLB
 * owns the transforms, so the Blender layout remains the only coordinate source.
 */
export function extractFirstFireFlameAnchors(
  root: Object3D
): FirstFireFlameAnchor[] {
  const anchors: FirstFireFlameAnchor[] = [];
  const instanceMatrix = new Matrix4();
  const worldMatrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();

  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!(object instanceof InstancedMesh)) return;

    const sourceName = `${object.name} ${object.geometry.name} ${materialNames(object.material)}`;
    const palette = resolvePalette(sourceName);
    if (palette === null) return;

    object.visible = false;
    for (let index = 0; index < object.count; index += 1) {
      object.getMatrixAt(index, instanceMatrix);
      worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
      worldMatrix.decompose(position, quaternion, scale);
      anchors.push({
        position: [position.x, position.y, position.z],
        scale: [Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)],
        palette,
        seed: deterministicSeed(position, anchors.length),
      });
    }
  });

  return anchors;
}

function selectCorridorLightAnchors(
  anchors: readonly FirstFireFlameAnchor[]
): FirstFireFlameAnchor[] {
  if (anchors.length <= corridorLightCount) return [...anchors];
  const ordered = [...anchors].sort(
    (left, right) => left.position[0] - right.position[0]
  );
  return Array.from({ length: corridorLightCount }, (_, index) => {
    const fraction = (index + 0.5) / corridorLightCount;
    return ordered[
      Math.min(ordered.length - 1, Math.floor(fraction * ordered.length))
    ]!;
  });
}

/** One billboard batch and a small pooled light rig for all 126 procession flames. */
export class FirstFireFlameFieldRenderer {
  readonly object3D = new Group();
  readonly mesh: InstancedMesh;
  readonly lights: PointLight[];

  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  private elapsed = 0;

  constructor(anchors: readonly FirstFireFlameAnchor[]) {
    this.object3D.name = "FirstFireProcessionFlames";

    this.geometry = createLayeredFlameGeometry();
    this.material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1 },
      },
      vertexShader: FLAME_VERTEX_SHADER,
      fragmentShader: FLAME_FRAGMENT_SHADER,
    });

    this.mesh = new InstancedMesh(this.geometry, this.material, anchors.length);
    this.mesh.name = "FirstFireFlameBillboards";
    this.mesh.instanceMatrix.setUsage(StaticDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 40;

    const seeds = new Float32Array(anchors.length);
    const palettes = new Float32Array(anchors.length);
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();

    anchors.forEach((anchor, index) => {
      const radius = Math.max(anchor.scale[0], anchor.scale[2]);
      position.set(...anchor.position);
      scale.set(radius * 2.35, anchor.scale[1] * 1.16, 1);
      matrix.compose(position, quaternion, scale);
      this.mesh.setMatrixAt(index, matrix);
      seeds[index] = anchor.seed;
      palettes[index] = anchor.palette;
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    this.geometry.setAttribute(
      "aPalette",
      new InstancedBufferAttribute(palettes, 1)
    );
    this.object3D.add(this.mesh);

    this.lights = selectCorridorLightAnchors(anchors).map((anchor) => {
      const light = new PointLight(
        new Color(paletteLightColors[anchor.palette]),
        18,
        7.5,
        2
      );
      light.position.set(...anchor.position);
      light.position.y += 0.12;
      this.object3D.add(light);
      return light;
    });
  }

  update(delta: number, motionScale = 1): void {
    this.elapsed += Math.min(delta, 1 / 20) * motionScale;
    this.material.uniforms.uTime!.value = this.elapsed;

    const slow = Math.sin(this.elapsed * 1.2) * 0.1;
    const medium = Math.sin(this.elapsed * 4.7) * 0.07;
    const crackle =
      Math.sin(this.elapsed * 23.7) * Math.sin(this.elapsed * 37.1) * 0.045;
    this.material.uniforms.uIntensity!.value = 0.96 + slow + medium + crackle;

    this.lights.forEach((light, index) => {
      const phase = index * 1.91;
      const localFlicker =
        Math.sin(this.elapsed * 3.7 + phase) * 0.1 +
        Math.sin(this.elapsed * 13.1 + phase * 0.7) * 0.055;
      light.intensity = 18 * (1 + slow + localFlicker);
    });
  }

  dispose(): void {
    this.object3D.remove(this.mesh);
    this.lights.forEach((light) => {
      this.object3D.remove(light);
      light.dispose();
    });
    this.geometry.dispose();
    this.material.dispose();
  }
}
