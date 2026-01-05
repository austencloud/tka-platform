<script lang="ts">
  /**
   * Sequence Viewer Page
   *
   * Standalone route for viewing and editing sequences from deep links.
   * URL format: /sequence/{encodedSequence}
   */

  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import SharedSequenceView from "$lib/shared/sequence-viewer/components/SharedSequenceView.svelte";
  import { resolve, TYPES } from "$lib/shared/inversify/di";
  import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  // Get encoded sequence from URL param
  const encodedId = $derived($page.params["id"]);

  // Decode sequence from URL
  const decodedSequence = $derived.by(() => {
    if (!encodedId) return null;

    try {
      const encoderService = resolve<ISequenceEncoder>(TYPES.ISequenceEncoder);
      return encoderService.decodeWithCompression(
        decodeURIComponent(encodedId)
      );
    } catch (err) {
      console.error("Failed to decode sequence:", err);
      return null;
    }
  });

  // Handle navigation back to home
  function handleClose() {
    goto("/");
  }

  // Handle opening in Create module
  function handleOpenInCreate(sequence: SequenceData) {
    // Store sequence for Create module to consume
    try {
      localStorage.setItem(
        "tka-pending-edit-sequence",
        JSON.stringify(sequence)
      );
      goto("/?module=create&tab=edit");
    } catch (err) {
      console.error("Failed to store sequence for editing:", err);
      goto("/");
    }
  }
</script>

<svelte:head>
  <title>
    {decodedSequence?.word || decodedSequence?.name || "Sequence"} - TKA Scribe
  </title>
  <meta
    name="description"
    content={decodedSequence?.word
      ? `View and edit the sequence "${decodedSequence.word}" in TKA Scribe`
      : "View and edit sequences in TKA Scribe"}
  />
</svelte:head>

<div class="sequence-page">
  {#if decodedSequence}
    <SharedSequenceView
      initialSequence={decodedSequence}
      onClose={handleClose}
      onOpenInCreate={handleOpenInCreate}
    />
  {:else}
    <div class="error-container">
      <div class="error-card">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="error-icon"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h1>Sequence Not Found</h1>
        <p>The sequence link appears to be invalid or corrupted.</p>
        <button class="home-button" onclick={handleClose}> Go to Home </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .sequence-page {
    min-height: 100vh;
    background: var(--color-background, var(--theme-panel-bg));
  }

  .error-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .error-card {
    text-align: center;
    padding: 2rem;
    background: var(--color-surface, var(--theme-panel-elevated-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 1rem;
    max-width: 400px;
  }

  .error-icon {
    color: var(--color-error, var(--semantic-error, var(--semantic-error)));
    margin-bottom: 1rem;
  }

  .error-card h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text, var(--theme-text));
    margin: 0 0 0.5rem 0;
  }

  .error-card p {
    color: var(--color-text-muted, var(--theme-text-dim));
    margin: 0 0 1.5rem 0;
  }

  .home-button {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary, var(--theme-accent, var(--semantic-info)));
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .home-button:hover {
    background: var(--color-primary-hover, var(--theme-accent-strong));
  }
</style>
