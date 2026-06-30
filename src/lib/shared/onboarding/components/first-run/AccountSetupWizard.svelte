<!--
  AccountSetupWizard - Post-signup overlay that hosts the unified setup card
  (name and/or password on one modal). Replaces the separate FirstRunWizard +
  SetPasswordWizard so a new magic-link account isn't walked through two stops.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import AccountSetupStep from "./AccountSetupStep.svelte";

  interface Props {
    needsPassword: boolean;
    forcePreview?: boolean;
    onComplete: () => void;
  }

  const { needsPassword, forcePreview = false, onComplete }: Props = $props();

  let animateIn = $state(false);

  onMount(() => {
    requestAnimationFrame(() => {
      animateIn = true;
    });
  });
</script>

<div class="account-setup-wizard" class:animate-in={animateIn}>
  <div class="step-container">
    <AccountSetupStep {needsPassword} {forcePreview} {onComplete} />
  </div>
</div>

<style>
  .account-setup-wizard {
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

  .account-setup-wizard :global(.account-setup-step) {
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
  }

  .account-setup-wizard.animate-in :global(.account-setup-step) {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .account-setup-wizard :global(.account-setup-step) {
      transition: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
