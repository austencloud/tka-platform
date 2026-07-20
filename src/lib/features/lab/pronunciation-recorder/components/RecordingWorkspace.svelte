<script lang="ts">
  import ActionButton from "$lib/shared/components/selection/ActionButton.svelte";
  import { getPronunciationRecorderContext } from "../context/pronunciation-recorder-context";
  import TakeWaveform from "./TakeWaveform.svelte";

  const { state } = getPronunciationRecorderContext();
</script>

<section class="workspace-card" aria-labelledby="recording-prompt-title">
  <div class="workspace-heading">
    <div>
      <p class="context-kicker">
        {state.currentJob.contextLabel}
        <span aria-hidden="true">·</span>
        {state.currentJob.contourLabel}
      </p>
      <h2 id="recording-prompt-title">{state.currentJob.spokenName}</h2>
    </div>
    <div class="take-position">
      <span>{state.currentIndex + 1}</span>
      <small>of {state.jobs.length}</small>
    </div>
  </div>

  <div class="carrier-prompt" aria-label="Carrier phrase">
    {#each state.currentJob.promptParts as part}
      <span class:target={part.target}>{part.text}</span>{part.punctuation}{" "}
    {/each}
  </div>

  <p class="direction">{state.currentJob.direction}</p>

  <div class="review-slot">
    {#if state.phase === "review" && state.reviewTake}
      <div class="crop-heading">
        <div>
          <h3>Choose the delivery clip</h3>
          <p>
            {#if state.trimSuggestion?.confidence === "strong"}
              Automatic crop found {state.trimSuggestion.detectedSegments} speech
              {state.trimSuggestion.detectedSegments === 1
                ? "group"
                : "groups"}.
            {:else}
              Automatic crop found {state.trimSuggestion?.detectedSegments ?? 0} clear
              speech groups. Check the handles.
            {/if}
          </p>
        </div>
        <span
          class:review={state.trimSuggestion?.confidence !== "strong"}
          class="crop-status"
        >
          {state.trimSuggestion?.confidence === "strong"
            ? "Ready to hear"
            : "Review crop"}
        </span>
      </div>

      {#key state.reviewTake.blob}
        <TakeWaveform
          blob={state.reviewTake.blob}
          startSeconds={state.trimStartSeconds}
          endSeconds={state.trimEndSeconds}
          onRangeChange={state.setTrimRange}
        />
      {/key}
    {:else if state.phase === "recording"}
      <div class="recording-state" aria-live="polite">
        <span class="recording-dot"></span>
        <strong>Recording carrier phrase</strong>
        <span>{state.recordingDurationSeconds.toFixed(1)} s</span>
      </div>
    {:else if state.phase === "saving"}
      <div class="saving-state" aria-live="polite">
        <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
        <strong>Rendering and saving the approved WAV</strong>
      </div>
    {:else}
      <div class="ready-state">
        <span class="ready-icon"
          ><i class="fas fa-waveform-lines" aria-hidden="true"></i></span
        >
        <p>
          Read the whole line once. Leave a clean half-beat at commas so the
          target can be lifted out without cutting the name.
        </p>
      </div>
    {/if}
  </div>

  <div class="primary-controls">
    {#if state.phase === "recording"}
      <button
        type="button"
        class="stop-button"
        onclick={() => void state.finishTake()}
      >
        <i class="fas fa-stop" aria-hidden="true"></i>
        Stop and review
      </button>
      <button
        type="button"
        class="quiet-button"
        onclick={() => void state.cancelRecording()}
      >
        Discard
      </button>
    {:else if state.phase === "review"}
      <button type="button" class="quiet-button" onclick={state.discardReview}>
        <i class="fas fa-rotate-left" aria-hidden="true"></i>
        Retake
      </button>
      <ActionButton
        label="Approve and next"
        icon="fa-check"
        color="cyan"
        onclick={() => void state.acceptTake()}
      />
    {:else}
      <ActionButton
        label={state.isAccepted(state.currentJob.id)
          ? "Record replacement"
          : "Record carrier phrase"}
        icon="fa-circle"
        disabled={state.phase === "saving"}
        busy={state.busyAction === "microphone"}
        busyLabel="Connecting microphone"
        onclick={() => void state.startTake()}
      />
    {/if}
  </div>

  <div class="workspace-footer">
    <button
      type="button"
      class="nav-button"
      onclick={() => state.move(-1)}
      disabled={state.navigationLocked}
      aria-label="Previous recording slot"
    >
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      Previous
    </button>

    <p class="status-message" aria-live="polite">{state.statusMessage}</p>

    <button
      type="button"
      class="nav-button"
      onclick={() => state.move(1)}
      disabled={state.navigationLocked}
      aria-label="Next recording slot"
    >
      Next
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </button>
  </div>
</section>

<style>
  .workspace-card {
    --workspace-surface: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
    --workspace-border: var(--theme-stroke, rgba(255, 255, 255, 0.13));
    --workspace-muted: var(--theme-text-dim, rgba(255, 255, 255, 0.64));
    display: grid;
    gap: 20px;
    min-width: 0;
    padding: clamp(20px, 3vw, 34px);
    border: 1px solid var(--workspace-border);
    border-radius: 20px;
    background: var(--workspace-surface);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.14);
  }

  .workspace-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }

  .context-kicker {
    display: flex;
    gap: 7px;
    margin: 0 0 6px;
    color: var(--theme-accent, #a78bfa);
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
    letter-spacing: 0.035em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: clamp(2rem, 6cqi, 4.6rem);
    font-weight: 760;
    letter-spacing: -0.035em;
    line-height: 1;
  }

  .take-position {
    display: grid;
    min-width: 58px;
    justify-items: end;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
  }

  .take-position span {
    font-size: var(--font-size-xl, 20px);
    font-weight: 750;
  }

  .take-position small {
    color: var(--workspace-muted);
    font-size: var(--font-size-compact, 12px);
  }

  .carrier-prompt {
    min-height: 90px;
    padding: 24px;
    border: 1px solid var(--workspace-border);
    border-radius: 16px;
    background: var(--theme-background, rgba(0, 0, 0, 0.22));
    color: var(--workspace-muted);
    font-size: clamp(1.45rem, 4cqi, 2.5rem);
    line-height: 1.45;
  }

  .carrier-prompt .target {
    color: var(--theme-text, #fff);
    font-weight: 760;
    text-decoration-color: var(--theme-accent, #a78bfa);
    text-decoration-line: underline;
    text-decoration-thickness: 0.13em;
    text-underline-offset: 0.2em;
  }

  .direction {
    max-width: 70ch;
    margin: 0;
    color: var(--workspace-muted);
    font-size: var(--font-size-sm, 14px);
    line-height: 1.6;
  }

  .review-slot {
    display: grid;
    min-height: 190px;
    align-content: center;
  }

  .crop-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }

  .crop-heading h3 {
    margin: 0 0 3px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-base, 16px);
  }

  .crop-heading p {
    margin: 0;
    color: var(--workspace-muted);
    font-size: var(--font-size-compact, 12px);
  }

  .crop-status {
    flex: none;
    padding: 5px 9px;
    border: 1px solid
      color-mix(in srgb, var(--semantic-success, #22c55e) 45%, transparent);
    border-radius: 999px;
    color: var(--semantic-success, #4ade80);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
  }

  .crop-status.review {
    border-color: color-mix(
      in srgb,
      var(--semantic-warning, #f59e0b) 45%,
      transparent
    );
    color: var(--semantic-warning, #fbbf24);
  }

  .ready-state,
  .recording-state,
  .saving-state {
    display: flex;
    min-height: 130px;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 20px;
    border: 1px dashed var(--workspace-border);
    border-radius: 14px;
    color: var(--workspace-muted);
    text-align: center;
  }

  .ready-state p {
    max-width: 58ch;
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    line-height: 1.55;
  }

  .ready-icon {
    display: grid;
    width: 46px;
    height: 46px;
    flex: none;
    place-items: center;
    border-radius: 50%;
    background: color-mix(
      in srgb,
      var(--theme-accent, #a78bfa) 16%,
      transparent
    );
    color: var(--theme-accent, #a78bfa);
  }

  .recording-state {
    color: var(--theme-text, #fff);
  }

  .recording-state span:last-child {
    min-width: 48px;
    color: var(--workspace-muted);
    font-family: var(--font-mono, monospace);
    font-variant-numeric: tabular-nums;
  }

  .recording-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--semantic-error, #ef4444);
    box-shadow: 0 0 0 7px
      color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    animation: recording-pulse 1.25s ease-in-out infinite;
  }

  .saving-state i {
    color: var(--theme-accent, #a78bfa);
  }

  .primary-controls {
    display: flex;
    min-height: 48px;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .stop-button,
  .quiet-button,
  .nav-button {
    display: inline-flex;
    min-height: var(--min-touch-target, 44px);
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border: 1px solid var(--workspace-border);
    border-radius: 12px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 650;
    cursor: pointer;
  }

  .stop-button {
    border-color: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 60%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 18%,
      transparent
    );
    color: var(--semantic-error, #f87171);
  }

  .quiet-button,
  .nav-button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.055));
  }

  .stop-button:hover,
  .quiet-button:hover:not(:disabled),
  .nav-button:hover:not(:disabled) {
    border-color: var(--theme-accent, #a78bfa);
  }

  .nav-button:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  .workspace-footer {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 14px;
    padding-top: 4px;
    border-top: 1px solid var(--workspace-border);
  }

  .status-message {
    margin: 0;
    color: var(--workspace-muted);
    font-size: var(--font-size-compact, 12px);
    line-height: 1.45;
    text-align: center;
  }

  @keyframes recording-pulse {
    50% {
      opacity: 0.42;
      transform: scale(0.85);
    }
  }

  @media (max-width: 620px) {
    .workspace-card {
      padding: 18px;
      border-radius: 16px;
    }

    .carrier-prompt {
      padding: 18px;
    }

    .ready-state {
      align-items: flex-start;
      text-align: left;
    }

    .workspace-footer {
      grid-template-columns: 1fr 1fr;
    }

    .status-message {
      grid-column: 1 / -1;
      grid-row: 1;
    }

    .nav-button {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .recording-dot {
      animation: none;
    }
  }
</style>
