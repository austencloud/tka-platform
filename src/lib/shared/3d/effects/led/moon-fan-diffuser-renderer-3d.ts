import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Euler,
  Mesh,
  Object3D,
  Quaternion,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  Vector3,
} from "three";

/** Lighttoys' published LED count, divided into two 39-emitter zones. */
export const MOON_FAN_LED_COUNT = 78;

/**
 * Samples the middle of each physical 39-emitter zone instead of its seam.
 * This keeps animated strip patterns legible as the two colors that the real
 * A/B controller can show through the fabric.
 */
export function moonFanZoneSampleIndices(
  ledCount = MOON_FAN_LED_COUNT
): readonly [number, number] {
  const count = Math.max(2, Math.round(ledCount));
  return [Math.floor(count * 0.25), Math.floor(count * 0.75)];
}

export interface MoonFanDiffuserColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface MoonFanDiffuserPose {
  readonly worldPosition: { x: number; y: number; z: number };
  readonly worldRotation: { x: number; y: number; z: number; w: number };
}

export interface MoonFanDiffuserFrame {
  readonly propState: MoonFanDiffuserPose;
  readonly rigLocalCenter: { x: number; y: number; z: number };
  readonly zoneA: MoonFanDiffuserColor;
  readonly zoneB: MoonFanDiffuserColor;
  readonly brightness: number;
  readonly scale?: number;
  readonly elapsedSeconds: number;
}

const WIDTH_M = 0.6;
const RADIUS_X_M = WIDTH_M / 2;
const ARC_CENTER_Y_M = 0.03;
const RADIUS_Y_M = 0.288;
const NOTCH_RADIUS_M = 0.058;
const HORIZONTAL_QUATERNION = new Quaternion().setFromEuler(
  new Euler(0, 0, Math.PI / 2)
);

/** The same measured outline authored into `fan.glb`. */
export function createMoonFanDiffuserGeometry(): ShapeGeometry {
  const shape = new Shape();
  shape.moveTo(-RADIUS_X_M, ARC_CENTER_Y_M);

  const notchSegments = 16;
  for (let index = 0; index <= notchSegments; index++) {
    const angle = ((145 - (110 * index) / notchSegments) * Math.PI) / 180;
    shape.lineTo(
      NOTCH_RADIUS_M * Math.cos(angle),
      NOTCH_RADIUS_M * Math.sin(angle)
    );
  }

  shape.lineTo(RADIUS_X_M, ARC_CENTER_Y_M);
  const arcSegments = 48;
  for (let index = 1; index <= arcSegments; index++) {
    const angle = (Math.PI * index) / arcSegments;
    shape.lineTo(
      RADIUS_X_M * Math.cos(angle),
      ARC_CENTER_Y_M + RADIUS_Y_M * Math.sin(angle)
    );
  }
  shape.closePath();

  const geometry = new ShapeGeometry(shape);
  geometry.name = "MoonFanDiffuserSurface";
  return geometry;
}

function createMoonFanDiffuserMaterial(): ShaderMaterial {
  const material = new ShaderMaterial({
    name: "MoonFanDiffuserMaterial",
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: {
      uZoneA: { value: new Color(1, 1, 1) },
      uZoneB: { value: new Color(1, 1, 1) },
      uBrightness: { value: 1 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;

      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZoneA;
      uniform vec3 uZoneB;
      uniform float uBrightness;
      uniform float uTime;
      varying vec2 vLocal;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        float zoneMix = smoothstep(-0.012, 0.012, vLocal.x);
        vec3 ledColor = mix(uZoneA, uZoneB, zoneMix);

        vec2 ellipsePoint = vec2(
          vLocal.x / 0.300,
          (vLocal.y - 0.030) / 0.288
        );
        float radial = length(ellipsePoint);
        float perimeterHotspot = smoothstep(0.72, 1.0, radial);
        float lowerHotspot = 1.0 - smoothstep(0.030, 0.105, vLocal.y);
        float seamShadow = smoothstep(0.0, 0.020, abs(vLocal.x));
        float gripShadow = smoothstep(0.060, 0.145, length(vLocal));

        // A tiny stable weave variation keeps the panel from looking like
        // glowing plastic. It never swims with the camera or the animation.
        float weave = mix(0.94, 1.04, hash21(floor(vLocal * 720.0)));
        float pulse = 0.985 + 0.015 * sin(uTime * 2.3 + radial * 8.0);
        float field = 0.20 + 0.76 * perimeterHotspot + 0.22 * lowerHotspot;
        field *= mix(0.84, 1.0, seamShadow);
        field *= mix(0.52, 1.0, gripShadow);
        field *= weave * pulse;

        // A cool-white fabric base remains visible between bright emitters,
        // matching the white diffusion skin visible in the product photos.
        vec3 fabric = vec3(0.10, 0.115, 0.13) * uBrightness;
        vec3 emission = ledColor * field * uBrightness * 2.15;
        float alpha = clamp((0.24 + field * 0.52) * uBrightness, 0.0, 0.92);
        gl_FragColor = vec4(fabric + emission, alpha);
      }
    `,
  });
  material.extensions = { clipCullDistance: false, multiDraw: false };
  return material;
}

/**
 * One live fabric light field per fan. The physical GLB owns the frame and
 * white skin; this renderer owns only the light transmitted through that skin.
 */
export class MoonFanDiffuserRenderer3D {
  private mesh: Mesh<ShapeGeometry, ShaderMaterial> | null = null;
  private parent: Object3D | null = null;
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();

  initialize(parent: Object3D): void {
    if (this.mesh) return;
    this.parent = parent;
    this.mesh = new Mesh(
      createMoonFanDiffuserGeometry(),
      createMoonFanDiffuserMaterial()
    );
    this.mesh.name = "MoonFanLiveDiffuser";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 99;
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  update(frame: MoonFanDiffuserFrame): void {
    if (!this.mesh) return;
    const { propState, rigLocalCenter, zoneA, zoneB } = frame;
    this.position.set(rigLocalCenter.x, rigLocalCenter.y, rigLocalCenter.z);
    this.rotation
      .set(
        propState.worldRotation.x,
        propState.worldRotation.y,
        propState.worldRotation.z,
        propState.worldRotation.w
      )
      .multiply(HORIZONTAL_QUATERNION);

    this.mesh.position.copy(this.position);
    this.mesh.quaternion.copy(this.rotation);
    this.mesh.scale.setScalar(frame.scale ?? 1);
    this.mesh.material.uniforms.uZoneA!.value.setRGB(zoneA.r, zoneA.g, zoneA.b);
    this.mesh.material.uniforms.uZoneB!.value.setRGB(zoneB.r, zoneB.g, zoneB.b);
    this.mesh.material.uniforms.uBrightness!.value = frame.brightness;
    this.mesh.material.uniforms.uTime!.value = frame.elapsedSeconds;
    this.mesh.visible = frame.brightness > 0;
  }

  reset(): void {
    if (this.mesh) this.mesh.visible = false;
  }

  dispose(): void {
    if (!this.mesh) return;
    this.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
    this.parent = null;
  }
}
