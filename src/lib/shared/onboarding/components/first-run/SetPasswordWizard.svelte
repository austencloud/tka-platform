<!--
  SetPasswordWizard - Required set-password overlay for passwordless accounts.

  Independent of FirstRunWizard (the name card): the password gate must fire even
  for accounts that already finished first-run on a prior session. Mounted by
  MainApplication when passwordOnboardingState.required is true.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import SetPasswordStep from "./steps/SetPasswordStep.svelte";

  interface Props {
    onComplete: () => void;
  }

  const { onComplete }: Props = $props();

  let animateIn = $state(false);

  onMount(() => {
    requestAnimationFrame(() => {
      animateIn = true;
    });
  });
</script>

<div class="set-password-wizard" class:animate-in={animateIn}>
  <div class="step-container">
    <SetPasswordStep {onComplete} />
  </div>
</div>

<style>
  .set-password-wizard {
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

  .set-password-wizard :global(.set-password-step) {
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
  }

  .set-password-wizard.animate-in :global(.set-password-step) {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .set-password-wizard :global(.set-password-step) {
      transition: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
