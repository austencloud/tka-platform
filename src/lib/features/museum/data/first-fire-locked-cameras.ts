/**
 * First Fire Gate 3 locked camera set.
 *
 * Each entry binds one contract camera to one approved Gate 2 walk frame.
 * Registration is by construction: the transform is derived from the same plan
 * contract that produced the frame, so a Gate 4 render from these cameras is
 * provably the same room the user approved.
 */
import {
  FIRST_FIRE_BLENDER_PLAYER_EYE_HEIGHT,
  type FirstFireBlenderContract,
  type FirstFireBlenderCamera,
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

/**
 * Cameras Gate 3 needs that the contract does not carry.
 *
 * These are derived here rather than added to the contract on purpose. The
 * contract's source digest is Gate 2 evidence for the graybox GLB, and cameras
 * contribute no geometry to that GLB — the verifier asserts zero cameras in the
 * export. Adding a QA camera upstream would invalidate an approved artifact's
 * digest without changing a single vertex. Deriving from the same shrine
 * geometry keeps registration exact and keeps Gate 3 additive.
 */
function deriveGate3Camera(
  contract: FirstFireBlenderContract,
  id: string
): FirstFireBlenderCamera {
  if (id !== "dj-cooling") {
    throw new Error(
      `Locked camera ${id} is missing from the First Fire contract`
    );
  }
  const dj = contract.shrines.find((candidate) => candidate.id === "dj");
  if (!dj) {
    throw new Error("The First Fire contract is missing the DJ court");
  }
  // Standing at the exit mouth the visitor actually leaves through, looking
  // back at the court as it cools to coals.
  return {
    id: "dj-cooling",
    name: "QA_Camera_dj_cooling",
    position: {
      x: dj.blenderExit.x,
      y: dj.blenderExit.y,
      z: FIRST_FIRE_BLENDER_PLAYER_EYE_HEIGHT,
    },
    target: { x: dj.blenderCentre.x, y: dj.blenderCentre.y, z: 1.05 },
    horizontalFovDegrees: 62,
    type: "perspective",
  };
}

/** The contract's documented exporter transform: (X, Y, Z) -> (X, Z, -Y). */
function toRuntime(point: { x: number; y: number; z: number }) {
  return { x: point.x, y: point.z, z: -point.y };
}

export function buildFirstFireLockedCameraViews(
  contract: FirstFireBlenderContract
): FirstFireLockedCameraView[] {
  return FIRST_FIRE_LOCKED_CAMERAS.map((locked) => {
    const source: FirstFireBlenderCamera =
      contract.cameras.find((candidate) => candidate.id === locked.id) ??
      deriveGate3Camera(contract, locked.id);
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
