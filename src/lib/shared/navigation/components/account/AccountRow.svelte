<!-- AccountRow: Clickable account identity row for sidebar footer and mobile drawer -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { authState } from "../../../auth/state/auth-state.svelte";
import type { HapticFeedback } from "../../../application/services/haptic-feedback";
  import RobustAvatar from "../../../components/avatar/RobustAvatar.svelte";
  import { authDrawerState } from "../../../auth/state/auth-drawer-state.svelte";

  let { variant = "expanded", onclick } = $props<{
    variant?: "expanded" | "collapsed" | "drawer";
    onclick?: () => void;
  }>();

  const user = $derived(authState.user);
  const isFullAccount = $derived(authState.isFullAccount);
  const displayName = $derived(
    user?.displayName || user?.email || "Account"
  );
  const photoURL = $derived(user?.photoURL ?? null);

  const avatarSize = $derived(variant === "collapsed" ? 32 : 28);

  function handleClick() {
    try {
      const hapticService = getHapticFeedback() as HapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }
    if (isFullAccount) {
      onclick?.();
    } else {
      // Guests get the auth sheet straight away (Sign up / Log in tabs),
      // not the account menu popover.
      authDrawerState.show("signup");
    }
  }
</script>

{#if variant === "drawer"}
  {#if isFullAccount && onclick}
    <button
      class="account-row drawer interactive"
      onclick={handleClick}
      aria-label="Edit profile"
    >
      <RobustAvatar src={photoURL} name={displayName} customSize={32} />
      <span class="account-label">{displayName}</span>
      <i class="fas fa-chevron-right drawer-chevron" aria-hidden="true"></i>
    </button>
  {:else if isFullAccount}
    <div class="account-row drawer">
      <RobustAvatar src={photoURL} name={displayName} customSize={32} />
      <span class="account-label">{displayName}</span>
    </div>
  {:else}
    <button
      class="account-row drawer interactive"
      onclick={() => {
        try { (getHapticFeedback() as HapticFeedback)?.trigger("selection"); } catch {}
        // Close the containing drawer (e.g. mobile nav) before the auth drawer
        // opens, so we never stack two full-height sheets on top of each other.
        onclick?.();
        authDrawerState.show("signup");
      }}
      aria-label="Sign in"
    >
      <div class="avatar-guest drawer-size">
        <i class="fas fa-user-plus" aria-hidden="true"></i>
      </div>
      <span class="account-label sign-up-label">Sign in</span>
    </button>
  {/if}
{:else}
  <button
    class="account-row"
    class:collapsed={variant === "collapsed"}
    onclick={handleClick}
    aria-label={isFullAccount ? "Account menu" : "Sign in"}
    title={variant === "collapsed" && !isFullAccount ? "Sign in" : undefined}
    aria-haspopup={isFullAccount ? "menu" : undefined}
  >
    <span class="avatar-col" class:collapsed={variant === "collapsed"}>
      {#if isFullAccount}
        <RobustAvatar
          src={photoURL}
          name={displayName}
          customSize={avatarSize}
        />
      {:else}
        <div class="avatar-guest" class:collapsed={variant === "collapsed"}>
          <i class="fas fa-user-plus" aria-hidden="true"></i>
        </div>
      {/if}
    </span>

    {#if variant !== "collapsed"}
      <span class="account-label">{isFullAccount ? displayName : "Sign in"}</span>
      {#if isFullAccount}
        <i class="fas fa-chevron-up chevron" aria-hidden="true"></i>
      {/if}
    {/if}
  </button>
{/if}

<style>
  /* ==========================================================================
     ACCOUNT ROW - Base (expanded)
     ========================================================================== */
  .account-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .account-row:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .account-row:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  /* Sidebar-expanded variant: same 44px row height as the rail's circle
     button so the footer's total height never changes across the sidebar
     tree swap (no vertical layout shift). The 44px avatar column centers
     the avatar on the rail's icon anchor. Drawer variant keeps its own
     metrics. */
  .account-row:not(.drawer):not(.collapsed) {
    height: var(--min-touch-target);
    gap: 0;
    padding: 0 12px 0 0;
  }

  .avatar-col {
    width: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-col.collapsed {
    width: auto;
  }

  /* ==========================================================================
     COLLAPSED VARIANT - Circle button
     ========================================================================== */
  .account-row.collapsed {
    width: var(--min-touch-target, 50px);
    height: var(--min-touch-target, 50px);
    padding: 0;
    justify-content: center;
    border-radius: 50%;
  }

  /* ==========================================================================
     DRAWER VARIANT - Static identity display, not interactive
     ========================================================================== */
  .account-row.drawer {
    border-radius: 14px;
    padding: 12px 16px;
    cursor: default;
    border-color: transparent;
    background: transparent;
    justify-content: center;
  }

  .account-row.drawer.interactive {
    cursor: pointer;
    border-color: var(--theme-stroke);
    background: var(--theme-card-bg);
  }

  .account-row.drawer.interactive:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .account-row.drawer.interactive:active {
    transform: scale(0.98);
  }

  .account-row.drawer.interactive:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  .drawer-chevron {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.4;
    margin-left: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .account-row.drawer.interactive:active {
      transform: none;
    }
  }

  /* ==========================================================================
     AVATAR (guest fallback only - authenticated users use RobustAvatar)
     ========================================================================== */
  .avatar-guest {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 12px);
  }

  .avatar-guest.collapsed {
    width: 32px;
    height: 32px;
    font-size: var(--font-size-sm, 14px);
  }

  .avatar-guest.drawer-size {
    width: 32px;
    height: 32px;
    border: 1.5px solid var(--theme-accent, #3b82f6);
    font-size: var(--font-size-sm, 14px);
  }

  .sign-up-label {
    color: var(--theme-accent, #3b82f6);
    font-weight: 600;
  }

  /* ==========================================================================
     LABEL + CHEVRON
     ========================================================================== */
  .account-label {
    flex: 1;
    text-align: left;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    animation: label-fade-in var(--duration-normal) ease-out var(--duration-fast) both;
  }

  .drawer .account-label {
    flex: none;
  }

  .chevron {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.5;
    transition: opacity var(--duration-normal) ease;
  }

  .account-row:hover .chevron {
    opacity: 0.8;
  }

  @keyframes label-fade-in {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* ==========================================================================
     ACCESSIBILITY
     ========================================================================== */
  @media (prefers-reduced-motion: reduce) {
    .account-row,
    .chevron {
      transition: none !important;
    }

    .account-label {
      animation: none;
    }
  }

  @media (prefers-contrast: high) {
    .account-row {
      border: 2px solid white;
    }
  }
</style>
