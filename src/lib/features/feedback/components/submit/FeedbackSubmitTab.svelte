<!-- FeedbackSubmitTab - Fluid container-query based layout -->
<script lang="ts">
  import FeedbackForm from "./FeedbackForm.svelte";
  import { getSharedFeedbackSubmitState } from "../../state/feedback-submit-state.svelte";
  import * as m from "$lib/paraglide/messages.js";

  // Use shared state so drafts persist between tab and quick panel
  const submitState = getSharedFeedbackSubmitState();
</script>

<div class="submit-tab">
  <div class="submit-container">
    <!-- Centered header -->
    <header class="submit-header">
      <div class="header-icon">
        <i class="fas fa-paper-plane" aria-hidden="true"></i>
      </div>
      <h1 class="header-title">{m.feedback_submit_title()}</h1>
      <p class="header-subtitle">{m.feedback_submit_subtitle()}</p>
    </header>

    <!-- Form Content -->
    <FeedbackForm formState={submitState} />
  </div>
</div>

<style>
  /* ═══════════════════════════════════════════════════════════════════════════
     CONTAINER-QUERY BASED FLUID LAYOUT
     ═══════════════════════════════════════════════════════════════════════════ */
  .submit-tab {
    /* Establish as container for queries */
    container-type: size;
    container-name: submit-tab;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    overflow-y: auto; /* Allow scrolling on small viewports */
    -webkit-overflow-scrolling: touch;

    /* Fluid padding that scales with container */
    padding: clamp(12px, 3cqi, 32px);
    padding-bottom: calc(
      clamp(12px, 3cqi, 32px) + env(safe-area-inset-bottom, 0px)
    );
  }

  .submit-container {
    /* Take up available space intelligently */
    width: min(100%, clamp(400px, 85cqi, 600px));
    max-height: 100%;

    display: flex;
    flex-direction: column;
    /* Tighter gap for mobile */
    gap: clamp(6px, 1.5cqh, 16px);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     HEADER - Centered, fluid sizing
     ═══════════════════════════════════════════════════════════════════════════ */
  .submit-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    /* Fluid gap based on container */
    gap: clamp(4px, 1cqh, 12px);
    /* Reduce header space when container is tight */
    padding-bottom: clamp(4px, 1.5cqh, 16px);
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    /* Fluid icon size */
    width: clamp(36px, 6cqi, 48px);
    height: clamp(36px, 6cqi, 48px);
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: clamp(8px, 1.5cqi, 14px);
    color: var(--semantic-success, var(--semantic-success));
    font-size: clamp(14px, 2.5cqi, 24px);
  }

  .header-title {
    margin: 0;
    /* Fluid typography */
    font-size: clamp(1rem, 3cqi, 1.5rem);
    font-weight: 700;
    color: var(--theme-text);
    letter-spacing: -0.02em;
  }

  .header-subtitle {
    margin: 0;
    font-size: clamp(0.75rem, 1.8cqi, 0.9375rem);
    color: var(--theme-text-dim, var(--theme-text-dim));
    line-height: 1.4;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     CONTAINER QUERIES - Adapt to actual available space
     ═══════════════════════════════════════════════════════════════════════════ */

  /* When container is very short - minimize header */
  @container submit-tab (max-height: 500px) {
    .submit-tab {
      justify-content: flex-start;
      padding-top: clamp(8px, 2cqh, 16px);
    }

    .submit-header {
      flex-direction: row;
      text-align: left;
      gap: 10px;
      padding-bottom: 0;
    }

    .header-icon {
      width: 28px;
      height: 28px;
      font-size: var(--font-size-compact);
      border-radius: 8px;
    }

    .header-title {
      font-size: 0.9375rem;
    }

    .header-subtitle {
      display: none;
    }
  }

  /* When container is narrow - tighten horizontal */
  @container submit-tab (max-width: 400px) {
    .submit-container {
      width: 100%;
    }
  }

  /* When container is wide - add intentional space */
  @container submit-tab (min-width: 800px) {
    .submit-container {
      width: min(85%, 580px);
    }
  }

  /* Hide scrollbar but allow if absolutely needed */
  .submit-tab::-webkit-scrollbar {
    width: 4px;
  }

  .submit-tab::-webkit-scrollbar-track {
    background: transparent;
  }

  .submit-tab::-webkit-scrollbar-thumb {
    background: var(--theme-stroke);
    border-radius: 2px;
  }
</style>
