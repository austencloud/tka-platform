import { Camera, Group, Mesh, Raycaster, Vector2, Vector3 } from "three";
import {
  Medusae,
  OCEAN_COLORS,
} from "../../scenes/ocean/runtime/fauna/jellyfish/jellyfish-geometry";
import { buildPentatonicNotes, midiToFreq } from "./ocean-jellyfish-notes";

const SCALE = 0.012;
const DRIFT_SPEED = 0.15;
const FIXED_STEP_MS = 1000 / 30;
const STAGE_CLEAR_RADIUS = 6;
const SPAWN_X_RANGE = 15;
const SPAWN_Z_RANGE = 15;
const SPAWN_Y_MIN = 3;
const SPAWN_Y_MAX = 8;
const DART_SPEED = 4;
const DART_VELOCITY_TAU = 0.15;
const DART_OFFSET_TAU = 0.6;
const DART_UP_BIAS = 0.5;
const HOVER_RADIUS = 0.3;
const PHYSICS_WARMUP_STEPS = 200;

interface JellyfishInstance {
  medusae: Medusae;
  baseX: number;
  baseY: number;
  baseZ: number;
  phaseOffset: number;
  elapsedMs: number;
  accumulatorMs: number;
  dartVelocity: Vector3;
  dartOffset: Vector3;
  frequencyHz: number;
  pan: number;
}

export interface OceanJellyfishInteraction {
  frequencyHz: number;
  pan: number;
}

export interface OceanJellyfishSwarm {
  readonly object: Group;
  readonly count: number;
  update(deltaSeconds: number): void;
  hoverAt(ndcX: number, ndcY: number, camera: Camera): boolean;
  interactAt(
    ndcX: number,
    ndcY: number,
    camera: Camera,
  ): OceanJellyfishInteraction | null;
  dispose(): void;
}

function generateSpawnPosition(seed: number): Vector3 {
  const r1 = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  const r2 = Math.sin(seed * 269.5 + 183.3) * 43758.5453;
  const r3 = Math.sin(seed * 419.2 + 371.9) * 43758.5453;
  const fraction = (value: number) => value - Math.floor(value);

  let x = 0;
  let z = 0;
  let attempts = 0;
  do {
    x = (fraction(Math.abs(r1 + attempts * 0.37)) * 2 - 1) * SPAWN_X_RANGE;
    z = (fraction(Math.abs(r2 + attempts * 0.53)) * 2 - 1) * SPAWN_Z_RANGE;
    attempts += 1;
  } while (Math.hypot(x, z) < STAGE_CLEAR_RADIUS && attempts < 20);

  const y =
    SPAWN_Y_MIN + fraction(Math.abs(r3)) * (SPAWN_Y_MAX - SPAWN_Y_MIN);
  return new Vector3(x, y, z);
}

/**
 * Exact renderer-neutral owner for Ocean's interactive jellyfish.
 *
 * Physics, spawning, picking, startle and motion live here. DOM cursor policy
 * and Web Audio remain in the Svelte adapter/application thread.
 */
export function createOceanJellyfishSwarm(
  countInput: number,
): OceanJellyfishSwarm {
  const count = Math.max(0, Math.floor(countInput));
  const object = new Group();
  object.name = "OceanJellyfishSwarm";
  const instances: JellyfishInstance[] = [];
  const pickMeshes: Mesh[] = [];
  const meshToInstance = new Map<Mesh, JellyfishInstance>();
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const dartDirection = new Vector3();

  for (let index = 0; index < count; index += 1) {
    const medusae = new Medusae(OCEAN_COLORS);
    for (let warmup = 0; warmup < PHYSICS_WARMUP_STEPS; warmup += 1) {
      medusae.update(33);
    }

    const position = generateSpawnPosition(index);
    const phaseOffset = index * 1.618;
    const instance: JellyfishInstance = {
      medusae,
      baseX: position.x,
      baseY: position.y,
      baseZ: position.z,
      phaseOffset,
      elapsedMs: phaseOffset * 1000,
      accumulatorMs: 0,
      dartVelocity: new Vector3(),
      dartOffset: new Vector3(),
      frequencyHz: 0,
      pan: Math.max(-1, Math.min(1, position.x / SPAWN_X_RANGE)),
    };
    instances.push(instance);
    object.add(medusae.item);

    medusae.item.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh && mesh.userData.jellyfishPickTarget) {
        pickMeshes.push(mesh);
        meshToInstance.set(mesh, instance);
      }
    });
  }

  const notes = buildPentatonicNotes(instances.length);
  instances
    .map((instance) => instance)
    .sort((left, right) => left.baseY - right.baseY)
    .forEach((instance, rank) => {
      instance.frequencyHz = midiToFreq(notes[rank]!);
    });

  function setRay(ndcX: number, ndcY: number, camera: Camera): void {
    ndc.set(ndcX, ndcY);
    raycaster.setFromCamera(ndc, camera);
  }

  return {
    object,
    count,
    update(deltaSeconds) {
      const deltaMs = Math.min(deltaSeconds * 1000, 50);
      const deltaSec = deltaMs * 0.001;
      const velocityDecay = Math.exp(-deltaSec / DART_VELOCITY_TAU);
      const offsetDecay = Math.exp(-deltaSec / DART_OFFSET_TAU);

      for (const instance of instances) {
        instance.elapsedMs += deltaMs;
        instance.accumulatorMs += deltaMs;
        while (instance.accumulatorMs >= FIXED_STEP_MS) {
          instance.medusae.update(FIXED_STEP_MS);
          instance.accumulatorMs -= FIXED_STEP_MS;
        }

        instance.dartVelocity.multiplyScalar(velocityDecay);
        instance.dartOffset
          .addScaledVector(instance.dartVelocity, deltaSec)
          .multiplyScalar(offsetDecay);

        const time = instance.elapsedMs * 0.001;
        const driftX = Math.sin(time * DRIFT_SPEED + instance.phaseOffset) * 0.5;
        const driftY =
          Math.sin(time * DRIFT_SPEED * 0.6 + instance.phaseOffset * 2) * 0.3;
        const driftZ =
          Math.cos(time * DRIFT_SPEED * 0.8 + instance.phaseOffset * 0.5) * 0.4;
        const animationTime = instance.medusae.animTime;
        const pulse =
          (Math.sin(animationTime * Math.PI - Math.PI * 0.5) + 1) * 0.5;
        const strength =
          0.4 +
          0.6 *
            ((Math.sin(animationTime * 0.31 + instance.phaseOffset * 5.3) + 1) *
              0.5) *
            ((Math.sin(animationTime * 0.17 + instance.phaseOffset * 2.9) + 1) *
              0.5);
        const bob = pulse * strength * 0.08;

        instance.medusae.item.position.set(
          instance.baseX + driftX + instance.dartOffset.x,
          instance.baseY + driftY + bob + instance.dartOffset.y,
          instance.baseZ + driftZ + instance.dartOffset.z,
        );
        instance.medusae.item.scale.setScalar(SCALE);
        instance.medusae.item.rotation.set(
          Math.sin(time * 0.3 + instance.phaseOffset) * 0.1,
          time * 0.05,
          Math.cos(time * 0.25 + instance.phaseOffset * 1.5) * 0.08,
        );
      }
    },
    hoverAt(ndcX, ndcY, camera) {
      setRay(ndcX, ndcY, camera);
      return instances.some(
        (instance) =>
          raycaster.ray.distanceToPoint(instance.medusae.item.position) <=
          HOVER_RADIUS,
      );
    },
    interactAt(ndcX, ndcY, camera) {
      setRay(ndcX, ndcY, camera);
      for (const mesh of pickMeshes) mesh.geometry.computeBoundingSphere();
      const hit = raycaster.intersectObjects(pickMeshes, false)[0];
      if (!hit) return null;
      const instance = meshToInstance.get(hit.object as Mesh);
      if (!instance) return null;

      instance.medusae.triggerStartle();
      dartDirection
        .copy(raycaster.ray.direction)
        .setY(raycaster.ray.direction.y + DART_UP_BIAS)
        .normalize();
      instance.dartVelocity.copy(dartDirection).multiplyScalar(DART_SPEED);
      return { frequencyHz: instance.frequencyHz, pan: instance.pan };
    },
    dispose() {
      for (const instance of instances) instance.medusae.dispose();
      object.clear();
      pickMeshes.length = 0;
      meshToInstance.clear();
    },
  };
}
