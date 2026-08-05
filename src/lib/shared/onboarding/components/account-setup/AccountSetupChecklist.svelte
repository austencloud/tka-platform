<script lang="ts">
  import type {
    AccountSetupState,
    AccountSetupTaskId,
  } from "../../state/account-setup-state.svelte";

  let { state, onTaskAction } = $props<{
    state: AccountSetupState;
    onTaskAction: (taskId: AccountSetupTaskId) => void;
  }>();

  const progressPercent = $derived(
    state.totalCount === 0
      ? 0
      : Math.round((state.completedCount / state.totalCount) * 100)
  );
</script>

{#if !state.loading && state.available}
  <section class="setup-card" aria-labelledby="account-setup-title">
    <header class="setup-header">
      <div class="header-copy">
        <p class="eyebrow">Account setup</p>
        <h2 id="account-setup-title">
          {state.isComplete
            ? "Your account is set"
            : "Finish setting up your account"}
        </h2>
      </div>
      <span class="progress-count">
        {state.completedCount} of {state.totalCount} done
      </span>
    </header>

    <div
      class="progress-track"
      role="progressbar"
      aria-label="Account setup progress"
      aria-valuemin="0"
      aria-valuemax={state.totalCount}
      aria-valuenow={state.completedCount}
    >
      <span class="progress-fill" style:width={`${progressPercent}%`}></span>
    </div>

    <p class="completion-status" role="status" aria-live="polite">
      {state.isComplete
        ? "Account setup complete."
        : `${state.completedCount} of ${state.totalCount} account setup tasks complete.`}
    </p>

    {#if state.saveError}
      <div class="save-error" role="status">
        <span>{state.saveError}</span>
        <button type="button" onclick={() => void state.retrySave()}
          >Retry</button
        >
      </div>
    {/if}

    <div class="task-grid">
      {#each state.tasks as task (task.id)}
        <button
          class="task-row"
          class:complete={task.complete}
          onclick={() => onTaskAction(task.id)}
          aria-label={`${task.actionLabel}: ${task.label}`}
        >
          <span class="task-status" aria-hidden="true">
            <i class="fas {task.complete ? 'fa-check' : task.icon}"></i>
          </span>
          <span class="task-copy">
            <span class="task-label">{task.label}</span>
            <span class="task-description">{task.description}</span>
          </span>
          <span class="task-action">{task.actionLabel}</span>
        </button>
      {/each}
    </div>
  </section>
{/if}

<style>
  .setup-card {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: clamp(16px, 2.5cqi, 24px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
  }

  .setup-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
  }

  .header-copy {
    min-width: 0;
  }

  .eyebrow,
  h2,
  .progress-count {
    margin: 0;
  }

  .eyebrow {
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin-top: 3px;
    color: var(--theme-text, #fff);
    font-size: clamp(1.05rem, 3.2cqi, 1.4rem);
    line-height: 1.2;
  }

  .progress-count {
    flex-shrink: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
  }

  .progress-track {
    width: 100%;
    height: 8px;
    overflow: hidden;
    background: color-mix(in srgb, var(--theme-text, #fff) 10%, transparent);
    border-radius: 999px;
  }

  .progress-fill {
    display: block;
    height: 100%;
    min-width: 0;
    background: var(--theme-accent, #8b5cf6);
    border-radius: inherit;
    transition: width var(--duration-normal, 200ms) ease;
  }

  .task-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .completion-status {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .save-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: var(--min-touch-target, 48px);
    padding: 10px 12px;
    color: var(--semantic-error, #ef4444);
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 10%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    border-radius: 12px;
    font-size: var(--font-size-min, 14px);
  }

  .save-error button {
    min-height: var(--min-touch-target, 44px);
    padding: 8px 14px;
    color: var(--theme-text, #fff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
    border-radius: 9px;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
  }

  .save-error button:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .task-row {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-height: var(--min-touch-target, 48px);
    padding: 10px 12px;
    text-align: left;
    color: var(--theme-text, #fff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease;
  }

  .task-row:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
  }

  .task-row:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .task-status {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    color: var(--theme-accent, #8b5cf6);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 14%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
    border-radius: 50%;
    font-size: var(--font-size-compact, 12px);
  }

  .task-row.complete .task-status {
    color: var(--semantic-success, #22c55e);
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 14%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 34%,
      transparent
    );
  }

  .task-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }

  .task-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }

  .task-description {
    overflow: hidden;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-action {
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    white-space: nowrap;
  }

  @container (min-width: 680px) {
    .task-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container (min-width: 1050px) {
    .task-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .task-row {
      grid-template-columns: 38px minmax(0, 1fr);
    }

    .task-action {
      grid-column: 2;
    }
  }

  @container (max-width: 420px) {
    .setup-header {
      align-items: start;
      flex-direction: column;
      gap: 6px;
    }

    .task-description {
      white-space: normal;
    }
  }

  @container (min-width: 100rem) {
    .setup-card {
      gap: 24px;
      padding: 36px;
      border-radius: 24px;
    }

    .setup-header {
      gap: 24px;
    }

    .eyebrow {
      font-size: 1rem;
    }

    h2 {
      margin-top: 6px;
      font-size: 2rem;
    }

    .progress-count {
      font-size: 1.125rem;
    }

    .progress-track {
      height: 12px;
    }

    .task-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .task-row {
      grid-template-columns: 56px minmax(0, 1fr) auto;
      gap: 16px;
      min-height: 8.5rem;
      padding: 20px 24px;
      border-radius: 16px;
    }

    .task-status {
      width: 52px;
      height: 52px;
      font-size: 1.125rem;
    }

    .task-copy {
      gap: 6px;
    }

    .task-label,
    .task-action {
      font-size: 1.125rem;
    }

    .task-action {
      grid-column: auto;
    }

    .task-description {
      font-size: 1rem;
    }

    .save-error {
      padding: 16px 20px;
      font-size: 1.125rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill,
    .task-row {
      transition: none;
    }
  }
</style>
