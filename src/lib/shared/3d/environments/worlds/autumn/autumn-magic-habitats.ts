import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  Raycaster,
  ShaderMaterial,
  Vector3,
  type Object3D,
} from "three";

import { AUTUMN_MAGIC_HABITATS } from "../../scenes/autumn/runtime/interaction/autumn-magic-habitat-layout";
import type { AutumnPulseTarget } from "./autumn-interaction";

export interface AutumnMagicHabitats {
  object: Group;
  targets: readonly AutumnPulseTarget[];
  setGroundY(groundY: number): void;
  setIntensity(intensity: number): void;
  dispose(): void;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float distanceFromCentre = length(vUv - 0.5) * 2.0;
    float aura = 1.0 - smoothstep(0.05, 1.0, distanceFromCentre);
    aura *= aura;
    if (aura < 0.004) discard;
    gl_FragColor = vec4(uColor, aura * uIntensity);
  }
`;

/** Exact renderer-neutral form of AutumnMagicHabitats. */
export function createAutumnMagicHabitats(options: {
  environment: Object3D;
  groundY: number;
  intensity?: number;
}): AutumnMagicHabitats {
  const object = new Group();
  object.name = "autumn-magic-habitats";
  const geometry = new CircleGeometry(1, 48);
  const raycaster = new Raycaster();
  const rayOrigin = new Vector3();
  const down = new Vector3(0, -1, 0);
  let groundY = options.groundY;
  let intensity = options.intensity ?? 1;
  let disposed = false;

  const entries = AUTUMN_MAGIC_HABITATS.map((habitat) => {
    const material = new ShaderMaterial({
      name: `Autumn Magic Habitat ${habitat.id}`,
      uniforms: {
        uColor: { value: new Color(habitat.color) },
        uIntensity: { value: 0.009 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = `autumn-magic-habitat-${habitat.id}`;
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(habitat.radius, habitat.radius, 1);
    mesh.renderOrder = 32;
    object.add(mesh);
    return {
      ...habitat,
      material,
      mesh,
      worldPosition: new Vector3(
        habitat.position[0],
        groundY,
        habitat.position[1]
      ),
    };
  });

  const targets = entries.map<AutumnPulseTarget>((entry) => ({
    position: entry.worldPosition,
    baseIntensity: 0.009 * intensity,
    boostScale: 0.025,
    readIntensity: () => entry.material.uniforms.uIntensity!.value as number,
    writeIntensity: (value) => {
      entry.material.uniforms.uIntensity!.value = value;
    },
  }));

  function placeOnTerrain(): void {
    const terrain = options.environment.getObjectByName("Autumn_Terrain");
    options.environment.updateMatrixWorld(true);
    entries.forEach((entry, index) => {
      let surfaceY = groundY;
      if (terrain) {
        rayOrigin.set(entry.position[0], groundY + 40, entry.position[1]);
        raycaster.set(rayOrigin, down);
        const hit = raycaster.intersectObject(terrain, true)[0];
        if (hit) surfaceY = hit.point.y;
      }
      entry.mesh.position.set(
        entry.position[0],
        surfaceY + 0.018,
        entry.position[1]
      );
      entry.worldPosition.set(entry.position[0], groundY, entry.position[1]);
      targets[index]!.position = entry.worldPosition;
    });
  }

  function syncIntensity(): void {
    const base = 0.009 * intensity;
    targets.forEach((target) => {
      target.baseIntensity = base;
      if (target.readIntensity() < base) target.writeIntensity(base);
    });
  }

  placeOnTerrain();
  syncIntensity();

  return {
    object,
    targets,
    setGroundY(nextGroundY) {
      if (disposed || nextGroundY === groundY) return;
      groundY = nextGroundY;
      placeOnTerrain();
    },
    setIntensity(nextIntensity) {
      if (disposed) return;
      intensity = nextIntensity;
      syncIntensity();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      for (const entry of entries) entry.material.dispose();
      object.clear();
    },
  };
}
