<!--
  RetroDoom - Playable DOOM shareware via js-dos emulator

  Renders a full js-dos container inside a RetroWindow. The DoomLoader
  handles CDN script injection and emulator lifecycle. When the component
  unmounts (window closed), the emulator is stopped and cleaned up.

  Domain: Retro Easter Eggs
-->
<script lang="ts">
  import { DoomLoader } from "../../../services/doom-loader";

  /* ------------------------------------------------------------------ */
  /* Props                                                               */
  /* ------------------------------------------------------------------ */

  const props: {
    onclose?: () => void;
  } = $props();

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  let containerEl: HTMLDivElement | undefined = $state();
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let stopFn: (() => void) | null = null;

  const loader = new DoomLoader();

  /* ------------------------------------------------------------------ */
  /* Launch DOOM when the container div is available                     */
  /* ------------------------------------------------------------------ */

  $effect(() => {
    if (!containerEl) return;

    loader
      .launch(containerEl)
      .then(({ stop }) => {
        stopFn = stop;
        isLoading = false;
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to load DOOM";
        error = message;
        isLoading = false;
      });

    return () => {
      stopFn?.();
    };
  });

  // onclose is part of the window contract; read via $effect to track reactively
  $effect(() => { void props.onclose; });
</script>

<div class="doom-container">
  <!-- The js-dos container must always be in the DOM so the emulator
       has a target on init. We hide it behind the loading/error overlay. -->
  <div
    bind:this={containerEl}
    class="doom-canvas"
    class:doom-hidden={!!error}
  ></div>

  {#if isLoading && !error}
    <div class="doom-loading">
      <p class="doom-loading-title">Loading DOOM.EXE...</p>
      <p class="doom-loading-hint">Downloading from id Software archives</p>
      <div class="doom-spinner"></div>
    </div>
  {/if}

  {#if error}
    <pre class="doom-error">DOOM.EXE - General Protection Fault

{error}

Press any key to close this window.</pre>
  {/if}
</div>

<style>
  .doom-container {
    width: 100%;
    height: 100%;
    position: relative;
    background: #000;
    overflow: hidden;
  }

  .doom-canvas {
    width: 100%;
    height: 100%;
  }

  /* js-dos injects its own child elements into the container div.
     Make sure they fill the space. */
  .doom-canvas :global(*) {
    max-width: 100%;
    max-height: 100%;
  }

  .doom-hidden {
    display: none;
  }

  /* ── Loading overlay ─────────────────────────────────── */

  .doom-loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #000;
    color: #b00;
    font-family: "Courier New", monospace;
    z-index: 10;
  }

  .doom-loading-title {
    font-size: 18px;
    font-weight: bold;
    margin: 0 0 8px;
    color: #c00;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .doom-loading-hint {
    font-size: 12px;
    color: #666;
    margin: 0 0 24px;
  }

  .doom-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #300;
    border-top-color: #c00;
    border-radius: 50%;
    animation: doom-spin 0.8s linear infinite;
  }

  @keyframes doom-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Error screen ────────────────────────────────────── */

  .doom-error {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    color: #c00;
    font-family: "Courier New", monospace;
    font-size: 14px;
    padding: 24px;
    margin: 0;
    white-space: pre-wrap;
    text-align: center;
    z-index: 10;
  }
</style>
