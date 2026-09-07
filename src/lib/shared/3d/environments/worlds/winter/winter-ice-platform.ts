import {
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  ShaderMaterial,
  ShapeGeometry,
} from "three";
import type { IcePlatformConfig } from "../../domain/models/scene-configs";
import {
  createIcePlatformShape,
  createIcePlatformSnowCollarShape,
} from "../../scenes/winter/ice-platform-geometry";

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vLocalPosition;
  uniform float uRadius;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vLocalPosition = position.xy / uRadius;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uPrimaryColor;
  uniform float uGlowIntensity;
  uniform float uFrostDensity;
  uniform float uRadius;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vLocalPosition;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p, int octaves) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      v += a * noise(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  vec2 voronoi(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float minDist = 8.0;
    float secondMin = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = vec2(hash21(n + g), hash21(n + g + vec2(43.12, 17.35)));
        o = 0.5 + 0.5 * sin(uTime * 0.08 + 6.2831 * o);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < minDist) {
          secondMin = minDist;
          minDist = d;
        } else if (d < secondMin) {
          secondMin = d;
        }
      }
    }
    return vec2(sqrt(minDist), sqrt(secondMin));
  }

  void main() {
    vec2 centeredUv = vLocalPosition;
    float dist = length(centeredUv);

    vec2 frostUv = centeredUv * uFrostDensity * 5.5;
    vec2 vor = voronoi(frostUv + uTime * 0.02);
    float veins = 1.0 - smoothstep(0.0, 0.09, vor.y - vor.x);
    veins *= 0.45 + 0.55 * noise(centeredUv * 6.0 + 3.7);

    vec2 driftUv = centeredUv * uFrostDensity * 2.0;
    float drift = fbm(driftUv + vec2(uTime * 0.015, uTime * 0.01), 5);
    float driftDetail = fbm(driftUv * 2.5 - vec2(uTime * 0.008, uTime * 0.012), 4);
    float frostSwirl = smoothstep(0.35, 0.65, drift) * 0.6 + smoothstep(0.4, 0.7, driftDetail) * 0.4;

    float sparkleNoise = noise(centeredUv * uFrostDensity * 20.0 + uTime * 0.05);
    float sparkle = pow(sparkleNoise, 12.0) * 2.0;
    vec3 deepIce = mix(vec3(0.07, 0.20, 0.36), uPrimaryColor * 0.5, 0.35);
    vec3 surfaceFrost = vec3(0.86, 0.92, 1.0);
    vec3 veinColor = mix(uPrimaryColor, vec3(0.8, 0.92, 1.0), 0.6);
    float depthGrad = smoothstep(0.35, 1.05, dist);
    vec3 baseColor = mix(deepIce, surfaceFrost, depthGrad * 0.35 + frostSwirl * 0.18);
    baseColor = mix(baseColor, veinColor, veins * 0.38);
    baseColor += surfaceFrost * frostSwirl * 0.15;
    baseColor += vec3(1.0) * sparkle * 0.3;

    float rim = smoothstep(0.62, 1.08, dist);
    vec3 rimColor = uPrimaryColor * 1.4 + vec3(0.1, 0.15, 0.25);
    baseColor += rimColor * rim * uGlowIntensity * 0.8;

    float downstageAxis = -centeredUv.y;
    float downstageAngle = atan(centeredUv.x, downstageAxis);
    float downstageWedge = 1.0 - smoothstep(0.0, 0.5, abs(downstageAngle));
    float downstageDist = smoothstep(0.5, 1.0, downstageAxis);
    float downstageGlow = downstageWedge * downstageDist;
    vec3 indicatorColor = mix(uPrimaryColor * 1.3, vec3(0.7, 0.85, 1.0), 0.5);
    baseColor += indicatorColor * downstageGlow * uGlowIntensity * 0.6;

    float alpha = mix(0.96, 0.55, smoothstep(0.3, 1.0, dist));
    alpha += veins * 0.1;
    gl_FragColor = vec4(baseColor, clamp(alpha, 0.0, 1.0));
  }
`;

export interface WinterIcePlatform {
  object: Group;
  update(deltaSeconds: number): void;
  setGroundY(groundY: number): void;
  dispose(): void;
}

export function createWinterIcePlatform(
  config: IcePlatformConfig,
  groundY: number,
  stageZOffset: number
): WinterIcePlatform {
  const object = new Group();
  object.name = "winter-ice-platform";
  object.position.z = stageZOffset;
  const shape = createIcePlatformShape(config.radius);
  const surfaceGeometry = new ShapeGeometry(shape, 12);
  const bodyBevelThickness = Math.min(0.045, config.height * 0.1);
  const bodyGeometry = new ExtrudeGeometry(shape, {
    depth: config.height,
    steps: 1,
    curveSegments: 12,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: Math.min(0.11, config.radius * 0.024),
    bevelThickness: bodyBevelThickness,
  });
  const snowCollarGeometry = new ExtrudeGeometry(
    createIcePlatformSnowCollarShape(config.radius),
    {
      depth: Math.min(0.16, config.height * 0.34),
      steps: 1,
      curveSegments: 12,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: Math.min(0.09, config.radius * 0.02),
      bevelThickness: Math.min(0.05, config.height * 0.12),
    }
  );
  const bodyMaterial = new MeshPhysicalMaterial({
    color: config.primaryColor,
    transmission: 0.36,
    thickness: config.height,
    roughness: 0.18,
    metalness: 0.02,
    transparent: true,
    opacity: 0.76,
    emissive: config.primaryColor,
    emissiveIntensity: 0.16,
  });
  const collarMaterial = new MeshPhysicalMaterial({
    color: "#dce7f1",
    roughness: 0.94,
    metalness: 0,
  });
  const surfaceMaterial = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPrimaryColor: { value: new Color(config.primaryColor) },
      uGlowIntensity: { value: config.glowIntensity },
      uFrostDensity: { value: config.frostDensity },
      uRadius: { value: config.radius },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });

  const body = new Mesh(bodyGeometry, bodyMaterial);
  body.name = "winter-ice-platform-body";
  body.rotation.x = -Math.PI / 2;
  body.position.y = groundY;
  body.receiveShadow = true;
  object.add(body);

  const collar = new Mesh(snowCollarGeometry, collarMaterial);
  collar.name = "winter-ice-platform-snow-collar";
  collar.rotation.x = -Math.PI / 2;
  collar.position.y = groundY + 0.012;
  collar.receiveShadow = true;
  object.add(collar);

  const surface = new Mesh(surfaceGeometry, surfaceMaterial);
  surface.name = "winter-ice-platform-surface";
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = groundY + config.height + bodyBevelThickness + 0.004;
  surface.receiveShadow = true;
  surface.renderOrder = 72;
  object.add(surface);

  return {
    object,
    update(deltaSeconds) {
      surfaceMaterial.uniforms.uTime!.value += deltaSeconds;
    },
    setGroundY(nextGroundY) {
      body.position.y = nextGroundY;
      collar.position.y = nextGroundY + 0.012;
      surface.position.y =
        nextGroundY + config.height + bodyBevelThickness + 0.004;
    },
    dispose() {
      surfaceGeometry.dispose();
      bodyGeometry.dispose();
      snowCollarGeometry.dispose();
      bodyMaterial.dispose();
      collarMaterial.dispose();
      surfaceMaterial.dispose();
      object.clear();
    },
  };
}
