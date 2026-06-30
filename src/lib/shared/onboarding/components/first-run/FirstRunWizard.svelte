<!--
  FirstRunWizard - Post-signup optional name card.

  Only ever mounts for full accounts (gated in MainApplication on isFullAccount),
  after the user has already signed up via the auth sheet. If the provider gave
  us a display name (Google/Facebook/most email signups), this completes with
  zero UI. Otherwise it shows a single skippable "What should we call you?" card.
  Pronouns and theme/prop choices live in Settings; the beta notice is a one-time
  toast (BetaNoticeToast).
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";

  import DisplayNameStep from "./steps/DisplayNameStep.svelte";

  interface Props {
    onComplete: () => void;
    onSkip: () => void;
    /** Admin "Preview First Run" — render the card even when the account
     *  already has a provider display name (which normally auto-completes). */
    forcePreview?: boolean;
  }

  const { onComplete, onSkip, forcePreview = false }: Props = $props();
  // onSkip is part of the wizard contract (MainApplication wires it to
  // markSkipped) but this flow always completes via onComplete.
  void onSkip;

  let hapticService: HapticFeedback | null = null;
  let animateIn = $state(false);

  // If the provider already supplied a name, there's nothing to ask — complete
  // immediately and render nothing. Skipped in forcePreview so admins can see
  // the card their named accounts would otherwise auto-skip.
  const hasProviderName = $derived(!!authState.user?.displayName?.trim());
  const showCard = $derived(forcePreview || !hasProviderName);

  onMount(() => {
    try {
      hapticService = getHapticFeedback();
    } catch {
      // Haptics optional
    }

    if (!showCard) {
      onComplete();
      return;
    }

    requestAnimationFrame(() => {
      animateIn = true;
    });
  });

  async function completeWith(displayName: string) {
    hapticService?.trigger("success");
    try {
      if (displayName.trim()) {
        await settingsService.updateSetting("userName", displayName.trim());
      }
    } catch (error) {
      console.error("Failed to apply first-run name:", error);
      // Completion is intentional: the name has a safe default and stays
      // editable in Settings, so a save failure should never trap a new user.
      toast.warning("Couldn't save your name. You can set it later in Settings.");
    }
    onComplete();
  }

  function handleNameComplete(name: string) {
    void completeWith(name);
  }

  function handleSkip() {
    hapticService?.trigger("selection");
    onComplete();
  }
</script>

{#if showCard}
  <div class="first-run-wizard" class:animate-in={animateIn}>
    <div class="step-container">
      <DisplayNameStep onNext={handleNameComplete} onSkip={handleSkip} />
    </div>
  </div>
{/if}

<style>
  .first-run-wizard {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.4));
    z-index: var(--z-priority);
    overflow-y: auto;
  }

  .step-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 600px;
    padding: 0 16px;
  }

  /* Entrance animation (matches DisplayNameStep's container fade) */
  .first-run-wizard :global(.display-name-step) {
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
  }

  .first-run-wizard.animate-in :global(.display-name-step) {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .first-run-wizard :global(.display-name-step) {
      transition: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
