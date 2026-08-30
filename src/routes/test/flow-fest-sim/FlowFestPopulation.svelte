<script lang="ts">
  import { useTask, useThrelte } from "@threlte/core";
  import { Avatar3D } from "@austencloud/scene-3d";
  import type { FlowFestMoment } from "$lib/features/flow-fest-sim/state/flow-fest-progress";
  import {
    FLOW_FEST_PHASE_WARM_START_SECONDS,
    FlowFestPopulationSimulation,
    createFlowFestPopulation,
    flowFestDayPhaseForMoment,
    flowFestPopulationRenderBudget,
    flowFestSimClock,
    type FlowFestNpc,
    type FlowFestPopulationFrame,
    type FlowFestPopulationSite,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-population";
  import { flowFestHomeAnchorIds } from "./flow-fest-population-site";

  interface Props {
    site: FlowFestPopulationSite;
    moment: FlowFestMoment;
    /** Total identities in the world, fire circle included. */
    populationCount?: number;
    onFrame?: (frame: FlowFestPopulationFrame) => void;
    onAvatarReady?: (id: string) => void;
  }

  const props: Props = $props();
  const { camera } = useThrelte();

  /** Fixed render slots, so a walker never remounts its GLTF mid-stride. */
  const SLOT_COUNT = 18;
  const REASSIGN_INTERVAL_SECONDS = 1;

  interface RenderSlot {
    key: number;
    agentId: string | null;
    /** Index into the simulation's stable agent array. */
    agentIndex: number;
    avatarId: string;
    x: number;
    y: number;
    z: number;
    facingAngle: number;
    isMoving: boolean;
    moveSpeed: number;
    directionX: number;
    directionZ: number;
    footPlanting: boolean;
    visible: boolean;
  }

  let slots = $state<RenderSlot[]>(
    Array.from({ length: SLOT_COUNT }, (_, key) => ({
      key,
      agentId: null,
      agentIndex: -1,
      avatarId: "ch01",
      x: 0,
      y: 0,
      z: 0,
      facingAngle: 0,
      isMoving: false,
      moveSpeed: 0,
      directionX: 0,
      directionZ: 1,
      footPlanting: false,
      visible: false,
    }))
  );

  let npcs: FlowFestNpc[] = [];
  let simulation: FlowFestPopulationSimulation | null = null;
  let elapsedSeconds = 0;
  let reassignAccumulator = REASSIGN_INTERVAL_SECONDS;
  let builtSiteSeed: string | null = null;
  let warmedMoment: FlowFestMoment | null = null;

  const candidateOrder: number[] = [];

  function ensureSimulation(site: FlowFestPopulationSite): void {
    if (builtSiteSeed === site.seed && simulation) return;
    npcs = createFlowFestPopulation(site, {
      count: props.populationCount ?? 38,
      homeAnchorIds: flowFestHomeAnchorIds(site),
    });
    simulation = new FlowFestPopulationSimulation(site, npcs);
    builtSiteSeed = site.seed;
    elapsedSeconds = 0;
    warmedMoment = null;
    reassignAccumulator = REASSIGN_INTERVAL_SECONDS;
    for (const slot of slots) {
      slot.agentId = null;
      slot.agentIndex = -1;
      slot.visible = false;
    }
  }

  function ensureWarmStart(active: FlowFestPopulationSimulation): void {
    if (warmedMoment === props.moment) return;
    warmedMoment = props.moment;
    const seconds =
      FLOW_FEST_PHASE_WARM_START_SECONDS[
        flowFestDayPhaseForMoment(props.moment)
      ];
    if (seconds <= 0) {
      elapsedSeconds = 0;
      return;
    }
    active.warmStart(props.moment, 0, seconds);
    elapsedSeconds = seconds;
    reassignAccumulator = REASSIGN_INTERVAL_SECONDS;
  }

  function reassignSlots(frame: FlowFestPopulationFrame): void {
    const budget = flowFestPopulationRenderBudget(frame.dayPhase);
    const view = camera.current;
    const eyeX = view?.position.x ?? 0;
    const eyeZ = view?.position.z ?? 0;

    candidateOrder.length = 0;
    for (let index = 0; index < frame.agents.length; index += 1) {
      const agent = frame.agents[index]!;
      // The fire circle renders its own attendees; the walking layer would
      // otherwise double them.
      if (agent.atFireJam) continue;
      const distance = Math.hypot(agent.x - eyeX, agent.z - eyeZ);
      if (distance > budget.cullMeters) continue;
      candidateOrder.push(index);
    }
    candidateOrder.sort((first, second) => {
      const a = frame.agents[first]!;
      const b = frame.agents[second]!;
      return (
        Math.hypot(a.x - eyeX, a.z - eyeZ) - Math.hypot(b.x - eyeX, b.z - eyeZ)
      );
    });
    candidateOrder.length = Math.min(
      candidateOrder.length,
      Math.min(budget.maxVisible, SLOT_COUNT)
    );

    const wanted = new Set(candidateOrder);
    const held = new Set<number>();
    for (const slot of slots) {
      if (slot.agentIndex >= 0 && wanted.has(slot.agentIndex)) {
        held.add(slot.agentIndex);
        continue;
      }
      slot.agentId = null;
      slot.agentIndex = -1;
      slot.visible = false;
    }

    const incoming = candidateOrder.filter((index) => !held.has(index));
    let cursor = 0;
    for (const slot of slots) {
      if (slot.agentIndex >= 0) continue;
      const agentIndex = incoming[cursor];
      if (agentIndex === undefined) break;
      cursor += 1;
      const agent = frame.agents[agentIndex]!;
      slot.agentIndex = agentIndex;
      slot.agentId = agent.id;
      slot.avatarId = agent.avatarId;
      slot.x = agent.x;
      slot.y = agent.y;
      slot.z = agent.z;
      slot.facingAngle = agent.facingAngle;
      slot.visible = true;
    }
  }

  function pushTransforms(frame: FlowFestPopulationFrame): void {
    const budget = flowFestPopulationRenderBudget(frame.dayPhase);
    const view = camera.current;
    const eyeX = view?.position.x ?? 0;
    const eyeZ = view?.position.z ?? 0;
    for (const slot of slots) {
      if (slot.agentIndex < 0) continue;
      const agent = frame.agents[slot.agentIndex];
      if (!agent) {
        slot.visible = false;
        continue;
      }
      slot.x = agent.x;
      slot.y = agent.y;
      slot.z = agent.z;
      slot.facingAngle = agent.facingAngle;
      slot.isMoving = agent.isMoving;
      slot.moveSpeed = agent.isMoving ? agent.speedMetersPerSecond : 0;
      slot.directionX = Math.sin(agent.facingAngle);
      slot.directionZ = Math.cos(agent.facingAngle);
      slot.visible = !agent.atFireJam;
      // Foot planting is the expensive half of the locomotion rig. Past the
      // near band a walker keeps its gait and drops the IK correction.
      slot.footPlanting =
        Math.hypot(agent.x - eyeX, agent.z - eyeZ) <= budget.nearMeters;
    }
  }

  useTask((delta) => {
    const site = props.site;
    ensureSimulation(site);
    const active = simulation;
    if (!active) return;
    ensureWarmStart(active);

    const step = Math.min(Math.max(delta, 0), 0.25);
    elapsedSeconds += step;
    const clock = flowFestSimClock(props.moment, elapsedSeconds);
    const frame = active.advance(clock, step);

    reassignAccumulator += step;
    if (reassignAccumulator >= REASSIGN_INTERVAL_SECONDS) {
      reassignAccumulator %= REASSIGN_INTERVAL_SECONDS;
      reassignSlots(frame);
    }
    pushTransforms(frame);
    props.onFrame?.(frame);
  });
</script>

{#each slots as slot (slot.key)}
  {#if slot.agentId}
    <Avatar3D
      id={`flow-fest-population-slot-${slot.key}`}
      avatarId={slot.avatarId}
      bluePropState={null}
      redPropState={null}
      visible={slot.visible}
      isActive={false}
      position={{ x: slot.x, y: slot.y, z: slot.z }}
      facingAngle={slot.facingAngle}
      isMoving={slot.isMoving}
      moveSpeed={slot.moveSpeed}
      moveDirection={{ x: slot.directionX, z: slot.directionZ }}
      enableLocomotion={true}
      enableFootPlanting={slot.footPlanting}
      onModelSwapped={() => props.onAvatarReady?.(slot.agentId ?? "")}
    />
  {/if}
{/each}
