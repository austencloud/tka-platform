<script lang="ts">
  /**
   * The seven non-performing friends around Keeper's fire court.
   *
   * Sitting bodies come from the shared seated-audience animation owner. The
   * other three use the same deployed avatar renderer as the main performer,
   * but without invisible props pulling their hands into a performance pose.
   */
  import { T } from "@threlte/core";
  import {
    Avatar3D,
    getAvatarModelPath,
    userProportionsState,
    type AvatarId,
  } from "@austencloud/scene-3d";
  import SeatedFigure3D from "$lib/shared/3d/components/SeatedFigure3D.svelte";
  import { SEATED_AUDIENCE_ANIMATION_URLS } from "$lib/shared/3d/config/seated-audience-assets";

  export interface FireCourtFriendPlacement {
    id: string;
    role: "spinner" | "seated" | "standing" | "rack-tender";
    x: number;
    z: number;
    facingAngle: number;
  }

  interface Props {
    placements: FireCourtFriendPlacement[];
    surfaceElevation: number;
    onReady?: (id: string) => void;
  }

  interface AudienceProfile {
    id: string;
    avatarId: AvatarId;
    seated: boolean;
    animationUrl?: string;
    timeOffset?: number;
    sizeScale?: number;
  }

  const props: Props = $props();
  const groundY = $derived(userProportionsState.groundY);
  const audienceProfiles = new Map<string, AudienceProfile>([
    [
      "seated-1",
      {
        id: "seated-1",
        avatarId: "ch18",
        seated: true,
        animationUrl: SEATED_AUDIENCE_ANIMATION_URLS[0],
        timeOffset: 0.15,
        sizeScale: 0.94,
      },
    ],
    [
      "seated-2",
      {
        id: "seated-2",
        avatarId: "ch24",
        seated: true,
        animationUrl: SEATED_AUDIENCE_ANIMATION_URLS[1],
        timeOffset: 0.72,
        sizeScale: 0.98,
      },
    ],
    [
      "seated-3",
      {
        id: "seated-3",
        avatarId: "ch10",
        seated: true,
        animationUrl: SEATED_AUDIENCE_ANIMATION_URLS[1],
        timeOffset: 1.28,
        sizeScale: 0.93,
      },
    ],
    [
      "seated-4",
      {
        id: "seated-4",
        avatarId: "ch44",
        seated: true,
        animationUrl: SEATED_AUDIENCE_ANIMATION_URLS[0],
        timeOffset: 1.86,
        sizeScale: 0.96,
      },
    ],
    ["standing-1", { id: "standing-1", avatarId: "ch07", seated: false }],
    ["standing-2", { id: "standing-2", avatarId: "ch22", seated: false }],
    ["rack-tender", { id: "rack-tender", avatarId: "ch41", seated: false }],
  ]);
</script>

{#each props.placements as friend (friend.id)}
  {@const profile = audienceProfiles.get(friend.id)}
  {#if profile?.seated && profile.animationUrl}
    <T.Group
      position={[friend.x, groundY + props.surfaceElevation, friend.z]}
      rotation.y={friend.facingAngle}
      scale={profile.sizeScale ?? 1}
    >
      <SeatedFigure3D
        modelUrl={getAvatarModelPath(profile.avatarId)}
        animationUrl={profile.animationUrl}
        timeOffset={profile.timeOffset}
        onReady={() => props.onReady?.(friend.id)}
      />
    </T.Group>
  {:else if profile}
    <Avatar3D
      id={`winter-fire-court-${friend.id}`}
      avatarId={profile.avatarId}
      bluePropState={null}
      redPropState={null}
      position={{
        x: friend.x,
        y: groundY + props.surfaceElevation,
        z: friend.z,
      }}
      facingAngle={friend.facingAngle}
      isActive={false}
      isMoving={false}
      enableLocomotion={true}
      enableFootPlanting={true}
      onModelSwapped={() => props.onReady?.(friend.id)}
    />
  {/if}
{/each}
