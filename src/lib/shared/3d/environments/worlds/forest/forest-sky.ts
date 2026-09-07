import {
  BackSide,
  Color,
  MathUtils,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type Camera,
  type Texture,
} from "three";
import type {
  SkyGradientConfig,
  SkySunConfig,
} from "../../domain/models/environment-models";
import type { MoonConfig } from "../../domain/models/scene-configs";

export interface ForestSky {
  object: Mesh<SphereGeometry, ShaderMaterial>;
  update(camera: Camera): void;
  setMoonTexture(texture: Texture | null): void;
  dispose(): void;
}

function moonDirection(config: MoonConfig | null | undefined): Vector3 {
  return new Vector3(
    ...(config?.direction ?? config?.position ?? [0, 0.25, -1])
  ).normalize();
}

function moonAngularDiameter(config: MoonConfig | null | undefined): number {
  if (!config) return 0.52;
  if (config.angularDiameterDegrees !== undefined) {
    return config.angularDiameterDegrees;
  }
  if (config.diameter !== undefined && config.position !== undefined) {
    const distance = new Vector3(...config.position).length();
    return MathUtils.radToDeg(2 * Math.atan(config.diameter / (2 * distance)));
  }
  return 0.52;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vSkyDirection;
  void main() {
    vSkyDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uBottomColor;
  uniform float uHasMid;
  uniform float uGradientStart;
  uniform float uGradientEnd;
  uniform float uMoonEnabled;
  uniform sampler2D uMoonTexture;
  uniform vec3 uMoonDirection;
  uniform float uMoonAngularRadius;
  uniform float uMoonOpacity;
  uniform float uMoonGlowScale;
  uniform float uMoonGlowOpacity;
  uniform float uMoonSurfaceLift;
  uniform float uMoonHorizonWarmth;
  uniform float uSunEnabled;
  uniform vec3 uSunDirection;
  uniform float uSunAngularRadius;
  uniform vec3 uSunColor;
  uniform float uSunOpacity;
  uniform float uSunGlowScale;
  uniform float uSunGlowOpacity;
  uniform vec3 uHorizonGlowColor;
  uniform vec2 uHorizonGlowBearing;
  uniform float uHorizonGlowHeight;
  uniform float uHorizonGlowSpread;
  uniform float uHorizonGlowIntensity;
  varying vec3 vSkyDirection;

  void main() {
    vec3 skyDirection = normalize(vSkyDirection);
    float rawHeight = skyDirection.y * 0.5 + 0.5;
    float h = clamp(
      (rawHeight - uGradientStart) / max(uGradientEnd - uGradientStart, 0.0001),
      0.0,
      1.0
    );
    vec3 color;
    if (uHasMid > 0.5) {
      color = h < 0.5
        ? mix(uBottomColor, uMidColor, h * 2.0)
        : mix(uMidColor, uTopColor, (h - 0.5) * 2.0);
    } else {
      color = mix(uBottomColor, uTopColor, h);
    }

    if (uHorizonGlowIntensity > 0.0) {
      float elevation = skyDirection.y;
      float vertical = exp(
        -max(elevation, 0.0) / max(uHorizonGlowHeight, 0.0001)
      );
      vertical *= smoothstep(-0.22, 0.02, elevation);
      vec2 flatDirection = vec2(skyDirection.x, skyDirection.z);
      float flatLength = length(flatDirection);
      float bearing = flatLength > 0.0001
        ? dot(flatDirection / flatLength, uHorizonGlowBearing) * 0.5 + 0.5
        : 0.5;
      float lateral = pow(
        clamp(bearing, 0.0, 1.0),
        mix(14.0, 1.0, clamp(uHorizonGlowSpread, 0.0, 1.0))
      );
      color += uHorizonGlowColor
        * vertical
        * lateral
        * uHorizonGlowIntensity;
    }

    if (uSunEnabled > 0.5) {
      float sunAngle = acos(clamp(
        dot(skyDirection, normalize(uSunDirection)),
        -1.0,
        1.0
      ));
      float sunRadius = max(uSunAngularRadius, 0.00001);
      float diskDistance = sunAngle / sunRadius;
      float disk = 1.0 - smoothstep(0.82, 1.0, diskDistance);
      float haloRadius = max(uSunGlowScale, 1.001);
      float halo = 1.0 - smoothstep(1.0, haloRadius, diskDistance);
      halo = pow(max(halo, 0.0), 2.2) * (1.0 - disk);
      color += uSunColor * halo * uSunGlowOpacity;
      color = mix(color, uSunColor, disk * uSunOpacity);
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

/** Forest-owned extraction of the production SkyGradient path. */
export function createForestSky(options: {
  sky: SkyGradientConfig;
  moon?: MoonConfig | null;
  sun?: SkySunConfig | null;
  moonTexture?: Texture | null;
}): ForestSky {
  const { sky, moon = null, sun = null, moonTexture = null } = options;
  const top = new Color(sky.topColor);
  const bottom = new Color(sky.bottomColor);
  const middle = sky.midColor
    ? new Color(sky.midColor)
    : new Color().lerpColors(top, bottom, 0.5);
  const geometry = new SphereGeometry(sky.radius ?? 200, 32, 32);
  const material = new ShaderMaterial({
    uniforms: {
      uTopColor: { value: top },
      uMidColor: { value: middle },
      uBottomColor: { value: bottom },
      uHasMid: { value: sky.midColor ? 1 : 0 },
      uGradientStart: { value: 0 },
      uGradientEnd: { value: 1 },
      uMoonEnabled: { value: moon?.enabled && moonTexture ? 1 : 0 },
      uMoonTexture: { value: moonTexture },
      uMoonDirection: { value: moonDirection(moon) },
      uMoonAngularRadius: {
        value: MathUtils.degToRad(moonAngularDiameter(moon) * 0.5),
      },
      uMoonOpacity: { value: moon?.opacity ?? 1 },
      uMoonGlowScale: { value: moon?.glowScale ?? 1.12 },
      uMoonGlowOpacity: { value: moon?.glowOpacity ?? 0.025 },
      uMoonSurfaceLift: { value: moon?.surfaceLift ?? 0 },
      uMoonHorizonWarmth: { value: moon?.horizonWarmth ?? 1 },
      uSunEnabled: { value: sun?.enabled ? 1 : 0 },
      uSunDirection: {
        value: new Vector3(...(sun?.direction ?? [0, 0.5, -1])).normalize(),
      },
      uSunAngularRadius: {
        value: MathUtils.degToRad((sun?.angularDiameterDegrees ?? 0.53) * 0.5),
      },
      uSunColor: { value: new Color(sun?.color ?? "#fff4d2") },
      uSunOpacity: { value: sun?.opacity ?? 1 },
      uSunGlowScale: { value: sun?.glowScale ?? 6 },
      uSunGlowOpacity: { value: sun?.glowOpacity ?? 0.12 },
      // Forest passes no horizon glow, but keeping the primitive's exact
      // zeroed material contract prevents renderer-dependent shader drift.
      uHorizonGlowColor: { value: new Color("#000000") },
      uHorizonGlowBearing: { value: new Vector2(0, -1) },
      uHorizonGlowHeight: { value: 0.2 },
      uHorizonGlowSpread: { value: 0.5 },
      uHorizonGlowIntensity: { value: 0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
  });
  const object = new Mesh(geometry, material);
  object.name = "forest-sky-gradient";
  object.renderOrder = -1;
  object.frustumCulled = false;
  return {
    object,
    update(camera) {
      object.position.copy(camera.position);
    },
    setMoonTexture(texture) {
      material.uniforms.uMoonTexture!.value = texture;
      material.uniforms.uMoonEnabled!.value = moon?.enabled && texture ? 1 : 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
