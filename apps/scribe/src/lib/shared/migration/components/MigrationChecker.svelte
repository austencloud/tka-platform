<!--
  MigrationChecker.svelte

  Orchestrates the domain migration notification system.
  Decides whether to show modal, banner, or nothing based on state.

  Add this to MainApplication.svelte to enable migration notifications.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { migrationState } from "../state/migration-state.svelte";
  import MigrationModal from "./MigrationModal.svelte";
  import MigrationBanner from "./MigrationBanner.svelte";

  // Local UI state (what's currently showing)
  let showModal = $state(false);
  let showBanner = $state(false);
  let initialized = $state(false);

  // Watch for state changes and update UI
  const shouldShowModal = $derived(migrationState.shouldShowModal);
  const shouldShowBanner = $derived(migrationState.shouldShowBanner);

  onMount(() => {
    // Initialize state from localStorage
    migrationState.initialize();
    initialized = true;

    // Determine what to show on initial load
    if (migrationState.shouldShowModal) {
      showModal = true;
    } else if (migrationState.shouldShowBanner) {
      showBanner = true;
    }
  });

  function handleModalDismiss() {
    showModal = false;

    // Check if we should show banner instead
    if (migrationState.shouldShowBanner) {
      showBanner = true;
    }
  }

  function handleBannerDismiss() {
    showBanner = false;
  }

  function handleShowModalFromBanner() {
    showBanner = false;
    showModal = true;
  }
</script>

{#if initialized}
  {#if showModal}
    <MigrationModal onDismiss={handleModalDismiss} />
  {/if}

  {#if showBanner && !showModal}
    <MigrationBanner
      onShowModal={handleShowModalFromBanner}
      onDismiss={handleBannerDismiss}
    />
  {/if}
{/if}
