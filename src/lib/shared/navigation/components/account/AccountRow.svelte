<!-- AccountRow: Clickable account identity row for sidebar footer and mobile drawer -->
<script lang="ts">
  import { authState } from "../../../auth/state/authState.svelte";
  import { container } from "../../../di";
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";

  let { variant = "expanded", onclick } = $props<{
    variant?: "expanded" | "collapsed" | "drawer";
    onclick: () => void;
  }>();

  const user = $derived(authState.user);
  const isAuthenticated = $derived(authState.isAuthenticated);
  const displayName = $derived(
    user?.displayName || user?.email || "Sign In"
  );
  const initial = $derived(displayName.charAt(0).toUpperCase());
  const photoURL = $derived(user?.photoURL ?? null);

  let photoError = $state(false);

  // Reset photo error when URL changes
  $effect(() => {
    if (photoURL) {
      photoError = false;
    }
  });

  function handleClick() {
    try {
      const hapticService = container.items.hapticFeedback as IHapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }
    onclick();
  }

  function handlePhotoError() {
    photoError = true;
  }
</script>

<button
  class="account-row"
  class:collapsed={variant === "collapsed"}
  class:drawer={variant === "drawer"}
  onclick={handleClick}
  aria-label={isAuthenticated ? "Account menu" : "Sign in"}
  aria-haspopup={variant !== "drawer" ? "menu" : undefined}
>
  <div class="avatar" class:collapsed={variant === "collapsed"}>
    {#if isAuthenticated && photoURL && !photoError}
      <img
        class="avatar-photo"
        src={photoURL}
        alt=""
        onerror={handlePhotoError}
      />
    {:else if isAuthenticated}
      <span class="avatar-initial">{initial}</span>
    {:else}
      <i class="fas fa-user" aria-hidden="true"></i>
    {/if}
  </div>

  {#if variant !== "collapsed"}
    <span class="account-label">{displayName}</span>
    <i class="fas fa-chevron-up chevron" aria-hidden="true"></i>
  {/if}
</button>

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
     DRAWER VARIANT - Full width, different padding/radius
     ========================================================================== */
  .account-row.drawer {
    border-radius: 14px;
    padding: 12px 16px;
  }

  /* ==========================================================================
     AVATAR
     ========================================================================== */
  .avatar {
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
    font-weight: 600;
    overflow: hidden;
  }

  .avatar.collapsed {
    width: 32px;
    height: 32px;
    font-size: var(--font-size-sm, 14px);
  }

  .avatar-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  .avatar-initial {
    line-height: 1;
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
