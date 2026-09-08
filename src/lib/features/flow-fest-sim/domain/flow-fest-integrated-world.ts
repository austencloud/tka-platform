import type {
  FlowFestBranchId,
  FlowFestRuntimeContract,
  FlowFestRuntimeZone,
} from "../../../../routes/test/flow-fest-graybox/flow-fest-runtime-contract";

export const FLOW_FEST_INTEGRATED_JOURNEY_VERSION = 1 as const;

// The live runtime history and the restore contract must agree on this bound.
// Restoration already rejects a persisted history longer than this; the live
// observer caps to the same number so a long legitimate journey gets trimmed
// (oldest entries first) instead of surviving in memory only to be discarded
// wholesale on the next load.
export const FLOW_FEST_MAX_AREA_HISTORY_ENTRIES = 64;

export type FlowFestIntegratedAreaId =
  | "lower-gate"
  | "selected-camp"
  | "west-parking"
  | "festival"
  | "transit";

export interface FlowFestIntegratedJourneyState {
  version: typeof FLOW_FEST_INTEGRATED_JOURNEY_VERSION;
  contractFingerprint: string;
  branch: FlowFestBranchId | null;
  currentArea: FlowFestIntegratedAreaId;
  areaHistory: Exclude<FlowFestIntegratedAreaId, "transit">[];
}

export interface FlowFestIntegratedTransition {
  ordinal: number;
  from: Exclude<FlowFestIntegratedAreaId, "transit">;
  to: Exclude<FlowFestIntegratedAreaId, "transit">;
}

export interface FlowFestIntegratedJourneyAudit {
  transitions: FlowFestIntegratedTransition[];
  visitedAreas: Exclude<FlowFestIntegratedAreaId, "transit">[];
  festivalEntries: number;
  festivalExits: number;
  backtrackingConfirmed: boolean;
  festivalReentryConfirmed: boolean;
  campReturnConfirmed: boolean;
  completeArrivalNightReturn: boolean;
}

const CAMP_ZONE_BY_BRANCH: Record<FlowFestBranchId, string> = {
  "lower-tent": "lower-tent-zone",
  "upper-tent": "upper-tent-zone",
  "car-camp": "car-camp-zone",
};

const LANDMARK_AREAS = new Set<FlowFestIntegratedAreaId>([
  "lower-gate",
  "selected-camp",
  "west-parking",
  "festival",
]);

export function getFlowFestCampZone(
  contract: FlowFestRuntimeContract,
  branch: FlowFestBranchId
): FlowFestRuntimeZone {
  const zoneId = CAMP_ZONE_BY_BRANCH[branch];
  const zone = contract.zones.find((candidate) => candidate.id === zoneId);
  if (!zone) throw new Error(`Flow Fest camp zone is missing: ${zoneId}`);
  return zone;
}

export function identifyFlowFestIntegratedArea(
  contract: FlowFestRuntimeContract,
  branch: FlowFestBranchId | null,
  position: { x: number; z: number }
): FlowFestIntegratedAreaId {
  if (
    isInsideZone(position, requiredZone(contract, "night-heart-zone")) ||
    isInsideZone(position, requiredZone(contract, "middle-earth-zone"))
  ) {
    return "festival";
  }
  if (branch && isInsideZone(position, getFlowFestCampZone(contract, branch))) {
    return "selected-camp";
  }
  if (isInsideZone(position, requiredZone(contract, "lower-gate-zone"))) {
    return "lower-gate";
  }
  if (
    isInsideZone(position, requiredZone(contract, "west-upper-parking-zone"))
  ) {
    return "west-parking";
  }
  return "transit";
}

export function createFlowFestIntegratedJourney(
  contractFingerprint: string,
  branch: FlowFestBranchId | null = null
): FlowFestIntegratedJourneyState {
  return {
    version: FLOW_FEST_INTEGRATED_JOURNEY_VERSION,
    contractFingerprint,
    branch,
    currentArea: "transit",
    areaHistory: [],
  };
}

export function setFlowFestIntegratedJourneyBranch(
  state: FlowFestIntegratedJourneyState,
  branch: FlowFestBranchId | null
): FlowFestIntegratedJourneyState {
  if (state.branch === branch) return state;
  if (state.branch !== null && branch !== null) {
    return createFlowFestIntegratedJourney(state.contractFingerprint, branch);
  }
  return { ...state, branch };
}

export function observeFlowFestIntegratedArea(
  state: FlowFestIntegratedJourneyState,
  area: FlowFestIntegratedAreaId
): FlowFestIntegratedJourneyState {
  if (state.currentArea === area) return state;
  if (area === "transit") return { ...state, currentArea: area };

  const lastArea = state.areaHistory.at(-1);
  return {
    ...state,
    currentArea: area,
    areaHistory:
      lastArea === area
        ? state.areaHistory
        : state.areaHistory
            .concat(area)
            .slice(-FLOW_FEST_MAX_AREA_HISTORY_ENTRIES),
  };
}

export function auditFlowFestIntegratedJourney(
  state: FlowFestIntegratedJourneyState
): FlowFestIntegratedJourneyAudit {
  const transitions = state.areaHistory.slice(1).map((to, index) => ({
    ordinal: index + 1,
    from: state.areaHistory[index]!,
    to,
  }));
  const festivalEntries =
    transitions.filter((transition) => transition.to === "festival").length +
    (state.areaHistory[0] === "festival" ? 1 : 0);
  const festivalExits = transitions.filter(
    (transition) =>
      transition.from === "festival" && transition.to !== "festival"
  ).length;
  const directedEdges = new Set<string>();
  let backtrackingConfirmed = false;
  for (const transition of transitions) {
    if (directedEdges.has(`${transition.to}>${transition.from}`)) {
      backtrackingConfirmed = true;
    }
    directedEdges.add(`${transition.from}>${transition.to}`);
  }
  const campVisits = state.areaHistory.filter(
    (area) => area === "selected-camp"
  ).length;

  return {
    transitions,
    visitedAreas: [...new Set(state.areaHistory)],
    festivalEntries,
    festivalExits,
    backtrackingConfirmed,
    festivalReentryConfirmed: festivalEntries >= 2 && festivalExits >= 1,
    campReturnConfirmed: campVisits >= 2,
    completeArrivalNightReturn:
      containsOrderedAreas(state.areaHistory, [
        "lower-gate",
        "selected-camp",
        "festival",
        "selected-camp",
      ]) && backtrackingConfirmed,
  };
}

export function restoreFlowFestIntegratedJourney(
  value: unknown,
  contractFingerprint: string
): FlowFestIntegratedJourneyState | null {
  const candidate = value as Partial<FlowFestIntegratedJourneyState> | null;
  if (
    candidate?.version !== FLOW_FEST_INTEGRATED_JOURNEY_VERSION ||
    candidate.contractFingerprint !== contractFingerprint ||
    ![null, "lower-tent", "upper-tent", "car-camp"].includes(
      candidate.branch ?? null
    ) ||
    (!LANDMARK_AREAS.has(candidate.currentArea as FlowFestIntegratedAreaId) &&
      candidate.currentArea !== "transit") ||
    !Array.isArray(candidate.areaHistory) ||
    candidate.areaHistory.length > FLOW_FEST_MAX_AREA_HISTORY_ENTRIES ||
    !candidate.areaHistory.every(
      (area) =>
        typeof area === "string" &&
        LANDMARK_AREAS.has(area as FlowFestIntegratedAreaId)
    ) ||
    // A landmark currentArea must be the most recent history entry.
    // observeFlowFestIntegratedArea() no-ops when the observed area already
    // equals currentArea, so an inconsistent pair here would silently stop
    // recording that area and corrupt every audit computed from areaHistory.
    (candidate.currentArea !== "transit" &&
      candidate.areaHistory.at(-1) !== candidate.currentArea)
  ) {
    return null;
  }
  for (let index = 1; index < candidate.areaHistory.length; index += 1) {
    if (candidate.areaHistory[index] === candidate.areaHistory[index - 1]) {
      return null;
    }
  }
  // Normalize a missing branch property to null explicitly: the contract
  // only permits branch-or-null, and a blind cast would let `undefined`
  // (from a persisted snapshot that omitted the field) through unchanged.
  return {
    ...candidate,
    branch: candidate.branch ?? null,
  } as FlowFestIntegratedJourneyState;
}

function requiredZone(
  contract: FlowFestRuntimeContract,
  zoneId: string
): FlowFestRuntimeZone {
  const zone = contract.zones.find((candidate) => candidate.id === zoneId);
  if (!zone) throw new Error(`Flow Fest registered zone is missing: ${zoneId}`);
  return zone;
}

function isInsideZone(
  position: { x: number; z: number },
  zone: FlowFestRuntimeZone
): boolean {
  const radiusX = zone.radiusMeters ?? zone.searchRadiusXMeters ?? 8;
  const radiusZ = zone.radiusMeters ?? zone.searchRadiusZMeters ?? 8;
  const x = (position.x - zone.center.x) / radiusX;
  const z = (position.z - zone.center.z) / radiusZ;
  return x * x + z * z <= 1;
}

function containsOrderedAreas(
  history: Exclude<FlowFestIntegratedAreaId, "transit">[],
  expected: Exclude<FlowFestIntegratedAreaId, "transit">[]
): boolean {
  let cursor = 0;
  for (const area of history) {
    if (area === expected[cursor]) cursor += 1;
    if (cursor === expected.length) return true;
  }
  return false;
}
