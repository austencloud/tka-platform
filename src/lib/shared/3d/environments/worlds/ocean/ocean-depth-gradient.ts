import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  type Camera,
} from "three";

export interface OceanDepthGradientOptions {
  shallowColor?: string;
  midColor?: string;
  deepColor?: string;
  radius?: number;
}

export interface OceanDepthGradientWorld {
  object: Mesh<SphereGeometry, ShaderMaterial>;
  update(camera: Camera): void;
  setColors(options: Pick<
    OceanDepthGradientOptions,
    "shallowColor" | "midColor" | "deepColor"
  >): void;
  dispose(): void;
}

const DEFAULT_SHALLOW_COLOR = "#123c55";
const DEFAULT_MID_COLOR = "#0a2438";
const DEFAULT_DEEP_COLOR = "#01060b";
const DEFAULT_RADIUS = 180;

export function createOceanDepthGradient(
  options: OceanDepthGradientOptions = {}
): OceanDepthGradientWorld {
  const geometry = new SphereGeometry(options.radius ?? DEFAULT_RADIUS, 32, 32);
  const material = new ShaderMaterial({
    uniforms: {
      uShallowColor: {
        value: new Color(options.shallowColor ?? DEFAULT_SHALLOW_COLOR),
      },
      uMidColor: { value: new Color(options.midColor ?? DEFAULT_MID_COLOR) },
      uDeepColor: { value: new Color(options.deepColor ?? DEFAULT_DEEP_COLOR) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;

      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uShallowColor;
      uniform vec3 uMidColor;
      uniform vec3 uDeepColor;
      varying vec3 vDirection;

      void main() {
        float height = vDirection.y;
        vec3 color = height < 0.0
          ? mix(uMidColor, uDeepColor, smoothstep(0.0, -0.55, height))
          : mix(uMidColor, uShallowColor, smoothstep(0.0, 0.75, height));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
  });

  const object = new Mesh(geometry, material);
  object.name = "ocean-depth-gradient";
  object.renderOrder = -1;
  object.frustumCulled = false;

  return {
    object,
    update(camera) {
      object.position.copy(camera.position);
    },
    setColors(next) {
      if (next.shallowColor) {
        material.uniforms.uShallowColor!.value.set(next.shallowColor);
      }
      if (next.midColor) {
        material.uniforms.uMidColor!.value.set(next.midColor);
      }
      if (next.deepColor) {
        material.uniforms.uDeepColor!.value.set(next.deepColor);
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
