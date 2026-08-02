<script lang="ts">
  /**
   * EmailAuthTabs
   *
   * Tabbed interface for email authentication methods:
   * - Password (traditional)
   * - Magic Link (passwordless)
   *
   * 2026 best practice: offer passwordless as the primary/first option
   */

  import EmailPasswordAuth from "./EmailPasswordAuth.svelte";
  import EmailLinkAuth from "./EmailLinkAuth.svelte";
  import LastUsedBadge from "./LastUsedBadge.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { getLastAuthMethod } from "$lib/shared/auth/services/last-auth-method.svelte";

  interface Props {
    mode?: "signin" | "signup";
    /**
     * Force the opening tab, overriding this device's last-used method. The
     * in-app-browser path passes "magic" because the magic link is the only
     * method that actually completes inside a webview — landing a webview
     * visitor on the password tab points them at a form most of them don't
     * have credentials for. Omitted everywhere else, so the last-used
     * default below is unchanged for normal browsers.
     */
    initialTab?: "magic" | "password";
  }

  let { mode = $bindable("signin"), initialTab }: Props = $props();

  const lastMethod = getLastAuthMethod();

  // Default to magic link (passwordless) as modern best practice — unless this
  // device last signed in with a password, in which case landing on the magic
  // tab just makes the user hunt for the form they actually want.
  let activeTab = $state<"magic" | "password">(
    initialTab ?? (lastMethod === "password" ? "password" : "magic")
  );
</script>

<div class="email-auth-tabs">
  <div class="tab-bar" role="tablist">
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === "magic"}
      class="tab"
      class:active={activeTab === "magic"}
      onclick={() => (activeTab = "magic")}
      aria-label={lastMethod === "magic-link"
        ? "Magic Link, last used on this device"
        : undefined}
    >
      {#if lastMethod === "magic-link"}
        <LastUsedBadge />
      {/if}
      <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
      <span>Magic Link</span>
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === "password"}
      class="tab"
      class:active={activeTab === "password"}
      onclick={() => (activeTab = "password")}
      aria-label={lastMethod === "password"
        ? `${t("auth_password")}, last used on this device`
        : undefined}
    >
      {#if lastMethod === "password"}
        <LastUsedBadge />
      {/if}
      <i class="fas fa-key" aria-hidden="true"></i>
      <span>{t("auth_password")}</span>
    </button>
  </div>

  <div class="tab-content" role="tabpanel">
    {#if activeTab === "magic"}
      <EmailLinkAuth />
    {:else}
      <EmailPasswordAuth bind:mode />
    {/if}
  </div>
</div>

<style>
  .email-auth-tabs {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    width: 100%;
  }

  .tab-bar {
    display: flex;
    gap: 4px;
    /* Extra top padding reserves the space the "Last used" badge straddles
       into, keeping it inside the bar's own border rather than poking over
       it. Unconditional, so the bar's height never depends on the badge. */
    padding: 0.75rem 0.25rem 0.25rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-md, 0.75rem);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tab {
    flex: 1;
    /* Anchor for the absolutely-positioned LastUsedBadge. */
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.75rem 1rem;
    border: none;
    border-radius: var(--radius-sm, 0.5rem);
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-normal, 200ms) ease,
      color var(--duration-normal, 200ms) ease;
  }

  .tab:hover:not(.active) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, white);
  }

  .tab.active {
    background: var(--theme-accent, #8b5cf6);
    color: white;
    font-weight: 600;
  }

  .tab i {
    font-size: 0.875em;
  }

  .tab-content {
    width: 100%;
  }

  .tab:focus-visible {
    outline: 3px solid
      color-mix(in srgb, var(--theme-accent, #7c6af7) 72%, white);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .tab {
      transition: none;
    }
  }
</style>
