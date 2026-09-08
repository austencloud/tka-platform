import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type Camera,
} from "three";

import type { AutumnPulseTarget } from "./autumn-interaction";

export interface AutumnWisps {
  object: Group;
  targets: readonly AutumnPulseTarget[];
  update(deltaSeconds: number, camera: Camera): void;
  setActive(active: boolean): void;
  setGroundY(groundY: number): void;
  setMotionScale(scale: number): void;
  dispose(): void;
}

interface WispRecord {
  group: Group;
  material: MeshStandardMaterial;
  baseX: number;
  baseHeight: number;
  baseZ: number;
  speed: number;
  phase: number;
  bobAmplitude: number;
  driftRadius: number;
}

const WISP_COLORS = ["#68f4dc", "#b58cff", "#ffbf73"] as const;
const BASE_EMISSIVE = 1.6;

/** Exact renderer-neutral form of production WillOWisps. */
export function createAutumnWisps(options: {
  count: number;
  groundY: number;
  active?: boolean;
  motionScale?: number;
}): AutumnWisps {
  const object = new Group();
  object.name = "autumn-wisps";
  const geometry = new SphereGeometry(1, 12, 12);
  const records: WispRecord[] = [];
  let groundY = options.groundY;
  let active = options.active ?? true;
  let motionScale = Math.max(0, options.motionScale ?? 1);
  let elapsed = 0;
  let disposed = false;

  for (let index = 0; index < options.count; index += 1) {
    const angle = (index / options.count) * Math.PI * 2 + index * 0.37;
    const radius = 8 + (index % 3) * 2;
    const baseHeight = 1 + ((index * 0.618) % 1) * 3;
    const scale = 0.05 + ((index * 0.41) % 1) * 0.045;
    const color = new Color(WISP_COLORS[index % WISP_COLORS.length]);
    const material = new MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: BASE_EMISSIVE,
      roughness: 0.3,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    const core = new Mesh(geometry, material);
    core.name = `autumn-wisp-core-${index}`;
    core.scale.setScalar(scale);
    const group = new Group();
    group.name = `autumn-wisp-${index}`;
    const baseX = Math.cos(angle) * radius;
    const baseZ = Math.sin(angle) * radius;
    group.position.set(baseX, groundY + baseHeight, baseZ);
    group.add(core);
    object.add(group);
    records.push({
      group,
      material,
      baseX,
      baseHeight,
      baseZ,
      speed: 0.12 + index * 0.03,
      phase: index * 1.7,
      bobAmplitude: 0.3 + index * 0.06,
      driftRadius: 0.5 + index * 0.08,
    });
  }

  const targets = records.map<AutumnPulseTarget>(({ group, material }) => ({
    position: group.position,
    baseIntensity: material.emissiveIntensity,
    readIntensity: () => material.emissiveIntensity,
    writeIntensity: (intensity) => {
      material.emissiveIntensity = intensity;
    },
  }));

  return {
    object,
    targets,
    update(deltaSeconds, camera) {
      if (disposed || !active) return;
      elapsed += deltaSeconds * motionScale;
      for (const record of records) {
        const time = elapsed * record.speed + record.phase;
        record.group.position.set(
          record.baseX + Math.sin(time * 0.7) * record.driftRadius,
          groundY + record.baseHeight + Math.sin(time) * record.bobAmplitude,
          record.baseZ + Math.cos(time * 0.5) * record.driftRadius
        );
        const distance = record.group.position.distanceTo(camera.position);
        const linear = Math.max(0, Math.min(1, (distance - 1.2) / 2.8));
        const proximity = linear * linear * (3 - 2 * linear);
        record.group.scale.setScalar(0.25 + proximity * 0.75);
        record.material.opacity = 0.58 * proximity;
      }
    },
    setActive(nextActive) {
      active = nextActive;
      object.visible = nextActive;
    },
    setGroundY(nextGroundY) {
      if (disposed || nextGroundY === groundY) return;
      const shift = nextGroundY - groundY;
      groundY = nextGroundY;
      for (const record of records) record.group.position.y += shift;
    },
    setMotionScale(scale) {
      motionScale = Number.isFinite(scale) ? Math.max(0, scale) : 1;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      for (const record of records) record.material.dispose();
      object.clear();
    },
  };
}
