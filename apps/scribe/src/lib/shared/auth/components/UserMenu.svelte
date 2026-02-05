<script lang="ts">
  /**
   * User Menu Component
   *
   * Displays user avatar and provides logout functionality
   */

  import { authState } from "../state/authState.svelte";

  let {
    class: className = "",
  }: {
    class?: string;
  } = $props();

  let showMenu = $state(false);
  let loading = $state(false);

  async function handleLogout() {
    loading = true;
    try {
      await authState.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      loading = false;
      showMenu = false;
    }
  }

  function toggleMenu() {
    showMenu = !showMenu;
  }

  function closeMenu() {
    showMenu = false;
  }

  // Get user initials for avatar
  const userInitials = $derived.by(() => {
    if (!authState.user) return "?";
    const name = authState.user.displayName || authState.user.email || "User";
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  });

  // Get user display name
  const displayName = $derived(
    authState.user?.displayName || authState.user?.email || "User"
  );

  // Get user avatar URL
  const avatarUrl = $derived(authState.user?.photoURL);
</script>

<div class="user-menu {className}">
  <button
    onclick={toggleMenu}
    class="avatar-button"
    aria-label="User menu"
    aria-expanded={showMenu}
    aria-controls="user-menu-dropdown"
  >
    {#if avatarUrl}
      <img src={avatarUrl} alt={displayName} class="avatar-image" />
    {:else}
      <div class="avatar-fallback">
        {userInitials}
      </div>
    {/if}
  </button>

  {#if showMenu}
    <div
      class="menu-backdrop"
      onclick={closeMenu}
      onkeydown={(e) => e.key === "Escape" && closeMenu()}
      role="button"
      tabindex="0"
      aria-label="Close menu"
    ></div>
    <div id="user-menu-dropdown" class="menu-dropdown">
      <div class="menu-header">
        <p class="user-name">{displayName}</p>
        <p class="user-email">{authState.user?.email || ""}</p>
      </div>

      <div class="menu-divider"></div>

      <button onclick={handleLogout} disabled={loading} class="logout-button">
        {#if loading}
          <span class="spinner"></span>
        {/if}
        Sign Out
      </button>
    </div>
  {/if}
</div>

<style>
  .user-menu {
    position: relative;
  }

  .avatar-button {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    border: 2px solid transparent;
    padding: 0;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    background: transparent;
  }

  .avatar-button:hover {
    border-color: var(--semantic-info, var(--semantic-info));
    transform: scale(1.05);
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar-fallback {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--semantic-info) 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text, white);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
  }

  .menu-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 0.5rem);
    min-width: 200px;
    background: var(--theme-panel-bg);
    border-radius: 0.5rem;
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    box-shadow: 0 10px 25px var(--theme-shadow, var(--theme-shadow));
    z-index: 50;
    overflow: hidden;
    animation: slideIn var(--duration-normal) ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .menu-header {
    padding: 1rem;
  }

  .user-name {
    font-weight: 600;
    color: var(--theme-text);
    margin: 0 0 0.25rem 0;
    font-size: 0.875rem;
  }

  .user-email {
    color: var(--theme-text-dim);
    margin: 0;
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu-divider {
    height: 1px;
    background: var(--theme-stroke);
  }

  .logout-button {
    width: 100%;
    padding: 0.75rem 1rem;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--semantic-error, var(--semantic-error));
    font-weight: 500;
    cursor: pointer;
    transition: background var(--duration-normal) ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .logout-button:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 10%,
      transparent
    );
  }

  .logout-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 0.875rem;
    height: 0.875rem;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .menu-dropdown {
      border-width: 2px;
    }

    .logout-button {
      font-weight: 600;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .menu-dropdown {
      animation: none;
    }
    .spinner {
      animation: none;
    }
  }
</style>
