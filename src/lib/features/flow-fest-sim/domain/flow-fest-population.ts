/**
 * The living population of Flow Fest.
 *
 * A schedule-driven skeleton with utility-scored interrupts. Each person holds
 * a persistent identity, a home camp, and a plan for the day; the plan keeps
 * running whether or not the player is watching. Interrupts let someone stop to
 * watch a spinner or fall into a conversation without abandoning where they
 * were headed.
 *
 * Everything here is a pure function of the sim clock plus a seed. No
 * `Date.now()`, no wall-clock sampling: replaying the same tick sequence
 * reproduces the same festival.
 *
 * Movement is delegated to `flow-fest-corridor-graph`, which only ever routes
 * along registered person legs and registered zone envelopes. This module never
 * touches a raw coordinate of its own.
 */

import type { FlowFestMoment } from "../state/flow-fest-progress";
import { makeRng, childSeed } from "$lib/shared/foundation/utils/seeded-rng";
import {
  clampInsideFlowFestClearing,
  flowFestCorridorAnchorNode,
  isFlowFestCorridorCovered,
  routeFlowFestCorridor,
  type FlowFestCorridorGraph,
  type FlowFestCorridorRouteStep,
} from "./flow-fest-corridor-graph";
import type {
  FlowFestFestivalAvatarId,
  FlowFestFestivalCommunityLayout,
  FlowFestFestivalPersonPlacement,
} from "./flow-fest-living-fire-jam";

export type FlowFestDayPhase =
  | "thursday-afternoon"
  | "dusk-migration"
  | "night-festival"
  | "late-drift-home";

export interface FlowFestDayPhaseWindow {
  startMinute: number;
  endMinute: number;
}

/**
 * Minutes past midnight. The late phase runs past 24:00 so the ordering stays
 * monotonic across the night rather than wrapping mid-festival.
 */
export const FLOW_FEST_DAY_PHASE_WINDOWS: Record<
  FlowFestDayPhase,
  FlowFestDayPhaseWindow
> = {
  "thursday-afternoon": { startMinute: 780, endMinute: 1140 },
  "dusk-migration": { startMinute: 1140, endMinute: 1260 },
  "night-festival": { startMinute: 1260, endMinute: 1560 },
  "late-drift-home": { startMinute: 1560, endMinute: 1800 },
};

export const FLOW_FEST_DAY_PHASE_ORDER: FlowFestDayPhase[] = [
  "thursday-afternoon",
  "dusk-migration",
  "night-festival",
  "late-drift-home",
];

/** Sim minutes advanced per real second while a moment is on screen. */
export const FLOW_FEST_SIM_MINUTES_PER_SECOND = 0.5;

/**
 * Seconds of unrendered simulation to run when a phase begins, so the player
 * joining at that moment finds the festival where the evening would have put
 * it. Afternoon runs from zero because the player arrives with everyone else.
 */
export const FLOW_FEST_PHASE_WARM_START_SECONDS: Record<
  FlowFestDayPhase,
  number
> = {
  "thursday-afternoon": 0,
  "dusk-migration": 60,
  "night-festival": 300,
  "late-drift-home": 150,
};

export function flowFestDayPhaseForMoment(
  moment: FlowFestMoment
): FlowFestDayPhase {
  switch (moment) {
    case "afternoon":
      return "thursday-afternoon";
    case "golden-hour":
      return "dusk-migration";
    case "night":
      return "night-festival";
    case "dawn":
      return "late-drift-home";
  }
}

export interface FlowFestSimClock {
  minuteOfDay: number;
  dayPhase: FlowFestDayPhase;
  /** 0 at the start of the phase window, 1 at its end. */
  phaseProgress: number;
}

/**
 * The population clock is anchored to the visual moment so the sky and the
 * schedule can never disagree. Elapsed seconds move time forward inside that
 * moment's window; the phase itself changes when the story does.
 */
export function flowFestSimClock(
  moment: FlowFestMoment,
  elapsedSeconds: number
): FlowFestSimClock {
  const dayPhase = flowFestDayPhaseForMoment(moment);
  const window = FLOW_FEST_DAY_PHASE_WINDOWS[dayPhase];
  const span = window.endMinute - window.startMinute;
  const advanced =
    window.startMinute +
    Math.max(0, elapsedSeconds) * FLOW_FEST_SIM_MINUTES_PER_SECOND;
  const minuteOfDay = Math.min(advanced, window.endMinute - 0.0001);
  return {
    minuteOfDay,
    dayPhase,
    phaseProgress: Math.max(
      0,
      Math.min(1, (minuteOfDay - window.startMinute) / span)
    ),
  };
}

export function flowFestClockLabel(minuteOfDay: number): string {
  const wrapped = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export type FlowFestNpcRole =
  | "gate-greeter"
  | "camp-host"
  | "traveler"
  | "fire-dancer"
  | "wanderer";

export type FlowFestActivity =
  | "gate-greet"
  | "camp-settle"
  | "camp-social"
  | "gear-up"
  | "travel"
  | "gather"
  | "practice"
  | "watch-fire"
  | "join-fire"
  | "rest";

/** Activities whose people belong to the fire circle, not the walking layer. */
export const FLOW_FEST_FIRE_JAM_ACTIVITIES: ReadonlySet<FlowFestActivity> =
  new Set<FlowFestActivity>(["watch-fire", "join-fire"]);

export type FlowFestAnchorKind =
  | "gate"
  | "camp"
  | "parking"
  | "gathering"
  | "practice"
  | "fire";

export interface FlowFestPopulationAnchor {
  id: string;
  label: string;
  kind: FlowFestAnchorKind;
  x: number;
  z: number;
  /** Index into the corridor graph's clearing list, or -1. */
  clearingIndex: number;
  /**
   * False when no registered person leg reaches this anchor. The lower gate is
   * the real case: its zone sits 1.4 m outside the lower-tent circle and no leg
   * touches it, so its people stand and greet rather than pretending to walk a
   * corridor that does not exist.
   */
  routable: boolean;
}

export interface FlowFestPopulationSite {
  seed: string;
  graph: FlowFestCorridorGraph;
  anchors: FlowFestPopulationAnchor[];
  /** Anchor the fire circle occupies, used for fire-jam handoff. */
  fireAnchorId: string;
  groundY: (x: number, z: number) => number;
}

export interface FlowFestScheduleBlock {
  startMinute: number;
  anchorId: string;
  activity: FlowFestActivity;
}

export interface FlowFestNpc {
  id: string;
  displayName: string;
  avatarId: FlowFestFestivalAvatarId;
  role: FlowFestNpcRole;
  homeAnchorId: string;
  /** 0 keeps to themself, 1 stops for every conversation. */
  sociability: number;
  walkSpeedMetersPerSecond: number;
  schedule: FlowFestScheduleBlock[];
  seed: string;
}

const AVATAR_ROSTER: FlowFestFestivalAvatarId[] = [
  "ch01",
  "ch07",
  "ch12",
  "ch18",
  "ch21",
  "ch22",
  "ch24",
  "ch41",
  "ch42",
];

const NPC_NAMES = [
  "Wren",
  "Bo",
  "Sage",
  "Cass",
  "Juniper",
  "Rook",
  "Mira",
  "Dez",
  "Ash",
  "Poppy",
  "Kit",
  "Lark",
  "Nico",
  "Sol",
  "Wilder",
  "Fen",
  "Marlow",
  "Tam",
  "Rue",
  "Ozzy",
  "Sparrow",
  "Indigo",
  "Cleo",
  "Bram",
  "Delta",
  "Onyx",
  "Vale",
  "Hollis",
  "Wynn",
  "Zephyr",
  "Callum",
  "Nova",
  "Piper",
  "Ridge",
  "Sunny",
  "Thea",
  "Blaze",
  "Coriander",
  "Echo",
  "Fable",
];

function pick<T>(items: readonly T[], roll: number): T {
  return items[Math.min(items.length - 1, Math.floor(roll * items.length))]!;
}

function anchorsOfKind(
  site: FlowFestPopulationSite,
  kind: FlowFestAnchorKind
): FlowFestPopulationAnchor[] {
  return site.anchors.filter((anchor) => anchor.kind === kind);
}

function requireAnchor(
  site: FlowFestPopulationSite,
  id: string
): FlowFestPopulationAnchor {
  const anchor = site.anchors.find((candidate) => candidate.id === id);
  if (!anchor) {
    throw new Error(`Flow Fest population anchor is not registered: ${id}`);
  }
  return anchor;
}

/**
 * Place a block inside its phase with per-person jitter so migrations stagger
 * instead of everyone standing up on the same minute.
 */
function blockStart(
  phase: FlowFestDayPhase,
  fraction: number,
  jitter: number
): number {
  const window = FLOW_FEST_DAY_PHASE_WINDOWS[phase];
  const span = window.endMinute - window.startMinute;
  return window.startMinute + span * Math.max(0, Math.min(0.96, fraction + jitter));
}

function buildSchedule(
  role: FlowFestNpcRole,
  homeAnchorId: string,
  site: FlowFestPopulationSite,
  rng: () => number
): FlowFestScheduleBlock[] {
  const gathering = anchorsOfKind(site, "gathering");
  const practice = anchorsOfKind(site, "practice");
  const parking = anchorsOfKind(site, "parking");
  const gatheringId =
    gathering.length > 0 ? pick(gathering, rng()).id : homeAnchorId;
  const practiceId =
    practice.length > 0 ? pick(practice, rng()).id : gatheringId;
  const parkingId = parking.length > 0 ? pick(parking, rng()).id : homeAnchorId;
  const fireId = site.fireAnchorId;
  const jitter = () => (rng() - 0.5) * 0.22;
  const blocks: FlowFestScheduleBlock[] = [];
  const push = (
    phase: FlowFestDayPhase,
    fraction: number,
    anchorId: string,
    activity: FlowFestActivity
  ) => {
    blocks.push({
      startMinute: blockStart(phase, fraction, jitter()),
      anchorId,
      activity,
    });
  };

  if (role === "gate-greeter") {
    push("thursday-afternoon", 0, homeAnchorId, "gate-greet");
    push("dusk-migration", 0.05, homeAnchorId, "gate-greet");
    push("night-festival", 0.05, homeAnchorId, "gate-greet");
    push("late-drift-home", 0.1, homeAnchorId, "rest");
    return sortSchedule(blocks);
  }

  if (role === "camp-host") {
    push("thursday-afternoon", 0.05, homeAnchorId, "camp-settle");
    push("thursday-afternoon", 0.55, homeAnchorId, "camp-social");
    push("dusk-migration", 0.15, homeAnchorId, "gear-up");
    push("dusk-migration", 0.6, gatheringId, "gather");
    push("night-festival", 0.2, fireId, "watch-fire");
    push("late-drift-home", 0.25, homeAnchorId, "rest");
    return sortSchedule(blocks);
  }

  if (role === "traveler") {
    push("thursday-afternoon", 0.05, parkingId, "travel");
    push("thursday-afternoon", 0.35, homeAnchorId, "camp-settle");
    push("thursday-afternoon", 0.75, gatheringId, "gather");
    push("dusk-migration", 0.35, gatheringId, "gather");
    push("night-festival", 0.15, fireId, "watch-fire");
    push("late-drift-home", 0.2, homeAnchorId, "rest");
    return sortSchedule(blocks);
  }

  if (role === "fire-dancer") {
    push("thursday-afternoon", 0.2, homeAnchorId, "camp-settle");
    push("thursday-afternoon", 0.7, practiceId, "practice");
    push("dusk-migration", 0.25, practiceId, "practice");
    push("dusk-migration", 0.7, fireId, "join-fire");
    push("night-festival", 0.05, fireId, "join-fire");
    push("late-drift-home", 0.35, homeAnchorId, "rest");
    return sortSchedule(blocks);
  }

  push("thursday-afternoon", 0.15, gatheringId, "gather");
  push("thursday-afternoon", 0.6, practiceId, "practice");
  push("dusk-migration", 0.2, gatheringId, "gather");
  push("night-festival", 0.1, fireId, "watch-fire");
  push("night-festival", 0.7, gatheringId, "gather");
  push("late-drift-home", 0.3, homeAnchorId, "rest");
  return sortSchedule(blocks);
}

function sortSchedule(
  blocks: FlowFestScheduleBlock[]
): FlowFestScheduleBlock[] {
  return [...blocks].sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * The block in force at a given minute. Before the first block the day has not
 * started for this person, so their first plan stands.
 */
export function resolveFlowFestScheduleBlock(
  schedule: ReadonlyArray<FlowFestScheduleBlock>,
  minuteOfDay: number
): FlowFestScheduleBlock {
  let current = schedule[0]!;
  for (const block of schedule) {
    if (block.startMinute <= minuteOfDay) current = block;
    else break;
  }
  return current;
}

export interface FlowFestPopulationOptions {
  /** Total identities in the world. */
  count?: number;
  /** Camp anchors people may call home, in preference order. */
  homeAnchorIds?: string[];
}

export function createFlowFestPopulation(
  site: FlowFestPopulationSite,
  options: FlowFestPopulationOptions = {}
): FlowFestNpc[] {
  const count = options.count ?? 38;
  const camps = anchorsOfKind(site, "camp");
  const gates = anchorsOfKind(site, "gate");
  const homes =
    options.homeAnchorIds?.map((id) => requireAnchor(site, id)) ?? camps;
  if (homes.length === 0) {
    throw new Error("Flow Fest population needs at least one camp anchor.");
  }

  const roleCycle: FlowFestNpcRole[] = [
    "traveler",
    "camp-host",
    "wanderer",
    "traveler",
    "fire-dancer",
    "camp-host",
    "wanderer",
    "traveler",
  ];

  const npcs: FlowFestNpc[] = [];
  for (let index = 0; index < count; index += 1) {
    const seed = childSeed(site.seed, `npc-${index}`);
    const rng = makeRng(seed);
    const isGateGreeter = gates.length > 0 && index < 3;
    const role: FlowFestNpcRole = isGateGreeter
      ? "gate-greeter"
      : roleCycle[index % roleCycle.length]!;
    const home = isGateGreeter
      ? gates[index % gates.length]!
      : homes[index % homes.length]!;
    const npc: FlowFestNpc = {
      id: `flow-fest-npc-${String(index).padStart(2, "0")}`,
      displayName: NPC_NAMES[index % NPC_NAMES.length]!,
      avatarId: AVATAR_ROSTER[index % AVATAR_ROSTER.length]!,
      role,
      homeAnchorId: home.id,
      sociability: 0.2 + rng() * 0.75,
      walkSpeedMetersPerSecond: 1.05 + rng() * 0.42,
      schedule: [],
      seed,
    };
    npc.schedule = buildSchedule(role, home.id, site, rng);
    npcs.push(npc);
  }
  return npcs;
}

export interface FlowFestPopulationAgentFrame {
  id: string;
  displayName: string;
  avatarId: FlowFestFestivalAvatarId;
  role: FlowFestNpcRole;
  x: number;
  y: number;
  z: number;
  facingAngle: number;
  isMoving: boolean;
  speedMetersPerSecond: number;
  activity: FlowFestActivity;
  /** The scheduled destination, even while an interrupt holds them. */
  anchorId: string;
  /** True while a utility interrupt has taken over from the schedule. */
  interrupted: boolean;
  /** True when the fire circle owns this person for the current phase. */
  atFireJam: boolean;
  /** False when no registered corridor reaches their destination. */
  routed: boolean;
}

export interface FlowFestPopulationFrame {
  minuteOfDay: number;
  dayPhase: FlowFestDayPhase;
  agents: FlowFestPopulationAgentFrame[];
  fireJamAttendeeCount: number;
  fireJamPerformerCount: number;
  travellingCount: number;
  interruptedCount: number;
  unroutableCount: number;
}

interface AgentState {
  npc: FlowFestNpc;
  x: number;
  z: number;
  facingAngle: number;
  speed: number;
  activity: FlowFestActivity;
  anchorId: string;
  routeAnchorId: string;
  path: FlowFestCorridorRouteStep[] | null;
  pathIndex: number;
  routed: boolean;
  interruptUntilMinute: number;
  interruptFacing: number;
  nextInterruptCheckSeconds: number;
  offsetX: number;
  offsetZ: number;
  wanderPhase: number;
  rng: () => number;
}

const SEPARATION_INTERVAL_SECONDS = 0.1;
const SEPARATION_RADIUS_METERS = 1.15;
const ARRIVAL_EASE_METERS = 2.2;
const ARRIVAL_SNAP_METERS = 0.35;

function shortestAngleTo(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export class FlowFestPopulationSimulation {
  readonly site: FlowFestPopulationSite;
  readonly npcs: FlowFestNpc[];

  private readonly states: AgentState[] = [];
  private readonly frameAgents: FlowFestPopulationAgentFrame[] = [];
  private readonly frameValue: FlowFestPopulationFrame;
  private separationAccumulator = 0;
  private elapsedSeconds = 0;
  private readonly scratch = { x: 0, z: 0 };

  constructor(site: FlowFestPopulationSite, npcs: FlowFestNpc[]) {
    this.site = site;
    this.npcs = npcs;

    for (const npc of npcs) {
      const anchor = requireAnchor(site, npc.schedule[0]!.anchorId);
      const rng = makeRng(childSeed(npc.seed, "motion"));
      const spread = 1.6;
      const startX = anchor.x + (rng() - 0.5) * spread;
      const startZ = anchor.z + (rng() - 0.5) * spread;
      const covered = isFlowFestCorridorCovered(site.graph, startX, startZ);
      const state: AgentState = {
        npc,
        x: covered ? startX : anchor.x,
        z: covered ? startZ : anchor.z,
        facingAngle: rng() * Math.PI * 2,
        speed: 0,
        activity: npc.schedule[0]!.activity,
        anchorId: anchor.id,
        routeAnchorId: anchor.id,
        path: null,
        pathIndex: 0,
        routed: true,
        interruptUntilMinute: -1,
        interruptFacing: 0,
        nextInterruptCheckSeconds: rng() * 3,
        offsetX: 0,
        offsetZ: 0,
        wanderPhase: rng() * Math.PI * 2,
        rng,
      };
      this.states.push(state);
      this.frameAgents.push({
        id: npc.id,
        displayName: npc.displayName,
        avatarId: npc.avatarId,
        role: npc.role,
        x: state.x,
        y: site.groundY(state.x, state.z),
        z: state.z,
        facingAngle: state.facingAngle,
        isMoving: false,
        speedMetersPerSecond: 0,
        activity: state.activity,
        anchorId: state.anchorId,
        interrupted: false,
        atFireJam: FLOW_FEST_FIRE_JAM_ACTIVITIES.has(state.activity),
        routed: true,
      });
    }

    this.frameValue = {
      minuteOfDay: FLOW_FEST_DAY_PHASE_WINDOWS["thursday-afternoon"].startMinute,
      dayPhase: "thursday-afternoon",
      agents: this.frameAgents,
      fireJamAttendeeCount: 0,
      fireJamPerformerCount: 0,
      travellingCount: 0,
      interruptedCount: 0,
      unroutableCount: 0,
    };
  }

  get frame(): FlowFestPopulationFrame {
    return this.frameValue;
  }

  /**
   * Run the world forward without rendering, so a phase the player joins
   * mid-stream starts where it would honestly be. This is simulated time, not a
   * pose: everyone walks the same corridors, just faster than the frame rate.
   * Interrupts and separation are skipped — both are cosmetic, and skipping
   * them leaves the seeded stream untouched so determinism holds.
   */
  warmStart(
    moment: FlowFestMoment,
    fromElapsedSeconds: number,
    toElapsedSeconds: number,
    stepSeconds = 0.25
  ): void {
    const span = Math.max(0, toElapsedSeconds - fromElapsedSeconds);
    const steps = Math.min(4000, Math.ceil(span / stepSeconds));
    for (let step = 0; step < steps; step += 1) {
      const clock = flowFestSimClock(
        moment,
        fromElapsedSeconds + step * stepSeconds
      );
      for (const state of this.states) {
        this.applySchedule(state, clock);
        this.integrate(state, stepSeconds, clock);
      }
    }
    this.elapsedSeconds += span;
  }

  /**
   * Advance the world. `deltaSeconds` is real time; the clock carries sim time.
   * Deterministic: the same clock and delta sequence always reproduces the same
   * frame, whatever the wall clock says.
   */
  advance(
    clock: FlowFestSimClock,
    deltaSeconds: number
  ): FlowFestPopulationFrame {
    const delta = Math.max(0, Math.min(0.25, deltaSeconds));
    this.elapsedSeconds += delta;
    this.separationAccumulator += delta;
    const runSeparation =
      this.separationAccumulator >= SEPARATION_INTERVAL_SECONDS;
    if (runSeparation) {
      this.separationAccumulator %= SEPARATION_INTERVAL_SECONDS;
    }

    for (const state of this.states) {
      this.applySchedule(state, clock);
      this.considerInterrupt(state, clock);
      this.integrate(state, delta, clock);
    }

    if (runSeparation) this.applySeparation();

    let fireJamAttendeeCount = 0;
    let fireJamPerformerCount = 0;
    let travellingCount = 0;
    let interruptedCount = 0;
    let unroutableCount = 0;

    for (let index = 0; index < this.states.length; index += 1) {
      const state = this.states[index]!;
      const agent = this.frameAgents[index]!;
      const x = state.x + state.offsetX;
      const z = state.z + state.offsetZ;
      agent.x = x;
      agent.z = z;
      agent.y = this.site.groundY(x, z);
      agent.facingAngle = state.facingAngle;
      agent.isMoving = state.speed > 0.08;
      agent.speedMetersPerSecond = state.speed;
      // While a route is live the person is visibly walking there, whatever the
      // plan calls the destination.
      agent.activity = state.path ? "travel" : state.activity;
      agent.anchorId = state.anchorId;
      agent.interrupted = state.interruptUntilMinute > clock.minuteOfDay;
      // The fire circle only takes over once they have actually arrived, so the
      // walk to the fire stays visible instead of vanishing at the schedule
      // boundary.
      agent.atFireJam =
        state.path === null && FLOW_FEST_FIRE_JAM_ACTIVITIES.has(state.activity);
      agent.routed = state.routed;

      if (agent.atFireJam) {
        fireJamAttendeeCount += 1;
        if (state.activity === "join-fire") fireJamPerformerCount += 1;
      }
      if (agent.isMoving) travellingCount += 1;
      if (agent.interrupted) interruptedCount += 1;
      if (!state.routed) unroutableCount += 1;
    }

    this.frameValue.minuteOfDay = clock.minuteOfDay;
    this.frameValue.dayPhase = clock.dayPhase;
    this.frameValue.fireJamAttendeeCount = fireJamAttendeeCount;
    this.frameValue.fireJamPerformerCount = fireJamPerformerCount;
    this.frameValue.travellingCount = travellingCount;
    this.frameValue.interruptedCount = interruptedCount;
    this.frameValue.unroutableCount = unroutableCount;
    return this.frameValue;
  }

  private applySchedule(state: AgentState, clock: FlowFestSimClock): void {
    const block = resolveFlowFestScheduleBlock(
      state.npc.schedule,
      clock.minuteOfDay
    );
    state.activity = block.activity;
    if (state.anchorId === block.anchorId) return;
    state.anchorId = block.anchorId;
    this.routeTo(state, block.anchorId);
  }

  private routeTo(state: AgentState, anchorId: string): void {
    const anchor = requireAnchor(this.site, anchorId);
    state.routeAnchorId = anchorId;
    if (!anchor.routable) {
      // No registered corridor reaches it. Stand where the plan last put them
      // rather than walking through canopy to keep a promise the site cannot
      // make.
      state.path = null;
      state.pathIndex = 0;
      state.routed = false;
      return;
    }
    const node = flowFestCorridorAnchorNode(this.site.graph, anchorId);
    const path = routeFlowFestCorridor(this.site.graph, state.x, state.z, node);
    state.path = path;
    state.pathIndex = 1;
    state.routed = path !== null;
  }

  private considerInterrupt(
    state: AgentState,
    clock: FlowFestSimClock
  ): void {
    if (state.interruptUntilMinute > clock.minuteOfDay) return;
    if (this.elapsedSeconds < state.nextInterruptCheckSeconds) return;
    state.nextInterruptCheckSeconds =
      this.elapsedSeconds + 1 + state.rng() * 2;

    // Utility scoring over a handful of candidates. Continuing the plan is the
    // baseline; the alternatives have to beat it.
    const continueScore = 0.55 + (state.path ? 0.2 : 0);

    let watchScore = 0;
    let watchFacing = state.facingAngle;
    const fire = requireAnchor(this.site, this.site.fireAnchorId);
    const fireDistance = Math.hypot(state.x - fire.x, state.z - fire.z);
    if (fireDistance < 34 && clock.dayPhase !== "thursday-afternoon") {
      watchScore =
        0.35 +
        state.npc.sociability * 0.5 +
        Math.max(0, 1 - fireDistance / 34) * 0.4;
      watchFacing = Math.atan2(fire.x - state.x, fire.z - state.z);
    }

    let chatScore = 0;
    let chatFacing = state.facingAngle;
    let nearest = Number.POSITIVE_INFINITY;
    for (const other of this.states) {
      if (other === state) continue;
      const distance = Math.hypot(other.x - state.x, other.z - state.z);
      if (distance >= nearest || distance > 5) continue;
      nearest = distance;
      chatFacing = Math.atan2(other.x - state.x, other.z - state.z);
    }
    if (Number.isFinite(nearest)) {
      chatScore = 0.3 + state.npc.sociability * 0.65 - nearest * 0.06;
    }

    const roll = state.rng();
    const best = Math.max(continueScore, watchScore * roll, chatScore * roll);
    if (best === continueScore) return;

    const holdMinutes = 0.4 + state.rng() * 1.6;
    state.interruptUntilMinute = clock.minuteOfDay + holdMinutes;
    state.interruptFacing = best === watchScore * roll ? watchFacing : chatFacing;
  }

  private integrate(
    state: AgentState,
    delta: number,
    clock: FlowFestSimClock
  ): void {
    if (state.interruptUntilMinute > clock.minuteOfDay) {
      state.speed = 0;
      state.facingAngle +=
        shortestAngleTo(state.facingAngle, state.interruptFacing) *
        Math.min(1, delta * 3.4);
      this.applyIdleDrift(state, delta, 0.05);
      return;
    }

    const path = state.path;
    if (!path || state.pathIndex >= path.length) {
      state.speed = 0;
      this.applyAmbient(state, delta);
      return;
    }

    let remaining = state.npc.walkSpeedMetersPerSecond * delta;
    const finalStep = path[path.length - 1]!;
    const distanceToEnd = Math.hypot(
      finalStep.x - state.x,
      finalStep.z - state.z
    );
    if (distanceToEnd < ARRIVAL_EASE_METERS) {
      remaining *= Math.max(0.25, distanceToEnd / ARRIVAL_EASE_METERS);
    }
    state.speed =
      delta > 0 ? remaining / delta : state.npc.walkSpeedMetersPerSecond;

    while (remaining > 0 && state.pathIndex < path.length) {
      const target = path[state.pathIndex]!;
      const dx = target.x - state.x;
      const dz = target.z - state.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= Math.max(remaining, 0.02)) {
        state.x = target.x;
        state.z = target.z;
        remaining -= distance;
        state.pathIndex += 1;
        continue;
      }
      const step = remaining / distance;
      state.x += dx * step;
      state.z += dz * step;
      state.facingAngle +=
        shortestAngleTo(state.facingAngle, Math.atan2(dx, dz)) *
        Math.min(1, delta * 5.5);
      remaining = 0;
    }

    if (state.pathIndex >= path.length) {
      state.path = null;
      state.speed = 0;
      if (distanceToEnd < ARRIVAL_SNAP_METERS) {
        state.offsetX = 0;
        state.offsetZ = 0;
      }
    }
  }

  private applyAmbient(state: AgentState, delta: number): void {
    const anchor = this.site.anchors.find(
      (candidate) => candidate.id === state.routeAnchorId
    );
    state.wanderPhase += delta * 0.35;
    if (!anchor) {
      this.applyIdleDrift(state, delta, 0.05);
      return;
    }
    const clearing =
      anchor.clearingIndex >= 0
        ? this.site.graph.clearings[anchor.clearingIndex]
        : undefined;
    // Open-field drift only inside envelopes the survey measured as open. Every
    // other zone gets a stand-and-shift, which is honest about what is under
    // the canopy there.
    if (!clearing || clearing.wanderPolicy !== "measured-open") {
      this.applyIdleDrift(state, delta, 0.05);
      return;
    }
    const radius = 2.6;
    const targetX =
      anchor.x + Math.cos(state.wanderPhase) * radius * 0.9;
    const targetZ =
      anchor.z + Math.sin(state.wanderPhase * 0.73) * radius;
    const dx = targetX - state.x;
    const dz = targetZ - state.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.05) return;
    const step = Math.min(distance, 0.42 * delta);
    let nextX = state.x + (dx / distance) * step;
    let nextZ = state.z + (dz / distance) * step;
    clampInsideFlowFestClearing(clearing, nextX, nextZ, this.scratch);
    nextX = this.scratch.x;
    nextZ = this.scratch.z;
    state.x = nextX;
    state.z = nextZ;
    state.speed = delta > 0 ? step / delta : 0;
    state.facingAngle +=
      shortestAngleTo(state.facingAngle, Math.atan2(dx, dz)) *
      Math.min(1, delta * 2.4);
  }

  private applyIdleDrift(
    state: AgentState,
    delta: number,
    amplitude: number
  ): void {
    state.wanderPhase += delta * 0.9;
    const sway = Math.sin(state.wanderPhase) * amplitude;
    state.offsetX = Math.cos(state.facingAngle) * sway;
    state.offsetZ = Math.sin(state.facingAngle) * sway;
  }

  /**
   * Small lateral offsets so people do not stand inside each other. Validated
   * against corridor coverage at 10 Hz; an offset that would leave the corridor
   * is discarded rather than trimmed, so the guarantee holds exactly.
   */
  private applySeparation(): void {
    for (let index = 0; index < this.states.length; index += 1) {
      const state = this.states[index]!;
      let pushX = 0;
      let pushZ = 0;
      for (let other = 0; other < this.states.length; other += 1) {
        if (other === index) continue;
        const peer = this.states[other]!;
        const dx = state.x - peer.x;
        const dz = state.z - peer.z;
        const squared = dx * dx + dz * dz;
        if (squared > SEPARATION_RADIUS_METERS * SEPARATION_RADIUS_METERS)
          continue;
        const distance = Math.max(0.05, Math.sqrt(squared));
        const strength = (SEPARATION_RADIUS_METERS - distance) * 0.5;
        pushX += (dx / distance) * strength;
        pushZ += (dz / distance) * strength;
      }

      const allowance = this.currentAllowance(state);
      const magnitude = Math.hypot(pushX, pushZ);
      if (magnitude > allowance && magnitude > 0) {
        pushX = (pushX / magnitude) * allowance;
        pushZ = (pushZ / magnitude) * allowance;
      }
      const candidateX = state.x + pushX;
      const candidateZ = state.z + pushZ;
      if (
        isFlowFestCorridorCovered(this.site.graph, candidateX, candidateZ)
      ) {
        state.offsetX = pushX;
        state.offsetZ = pushZ;
      } else {
        state.offsetX = 0;
        state.offsetZ = 0;
      }
    }
  }

  private currentAllowance(state: AgentState): number {
    const path = state.path;
    if (path && state.pathIndex < path.length) {
      return path[state.pathIndex]!.allowanceMeters;
    }
    const anchor = this.site.anchors.find(
      (candidate) => candidate.id === state.routeAnchorId
    );
    return anchor && anchor.clearingIndex >= 0 ? 0.9 : 0.2;
  }
}

/**
 * How many people the population layer is handing to the fire circle. The
 * existing sampler stays the owner of what happens inside the circle; this is
 * only the door count.
 */
export function flowFestFireJamAttendance(frame: FlowFestPopulationFrame): {
  spectators: number;
  performers: number;
} {
  return {
    spectators: Math.max(
      0,
      frame.fireJamAttendeeCount - frame.fireJamPerformerCount
    ),
    performers: frame.fireJamPerformerCount,
  };
}

/**
 * Compose the authored fire-circle layout down to the attendance the
 * population layer actually delivered. Pure: the base layout is never mutated,
 * and the fire rotation is re-indexed so its own audit still holds.
 */
export function composeFlowFestFireJamLayout(
  base: FlowFestFestivalCommunityLayout,
  attendance: { spectators: number; performers: number }
): FlowFestFestivalCommunityLayout {
  const spectators = base.people.filter(
    (person) => person.role === "spectator"
  );
  const fireRotation = base.people.filter(
    (person) => person.behavior === "fire-rotation"
  );
  const continuous = base.people.filter(
    (person) => person.role !== "spectator" && person.behavior !== "fire-rotation"
  );

  const keptSpectators = spectators.slice(
    0,
    Math.max(0, Math.min(spectators.length, Math.round(attendance.spectators)))
  );
  // The circle needs enough dancers for a rotation to mean anything; below two
  // it reads as one person standing in a field, so the circle closes instead.
  const performerTarget = Math.min(
    fireRotation.length,
    Math.max(0, Math.round(attendance.performers))
  );
  const keptFire: FlowFestFestivalPersonPlacement[] =
    performerTarget >= 2
      ? fireRotation.slice(0, performerTarget).map((person, index) => ({
          ...person,
          rotationOrdinal: index,
        }))
      : [];
  const keptContinuous = keptFire.length > 0 ? continuous : [];

  const activeFire =
    keptFire.length === 0
      ? 0
      : Math.max(
          1,
          Math.min(
            keptFire.length - 1,
            base.activeFirePerformerCount
          )
        );

  const people = [...keptSpectators, ...keptFire, ...keptContinuous];
  return {
    ...base,
    people,
    spectatorCount: keptSpectators.length,
    performerCount: keptFire.length + keptContinuous.length,
    firePerformerCount: keptFire.length,
    activeFirePerformerCount: activeFire,
  };
}

export interface FlowFestPopulationRenderBudget {
  /** Full-rate animated avatars mounted at once, outside the fire circle. */
  maxVisible: number;
  /** Inside this radius an avatar keeps foot planting. */
  nearMeters: number;
  /** Beyond this radius an avatar is not mounted at all. */
  cullMeters: number;
}

/**
 * The fire circle already mounts up to 24 avatars at night, so the walking
 * layer gives ground back once the festival is lit.
 */
export function flowFestPopulationRenderBudget(
  dayPhase: FlowFestDayPhase
): FlowFestPopulationRenderBudget {
  switch (dayPhase) {
    case "thursday-afternoon":
      return { maxVisible: 16, nearMeters: 25, cullMeters: 110 };
    case "dusk-migration":
      return { maxVisible: 14, nearMeters: 25, cullMeters: 110 };
    case "night-festival":
      return { maxVisible: 8, nearMeters: 22, cullMeters: 70 };
    case "late-drift-home":
      return { maxVisible: 10, nearMeters: 22, cullMeters: 90 };
  }
}
