<script lang="ts">
  import { onMount } from "svelte";

  import { getAudioAnalyzer } from "$lib/features/feedback/get-audio-analyzer";
  import ProgressBar from "$lib/shared/components/loading/ProgressBar.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import RecordingInventory from "./components/RecordingInventory.svelte";
  import RecordingWorkspace from "./components/RecordingWorkspace.svelte";
  import { setPronunciationRecorderContext } from "./context/pronunciation-recorder-context";
  import { getPronunciationRecorder } from "./get-pronunciation-recorder";
  import { getPronunciationTakeStore } from "./get-pronunciation-take-store";
  import { createPronunciationRecorderState } from "./state/pronunciation-recorder-state.svelte";

  const state = createPronunciationRecorderState({
    recorder: getPronunciationRecorder(),
    takeStore: getPronunciationTakeStore(),
    audioAnalyzer: getAudioAnalyzer(),
    errorHandler: getErrorHandler(),
  });
  setPronunciationRecorderContext({ state });

  const processingStillOn = $derived(
    Boolean(
      state.microphoneSettings?.echoCancellation ||
      state.microphoneSettings?.noiseSuppression ||
      state.microphoneSettings?.autoGainControl
    )
  );

  onMount(() => {
    void state.initialize();
    return state.dispose;
  });

  function handleDeviceChange(event: Event): void {
    const select = event.currentTarget as HTMLSelectElement;
    void state.connectMicrophone(select.value);
  }

  function handleKeyboardShortcut(event: KeyboardEvent): void {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target?.isContentEditable ||
      target?.matches("input, select, textarea, button, a")
    ) {
      return;
    }

    if (event.code === "Space") {
      if (state.phase === "ready") {
        event.preventDefault();
        void state.startTake();
      } else if (state.phase === "recording") {
        event.preventDefault();
        void state.finishTake();
      }
    } else if (event.key === "Enter" && state.phase === "review") {
      event.preventDefault();
      void state.acceptTake();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      state.move(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      state.move(1);
    }
  }
</script>

<svelte:window onkeydown={handleKeyboardShortcut} />

<div class="recorder-lab">
  <header class="lab-heading">
    <div>
      <p class="eyebrow">Pronunciation studio</p>
      <h1>Record the TKA voice</h1>
      <p class="intro">
        Four useful phrase positions, one approved performance in each slot.
        Retakes are auditions, not extra runtime variants.
      </p>
    </div>
    <div class="shortcut-guide" aria-label="Keyboard shortcuts">
      <span><kbd>Space</kbd> record or stop</span>
      <span><kbd>Enter</kbd> approve</span>
      <span><kbd>←</kbd><kbd>→</kbd> move</span>
    </div>
  </header>

  <section class="reasoning-card" aria-labelledby="prosody-guidance-title">
    <div class="reasoning-icon" aria-hidden="true">
      <i class="fas fa-wave-square"></i>
    </div>
    <div>
      <h2 id="prosody-guidance-title">
        The contour belongs to the phrase position
      </h2>
      <p>
        First items stay lightly open, middle items stay connected, and final
        items settle. Record the full dash name as one unit. A final “Sigma
        dash” falls across the name instead of dropping only on “dash.”
      </p>
    </div>
  </section>

  <section class="setup-grid" aria-label="Recording setup">
    <div class="setup-card">
      <div class="setup-card-heading">
        <span class:connected={state.folderName} class="setup-number">
          {state.folderName ? "✓" : "1"}
        </span>
        <div>
          <h2>Output folder</h2>
          <p>
            {#if state.folderName}
              Approved WAV files and manifest save directly to the v1 folder.
            {:else if state.directSaveSupported}
              Choose static/audio/pronunciations/v1 for immediate, resumable
              saves.
            {:else}
              Takes stay in this tab until the session ZIP is exported.
            {/if}
          </p>
        </div>
      </div>
      <div class="setup-actions">
        {#if state.directSaveSupported}
          <PanelButton
            variant={state.folderName ? "secondary" : "primary"}
            disabled={state.navigationLocked}
            onclick={() => void state.connectFolder()}
          >
            <i class="fas fa-folder-open" aria-hidden="true"></i>
            {state.busyAction === "folder"
              ? "Opening folder"
              : state.folderName
                ? "Change folder"
                : "Choose v1 folder"}
          </PanelButton>
        {/if}
        <PanelButton
          disabled={state.sessionTakeCount === 0 || state.navigationLocked}
          onclick={() => void state.exportSessionZip()}
        >
          <i class="fas fa-file-zipper" aria-hidden="true"></i>
          {state.busyAction === "export"
            ? "Building ZIP"
            : `Export session (${state.sessionTakeCount})`}
        </PanelButton>
      </div>
    </div>

    <div class="setup-card">
      <div class="setup-card-heading">
        <span class:connected={state.micConnected} class="setup-number">
          {state.micConnected ? "✓" : "2"}
        </span>
        <div>
          <h2>Studio microphone</h2>
          <p>Requests mono 48 kHz capture with call processing switched off.</p>
        </div>
      </div>

      <div class="microphone-controls">
        {#if state.microphones.length > 0}
          <label>
            <span>Input</span>
            <select
              value={state.selectedDeviceId}
              onchange={handleDeviceChange}
              disabled={state.navigationLocked}
            >
              <option value="">System default</option>
              {#each state.microphones as microphone}
                <option value={microphone.deviceId}>{microphone.label}</option>
              {/each}
            </select>
          </label>
        {/if}

        <PanelButton
          variant={state.micConnected ? "secondary" : "primary"}
          disabled={state.navigationLocked}
          onclick={() => void state.connectMicrophone()}
        >
          <i class="fas fa-microphone" aria-hidden="true"></i>
          {state.busyAction === "microphone"
            ? "Connecting"
            : state.micConnected
              ? "Reconnect"
              : "Connect microphone"}
        </PanelButton>
      </div>

      <div
        class="input-meter"
        aria-label={`Microphone input level ${Math.round(state.micLevel * 100)} percent`}
      >
        <span style:width={`${Math.min(100, state.micLevel * 100)}%`}></span>
      </div>

      {#if state.microphoneSettings}
        <div class="capture-readout">
          <span
            >{state.microphoneSettings.sampleRate?.toLocaleString() ??
              "Unreported"} Hz input</span
          >
          <span>{state.microphoneSettings.channelCount ?? "?"} channel</span>
          <span>24-bit capture WAV</span>
          <span>16-bit delivery WAV</span>
        </div>
        {#if processingStillOn}
          <p class="processing-warning">
            This input still reports browser processing. Turn off voice
            isolation or enhancements in the operating system before the
            production pass.
          </p>
        {/if}
      {/if}
    </div>
  </section>

  <ProgressBar
    percent={state.progressPercent}
    label={`${state.acceptedCount} of ${state.jobs.length} approved`}
    showPercent
    height={8}
  />

  <main class="recorder-layout">
    <RecordingWorkspace />
    <RecordingInventory />
  </main>
</div>

<style>
  .recorder-lab {
    --recorder-surface: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
    --recorder-border: var(--theme-stroke, rgba(255, 255, 255, 0.13));
    --recorder-muted: var(--theme-text-dim, rgba(255, 255, 255, 0.64));
    container-type: inline-size;
    display: flex;
    height: 100%;
    flex-direction: column;
    gap: 22px;
    padding: clamp(18px, 3vw, 34px);
    overflow-y: auto;
    color: var(--theme-text, #fff);
  }

  .lab-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
  }

  .eyebrow {
    margin: 0 0 5px;
    color: var(--theme-accent, #a78bfa);
    font-size: var(--font-size-compact, 12px);
    font-weight: 760;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.8rem, 4cqi, 3.25rem);
    letter-spacing: -0.035em;
    line-height: 1.05;
  }

  .intro {
    max-width: 72ch;
    margin: 9px 0 0;
    color: var(--recorder-muted);
    font-size: var(--font-size-sm, 14px);
    line-height: 1.55;
  }

  .shortcut-guide {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px 12px;
    color: var(--recorder-muted);
    font-size: var(--font-size-compact, 12px);
  }

  .shortcut-guide span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  kbd {
    min-width: 25px;
    padding: 3px 6px;
    border: 1px solid var(--recorder-border);
    border-bottom-width: 2px;
    border-radius: 6px;
    background: var(--recorder-surface);
    color: var(--theme-text, #fff);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    text-align: center;
  }

  .reasoning-card {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 16px;
    padding: 16px 18px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #a78bfa) 36%, transparent);
    border-radius: 16px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #a78bfa) 8%,
      transparent
    );
  }

  .reasoning-icon {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border-radius: 12px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #a78bfa) 16%,
      transparent
    );
    color: var(--theme-accent, #a78bfa);
  }

  .reasoning-card h2,
  .setup-card h2 {
    margin: 0;
    font-size: var(--font-size-base, 16px);
  }

  .reasoning-card p,
  .setup-card p {
    margin: 4px 0 0;
    color: var(--recorder-muted);
    font-size: var(--font-size-sm, 14px);
    line-height: 1.5;
  }

  .setup-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .setup-card {
    display: grid;
    align-content: start;
    gap: 14px;
    padding: 18px;
    border: 1px solid var(--recorder-border);
    border-radius: 16px;
    background: var(--recorder-surface);
  }

  .setup-card-heading {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: start;
    gap: 12px;
  }

  .setup-number {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border: 1px solid var(--recorder-border);
    border-radius: 50%;
    color: var(--theme-accent, #a78bfa);
    font-size: var(--font-size-sm, 14px);
    font-weight: 800;
  }

  .setup-number.connected {
    border-color: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 55%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 13%,
      transparent
    );
    color: var(--semantic-success, #4ade80);
  }

  .setup-actions,
  .microphone-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 9px;
  }

  .microphone-controls label {
    display: grid;
    flex: 1 1 230px;
    gap: 5px;
  }

  .microphone-controls label > span {
    color: var(--recorder-muted);
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
  }

  select {
    min-height: var(--min-touch-target, 44px);
    width: 100%;
    padding: 8px 34px 8px 11px;
    border: 1px solid var(--recorder-border);
    border-radius: 9px;
    background: var(--theme-background, #15151d);
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
  }

  .input-meter {
    height: 7px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--theme-background, rgba(0, 0, 0, 0.28));
  }

  .input-meter span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      #22c55e 0 65%,
      #f59e0b 82%,
      #ef4444 100%
    );
    transition: width 80ms linear;
  }

  .capture-readout {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .capture-readout span {
    padding: 4px 8px;
    border: 1px solid var(--recorder-border);
    border-radius: 999px;
    color: var(--recorder-muted);
    font-size: var(--font-size-compact, 12px);
  }

  .processing-warning {
    color: var(--semantic-warning, #fbbf24) !important;
  }

  .recorder-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(310px, 0.36fr);
    align-items: start;
    gap: 18px;
    padding-bottom: 20px;
  }

  @container (max-width: 920px) {
    .lab-heading {
      align-items: flex-start;
      flex-direction: column;
    }

    .shortcut-guide {
      justify-content: flex-start;
    }

    .setup-grid,
    .recorder-layout {
      grid-template-columns: 1fr;
    }
  }

  @container (max-width: 540px) {
    .recorder-lab {
      padding: 16px;
    }

    .reasoning-card {
      grid-template-columns: 1fr;
    }

    .setup-actions > :global(button),
    .microphone-controls > :global(button) {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .input-meter span {
      transition: none;
    }
  }
</style>
