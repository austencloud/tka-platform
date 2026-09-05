import type { FlowFestBranchId } from "../../../../routes/test/flow-fest-graybox/flow-fest-runtime-contract";
import { FLOW_FEST_MASTER_SEED } from "../domain/flow-fest-simulation-contract";
import type { FlowFestFireJamState } from "../domain/flow-fest-fire-jam";
import {
  createFlowFestDefaultLoadout,
  flowFestDepartureProfile,
  restoreFlowFestLoadout,
  type FlowFestLoadout,
} from "../domain/flow-fest-loadout";

/**
 * Version 3 puts the loadout screen and the drive in front of the gate.
 * Version 2 sessions started at the gate on foot with no car and no
 * departure; they cannot be upgraded honestly, so they restart at the loadout.
 */
export const FLOW_FEST_SESSION_VERSION = 3 as const;

export type FlowFestMoment = "afternoon" | "golden-hour" | "night" | "dawn";

export type FlowFestProgressPhase =
  | "loadout"
  | "drive-in"
  | "gate-check-in"
  | "choose-camp"
  | "camp-arrival"
  | "vehicle-settle"
  | "walk-home"
  | "make-camp"
  | "walk-to-festival"
  | "festival-night"
  | "night-free-roam"
  | "night-return"
  | "morning";

export type FlowFestProgressAction =
  | { type: "depart"; loadout: FlowFestLoadout }
  | { type: "arrive-at-gate" }
  | { type: "drain-energy"; percent: number }
  | { type: "check-in" }
  | { type: "choose-camp"; branch: FlowFestBranchId }
  | { type: "arrive-at-camp" }
  | { type: "settle-vehicle" }
  | { type: "reach-camp" }
  | { type: "make-camp" }
  | { type: "reach-festival" }
  | { type: "begin-night" }
  | { type: "join-fire-jam" }
  | { type: "complete-fire-jam" }
  | { type: "head-home" }
  | { type: "return-to-camp" }
  | { type: "start-over" };

export interface FlowFestProgressState {
  version: typeof FLOW_FEST_SESSION_VERSION;
  contractFingerprint: string;
  masterSeed: typeof FLOW_FEST_MASTER_SEED;
  phase: FlowFestProgressPhase;
  moment: FlowFestMoment;
  branch: FlowFestBranchId | null;
  fireJamState: FlowFestFireJamState;
  completed: FlowFestProgressPhase[];
  /** Null only on the loadout screen; fixed once the car leaves. */
  loadout: FlowFestLoadout | null;
  /** 0..100. Seeded by the departure, drained by the drive. */
  energyPercent: number;
}

export interface FlowFestObjective {
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel: string | null;
  targetZoneId: string | null;
  progressStep: number;
  progressTotal: number;
}

const PHASE_ORDER: FlowFestProgressPhase[] = [
  "loadout",
  "drive-in",
  "gate-check-in",
  "choose-camp",
  "camp-arrival",
  "vehicle-settle",
  "walk-home",
  "make-camp",
  "walk-to-festival",
  "festival-night",
  "night-free-roam",
  "night-return",
  "morning",
];

const CAMP_ZONE_BY_BRANCH: Record<FlowFestBranchId, string> = {
  "lower-tent": "lower-tent-zone",
  "upper-tent": "upper-tent-zone",
  "car-camp": "car-camp-zone",
};

const CAMP_ESTABLISHED_PHASES = new Set<FlowFestProgressPhase>([
  "walk-to-festival",
  "festival-night",
  "night-free-roam",
  "night-return",
  "morning",
]);

/** Phases that still run on the light the car arrived into. */
const ARRIVAL_LIGHT_PHASES = new Set<FlowFestProgressPhase>([
  "drive-in",
  "gate-check-in",
  "choose-camp",
  "camp-arrival",
  "vehicle-settle",
]);

const BRANCHLESS_PHASES = new Set<FlowFestProgressPhase>([
  "loadout",
  "drive-in",
  "gate-check-in",
  "choose-camp",
]);

export function isFlowFestCampEstablishedPhase(
  phase: FlowFestProgressPhase
): boolean {
  return CAMP_ESTABLISHED_PHASES.has(phase);
}

/** The phase the player spends in the driver's seat rather than on foot or the wheel. */
export function isFlowFestDrivingPhase(phase: FlowFestProgressPhase): boolean {
  return phase === "drive-in";
}

/** Phases lit by the light the car arrived into rather than the site clock. */
export function isFlowFestArrivalLightPhase(
  phase: FlowFestProgressPhase
): boolean {
  return ARRIVAL_LIGHT_PHASES.has(phase);
}

/**
 * The light a phase is expected to run under. A late departure arrives into
 * golden hour, so every phase that would otherwise be afternoon follows it.
 */
export function expectedFlowFestMoment(
  phase: FlowFestProgressPhase,
  loadout: FlowFestLoadout | null
): FlowFestMoment {
  if (phase === "loadout") return "afternoon";
  if (ARRIVAL_LIGHT_PHASES.has(phase)) {
    return loadout
      ? flowFestDepartureProfile(loadout.departure).arrivalMoment
      : "afternoon";
  }
  switch (phase) {
    case "walk-home":
    case "make-camp":
    case "walk-to-festival":
    case "festival-night":
      return "golden-hour";
    case "night-free-roam":
    case "night-return":
      return "night";
    default:
      return "dawn";
  }
}

export function createFlowFestProgress(
  contractFingerprint: string
): FlowFestProgressState {
  return {
    version: FLOW_FEST_SESSION_VERSION,
    contractFingerprint,
    masterSeed: FLOW_FEST_MASTER_SEED,
    phase: "loadout",
    moment: "afternoon",
    branch: null,
    fireJamState: "not-started",
    completed: [],
    loadout: null,
    energyPercent: 100,
  };
}

export function advanceFlowFestProgress(
  state: FlowFestProgressState,
  action: FlowFestProgressAction
): FlowFestProgressState {
  if (action.type === "start-over") {
    return createFlowFestProgress(state.contractFingerprint);
  }
  if (action.type === "drain-energy") {
    if (
      !state.loadout ||
      !Number.isFinite(action.percent) ||
      action.percent <= 0
    ) {
      return state;
    }
    const energyPercent = Math.max(0, state.energyPercent - action.percent);
    return energyPercent === state.energyPercent
      ? state
      : { ...state, energyPercent };
  }

  const transition = transitionFor(state, action);
  if (!transition) return state;

  return {
    ...state,
    ...transition,
    completed:
      transition.phase &&
      transition.phase !== state.phase &&
      !state.completed.includes(state.phase)
        ? state.completed.concat(state.phase)
        : state.completed,
  };
}

export function restoreFlowFestProgress(
  value: unknown,
  contractFingerprint: string
): FlowFestProgressState | null {
  const candidate = value as Partial<FlowFestProgressState> | null;
  if (
    candidate?.version !== FLOW_FEST_SESSION_VERSION ||
    candidate.contractFingerprint !== contractFingerprint ||
    candidate.masterSeed !== FLOW_FEST_MASTER_SEED ||
    !PHASE_ORDER.includes(candidate.phase as FlowFestProgressPhase) ||
    !["afternoon", "golden-hour", "night", "dawn"].includes(
      candidate.moment ?? ""
    ) ||
    !["not-started", "active", "completed"].includes(
      candidate.fireJamState ?? ""
    ) ||
    !Array.isArray(candidate.completed) ||
    typeof candidate.energyPercent !== "number" ||
    !Number.isFinite(candidate.energyPercent) ||
    candidate.energyPercent < 0 ||
    candidate.energyPercent > 100
  ) {
    return null;
  }
  if (
    candidate.branch !== null &&
    !["lower-tent", "upper-tent", "car-camp"].includes(candidate.branch ?? "")
  ) {
    return null;
  }
  const loadout =
    candidate.loadout === null
      ? null
      : restoreFlowFestLoadout(candidate.loadout);
  if (candidate.loadout !== null && !loadout) return null;

  const phase = candidate.phase as FlowFestProgressPhase;
  const branch = candidate.branch as FlowFestBranchId | null;
  const completed = candidate.completed as unknown[];
  if (
    !completed.every(
      (entry) =>
        typeof entry === "string" &&
        PHASE_ORDER.includes(entry as FlowFestProgressPhase)
    ) ||
    !isReachableSnapshot(
      phase,
      candidate.moment as FlowFestMoment,
      branch,
      candidate.fireJamState as FlowFestFireJamState,
      completed,
      loadout
    )
  ) {
    return null;
  }

  return {
    version: FLOW_FEST_SESSION_VERSION,
    contractFingerprint,
    masterSeed: FLOW_FEST_MASTER_SEED,
    phase,
    moment: candidate.moment as FlowFestMoment,
    branch,
    fireJamState: candidate.fireJamState as FlowFestFireJamState,
    completed: completed as FlowFestProgressPhase[],
    loadout,
    energyPercent: candidate.energyPercent,
  };
}

export function getFlowFestObjective(
  state: FlowFestProgressState
): FlowFestObjective {
  const progressStep = PHASE_ORDER.indexOf(state.phase) + 1;
  const common = { progressStep, progressTotal: PHASE_ORDER.length };
  switch (state.phase) {
    case "loadout":
      return {
        ...common,
        eyebrow: "Thursday · before you leave",
        title: "Pack the car",
        detail:
          "Who you are, what you drive, and when you leave. The budget is what it is.",
        actionLabel: null,
        targetZoneId: null,
      };
    case "drive-in":
      return {
        ...common,
        eyebrow: "W Camden College Corner Rd",
        title: "Drive to the front gate",
        detail:
          "Follow the county road east. The camp entrance is on the left at the bottom of the hill. Take it slow, pull off the road, and get out of the car.",
        actionLabel: null,
        targetZoneId: "lower-gate-zone",
      };
    case "gate-check-in":
      return {
        ...common,
        eyebrow: "Thursday · arrival",
        title: "Check in at the lower gate",
        detail:
          "You made it. Get your wristband, the lay of the land, and a place to sleep.",
        actionLabel: "Check in",
        targetZoneId: "lower-gate-zone",
      };
    case "choose-camp":
      return {
        ...common,
        eyebrow: "Camp map",
        title: "Where are you sleeping?",
        detail:
          "Tent on the lower or upper level, or keep the car with you in the open lower field.",
        actionLabel: null,
        targetZoneId: null,
      };
    case "camp-arrival":
      return {
        ...common,
        eyebrow: "Arrival route staging",
        title:
          state.branch === "car-camp"
            ? "Stage the car-camp arrival"
            : "Stage the unload leg",
        detail:
          state.branch === "upper-tent"
            ? "Follow the registered road leg to the exact upper-level unload endpoint. Vehicle travel is staged without inventing a drive time."
            : state.branch === "lower-tent"
              ? "Follow the registered lower-level leg to its unload endpoint before the parking loop."
              : "Stage arrival at the registered car-camp endpoint in the open lower field; the car stays with you.",
        actionLabel: "Stage arrival",
        targetZoneId: null,
      };
    case "vehicle-settle":
      return {
        ...common,
        eyebrow: "The parking ritual",
        title:
          state.branch === "car-camp"
            ? "Settle into the lower field"
            : "Relocate the car to the west field",
        detail:
          state.branch === "car-camp"
            ? "The car remains at the registered campsite endpoint. Continue on foot to establish camp."
            : "The registered road centerline ends in west upper parking. Travel is untimed; the walk home starts from that exact endpoint.",
        actionLabel:
          state.branch === "car-camp"
            ? "Continue on foot"
            : "Stage west parking",
        targetZoneId: null,
      };
    case "walk-home":
      return {
        ...common,
        eyebrow: "On foot now",
        title: "Walk back to your campsite",
        detail: "Follow the terrain back to the spot where you left your gear.",
        actionLabel: null,
        targetZoneId: state.branch ? CAMP_ZONE_BY_BRANCH[state.branch] : null,
      };
    case "make-camp":
      return {
        ...common,
        eyebrow: "Home for the weekend",
        title: "Make camp",
        detail:
          "Pitch the tent, put on something warm, and make this tiny patch of Earth yours.",
        actionLabel: "Make camp",
        targetZoneId: state.branch ? CAMP_ZONE_BY_BRANCH[state.branch] : null,
      };
    case "walk-to-festival":
      return {
        ...common,
        eyebrow: "Golden hour",
        title: "Find Middle Earth",
        detail:
          "Take the real footpath through the trees. The sound and lights get stronger as you get close.",
        actionLabel: null,
        targetZoneId: "middle-earth-zone",
      };
    case "festival-night":
      return {
        ...common,
        eyebrow: "Blue hour",
        title: "Stay until the lights come on",
        detail:
          "The field is gathering around an authored fire circle and light sculpture as the last daylight leaves.",
        actionLabel: "Let night fall",
        targetZoneId: "night-heart-zone",
      };
    case "night-free-roam":
      if (state.fireJamState === "not-started") {
        return {
          ...common,
          eyebrow: "The fire jam",
          title: "Park outside, then enter the circle",
          detail:
            "Leave the wheel beyond the performance floor, walk through the spectator opening, and take your place inside.",
          actionLabel: "Join the fire jam",
          targetZoneId: "night-heart-zone",
        };
      }
      if (state.fireJamState === "active") {
        return {
          ...common,
          eyebrow: "Your turn",
          title: "The circle is moving with you",
          detail:
            "Fire, LEDs, performers, and the procedural sound bed are responding to the active jam state.",
          actionLabel: "Finish your turn",
          targetZoneId: "night-heart-zone",
        };
      }
      return {
        ...common,
        eyebrow: "Night heart",
        title: "Your first fire jam is in the books",
        detail:
          "The circle stays alive behind you. Explore the LED shelter or start the walk back to camp.",
        actionLabel: "Head for camp",
        targetZoneId: "night-heart-zone",
      };
    case "night-return":
      return {
        ...common,
        eyebrow: "2:13 AM",
        title: "Find your way home",
        detail:
          "The woods are darker now. Follow the lanterns back to the campsite you chose.",
        actionLabel: null,
        targetZoneId: state.branch ? CAMP_ZONE_BY_BRANCH[state.branch] : null,
      };
    case "morning":
      return {
        ...common,
        eyebrow: "Friday · 8:06 AM",
        title: "You wake up inside the festival",
        detail:
          "Coffee somewhere nearby. Damp grass. A whole day of workshops and jams still ahead.",
        actionLabel: "Play Thursday again",
        targetZoneId: null,
      };
  }
}

function transitionFor(
  state: FlowFestProgressState,
  action: FlowFestProgressAction
): Partial<FlowFestProgressState> | null {
  if (state.phase === "loadout" && action.type === "depart") {
    const profile = flowFestDepartureProfile(action.loadout.departure);
    return {
      phase: "drive-in",
      loadout: { ...action.loadout, props: [...action.loadout.props] },
      moment: profile.arrivalMoment,
      energyPercent: profile.startingEnergyPercent,
    };
  }
  if (state.phase === "drive-in" && action.type === "arrive-at-gate") {
    return { phase: "gate-check-in" };
  }
  if (state.phase === "gate-check-in" && action.type === "check-in") {
    return { phase: "choose-camp" };
  }
  if (state.phase === "choose-camp" && action.type === "choose-camp") {
    return { phase: "camp-arrival", branch: action.branch };
  }
  if (state.phase === "camp-arrival" && action.type === "arrive-at-camp") {
    return { phase: "vehicle-settle" };
  }
  if (state.phase === "vehicle-settle" && action.type === "settle-vehicle") {
    return state.branch === "car-camp"
      ? { phase: "make-camp", moment: "golden-hour" }
      : { phase: "walk-home", moment: "golden-hour" };
  }
  if (state.phase === "walk-home" && action.type === "reach-camp") {
    return { phase: "make-camp" };
  }
  if (state.phase === "make-camp" && action.type === "make-camp") {
    return { phase: "walk-to-festival", moment: "golden-hour" };
  }
  if (state.phase === "walk-to-festival" && action.type === "reach-festival") {
    return { phase: "festival-night" };
  }
  if (state.phase === "festival-night" && action.type === "begin-night") {
    return { phase: "night-free-roam", moment: "night" };
  }
  if (
    state.phase === "night-free-roam" &&
    state.fireJamState === "not-started" &&
    action.type === "join-fire-jam"
  ) {
    return { fireJamState: "active" };
  }
  if (
    state.phase === "night-free-roam" &&
    state.fireJamState === "active" &&
    action.type === "complete-fire-jam"
  ) {
    return { fireJamState: "completed" };
  }
  if (
    state.phase === "night-free-roam" &&
    state.fireJamState === "completed" &&
    action.type === "head-home"
  ) {
    return { phase: "night-return", moment: "night" };
  }
  if (state.phase === "night-return" && action.type === "return-to-camp") {
    return { phase: "morning", moment: "dawn" };
  }
  return null;
}

function isReachableSnapshot(
  phase: FlowFestProgressPhase,
  moment: FlowFestMoment,
  branch: FlowFestBranchId | null,
  fireJamState: FlowFestFireJamState,
  completed: unknown[],
  loadout: FlowFestLoadout | null
): boolean {
  if ((phase === "loadout") !== (loadout === null)) return false;
  const branchRequired = !BRANCHLESS_PHASES.has(phase);
  if (
    (branchRequired && branch === null) ||
    (!branchRequired && branch !== null)
  ) {
    return false;
  }
  if (phase === "walk-home" && branch === "car-camp") return false;
  const beforeJam = !["night-free-roam", "night-return", "morning"].includes(
    phase
  );
  if (beforeJam && fireJamState !== "not-started") return false;
  if (
    ["night-return", "morning"].includes(phase) &&
    fireJamState !== "completed"
  ) {
    return false;
  }
  if (moment !== expectedFlowFestMoment(phase, loadout)) return false;

  const prefix: FlowFestProgressPhase[] = [
    "loadout",
    "drive-in",
    "gate-check-in",
    "choose-camp",
    "camp-arrival",
    "vehicle-settle",
  ];
  if (branch !== "car-camp") prefix.push("walk-home");
  prefix.push(
    "make-camp",
    "walk-to-festival",
    "festival-night",
    "night-free-roam",
    "night-return"
  );
  const phaseIndex = prefix.indexOf(phase);
  const expectedCompleted =
    phaseIndex >= 0 ? prefix.slice(0, phaseIndex) : prefix;
  return (
    completed.length === expectedCompleted.length &&
    completed.every((entry, index) => entry === expectedCompleted[index])
  );
}

export function createFlowFestGate4ReviewProgress(
  contractFingerprint: string
): FlowFestProgressState {
  let state = createFlowFestProgress(contractFingerprint);
  state = advanceFlowFestProgress(state, {
    type: "depart",
    loadout: createFlowFestDefaultLoadout(),
  });
  state = advanceFlowFestProgress(state, { type: "arrive-at-gate" });
  state = advanceFlowFestProgress(state, { type: "check-in" });
  state = advanceFlowFestProgress(state, {
    type: "choose-camp",
    branch: "lower-tent",
  });
  state = advanceFlowFestProgress(state, { type: "arrive-at-camp" });
  state = advanceFlowFestProgress(state, { type: "settle-vehicle" });
  state = advanceFlowFestProgress(state, { type: "reach-camp" });
  state = advanceFlowFestProgress(state, { type: "make-camp" });
  state = advanceFlowFestProgress(state, { type: "reach-festival" });
  return advanceFlowFestProgress(state, { type: "begin-night" });
}
