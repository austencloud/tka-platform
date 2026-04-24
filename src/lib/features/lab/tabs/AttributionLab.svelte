<!--
  AttributionLab - Test the deferred attribution prompt

  Allows testing the slide-up attribution prompt without
  waiting for engagement thresholds to be met.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { getAttributionPromptState } from "$lib/shared/attribution/state/attribution-prompt-state.svelte";
  import AttributionPrompt from "$lib/shared/attribution/components/AttributionPrompt.svelte";

  const promptState = getAttributionPromptState();

  // Get current metrics and state
  let metrics = $state<Record<string, unknown>>({});
  let currentPromptState = $state<Record<string, unknown>>({});

  function refreshState() {
    try {
      const trigger = container?.items?.attributionPromptTrigger as any;
      if (trigger) {
        metrics = trigger.getEngagementMetrics?.() || {};
        currentPromptState = trigger.getPromptState?.() || {};
      }
    } catch (e) {
      console.error("Failed to get attribution state:", e);
    }
  }

  // Refresh on mount
  $effect(() => {
    refreshState();
  });

  function showPrompt() {
    promptState.show();
  }

  function resetPromptState() {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("tka-attribution-prompt-state");
      localStorage.removeItem("tka-attribution-metrics");
      refreshState();
    }
  }

  function simulateEngagement() {
    try {
      const trigger = container?.items?.attributionPromptTrigger as any;
      if (trigger) {
        // Simulate enough engagement to trigger the prompt
        for (let i = 0; i < 6; i++) {
          trigger.recordInteraction?.("sequence_view");
        }
        trigger.recordModuleVisit?.("create");
        trigger.recordModuleVisit?.("browse");
        trigger.recordModuleVisit?.("learn");
        refreshState();
      }
    } catch (e) {
      console.error("Failed to simulate engagement:", e);
    }
  }

  function setEligibleNow() {
    if (typeof localStorage !== "undefined") {
      const state = JSON.parse(localStorage.getItem("tka-attribution-prompt-state") || "{}");
      state.eligibleAfter = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      state.lastDismissed = undefined;
      state.showCount = 0;
      localStorage.setItem("tka-attribution-prompt-state", JSON.stringify(state));
      refreshState();
    }
  }
</script>

<div class="attribution-lab">
  <header class="lab-header">
    <h1>Attribution Prompt Lab</h1>
    <p class="subtitle">Test the deferred attribution question prompt</p>
  </header>

  <div class="lab-content">
    <section class="controls-section">
      <h2>Controls</h2>
      <div class="button-grid">
        <button class="lab-button primary" onclick={showPrompt}>
          <i class="fas fa-eye"></i>
          Show Prompt Now
        </button>
        <button class="lab-button" onclick={simulateEngagement}>
          <i class="fas fa-chart-line"></i>
          Simulate Engagement
        </button>
        <button class="lab-button" onclick={setEligibleNow}>
          <i class="fas fa-clock"></i>
          Make Eligible Now
        </button>
        <button class="lab-button danger" onclick={resetPromptState}>
          <i class="fas fa-trash"></i>
          Reset All State
        </button>
        <button class="lab-button" onclick={refreshState}>
          <i class="fas fa-sync"></i>
          Refresh
        </button>
      </div>
    </section>

    <section class="state-section">
      <h2>Engagement Metrics</h2>
      <div class="state-display">
        <div class="state-row">
          <span class="label">Sequences Viewed:</span>
          <span class="value">{metrics.sequencesViewed ?? 0}</span>
        </div>
        <div class="state-row">
          <span class="label">Sequences Created:</span>
          <span class="value">{metrics.sequencesCreated ?? 0}</span>
        </div>
        <div class="state-row">
          <span class="label">Modules Visited:</span>
          <span class="value">{metrics.modulesVisited ?? 0}</span>
        </div>
        <div class="state-row">
          <span class="label">Session Count:</span>
          <span class="value">{metrics.sessionCount ?? 0}</span>
        </div>
        <div class="state-row">
          <span class="label">Days Since Signup:</span>
          <span class="value">{metrics.daysSinceSignup ?? 0}</span>
        </div>
      </div>
    </section>

    <section class="state-section">
      <h2>Prompt State</h2>
      <div class="state-display">
        <div class="state-row">
          <span class="label">Completed:</span>
          <span class="value" class:success={currentPromptState.completed}>{currentPromptState.completed ? "Yes" : "No"}</span>
        </div>
        <div class="state-row">
          <span class="label">Show Count:</span>
          <span class="value">{currentPromptState.showCount ?? 0}</span>
        </div>
        <div class="state-row">
          <span class="label">Eligible After:</span>
          <span class="value small">{currentPromptState.eligibleAfter ?? "Not set"}</span>
        </div>
        <div class="state-row">
          <span class="label">Last Dismissed:</span>
          <span class="value small">{currentPromptState.lastDismissed ?? "Never"}</span>
        </div>
      </div>
    </section>

    <section class="info-section">
      <h2>Trigger Conditions</h2>
      <ul class="conditions-list">
        <li><strong>Min Days:</strong> 1 day after signup</li>
        <li><strong>Min Interactions:</strong> 5 sequences viewed/created</li>
        <li><strong>Min Modules:</strong> 2 distinct modules visited</li>
        <li><strong>Dismissal Cooldown:</strong> 48 hours</li>
        <li><strong>Max Attempts:</strong> 3 times before giving up</li>
      </ul>
    </section>
  </div>

  <!-- The actual prompt component - controlled by promptState -->
  <AttributionPrompt />
</div>

<style>
  .attribution-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    overflow-y: auto;
  }

  .lab-header {
    margin-bottom: 24px;
  }

  .lab-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-text, white);
    margin: 0 0 8px;
  }

  .subtitle {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.9rem;
    margin: 0;
  }

  .lab-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  section {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 16px;
  }

  section h2 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 12px;
  }

  .button-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .lab-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    min-height: 44px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .lab-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .lab-button.primary {
    background: var(--theme-accent-strong, #8b5cf6);
    border-color: var(--theme-accent-strong, #8b5cf6);
  }

  .lab-button.primary:hover {
    background: color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 85%, white);
  }

  .lab-button.danger {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .lab-button.danger:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  .state-display {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .state-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
  }

  .label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.875rem;
  }

  .value {
    color: var(--theme-text, white);
    font-weight: 600;
    font-size: 0.875rem;
    font-family: monospace;
  }

  .value.small {
    font-size: 0.75rem;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value.success {
    color: #22c55e;
  }

  .conditions-list {
    margin: 0;
    padding: 0 0 0 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: 0.875rem;
    line-height: 1.8;
  }

  .conditions-list strong {
    color: var(--theme-text, white);
  }

  @media (max-width: 600px) {
    .attribution-lab {
      padding: 16px;
    }

    .button-grid {
      flex-direction: column;
    }

    .lab-button {
      width: 100%;
      justify-content: center;
    }
  }
</style>
