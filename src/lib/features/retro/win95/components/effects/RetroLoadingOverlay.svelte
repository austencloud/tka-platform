<!--
  RetroLoadingOverlay — Full-screen fake loading sequence for TKA-OS v1.0

  Renders a centered "Please Wait" dialog with a lying progress bar
  over a semi-transparent overlay. Progress jumps forward erratically,
  occasionally regresses, and stalls at 99% before completing.

  Auto-starts a FakeLoadingManager session on mount and calls
  oncomplete when the session finishes.

  Domain: Retro Desktop Effects
-->
<script lang="ts">
  import RetroProgressBar from "../primitives/RetroProgressBar.svelte";
  import { FakeLoadingManager } from "../../services/implementations/FakeLoadingManager";
  import type { LoadingContext } from "../../services/contracts/IFakeLoadingManager";
  import { RETRO_ICONS } from "../rendering/retro-icons";

  let {
    context,
    message = "",
    oncomplete,
  }: {
    context: LoadingContext;
    message?: string;
    oncomplete?: () => void;
  } = $props();

  let progress = $state(0);
  let statusMessage = $state("");
  let complete = $state(false);

  const manager = new FakeLoadingManager();

  $effect(() => {
    const unsubscribe = manager.onProgress((session) => {
      progress = session.progress;
      statusMessage = session.message;

      if (session.isComplete && !complete) {
        complete = true;
        oncomplete?.();
      }
    });

    manager.startSession(context);

    return () => {
      unsubscribe();
      manager.cancelSession();
    };
  });
</script>

<div class="retro-loading-overlay" role="alert" aria-live="polite">
  <div class="retro-loading-dialog window">
    <div class="retro-loading-header">
      <span class="retro-loading-hourglass" aria-hidden="true">{@html RETRO_ICONS.hourglass}</span>
      <span class="retro-loading-title">
        {message || "Please Wait..."}
      </span>
    </div>

    <div class="retro-loading-bar">
      <RetroProgressBar value={progress} segmented />
    </div>

    <div class="retro-loading-status">
      {statusMessage}
    </div>
  </div>
</div>

<style>
  /* ------------------------------------------------------------------ */
  /* Overlay — semi-transparent backdrop covering the viewport            */
  /* ------------------------------------------------------------------ */
  .retro-loading-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
  }

  /* ------------------------------------------------------------------ */
  /* Dialog — the centered "Please Wait" box                             */
  /* ------------------------------------------------------------------ */
  .retro-loading-dialog {
    min-width: 320px;
    max-width: 420px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    background: var(--retro-button-face, #c0c0c0);
    color: var(--retro-field-text, #000);
  }

  /* ------------------------------------------------------------------ */
  /* Header — hourglass + context message                                */
  /* ------------------------------------------------------------------ */
  .retro-loading-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .retro-loading-hourglass {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    image-rendering: pixelated;
  }

  .retro-loading-hourglass :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .retro-loading-title {
    font-weight: 700;
  }

  /* ------------------------------------------------------------------ */
  /* Progress bar wrapper                                                */
  /* ------------------------------------------------------------------ */
  .retro-loading-bar {
    width: 100%;
  }

  /* ------------------------------------------------------------------ */
  /* Status message — mono font, single line                             */
  /* ------------------------------------------------------------------ */
  .retro-loading-status {
    font-family: var(--retro-font-mono, "Fixedsys", "Courier New", monospace);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-disabled-text, #808080);
    min-height: 1.4em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
