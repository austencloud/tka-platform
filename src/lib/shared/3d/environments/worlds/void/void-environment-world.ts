import {
  AmbientLight,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from "three";
import { resolveCircularStageRadius } from "../../domain/performer-stage-bounds";
import {
  createDefaultVoidConfig,
  type VoidSceneConfig,
} from "../../domain/models/scene-configs";

const COLUMN_COUNT = 8;

const VOID_PLATFORM_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const VOID_PLATFORM_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uGridColor;
  uniform float uGlowIntensity;
  uniform float uGridDensity;
  varying vec2 vUv;

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float dist = length(centered);
    if (dist > 1.0) discard;

    float ringCount = 8.0 * uGridDensity;
    float lineCount = 12.0 * uGridDensity;
    float lineWidth = 0.06;
    float ringCoord = dist * ringCount;
    float ringFrac = abs(fract(ringCoord) - 0.5) * 2.0;
    float rings = 1.0 - smoothstep(0.0, lineWidth, ringFrac);
    float angle = atan(centered.y, centered.x);
    float radialCoord = angle * lineCount / 6.283185;
    float radialFrac = abs(fract(radialCoord) - 0.5) * 2.0;
    float radials = 1.0 - smoothstep(0.0, lineWidth, radialFrac);
    radials *= smoothstep(0.0, 0.08, dist);

    float grid = max(rings, radials);
    float edgeFade = 1.0 - smoothstep(0.7, 1.0, dist);
    float downstageBias = 1.0 + smoothstep(-0.1, 0.5, centered.y) * 1.0;
    float pulse = 0.85 + 0.15 * sin(uTime * 1.2);
    float brightness = grid * edgeFade * uGlowIntensity * downstageBias * pulse;
    vec3 color = uGridColor * brightness;
    float glowSpread = grid * edgeFade * uGlowIntensity * downstageBias * pulse * 0.3;
    color += uGridColor * glowSpread;

    gl_FragColor = vec4(color, clamp(brightness + glowSpread, 0.0, 1.0));
  }
`;

export interface VoidEnvironmentWorldOptions {
  config?: VoidSceneConfig;
  groundY: number;
  stageRadius?: number;
  stageRadiusGrowth?: number;
}

export interface VoidEnvironmentWorld {
  root: Group;
  update(deltaSeconds: number): void;
  dispose(): void;
}

/** Exact renderer-neutral owner of the production Void environment. */
export function createVoidEnvironmentWorld(
  options: VoidEnvironmentWorldOptions
): VoidEnvironmentWorld {
  const root = new Group();
  root.name = "void-environment-world";
  const config = options.config ?? createDefaultVoidConfig();
  const radius = resolveCircularStageRadius(
    options.stageRadius ?? 3,
    config.platform.radius,
    undefined,
    options.stageRadiusGrowth ?? 0
  );
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();

  function geometry<T extends BufferGeometry>(value: T): T {
    geometries.add(value);
    return value;
  }

  function material<T extends Material>(value: T): T {
    materials.add(value);
    return value;
  }

  let gridMaterial: ShaderMaterial | null = null;
  if (config.platform.enabled) {
    const platform = config.platform;
    const bodyGeometry = geometry(
      new CylinderGeometry(radius, radius, platform.height, 64, 1, true)
    );
    const body = new Mesh(
      bodyGeometry,
      material(
        new MeshStandardMaterial({
          color: "#000000",
          transparent: true,
          opacity: 0.15,
          depthWrite: false,
        })
      )
    );
    body.name = "void-platform-body";
    body.position.y = options.groundY + platform.height / 2;
    root.add(body);

    gridMaterial = material(
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uGridColor: { value: new Color(platform.gridColor) },
          uGlowIntensity: { value: platform.glowIntensity },
          uGridDensity: { value: platform.gridDensity },
        },
        vertexShader: VOID_PLATFORM_VERTEX_SHADER,
        fragmentShader: VOID_PLATFORM_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      })
    );
    const grid = new Mesh(
      geometry(new CircleGeometry(radius, 128)),
      gridMaterial
    );
    grid.name = "void-platform-grid";
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = options.groundY + platform.height;
    root.add(grid);

    const topRingMaterial = material(
      new MeshStandardMaterial({
        color: platform.gridColor,
        emissive: platform.gridColor,
        emissiveIntensity: platform.glowIntensity * 1.2,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      })
    );
    const bottomRingMaterial = material(
      new MeshStandardMaterial({
        color: platform.gridColor,
        emissive: platform.gridColor,
        emissiveIntensity: platform.glowIntensity * 1.5,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    const ringGeometry = geometry(new TorusGeometry(radius, 0.015, 8, 128));
    const topRing = new Mesh(ringGeometry, topRingMaterial);
    topRing.name = "void-platform-top-ring";
    topRing.rotation.x = -Math.PI / 2;
    topRing.position.y = options.groundY + platform.height;
    root.add(topRing);
    const bottomRing = new Mesh(ringGeometry, bottomRingMaterial);
    bottomRing.name = "void-platform-bottom-ring";
    bottomRing.rotation.x = -Math.PI / 2;
    bottomRing.position.y = options.groundY + 0.01;
    root.add(bottomRing);

    const columnGeometry = geometry(
      new CylinderGeometry(0.008, 0.008, platform.height, 6)
    );
    const columnMaterial = material(
      new MeshStandardMaterial({
        color: platform.gridColor,
        emissive: platform.gridColor,
        emissiveIntensity: platform.glowIntensity * 0.8,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      })
    );
    for (let index = 0; index < COLUMN_COUNT; index += 1) {
      const angle = (index / COLUMN_COUNT) * Math.PI * 2;
      const column = new Mesh(columnGeometry, columnMaterial);
      column.name = `void-platform-column-${index}`;
      column.position.set(
        Math.cos(angle) * radius,
        options.groundY + platform.height / 2,
        Math.sin(angle) * radius
      );
      root.add(column);
    }
  }

  root.add(new AmbientLight("#ffffff", config.ambientIntensity));
  const directional = new DirectionalLight("#ffffff", 0.3);
  directional.position.set(5, 10, 5);
  root.add(directional);

  let disposed = false;
  return {
    root,
    update(deltaSeconds) {
      if (disposed || !gridMaterial) return;
      gridMaterial.uniforms.uTime!.value += deltaSeconds;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const value of geometries) value.dispose();
      for (const value of materials) value.dispose();
      root.clear();
    },
  };
}
