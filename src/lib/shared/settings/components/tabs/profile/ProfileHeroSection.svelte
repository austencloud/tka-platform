<!-- ProfileHeroSection.svelte - Profile avatar, name, email, and sign-out button -->
<script lang="ts">
  import RobustAvatar from "../../../../components/avatar/RobustAvatar.svelte";
  import type { User } from "firebase/auth";

  interface Props {
    user: User;
    onSignOut: () => void;
    disabled?: boolean;
  }

  let { user, onSignOut, disabled = false }: Props = $props();
</script>

<section class="glass-card profile-card">
  <div class="profile-hero">
    <div class="avatar-wrapper">
      <RobustAvatar
        src={user.photoURL}
        name={user.displayName || user.email}
        alt={user.displayName || "User"}
        size="xl"
      />
    </div>
    <div class="profile-info">
      <h2 class="profile-name">{user.displayName || "User"}</h2>
      {#if user.email}
        <p class="profile-email">{user.email}</p>
      {/if}
    </div>
    {#if !disabled}
      <button class="sign-out-btn" onclick={onSignOut}>
        <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
        <span>Sign Out</span>
      </button>
    {/if}
  </div>
</section>

<style>
  /* ========================================
     GLASS CARD BASE
     ======================================== */
  .glass-card {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 2.5cqi, 16px);
    padding: clamp(14px, 2.5cqi, 24px);
    border-radius: clamp(12px, 3cqi, 16px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;
  }

  .glass-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-1px);
    box-shadow: var(--theme-shadow);
  }

  /* ========================================
     PROFILE HERO
     ======================================== */
  .profile-hero {
    display: flex;
    align-items: center;
    gap: clamp(12px, 2.5cqi, 24px);
    flex-wrap: wrap;
  }

  .avatar-wrapper {
    width: clamp(64px, 14cqi, 100px);
    height: clamp(64px, 14cqi, 100px);
    border-radius: 50%;
    overflow: hidden;
    padding: 3px;
    background: linear-gradient(
      135deg,
      var(--theme-accent) 0%,
      var(--theme-accent-strong) 100%
    );
    box-shadow: 0 0 32px
      color-mix(in srgb, var(--theme-accent) 25%, transparent);
    flex-shrink: 0;
  }

  .avatar-wrapper :global(.robust-avatar) {
    width: 100% !important;
    height: 100% !important;
  }

  .avatar-wrapper :global(img),
  .avatar-wrapper :global(.avatar-fallback) {
    border-radius: 50%;
  }

  .profile-info {
    flex: 1;
    min-width: 140px;
  }

  .profile-name {
    font-size: clamp(18px, 3.5cqi, 28px);
    font-weight: 700;
    color: var(--theme-text);
    margin: 0;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
  }

  .profile-email {
    font-size: clamp(12px, 2cqi, 15px);
    color: var(--theme-text-dim);
    margin: 0;
  }

  .sign-out-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target);
    padding: 12px 20px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 12px;
    color: #fca5a5;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .sign-out-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.6);
    color: #fecaca;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(239, 68, 68, 0.2);
  }

  .sign-out-btn:active {
    transform: scale(0.97);
  }

  .sign-out-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Mobile: Stack profile */
  @container profile-tab (max-width: 420px) {
    .profile-hero {
      flex-direction: column;
      text-align: center;
      gap: 16px;
    }

    .profile-info {
      min-width: 100%;
    }

    .sign-out-btn {
      width: 100%;
    }
  }

  /* Very small screens: more compact */
  @container profile-tab (max-width: 360px) {
    .profile-hero {
      gap: 12px;
    }

    .profile-name {
      font-size: var(--font-size-base);
    }

    .profile-email {
      font-size: var(--font-size-compact);
    }
  }

  /* ========================================
     ACCESSIBILITY
     ======================================== */
  @media (prefers-reduced-motion: reduce) {
    .glass-card,
    .sign-out-btn {
      transition: none;
    }

    .glass-card:hover,
    .sign-out-btn:hover {
      transform: none;
    }
  }

  @media (prefers-contrast: high) {
    .glass-card,
    .sign-out-btn {
      border-width: 2px;
    }
  }
</style>
