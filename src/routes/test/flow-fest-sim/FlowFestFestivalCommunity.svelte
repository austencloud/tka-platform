<script lang="ts">
  import { useTask } from "@threlte/core";
  import { Avatar3D } from "@austencloud/scene-3d";
  import LiveSequencePerformer3D from "$lib/shared/3d/performers/LiveSequencePerformer3D.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    GGGG_CW,
    GHGH,
    HHHH_CCW,
  } from "$lib/shared/combination/domain/demo-fixtures";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import {
    sampleFlowFestLivingCommunity,
    type FlowFestFestivalCommunityLayout,
    type FlowFestFestivalPersonRole,
    type FlowFestLivingCommunityFrame,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-living-fire-jam";

  interface Props {
    community: FlowFestFestivalCommunityLayout;
    energy?: number;
    onAvatarReady?: (id: string) => void;
    onSimulationFrame?: (frame: FlowFestLivingCommunityFrame) => void;
  }

  const props: Props = $props();

  const performerProfiles: Record<
    Exclude<FlowFestFestivalPersonRole, "spectator">,
    { propType: PropType; sequence: SequenceData; effectId: "fire" | "led" }
  > = {
    "fire-poi": {
      propType: PropType.POI,
      sequence: GHGH,
      effectId: "fire",
    },
    "fire-hoop": {
      propType: PropType.BIGHOOP,
      sequence: HHHH_CCW,
      effectId: "fire",
    },
    juggler: {
      propType: PropType.CLUB,
      sequence: GGGG_CW,
      effectId: "led",
    },
    "led-flow": {
      propType: PropType.CAPSULE_BATON,
      sequence: GHGH,
      effectId: "led",
    },
  };

  let elapsedSeconds = 0;
  let updateAccumulator = 0;
  let frame = $state(
    sampleFlowFestLivingCommunity(props.community, 0, props.energy ?? 0)
  );
  const framesById = $derived(
    new Map(frame.people.map((person) => [person.id, person]))
  );

  $effect(() => {
    const community = props.community;
    const energy = props.energy ?? 0;
    frame = sampleFlowFestLivingCommunity(community, elapsedSeconds, energy);
  });

  useTask((delta) => {
    elapsedSeconds += Math.min(Math.max(delta, 0), 0.25);
    updateAccumulator += delta;
    if (updateAccumulator < 0.1) return;
    updateAccumulator %= 0.1;
    frame = sampleFlowFestLivingCommunity(
      props.community,
      elapsedSeconds,
      props.energy ?? 0
    );
    props.onSimulationFrame?.(frame);
  });
</script>

{#each props.community.people as person (person.id)}
  {@const living = framesById.get(person.id)}
  {#if living}
    {#if person.role === "spectator"}
      <Avatar3D
        id={`flow-fest-${person.id}`}
        avatarId={person.avatarId}
        bluePropState={null}
        redPropState={null}
        visible={true}
        isActive={false}
        position={{ x: living.x, y: living.y, z: living.z }}
        facingAngle={living.facingAngle}
        isMoving={living.isMoving}
        moveSpeed={living.isMoving ? 0.54 : 0}
        moveDirection={{
          x: Math.sin(living.facingAngle),
          z: Math.cos(living.facingAngle),
        }}
        enableLocomotion={true}
        enableFootPlanting={true}
        onModelSwapped={() => props.onAvatarReady?.(person.id)}
      />
    {:else}
      {@const profile = performerProfiles[person.role]}
      <LiveSequencePerformer3D
        id={`flow-fest-${person.id}`}
        position={{ x: living.x, y: living.y, z: living.z }}
        facingAngle={living.facingAngle}
        avatarId={person.avatarId}
        propType={profile.propType}
        sequence={profile.sequence}
        effectId={profile.effectId}
        effectQualityTier="low"
        phaseOffsetSteps={person.phaseOffset}
        playbackSpeed={0.92 + (props.energy ?? 0) * 0.34}
        active={living.active}
        onReady={() => props.onAvatarReady?.(person.id)}
      />
    {/if}
  {/if}
{/each}
