<script lang="ts">
  import { onMount } from "svelte";
  import WaveSurfer from "wavesurfer.js";
  import RegionsPlugin, {
    type Region,
  } from "wavesurfer.js/dist/plugins/regions.js";

  interface Props {
    blob: Blob;
    startSeconds: number;
    endSeconds: number;
    onRangeChange: (startSeconds: number, endSeconds: number) => void;
  }

  let { blob, startSeconds, endSeconds, onRangeChange }: Props = $props();

  let container = $state<HTMLDivElement>();
  let region: Region | null = null;
  let ready = $state(false);
  let loadError = $state(false);

  onMount(() => {
    if (!container) return;

    const url = URL.createObjectURL(blob);
    const regions = RegionsPlugin.create();
    const wavesurfer = WaveSurfer.create({
      container,
      height: 104,
      waveColor: "rgba(167, 139, 250, 0.46)",
      progressColor: "rgba(34, 211, 238, 0.82)",
      cursorColor: "rgba(255, 255, 255, 0.8)",
      cursorWidth: 1,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: false,
      plugins: [regions],
    });

    wavesurfer.on("ready", () => {
      region = regions.addRegion({
        id: "delivery-crop",
        start: startSeconds,
        end: endSeconds,
        drag: true,
        resize: true,
        minLength: 0.05,
        color: "rgba(34, 211, 238, 0.2)",
        content: "delivery clip",
      });
      ready = true;
    });
    regions.on("region-updated", (updated) => {
      onRangeChange(updated.start, updated.end);
    });

    void wavesurfer.load(url).catch(() => {
      loadError = true;
    });

    return () => {
      wavesurfer.destroy();
      URL.revokeObjectURL(url);
    };
  });

  function previewCrop(): void {
    region?.play(true);
  }
</script>

<div class="waveform-editor">
  <div
    class="waveform-shell"
    class:loading={!ready}
    bind:this={container}
  ></div>

  {#if loadError}
    <p class="waveform-note error">The waveform could not open this take.</p>
  {:else}
    <div class="waveform-footer">
      <button
        type="button"
        class="preview-button"
        onclick={previewCrop}
        disabled={!ready}
      >
        <i class="fas fa-play" aria-hidden="true"></i>
        Play crop
      </button>
      <p class="waveform-note">
        Drag either edge around the target. Keep a breath of room tone, not the
        comma pause.
      </p>
      <span class="duration-readout">
        {Math.max(0, endSeconds - startSeconds).toFixed(2)} s
      </span>
    </div>
  {/if}
</div>

<style>
  .waveform-editor {
    --waveform-surface: var(--theme-background, #111119);
    --waveform-border: var(--theme-stroke, rgba(255, 255, 255, 0.13));
    display: grid;
    gap: 10px;
  }

  .waveform-shell {
    min-height: 104px;
    overflow: hidden;
    border: 1px solid var(--waveform-border);
    border-radius: 12px;
    background: var(--waveform-surface);
  }

  .waveform-shell.loading {
    opacity: 0.55;
  }

  .waveform-footer {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
  }

  .preview-button {
    display: inline-flex;
    min-height: var(--min-touch-target, 44px);
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border: 1px solid var(--waveform-border);
    border-radius: 9px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
  }

  .preview-button:hover:not(:disabled) {
    border-color: var(--theme-accent, #a78bfa);
  }

  .preview-button:disabled {
    cursor: wait;
    opacity: 0.5;
  }

  .waveform-note {
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.45;
  }

  .waveform-note.error {
    color: var(--semantic-error, #f87171);
  }

  .duration-readout {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 640px) {
    .waveform-footer {
      grid-template-columns: 1fr auto;
    }

    .waveform-note {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }
</style>
