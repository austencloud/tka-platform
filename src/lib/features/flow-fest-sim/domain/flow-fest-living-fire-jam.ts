export type FlowFestFestivalPersonRole =
  | "spectator"
  | "fire-poi"
  | "fire-hoop"
  | "juggler"
  | "led-flow";

export type FlowFestFestivalPersonBehavior =
  | "watch-fire"
  | "social-pair"
  | "perimeter-walk"
  | "fire-rotation"
  | "led-session"
  | "field-practice";

/**
 * Festival attendees must read as ordinary humans. The chXX catalog also
 * contains creature models that this union deliberately excludes: ch10 is a
 * zombie (bloody decayed skin, reads as a charred body), ch34 is a green
 * plant creature, and ch44 is a near-black creature with glowing accents.
 */
export type FlowFestFestivalAvatarId =
  | "ch01"
  | "ch07"
  | "ch12"
  | "ch18"
  | "ch21"
  | "ch22"
  | "ch24"
  | "ch41"
  | "ch42";

export interface FlowFestFestivalPersonPlacement {
  id: string;
  avatarId: FlowFestFestivalAvatarId;
  role: FlowFestFestivalPersonRole;
  behavior: FlowFestFestivalPersonBehavior;
  x: number;
  y: number;
  z: number;
  facingAngle: number;
  phaseOffset: number;
  lookTarget?: { x: number; z: number };
  performanceTarget?: { x: number; y: number; z: number };
  queueTarget?: { x: number; y: number; z: number };
  rotationOrdinal?: number;
}

export interface FlowFestFestivalCommunityLayout {
  fireCenter: { x: number; y: number; z: number };
  ledCircleCenter: { x: number; y: number; z: number };
  people: FlowFestFestivalPersonPlacement[];
  spectatorCount: number;
  performerCount: number;
  firePerformerCount: number;
  activeFirePerformerCount: number;
  ingressBearingRadians: number;
  ingressHalfWidthRadians: number;
}

export interface FlowFestLivingPersonFrame {
  id: string;
  x: number;
  y: number;
  z: number;
  facingAngle: number;
  isMoving: boolean;
  active: boolean;
  activity: "watching" | "talking" | "walking" | "performing" | "waiting";
}

export interface FlowFestLivingCommunityFrame {
  elapsedSeconds: number;
  rotationOrdinal: number;
  activeFirePerformerIds: string[];
  movingSpectatorCount: number;
  talkingSpectatorCount: number;
  people: FlowFestLivingPersonFrame[];
}

const FIRE_ROTATION_SECONDS = 24;
const FIRE_ROTATION_TRANSITION_SECONDS = 4.5;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function wrapOrdinal(value: number, count: number): number {
  return ((value % count) + count) % count;
}

function faceTarget(
  x: number,
  z: number,
  target: { x: number; z: number }
): number {
  return Math.atan2(target.x - x, target.z - z);
}

function firePerformerIsActive(
  performerOrdinal: number,
  rotationOrdinal: number,
  performerCount: number,
  activeCount: number
): boolean {
  const distance = wrapOrdinal(
    performerOrdinal - rotationOrdinal,
    performerCount
  );
  return distance < activeCount;
}

function sampleFirePerformer(
  person: FlowFestFestivalPersonPlacement,
  layout: FlowFestFestivalCommunityLayout,
  elapsedSeconds: number,
  rotationOrdinal: number
): FlowFestLivingPersonFrame {
  const performerOrdinal = person.rotationOrdinal ?? 0;
  const active = firePerformerIsActive(
    performerOrdinal,
    rotationOrdinal,
    layout.firePerformerCount,
    layout.activeFirePerformerCount
  );
  const previousActive = firePerformerIsActive(
    performerOrdinal,
    rotationOrdinal - 1,
    layout.firePerformerCount,
    layout.activeFirePerformerCount
  );
  const cycleSeconds = elapsedSeconds % FIRE_ROTATION_SECONDS;
  const transition = smoothstep(
    cycleSeconds / FIRE_ROTATION_TRANSITION_SECONDS
  );
  const from = previousActive
    ? (person.performanceTarget ?? person)
    : (person.queueTarget ?? person);
  const to = active
    ? (person.performanceTarget ?? person)
    : (person.queueTarget ?? person);
  const x = lerp(from.x, to.x, transition);
  const y = lerp(from.y, to.y, transition);
  const z = lerp(from.z, to.z, transition);
  const isMoving = previousActive !== active && transition < 0.995;

  return {
    id: person.id,
    x,
    y,
    z,
    facingAngle: isMoving
      ? faceTarget(x, z, to)
      : faceTarget(x, z, layout.fireCenter),
    isMoving,
    active: active && transition > 0.48,
    activity: active && transition > 0.48 ? "performing" : "waiting",
  };
}

function sampleSpectator(
  person: FlowFestFestivalPersonPlacement,
  layout: FlowFestFestivalCommunityLayout,
  elapsedSeconds: number,
  responseIntensity: number
): FlowFestLivingPersonFrame {
  const phase = elapsedSeconds * 0.28 + person.phaseOffset;
  if (person.behavior === "perimeter-walk") {
    const dx = person.x - layout.fireCenter.x;
    const dz = person.z - layout.fireCenter.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const tangentX = -dz / length;
    const tangentZ = dx / length;
    const travel = Math.sin(phase) * (1.35 + responseIntensity * 0.55);
    const velocity = Math.cos(phase);
    const x = person.x + tangentX * travel;
    const z = person.z + tangentZ * travel;
    return {
      id: person.id,
      x,
      y: person.y,
      z,
      facingAngle:
        Math.atan2(
          tangentX * Math.sign(velocity),
          tangentZ * Math.sign(velocity)
        ) || person.facingAngle,
      isMoving: Math.abs(velocity) > 0.16,
      active: true,
      activity: "walking",
    };
  }

  const breathingOffset = Math.sin(phase * 1.7) * 0.055;
  const target =
    person.behavior === "social-pair" && person.lookTarget
      ? person.lookTarget
      : layout.fireCenter;
  return {
    id: person.id,
    x: person.x + Math.cos(person.facingAngle) * breathingOffset,
    y: person.y,
    z: person.z + Math.sin(person.facingAngle) * breathingOffset,
    facingAngle: faceTarget(person.x, person.z, target),
    isMoving: false,
    active: true,
    activity: person.behavior === "social-pair" ? "talking" : "watching",
  };
}

function sampleContinuousPerformer(
  person: FlowFestFestivalPersonPlacement,
  layout: FlowFestFestivalCommunityLayout,
  elapsedSeconds: number
): FlowFestLivingPersonFrame {
  const target =
    person.behavior === "led-session"
      ? layout.ledCircleCenter
      : (person.lookTarget ?? layout.fireCenter);
  const orbit = person.behavior === "field-practice" ? 0.22 : 0.08;
  const phase = elapsedSeconds * 0.21 + person.phaseOffset;
  const x = person.x + Math.cos(phase) * orbit;
  const z = person.z + Math.sin(phase) * orbit;
  return {
    id: person.id,
    x,
    y: person.y,
    z,
    facingAngle: faceTarget(x, z, target),
    isMoving: false,
    active: true,
    activity: "performing",
  };
}

export function sampleFlowFestLivingCommunity(
  layout: FlowFestFestivalCommunityLayout,
  elapsedSeconds: number,
  responseIntensity: number
): FlowFestLivingCommunityFrame {
  const safeElapsed = Math.max(0, elapsedSeconds);
  const rotationOrdinal = Math.floor(safeElapsed / FIRE_ROTATION_SECONDS);
  const people = layout.people.map((person) => {
    if (person.behavior === "fire-rotation") {
      return sampleFirePerformer(person, layout, safeElapsed, rotationOrdinal);
    }
    if (person.role === "spectator") {
      return sampleSpectator(
        person,
        layout,
        safeElapsed,
        clamp01(responseIntensity)
      );
    }
    return sampleContinuousPerformer(person, layout, safeElapsed);
  });

  return {
    elapsedSeconds: safeElapsed,
    rotationOrdinal,
    activeFirePerformerIds: people
      .filter((person) => person.activity === "performing")
      .filter((frame) =>
        layout.people.some(
          (person) =>
            person.id === frame.id && person.behavior === "fire-rotation"
        )
      )
      .map((person) => person.id),
    movingSpectatorCount: people.filter(
      (person) => person.activity === "walking" && person.isMoving
    ).length,
    talkingSpectatorCount: people.filter(
      (person) => person.activity === "talking"
    ).length,
    people,
  };
}

export function auditFlowFestLivingCommunity(
  layout: FlowFestFestivalCommunityLayout,
  performanceFloorRadiusMeters: number
): {
  spectatorFloorIntrusions: number;
  minimumSpectatorRadiusMeters: number;
  fireRotationComplete: boolean;
  ingressParticipantCount: number;
} {
  const spectators = layout.people.filter(
    (person) => person.role === "spectator"
  );
  const radii = spectators.map((person) =>
    Math.hypot(person.x - layout.fireCenter.x, person.z - layout.fireCenter.z)
  );
  const ingressParticipantCount = spectators.filter((person) => {
    const bearing = Math.atan2(
      person.z - layout.fireCenter.z,
      person.x - layout.fireCenter.x
    );
    const delta = Math.atan2(
      Math.sin(bearing - layout.ingressBearingRadians),
      Math.cos(bearing - layout.ingressBearingRadians)
    );
    return Math.abs(delta) < layout.ingressHalfWidthRadians;
  }).length;
  const fireRotation = layout.people.filter(
    (person) => person.behavior === "fire-rotation"
  );
  const ordinals = new Set(
    fireRotation.map((person) => person.rotationOrdinal)
  );

  return {
    spectatorFloorIntrusions: radii.filter(
      (radius) => radius < performanceFloorRadiusMeters + 1.2
    ).length,
    minimumSpectatorRadiusMeters: Math.min(...radii),
    fireRotationComplete:
      fireRotation.length === layout.firePerformerCount &&
      ordinals.size === layout.firePerformerCount,
    ingressParticipantCount,
  };
}
