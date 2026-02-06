<script lang="ts">
  /**
   * UserAvatar - Shared avatar component with two variants
   *
   * Now uses RobustAvatar internally for reliable image loading with
   * automatic retry and fallback.
   *
   * Variants:
   * - 'color': Extracts dominant color from avatar, renders gradient ring
   * - 'role': Shows role badge overlay
   *
   * Props:
   * - user: UserProfile or UserData
   * - variant: 'color' | 'role' (default: 'color')
   * - size: 'sm' | 'md' | 'lg' (default: 'md')
   * - onload: Called when image loads (for color extraction)
   * - onerror: Called when image fails to load
   */

  import type { UserRole } from "$lib/shared/auth/domain/models/UserRole";
  import {
    getRoleIcon,
    getRoleColor,
    getRoleLabel,
  } from "$lib/shared/auth/utils/role-display-utils";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";

  interface BaseUser {
    displayName: string;
    avatar?: string;
    photoURL?: string;
    googleId?: string;
  }

  interface Props {
    user: BaseUser;
    variant?: "color" | "role";
    size?: "sm" | "md" | "lg";
    accentColor?: string;
    role?: UserRole;
    onload?: (img: HTMLImageElement) => void;
    onerror?: () => void;
  }

  let {
    user,
    variant = "color",
    size = "md",
    accentColor,
    role,
    onload,
    onerror,
  }: Props = $props();

  // Map size to pixel values for RobustAvatar
  const sizeMap = {
    sm: 40,
    md: 56,
    lg: 80,
  };

  const imageUrl = $derived(user.photoURL || user.avatar);
  const dimension = $derived(sizeMap[size]);
</script>

<div
  class="user-avatar"
  class:variant-color={variant === "color"}
  class:variant-role={variant === "role"}
  class:size-sm={size === "sm"}
  class:size-md={size === "md"}
  class:size-lg={size === "lg"}
  style={variant === "color" && accentColor
    ? `--accent-color: ${accentColor}`
    : ""}
>
  <RobustAvatar
    src={imageUrl}
    name={user.displayName}
    googleId={user.googleId}
    alt={user.displayName}
    customSize={dimension}
    {onload}
    {onerror}
  />

  {#if variant === "role" && role && role !== "user"}
    <span
      class="role-badge"
      title={getRoleLabel(role)}
      style="background: {getRoleColor(role)}"
    >
      <i class="fas {getRoleIcon(role)}" aria-hidden="true"></i>
    </span>
  {/if}
</div>

<style>
  .user-avatar {
    position: relative;
    border-radius: 50%;
    overflow: visible;
    flex-shrink: 0;
  }

  /* Size variants */
  .user-avatar.size-sm {
    width: 40px;
    height: 40px;
  }

  .user-avatar.size-md {
    width: 56px;
    height: 56px;
  }

  .user-avatar.size-lg {
    width: 80px;
    height: 80px;
  }

  /* Color variant - gradient ring border */
  .user-avatar.variant-color {
    border: 3px solid;
    border-color: var(--accent-color, var(--theme-accent-strong));
    box-shadow: 0 0 16px
      color-mix(
        in srgb,
        var(--accent-color, var(--theme-accent-strong)) 40%,
        transparent
      );
  }

  /* Role badge - overlay on bottom-right */
  .role-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact);
    color: #000;
    border: 2px solid rgba(10, 10, 15, 0.9);
    z-index: 1;
  }
</style>
