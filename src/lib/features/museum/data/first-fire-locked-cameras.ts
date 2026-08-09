/**
 * First Fire Gate 3 locked camera set.
 *
 * Each entry binds one contract camera to one approved Gate 2 walk frame.
 * Registration is by construction: the transform is derived from the same plan
 * contract that produced the frame, so a Gate 4 render from these cameras is
 * provably the same room the user approved.
 */
import type {
  FirstFireBlenderContract,
  FirstFireBlenderCamera,
} from "./first-fire-blender-contract";

export interface FirstFireLockedCamera {
  /** Contract camera id. */
  id: string;
  /** Gate 2 walk frame this camera reproduces. */
  frame: string;
  /** What the frame is for, in one line. */
  intent: string;
}

export interface FirstFireLockedCameraView extends FirstFireLockedCamera {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  /** Runtime yaw toward the target, radians. */
  yaw: number;
  horizontalFovDegrees: number;
}

export const FIRST_FIRE_LOCKED_CAMERAS: readonly FirstFireLockedCamera[] = [
  {
    id: "ember-bridge",
    frame: "walk-01-ember-bridge.webp",
    intent: "Arrival. The vent chamber reads as a volcano before any court is legible.",
  },
  {
    id: "dj-threshold",
    frame: "walk-02-dj-mouth.webp",
    intent: "Coal announced. Narrowest throat, closest performer, hardest heat distortion.",
  },
  {
    id: "dj-cooling",
    frame: "walk-03-dj-cooling.webp",
    intent: "The walked court cooling to coals behind the visitor.",
  },
  {
    id: "ek-threshold",
    frame: "walk-04-ek-mouth.webp",
    intent: "Flame added. The court opens and breathes after DJ's proximity.",
  },
  {
    id: "fl-threshold",
    frame: "walk-05-fl-mouth.webp",
    intent: "Arc added. The full instrument, and the only fire arriving from outside.",
  },
  {
    id: "blackout",
    frame: "walk-06-blackout.webp",
    intent: "Three accumulated layers gone at once. No light source survives.",
  },
  {
    id: "earth-reveal",
    frame: "walk-07-earth-growth.webp",
    intent: "Green rising from the strike scars along the route already walked.",
  },
] as const;

/** The contract's documented exporter transform: (X, Y, Z) -> (X, Z, -Y). */
function toRuntime(point: { x: number; y: number; z: number }) {
  return { x: point.x, y: point.z, z: -point.y };
}

export function buildFirstFireLockedCameraViews(
  contract: FirstFireBlenderContract
): FirstFireLockedCameraView[] {
  return FIRST_FIRE_LOCKED_CAMERAS.map((locked) => {
    const source: FirstFireBlenderCamera | undefined = contract.cameras.find(
      (candidate) => candidate.id === locked.id
    );
    if (!source) {
      throw new Error(
        `Locked camera ${locked.id} is missing from the First Fire contract`
      );
    }
    const position = toRuntime(source.position);
    const target = toRuntime(source.target);
    return {
      ...locked,
      position,
      target,
      yaw: Math.atan2(target.x - position.x, target.z - position.z),
      horizontalFovDegrees: source.horizontalFovDegrees,
    };
  });
}

export function findFirstFireLockedCameraView(
  contract: FirstFireBlenderContract,
  id: string
): FirstFireLockedCameraView | undefined {
  return buildFirstFireLockedCameraViews(contract).find(
    (view) => view.id === id
  );
}
