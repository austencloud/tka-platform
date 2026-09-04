import {
  BackSide,
  Color,
  MathUtils,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Camera,
  type Texture,
} from "three";
import type { SkyGradientConfig } from "../../domain/models/environment-models";
import type { MoonConfig } from "../../domain/models/scene-configs";

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vSkyDirection;

  void main() {
    vSkyDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// This is the Winter-used path of SkyGradient's production shader. Keeping it
// here makes the Moon and three-stop gradient identical in the app and worker
// without making either renderer own the look.
const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uBottomColor;
  uniform float uHasMid;
  uniform float uMoonEnabled;
  uniform sampler2D uMoonTexture;
  uniform vec3 uMoonDirection;
  uniform float uMoonAngularRadius;
  uniform float uMoonOpacity;
  uniform float uMoonGlowScale;
  uniform float uMoonGlowOpacity;
  uniform float uMoonSurfaceLift;
  uniform float uMoonHorizonWarmth;
  varying vec3 vSkyDirection;

  void main() {
    vec3 skyDirection = normalize(vSkyDirection);
    float h = clamp(skyDirection.y * 0.5 + 0.5, 0.0, 1.0);

    vec3 color;
    if (uHasMid > 0.5) {
      if (h < 0.5) {
        color = mix(uBottomColor, uMidColor, h * 2.0);
      } else {
        color = mix(uMidColor, uTopColor, (h - 0.5) * 2.0);
      }
    } else {
      color = mix(uBottomColor, uTopColor, h);
    }

    if (uMoonEnabled > 0.5) {
      vec3 moonDirection = normalize(uMoonDirection);
      float moonFrontHemisphere = step(
        0.0,
        dot(skyDirection, moonDirection)
      );
      vec3 referenceUp = abs(moonDirection.y) > 0.98
        ? vec3(1.0, 0.0, 0.0)
        : vec3(0.0, 1.0, 0.0);
      vec3 moonRight = normalize(cross(referenceUp, moonDirection));
      vec3 moonUp = normalize(cross(moonDirection, moonRight));

      float angularScale = max(sin(uMoonAngularRadius), 0.00001);
      vec2 moonPlane = vec2(
        dot(skyDirection, moonRight),
        dot(skyDirection, moonUp)
      ) / angularScale;
      float radialDistance = length(moonPlane);
      vec2 moonUv = moonPlane * vec2(0.5, -0.5) + 0.5;

      vec4 moonSample = texture2D(uMoonTexture, moonUv);
      float diskEdge = 1.0 - smoothstep(0.965, 1.0, radialDistance);
      float diskAlpha = moonSample.a
        * diskEdge
        * uMoonOpacity
        * moonFrontHemisphere;

      float elevation = clamp(moonDirection.y, 0.0, 1.0);
      float atmospherePath = smoothstep(0.0, 0.42, elevation);
      float transmittance = mix(0.82, 1.0, atmospherePath);
      vec3 horizonTint = mix(
        vec3(0.94, 0.97, 1.0),
        vec3(1.0, 0.67, 0.42),
        uMoonHorizonWarmth
      );
      vec3 atmosphericTint = mix(
        horizonTint,
        vec3(0.92, 0.96, 1.0),
        atmospherePath
      );
      vec3 moonSurface = pow(max(moonSample.rgb, vec3(0.0)), vec3(0.72));
      moonSurface = mix(moonSurface, vec3(1.0), uMoonSurfaceLift);
      vec3 moonColor = moonSurface * atmosphericTint * transmittance;

      float haloRadius = max(uMoonGlowScale, 1.001);
      float halo = 1.0 - smoothstep(1.0, haloRadius, radialDistance);
      halo *= (1.0 - diskEdge) * moonFrontHemisphere;
      color += atmosphericTint * halo * uMoonGlowOpacity * transmittance;
      color = mix(color, moonColor, clamp(diskAlpha, 0.0, 1.0));
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface WinterSky {
  object: Mesh<SphereGeometry, ShaderMaterial>;
  update(camera: Camera): void;
  dispose(): void;
}

function moonDirection(config: MoonConfig): Vector3 {
  return new Vector3(
    ...(config.direction ?? config.position ?? [0, 0.25, -1])
  ).normalize();
}

function moonAngularDiameter(config: MoonConfig): number {
  if (config.angularDiameterDegrees !== undefined) {
    return config.angularDiameterDegrees;
  }
  if (config.diameter !== undefined && config.position !== undefined) {
    const distance = new Vector3(...config.position).length();
    return MathUtils.radToDeg(2 * Math.atan(config.diameter / (2 * distance)));
  }
  return 0.52;
}

export function createWinterSky(
  sky: SkyGradientConfig,
  moon: MoonConfig,
  moonTexture: Texture
): WinterSky {
  const geometry = new SphereGeometry(sky.radius ?? 200, 32, 32);
  const material = new ShaderMaterial({
    uniforms: {
      uTopColor: { value: new Color(sky.topColor) },
      uMidColor: { value: new Color(sky.midColor ?? sky.topColor) },
      uBottomColor: { value: new Color(sky.bottomColor) },
      uHasMid: { value: sky.midColor ? 1 : 0 },
      uMoonEnabled: { value: moon.enabled ? 1 : 0 },
      uMoonTexture: { value: moonTexture },
      uMoonDirection: { value: moonDirection(moon) },
      uMoonAngularRadius: {
        value: MathUtils.degToRad(moonAngularDiameter(moon) * 0.5),
      },
      uMoonOpacity: { value: moon.opacity ?? 1 },
      uMoonGlowScale: { value: moon.glowScale ?? 1.12 },
      uMoonGlowOpacity: { value: moon.glowOpacity ?? 0.025 },
      uMoonSurfaceLift: { value: moon.surfaceLift ?? 0 },
      uMoonHorizonWarmth: { value: moon.horizonWarmth ?? 1 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
  });
  const object = new Mesh(geometry, material);
  object.name = "winter-sky-gradient";
  object.renderOrder = -1;
  object.frustumCulled = false;

  return {
    object,
    update(camera) {
      object.position.copy(camera.position);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
