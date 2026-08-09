<!--
  Developer HUD for the Ghost's live decision hierarchy.

  The public thought bubble says what the character is thinking. This panel
  answers the engineering questions behind it: which activity owns the next
  several steps, which step is running, whether the Ghost is perceiving or
  acting, and which sidebar labels it actually read before choosing.
-->
<script lang="ts">
  import type { GhostMood } from "../domain/intention";
  import type { GhostMindStatus } from "../services/mind.svelte";

  let {
    status,
    thought,
    mood,
    seed,
    stage = false,
  }: {
    status: GhostMindStatus;
    thought: string | null;
    mood: GhostMood;
    seed: number;
    stage?: boolean;
  } = $props();

  const activityPosition = $derived(
    status.activityStepCount
      ? `${status.activityStepIndex + 1}/${status.activityStepCount}`
      : "0/0"
  );
  const optionSummary = $derived(
    status.navigationOptions
      .map((option) => option.label)
      .slice(0, 8)
      .join(" · ") || "Nothing read yet"
  );
</script>

<aside class="mind-overlay" class:stage aria-hidden="true">
  <header>
    <span class="eyebrow">Ghost mind</span>
    <span class="phase phase-{status.phase}">{status.phase}</span>
  </header>

  <div class="facts">
    <span class="label">Activity</span>
    <span class="value">
      {status.activityId ?? "none"}{status.activityVariantId &&
      status.activityVariantId !== "default"
        ? ` · ${status.activityVariantId}`
        : ""}
      <span class="counter">{activityPosition}</span>
    </span>

    <span class="label">Intention</span>
    <span class="value">{status.intentionId ?? "choosing"}</span>

    <span class="label">Target</span>
    <span class="value">{status.targetLabel ?? "none"}</span>

    <span class="label">Mood</span>
    <span class="value">{mood}</span>
  </div>

  <div class="section">
    <span class="section-label">Plan</span>
    <div class="plan">
      {#each status.plan as step, index}
        <span
          class="plan-step"
          class:current={index === status.activityStepIndex}
          class:done={index < status.activityStepIndex}
          title={step}>{step}</span
        >
      {:else}
        <span class="empty">Waiting for an activity</span>
      {/each}
    </div>
  </div>

  <div class="section readout">
    <span class="section-label">Sidebar read</span>
    <span class="read-value">{optionSummary}</span>
    {#if status.navigationChoice}
      <span class="choice">
        Chose {status.navigationChoice.label}
      </span>
    {/if}
  </div>

  <div class="section thought">
    <span class="section-label">Thought</span>
    <span class="thought-value">{thought ?? "Watching quietly"}</span>
  </div>

  <footer>
    <span>seed {seed}</span>
    {#if status.activityCandidates.length}
      <span class="candidates">
        considered {status.activityCandidates
          .slice(0, 3)
          .map(({ id, score }) => `${id} ${score.toFixed(2)}`)
          .join(" · ")}
      </span>
    {/if}
  </footer>
</aside>

<style>
  .mind-overlay {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483002;
    width: min(360px, calc(100vw - 32px));
    height: 300px;
    box-sizing: border-box;
    overflow: hidden;
    padding: 14px 16px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b8cff) 42%, transparent);
    border-radius: 14px;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #101018) 94%,
      transparent
    );
    box-shadow:
      0 18px 48px -20px rgba(0, 0, 0, 0.78),
      0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    color: var(--theme-text, #f4f4f8);
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.35;
    pointer-events: none;
  }

  header,
  footer,
  .value {
    display: flex;
    align-items: center;
  }

  header {
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .eyebrow,
  .section-label,
  .label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
  }

  .phase {
    min-width: 9ch;
    padding: 3px 7px;
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b8cff) 18%,
      transparent
    );
    color: var(--theme-accent, #a7a8ff);
    text-align: center;
    text-transform: uppercase;
    font-size: 12px;
    font-weight: 800;
  }

  .phase-perceiving {
    color: #67e8f9;
    background: rgba(34, 211, 238, 0.16);
  }

  .phase-acting {
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.16);
  }

  .phase-watching,
  .phase-waiting {
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.14);
  }

  .facts {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 3px 8px;
  }

  .value {
    min-width: 0;
    justify-content: space-between;
    overflow: hidden;
    color: #e2e8f0;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .counter {
    margin-left: 8px;
    color: #93c5fd;
    font-variant-numeric: tabular-nums;
  }

  .section {
    margin-top: 9px;
  }

  .section-label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
  }

  .plan {
    display: flex;
    gap: 4px;
    height: 24px;
    overflow: hidden;
  }

  .plan-step {
    flex: 0 1 auto;
    min-width: 16px;
    max-width: 94px;
    overflow: hidden;
    padding: 3px 6px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.58);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .plan-step.done {
    opacity: 0.36;
    text-decoration: line-through;
  }

  .plan-step.current {
    flex-shrink: 0;
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #8b8cff) 65%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b8cff) 18%,
      transparent
    );
    color: #fff;
  }

  .readout,
  .thought {
    position: relative;
    height: 41px;
    overflow: hidden;
  }

  .read-value,
  .thought-value {
    display: -webkit-box;
    overflow: hidden;
    color: #cbd5e1;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .thought-value {
    color: #f8fafc;
    font-family: inherit;
    font-style: italic;
  }

  .choice {
    position: absolute;
    right: 0;
    top: 0;
    max-width: 55%;
    overflow: hidden;
    color: #67e8f9;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .empty {
    color: rgba(255, 255, 255, 0.42);
    font-style: italic;
  }

  footer {
    position: absolute;
    right: 16px;
    bottom: 10px;
    left: 16px;
    justify-content: space-between;
    gap: 12px;
    color: rgba(255, 255, 255, 0.4);
    font-variant-numeric: tabular-nums;
  }

  .candidates {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .mind-overlay.stage {
    width: min(560px, calc(100vw - 48px));
    height: 410px;
    padding: 22px 24px;
    border-radius: 22px;
    font-size: 16px;
  }

  .mind-overlay.stage .phase,
  .mind-overlay.stage .section-label {
    font-size: 14px;
  }

  .mind-overlay.stage .facts {
    grid-template-columns: 104px minmax(0, 1fr);
    gap: 7px 12px;
  }

  .mind-overlay.stage .section {
    margin-top: 16px;
  }

  .mind-overlay.stage .plan {
    height: 34px;
  }

  .mind-overlay.stage .plan-step {
    max-width: 150px;
    padding: 6px 9px;
  }

  .mind-overlay.stage .readout,
  .mind-overlay.stage .thought {
    height: 56px;
  }

  .mind-overlay.stage footer {
    right: 24px;
    bottom: 18px;
    left: 24px;
  }
</style>
