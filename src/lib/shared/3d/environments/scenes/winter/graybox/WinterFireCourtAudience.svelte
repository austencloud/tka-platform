<script lang="ts">
  /**
   * The seven non-performing friends around Keeper's fire court.
   *
   * Every friend uses the same deployed avatar renderer as the main performer
   * and watches the active court. There is no audience furniture or
   * prop-storage station competing with the performance.
   */
  import {
    Avatar3D,
    userProportionsState,
    type AvatarId,
  } from "@austencloud/scene-3d";

  export interface FireCourtFriendPlacement {
    id: string;
    role: "spinner" | "standing";
    x: number;
    z: number;
    facingAngle: number;
    surfaceElevation: number;
  }

  interface Props {
    placements: FireCourtFriendPlacement[];
    onReady?: (id: string) => void;
  }

  interface AudienceProfile {
    id: string;
    avatarId: AvatarId;
  }

  const props: Props = $props();
  const groundY = $derived(userProportionsState.groundY);
  const audienceProfiles = new Map<string, AudienceProfile>([
    ["observer-1", { id: "observer-1", avatarId: "ch18" }],
    ["observer-2", { id: "observer-2", avatarId: "ch24" }],
    ["observer-3", { id: "observer-3", avatarId: "ch10" }],
    ["observer-4", { id: "observer-4", avatarId: "ch44" }],
    ["standing-1", { id: "standing-1", avatarId: "ch07" }],
    ["standing-2", { id: "standing-2", avatarId: "ch22" }],
    ["standing-3", { id: "standing-3", avatarId: "ch41" }],
  ]);
</script>

{#each props.placements as friend (friend.id)}
  {@const profile = audienceProfiles.get(friend.id)}
  {#if profile}
    <Avatar3D
      id={`winter-fire-court-${friend.id}`}
      avatarId={profile.avatarId}
      bluePropState={null}
      redPropState={null}
      position={{
        x: friend.x,
        y: groundY + friend.surfaceElevation,
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
