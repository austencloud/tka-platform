import { Plane, Raycaster, Vector2, Vector3, type Camera } from "three";

export interface AutumnPulseTarget {
  position: Vector3;
  baseIntensity: number;
  boostScale?: number;
  readIntensity(): number;
  writeIntensity(intensity: number): void;
}

export interface AutumnPresencePoint {
  x: number;
  z: number;
}

export interface AutumnInteraction {
  update(deltaSeconds: number, camera: Camera): void;
  pointerMove(ndcX: number, ndcY: number): boolean;
  pointerLeave(): void;
  setActive(active: boolean): void;
  setGroundY(groundY: number): void;
  setMagicIntensity(intensity: number): void;
  setPresence(presence: readonly AutumnPresencePoint[]): void;
  dispose(): void;
}

/** Exact renderer-neutral owner of AutumnInteraction's proximity response. */
export function createAutumnInteraction(options: {
  targets: readonly AutumnPulseTarget[];
  presence?: readonly AutumnPresencePoint[];
  groundY: number;
  active?: boolean;
  radius?: number;
  presenceRadius?: number;
  magicIntensity?: number;
  responsiveness?: number;
}): AutumnInteraction {
  const targets = options.targets;
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const groundPlane = new Plane(new Vector3(0, 1, 0), -options.groundY);
  const focus = new Vector3();
  const radius = options.radius ?? 4;
  const presenceRadius = options.presenceRadius ?? 10;
  const responsiveness = options.responsiveness ?? 6;
  let presence = options.presence ?? [];
  let boost = 1.8 * (options.magicIntensity ?? 1);
  let pointerActive = false;
  let active = options.active ?? true;
  let disposed = false;

  function resetTargets(): void {
    for (const target of targets) {
      target.writeIntensity(target.baseIntensity);
    }
  }

  return {
    update(deltaSeconds, camera) {
      if (disposed || !active) return;
      let focusActive = false;
      if (pointerActive) {
        raycaster.setFromCamera(ndc, camera);
        focusActive = raycaster.ray.intersectPlane(groundPlane, focus) !== null;
      }

      const alpha = 1 - Math.exp(-responsiveness * deltaSeconds);
      const invRadius = radius > 0 ? 1 / radius : 0;
      const invPresenceRadius = presenceRadius > 0 ? 1 / presenceRadius : 0;
      for (const target of targets) {
        let strongestFalloff = 0;
        if (focusActive) {
          const dx = target.position.x - focus.x;
          const dz = target.position.z - focus.z;
          const normalized = 1 - Math.hypot(dx, dz) * invRadius;
          if (normalized > 0) {
            strongestFalloff = normalized * normalized * (3 - 2 * normalized);
          }
        }
        for (const point of presence) {
          const dx = target.position.x - point.x;
          const dz = target.position.z - point.z;
          const normalized = 1 - Math.hypot(dx, dz) * invPresenceRadius;
          if (normalized <= 0) continue;
          strongestFalloff = Math.max(
            strongestFalloff,
            normalized * normalized * (3 - 2 * normalized)
          );
        }
        const goal =
          target.baseIntensity +
          boost * (target.boostScale ?? 1) * strongestFalloff;
        const current = target.readIntensity();
        target.writeIntensity(current + (goal - current) * alpha);
      }
    },
    pointerMove(ndcX, ndcY) {
      if (disposed || !active) return false;
      ndc.set(ndcX, ndcY);
      pointerActive = true;
      return true;
    },
    pointerLeave() {
      pointerActive = false;
    },
    setActive(nextActive) {
      active = nextActive;
      if (!active) {
        pointerActive = false;
        resetTargets();
      }
    },
    setGroundY(groundY) {
      groundPlane.constant = -groundY;
    },
    setMagicIntensity(intensity) {
      boost = 1.8 * intensity;
    },
    setPresence(nextPresence) {
      presence = nextPresence;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pointerActive = false;
      resetTargets();
    },
  };
}
