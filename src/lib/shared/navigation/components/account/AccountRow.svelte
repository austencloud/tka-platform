<!-- AccountRow: Clickable account identity row for sidebar footer and mobile drawer -->
<script lang="ts">
  import { authState } from "../../../auth/state/authState.svelte";
  import { container } from "../../../di";
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import RobustAvatar from "../../../components/avatar/RobustAvatar.svelte";

  let { variant = "expanded", onclick } = $props<{
    variant?: "expanded" | "collapsed" | "drawer";
    onclick?: () => void;
  }>();

  const user = $derived(authState.user);
  const isAuthenticated = $derived(authState.isAuthenticated);
  const displayName = $derived(
    user?.displayName || user?.email || "Sign In"
  );
  const photoURL = $derived(user?.photoURL ?? null);

  const avatarSize = $derived(variant === "collapsed" ? 32 : 28);

  function handleClick() {
    try {
      const hapticService = container.items.hapticFeedback as IHapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }
    onclick?.();
  }
</script>

{#if variant === "drawer"}
  {#if onclick && isAuthenticated}
    <button
      class="account-row drawer interactive"
      onclick={handleClick}
      aria-label="Edit profile"
    >
      <RobustAvatar src={photoURL} name={displayName} customSize={32} />
      <span class="account-label">{displayName}</span>
      <i class="fas fa-chevron-right drawer-chevron" aria-hidden="true"></i>
    </button>
  {:else}
    <div class="account-row drawer">
      {#if isAuthenticated}
        <RobustAvatar src={photoURL} name={displayName} customSize={32} />
      {:else}
        <div class="avatar-guest">
          <i class="fas fa-user" aria-hidden="true"></i>
        </div>
      {/if}
      <span class="account-label">{displayName}</span>
    </div>
  {/if}
{:else}
  <button
    class="account-row"
    class:collapsed={variant === "collapsed"}
    onclick={handleClick}
    aria-label={isAuthenticated ? "Account menu" : "Sign in"}
    aria-haspopup="menu"
  >
    {#if isAuthenticated}
      <RobustAvatar
        src={photoURL}
        name={displayName}
        customSize={avatarSize}
      />
    {:else}
      <div class="avatar-guest" class:collapsed={variant === "collapsed"}>
        <i class="fas fa-user" aria-hidden="true"></i>
      </div>
    {/if}

    {#if variant !== "collapsed"}
      <span class="account-label">{displayName}</span>
      <i class="fas fa-chevron-up chevron" aria-hidden="true"></i>
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
     AVATAR (guest fallback only — authenticated users use RobustAvatar)
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
