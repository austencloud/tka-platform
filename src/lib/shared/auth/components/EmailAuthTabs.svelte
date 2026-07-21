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
  }

  let { mode = $bindable("signin") }: Props = $props();

  const lastMethod = getLastAuthMethod();

  // Default to magic link (passwordless) as modern best practice — unless this
  // device last signed in with a password, in which case landing on the magic
  // tab just makes the user hunt for the form they actually want.
  let activeTab = $state<"magic" | "password">(
    lastMethod === "password" ? "password" : "magic"
  );
</script>

<div class="email-auth-tabs">
  <div class="tab-bar" role="tablist">
    <button
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
    gap: clamp(12px, 2vh, 16px);
    width: 100%;
  }

  .tab-bar {
    display: flex;
    gap: 4px;
    /* Extra top padding reserves the space the "Last used" badge straddles
       into. Unconditional, so the bar's height never depends on the badge. */
    padding: 0.5rem 4px 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: clamp(8px, 1.2vh, 12px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tab {
    flex: 1;
    /* Anchor for the absolutely-positioned LastUsedBadge. */
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: clamp(8px, 1.2vh, 12px) clamp(12px, 2vw, 16px);
    border: none;
    border-radius: clamp(6px, 1vh, 8px);
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: clamp(0.75rem, 1.6vh, var(--font-size-sm));
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) ease;
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
    font-size: clamp(0.75rem, 1.5vh, 0.875rem);
  }

  .tab-content {
    width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .tab {
      transition: none;
    }
  }
</style>
