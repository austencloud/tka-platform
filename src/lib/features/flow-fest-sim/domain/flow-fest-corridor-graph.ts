/**
 * Corridor routing for the Flow Fest population.
 *
 * Reality Lock: every metre an NPC walks belongs either to a registered
 * person-route leg from the Gate 2 runtime contract or to a registered zone
 * envelope. This module owns that guarantee. It never invents a centerline, and
 * it never lets a route leave the union of leg tubes and zone ellipses — the
 * canopy screen is carved for exactly those corridors, so anything else walks
 * through trees.
 *
 * Coordinates arrive here already in the terrain's registered metre frame. The
 * graph copies numbers, never re-derives them, so `createFlowFestCampPlan` and
 * the runtime contract remain the only coordinate owners.
 */

export interface FlowFestCorridorPoint {
  x: number;
  z: number;
}

/** One registered person-route leg, used as a walkable tube of its own width. */
export interface FlowFestCorridorLeg {
  id: string;
  widthMeters: number;
  points: ReadonlyArray<FlowFestCorridorPoint>;
}

/**
 * `measured-open` envelopes are the ones the Gate 1 report measured as open
 * ground (Middle Earth 99.3 percent, the car-camping open middle 100.0
 * percent). `authored-ambient` envelopes are registered zones that are only
 * partly open — the lower gate circle is 69.7 percent and the lower-tent
 * perimeter circle is 82.6 percent. Standing an NPC inside one of those is
 * authored festival fiction placed in a registered zone, not a claim that the
 * whole circle is clear ground.
 */
export type FlowFestClearingWanderPolicy = "measured-open" | "authored-ambient";

export interface FlowFestCorridorClearing {
  id: string;
  center: FlowFestCorridorPoint;
  radiusXMeters: number;
  radiusZMeters: number;
  measuredOpenFraction: number;
  wanderPolicy: FlowFestClearingWanderPolicy;
}

/** A named destination the population schedules against. */
export interface FlowFestCorridorAnchorInput {
  id: string;
  x: number;
  z: number;
}

export interface FlowFestCorridorNode {
  index: number;
  x: number;
  z: number;
  /** Registered legs whose vertices merged into this node. */
  legIds: string[];
  /** Clearing envelope that owns this node, when it sits inside one. */
  clearingIndex: number;
  anchorId: string | null;
}

export interface FlowFestCorridorEdge {
  from: number;
  to: number;
  lengthMeters: number;
  /** Exactly one of these is set: the edge is a leg span or a clearing chord. */
  legId: string | null;
  clearingIndex: number;
}

export interface FlowFestCorridorGraph {
  legs: FlowFestCorridorLeg[];
  clearings: FlowFestCorridorClearing[];
  nodes: FlowFestCorridorNode[];
  edges: FlowFestCorridorEdge[];
  /** Edge indices leaving each node. */
  adjacency: number[][];
  anchorNodeByeId: Map<string, number>;
  /** Reused Dijkstra scratch so routing allocates only its result path. */
  scratch: {
    distance: Float64Array;
    previousNode: Int32Array;
    previousEdge: Int32Array;
    settled: Uint8Array;
  };
}

/**
 * Lateral room an NPC may use for separation steering without leaving the
 * registered corridor. The person corridors reserve 0.8 m, so a quarter metre
 * each side is what honestly exists.
 */
export const FLOW_FEST_CORRIDOR_STEER_MARGIN_METERS = 0.15;

/** Chord endpoints sit at least this far inside a clearing before we use them. */
const CLEARING_CHORD_INSET_METERS = 1.2;

function distance(
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  return Math.hypot(ax - bx, az - bz);
}

export function flowFestClearingNormalizedRadius(
  clearing: FlowFestCorridorClearing,
  x: number,
  z: number
): number {
  const nx = (x - clearing.center.x) / clearing.radiusXMeters;
  const nz = (z - clearing.center.z) / clearing.radiusZMeters;
  return Math.hypot(nx, nz);
}

export function isInsideFlowFestClearing(
  clearing: FlowFestCorridorClearing,
  x: number,
  z: number,
  insetMeters = 0
): boolean {
  const shrinkX = Math.max(0.5, clearing.radiusXMeters - insetMeters);
  const shrinkZ = Math.max(0.5, clearing.radiusZMeters - insetMeters);
  const nx = (x - clearing.center.x) / shrinkX;
  const nz = (z - clearing.center.z) / shrinkZ;
  return nx * nx + nz * nz <= 1;
}

/**
 * Pull a point back inside its clearing. The ellipse is convex, so scaling the
 * offset from the centre is exact rather than approximate.
 */
export function clampInsideFlowFestClearing(
  clearing: FlowFestCorridorClearing,
  x: number,
  z: number,
  out: { x: number; z: number },
  insetMeters = 0.35
): void {
  const shrinkX = Math.max(0.5, clearing.radiusXMeters - insetMeters);
  const shrinkZ = Math.max(0.5, clearing.radiusZMeters - insetMeters);
  const nx = (x - clearing.center.x) / shrinkX;
  const nz = (z - clearing.center.z) / shrinkZ;
  const radius = Math.hypot(nx, nz);
  if (radius <= 1) {
    out.x = x;
    out.z = z;
    return;
  }
  out.x = clearing.center.x + (nx / radius) * shrinkX;
  out.z = clearing.center.z + (nz / radius) * shrinkZ;
}

export function distanceToFlowFestSegment(
  x: number,
  z: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number
): number {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return distance(x, z, startX, startZ);
  const t = Math.max(
    0,
    Math.min(1, ((x - startX) * dx + (z - startZ) * dz) / lengthSquared)
  );
  return distance(x, z, startX + dx * t, startZ + dz * t);
}

/**
 * The single truth for "may a person stand here". Corridor tubes plus
 * registered zone envelopes; nothing else.
 */
export function isFlowFestCorridorCovered(
  graph: FlowFestCorridorGraph,
  x: number,
  z: number,
  marginMeters = 0
): boolean {
  for (const clearing of graph.clearings) {
    if (flowFestClearingNormalizedRadius(clearing, x, z) <= 1) return true;
  }
  for (const leg of graph.legs) {
    const halfWidth = leg.widthMeters / 2 + marginMeters;
    for (let index = 1; index < leg.points.length; index += 1) {
      const start = leg.points[index - 1]!;
      const end = leg.points[index]!;
      if (
        distanceToFlowFestSegment(x, z, start.x, start.z, end.x, end.z) <=
        halfWidth
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Sampled coverage of a straight hop, used when adding chords and snapping. */
export function isFlowFestHopCovered(
  graph: FlowFestCorridorGraph,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  sampleSpacingMeters = 0.5
): boolean {
  const length = distance(fromX, fromZ, toX, toZ);
  const steps = Math.max(1, Math.ceil(length / sampleSpacingMeters));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    if (
      !isFlowFestCorridorCovered(
        graph,
        fromX + (toX - fromX) * t,
        fromZ + (toZ - fromZ) * t
      )
    ) {
      return false;
    }
  }
  return true;
}

function clearingIndexContaining(
  clearings: FlowFestCorridorClearing[],
  x: number,
  z: number,
  insetMeters = 0
): number {
  let best = -1;
  let bestRadius = Number.POSITIVE_INFINITY;
  for (let index = 0; index < clearings.length; index += 1) {
    const clearing = clearings[index]!;
    if (!isInsideFlowFestClearing(clearing, x, z, insetMeters)) continue;
    const radius = flowFestClearingNormalizedRadius(clearing, x, z);
    if (radius < bestRadius) {
      bestRadius = radius;
      best = index;
    }
  }
  return best;
}

export interface FlowFestCorridorGraphInput {
  legs: FlowFestCorridorLeg[];
  clearings: FlowFestCorridorClearing[];
  anchors?: FlowFestCorridorAnchorInput[];
  mergeToleranceMeters?: number;
}

export function buildFlowFestCorridorGraph(
  input: FlowFestCorridorGraphInput
): FlowFestCorridorGraph {
  const mergeTolerance = input.mergeToleranceMeters ?? 0.5;
  const nodes: FlowFestCorridorNode[] = [];
  const edges: FlowFestCorridorEdge[] = [];
  const anchorNodeByeId = new Map<string, number>();

  const findOrCreateNode = (x: number, z: number): FlowFestCorridorNode => {
    for (const node of nodes) {
      if (distance(node.x, node.z, x, z) <= mergeTolerance) return node;
    }
    const node: FlowFestCorridorNode = {
      index: nodes.length,
      x,
      z,
      legIds: [],
      clearingIndex: clearingIndexContaining(input.clearings, x, z),
      anchorId: null,
    };
    nodes.push(node);
    return node;
  };

  const addEdge = (
    from: number,
    to: number,
    legId: string | null,
    clearingIndex: number
  ): void => {
    if (from === to) return;
    const length = distance(
      nodes[from]!.x,
      nodes[from]!.z,
      nodes[to]!.x,
      nodes[to]!.z
    );
    edges.push({ from, to, lengthMeters: length, legId, clearingIndex });
    edges.push({
      from: to,
      to: from,
      lengthMeters: length,
      legId,
      clearingIndex,
    });
  };

  for (const leg of input.legs) {
    let previous: FlowFestCorridorNode | null = null;
    for (const point of leg.points) {
      const node = findOrCreateNode(point.x, point.z);
      if (!node.legIds.includes(leg.id)) node.legIds.push(leg.id);
      if (previous) addEdge(previous.index, node.index, leg.id, -1);
      previous = node;
    }
  }

  for (const anchor of input.anchors ?? []) {
    const node = findOrCreateNode(anchor.x, anchor.z);
    node.anchorId ??= anchor.id;
    anchorNodeByeId.set(anchor.id, node.index);
  }

  // Clearing chords. Both endpoints must sit comfortably inside the same
  // envelope, so the straight line between them cannot leave it.
  for (
    let clearingIndex = 0;
    clearingIndex < input.clearings.length;
    clearingIndex += 1
  ) {
    const clearing = input.clearings[clearingIndex]!;
    const inside = nodes.filter((node) =>
      isInsideFlowFestClearing(
        clearing,
        node.x,
        node.z,
        CLEARING_CHORD_INSET_METERS
      )
    );
    for (let first = 0; first < inside.length; first += 1) {
      for (let second = first + 1; second < inside.length; second += 1) {
        addEdge(
          inside[first]!.index,
          inside[second]!.index,
          null,
          clearingIndex
        );
      }
    }
  }

  const adjacency: number[][] = nodes.map(() => []);
  edges.forEach((edge, index) => {
    adjacency[edge.from]!.push(index);
  });

  return {
    legs: input.legs,
    clearings: input.clearings,
    nodes,
    edges,
    adjacency,
    anchorNodeByeId,
    scratch: {
      distance: new Float64Array(nodes.length),
      previousNode: new Int32Array(nodes.length),
      previousEdge: new Int32Array(nodes.length),
      settled: new Uint8Array(nodes.length),
    },
  };
}

export function flowFestCorridorAnchorNode(
  graph: FlowFestCorridorGraph,
  anchorId: string
): number {
  const node = graph.anchorNodeByeId.get(anchorId);
  if (node === undefined) {
    throw new Error(`Flow Fest corridor anchor is not registered: ${anchorId}`);
  }
  return node;
}

/**
 * Nearest node reachable by a covered straight hop. Falls back to the plain
 * nearest node only when nothing is reachable, so a caller can detect the
 * isolated case instead of teleporting through canopy.
 */
export function snapToFlowFestCorridorNode(
  graph: FlowFestCorridorGraph,
  x: number,
  z: number
): { node: number; covered: boolean } {
  let nearest = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  let coveredNode = -1;
  let coveredDistance = Number.POSITIVE_INFINITY;
  for (const node of graph.nodes) {
    const candidate = distance(node.x, node.z, x, z);
    if (candidate < nearestDistance) {
      nearestDistance = candidate;
      nearest = node.index;
    }
    if (candidate >= coveredDistance) continue;
    if (isFlowFestHopCovered(graph, x, z, node.x, node.z)) {
      coveredDistance = candidate;
      coveredNode = node.index;
    }
  }
  return coveredNode >= 0
    ? { node: coveredNode, covered: true }
    : { node: nearest, covered: false };
}

/** Dijkstra over the corridor graph. Returns node indices, start included. */
export function routeFlowFestCorridorNodes(
  graph: FlowFestCorridorGraph,
  fromNode: number,
  toNode: number
): number[] | null {
  const { distance: cost, previousNode, previousEdge, settled } = graph.scratch;
  cost.fill(Number.POSITIVE_INFINITY);
  previousNode.fill(-1);
  previousEdge.fill(-1);
  settled.fill(0);
  cost[fromNode] = 0;

  for (;;) {
    let current = -1;
    let currentCost = Number.POSITIVE_INFINITY;
    for (let index = 0; index < graph.nodes.length; index += 1) {
      if (settled[index] === 1) continue;
      const candidate = cost[index]!;
      if (candidate < currentCost) {
        currentCost = candidate;
        current = index;
      }
    }
    if (current < 0) break;
    if (current === toNode) break;
    settled[current] = 1;
    for (const edgeIndex of graph.adjacency[current]!) {
      const edge = graph.edges[edgeIndex]!;
      const next = currentCost + edge.lengthMeters;
      if (next >= cost[edge.to]!) continue;
      cost[edge.to] = next;
      previousNode[edge.to] = current;
      previousEdge[edge.to] = edgeIndex;
    }
  }

  if (!Number.isFinite(cost[toNode]!)) return null;
  const path: number[] = [];
  let cursor = toNode;
  while (cursor >= 0) {
    path.push(cursor);
    if (cursor === fromNode) break;
    cursor = previousNode[cursor]!;
  }
  if (path[path.length - 1] !== fromNode) return null;
  path.reverse();
  return path;
}

export interface FlowFestCorridorRouteStep {
  x: number;
  z: number;
  /** Lateral room for separation steering on the span that ends here. */
  allowanceMeters: number;
  /** Clearing that owns the span, or -1 when the span is a leg. */
  clearingIndex: number;
}

/**
 * A followable polyline from an arbitrary covered position to a graph node.
 * Every span is either a registered leg span or a chord inside one registered
 * clearing, so the follower cannot wander off the corridor network.
 */
export function routeFlowFestCorridor(
  graph: FlowFestCorridorGraph,
  fromX: number,
  fromZ: number,
  toNode: number
): FlowFestCorridorRouteStep[] | null {
  const snapped = snapToFlowFestCorridorNode(graph, fromX, fromZ);
  if (!snapped.covered) return null;
  const nodePath = routeFlowFestCorridorNodes(graph, snapped.node, toNode);
  if (!nodePath) return null;

  const steps: FlowFestCorridorRouteStep[] = [
    {
      x: fromX,
      z: fromZ,
      allowanceMeters: 0,
      clearingIndex: clearingIndexContaining(graph.clearings, fromX, fromZ),
    },
  ];
  for (let index = 0; index < nodePath.length; index += 1) {
    const node = graph.nodes[nodePath[index]!]!;
    const previousIndex = index === 0 ? -1 : nodePath[index - 1]!;
    let allowance = FLOW_FEST_CORRIDOR_STEER_MARGIN_METERS;
    let clearingIndex = node.clearingIndex;
    if (previousIndex >= 0) {
      const edge = findEdge(graph, previousIndex, nodePath[index]!);
      if (edge) {
        clearingIndex = edge.clearingIndex;
        allowance =
          edge.clearingIndex >= 0
            ? 0.9
            : Math.max(
                0.15,
                legWidth(graph, edge.legId) / 2 -
                  FLOW_FEST_CORRIDOR_STEER_MARGIN_METERS
              );
      }
    }
    const last = steps[steps.length - 1]!;
    if (distance(last.x, last.z, node.x, node.z) < 0.05) {
      last.allowanceMeters = allowance;
      last.clearingIndex = clearingIndex;
      continue;
    }
    steps.push({ x: node.x, z: node.z, allowanceMeters: allowance, clearingIndex });
  }
  return steps.length > 1 ? steps : null;
}

function legWidth(graph: FlowFestCorridorGraph, legId: string | null): number {
  if (!legId) return 0.8;
  return graph.legs.find((leg) => leg.id === legId)?.widthMeters ?? 0.8;
}

function findEdge(
  graph: FlowFestCorridorGraph,
  from: number,
  to: number
): FlowFestCorridorEdge | null {
  for (const edgeIndex of graph.adjacency[from]!) {
    const edge = graph.edges[edgeIndex]!;
    if (edge.to === to) return edge;
  }
  return null;
}

export function flowFestCorridorPathLength(
  steps: ReadonlyArray<FlowFestCorridorRouteStep>
): number {
  let total = 0;
  for (let index = 1; index < steps.length; index += 1) {
    total += distance(
      steps[index - 1]!.x,
      steps[index - 1]!.z,
      steps[index]!.x,
      steps[index]!.z
    );
  }
  return total;
}

/** Every registered leg id a route touches. Used by the corridor audit. */
export function flowFestCorridorRouteLegIds(
  graph: FlowFestCorridorGraph,
  steps: ReadonlyArray<FlowFestCorridorRouteStep>
): string[] {
  const ids = new Set<string>();
  for (let index = 1; index < steps.length; index += 1) {
    const step = steps[index]!;
    if (step.clearingIndex >= 0) continue;
    const previous = steps[index - 1]!;
    const midX = (previous.x + step.x) / 2;
    const midZ = (previous.z + step.z) / 2;
    for (const leg of graph.legs) {
      for (let point = 1; point < leg.points.length; point += 1) {
        const start = leg.points[point - 1]!;
        const end = leg.points[point]!;
        if (
          distanceToFlowFestSegment(
            midX,
            midZ,
            start.x,
            start.z,
            end.x,
            end.z
          ) <=
          leg.widthMeters / 2
        ) {
          ids.add(leg.id);
        }
      }
    }
  }
  return [...ids];
}
