<script lang="ts">
  interface Props {
    audioMode: "original" | "instagram";
    canKeepOriginalAudio: boolean;
    exporting: boolean;
    exportError?: string;
    onAudioModeChange: (mode: "original" | "instagram") => void;
  }

  let {
    audioMode,
    canKeepOriginalAudio,
    exporting,
    exportError = "",
    onAudioModeChange,
  }: Props = $props();
</script>

<section class="delivery" aria-labelledby="post-studio-sound">
  <div>
    <span class="eyebrow">Export</span>
    <h3 id="post-studio-sound">Sound</h3>
  </div>

  <div class="sound-options" role="radiogroup" aria-label="Post sound">
    <button
      type="button"
      class:active={audioMode === "original"}
      class="sound-option"
      disabled={!canKeepOriginalAudio || exporting}
      role="radio"
      aria-checked={audioMode === "original"}
      aria-label="Keep the performance video's original sound"
      onclick={() => onAudioModeChange("original")}
    >
      <i class="fa-solid fa-volume-high" aria-hidden="true"></i>
      <span>
        <strong>Original sound</strong>
        <small>Keep audio from the performance video.</small>
      </span>
    </button>
    <button
      type="button"
      class:active={audioMode === "instagram"}
      class="sound-option"
      disabled={exporting}
      role="radio"
      aria-checked={audioMode === "instagram"}
      aria-label="Export silently and add music in Instagram"
      onclick={() => onAudioModeChange("instagram")}
    >
      <i class="fa-brands fa-instagram" aria-hidden="true"></i>
      <span>
        <strong>Add music later</strong>
        <small>Export silently for Instagram's music picker.</small>
      </span>
    </button>
  </div>

  <p class="delivery-note">
    Layout, timing, fades, and placement are baked into the MP4. Instagram can
    still add music, stickers, filters, and text.
  </p>

  <p class="error-slot" class:visible={!!exportError} role="alert">
    {exportError || "Export status"}
  </p>
</section>

<style>
  .delivery {
    display: grid;
    gap: var(--spacing-md);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--theme-stroke);
  }

  .eyebrow {
    display: block;
    margin-bottom: var(--spacing-xs);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h3 {
    margin: 0;
    color: var(--theme-text);
    font-size: 1.15rem;
  }

  .sound-options {
    display: grid;
    gap: var(--spacing-sm);
  }

  .sound-option {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    min-height: 4rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .sound-option > i {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-2026-sm);
    background: color-mix(
      in srgb,
      var(--theme-accent) 12%,
      var(--theme-card-bg)
    );
    color: var(--theme-accent);
  }

  .sound-option > span {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .sound-option strong {
    font-size: var(--font-size-min);
  }

  .sound-option small {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    line-height: 1.35;
  }

  .sound-option:hover:not(:disabled),
  .sound-option.active {
    border-color: var(--theme-accent);
    background: color-mix(
      in srgb,
      var(--theme-accent) 10%,
      var(--theme-card-bg)
    );
  }

  .sound-option:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .sound-option:disabled {
    opacity: 0.44;
    cursor: not-allowed;
  }

  .delivery-note,
  .error-slot {
    margin: 0;
    font-size: var(--font-size-compact);
    line-height: 1.45;
  }

  .delivery-note {
    color: var(--theme-text-dim);
  }

  .error-slot {
    min-height: 1.25rem;
    visibility: hidden;
    color: var(--semantic-error);
  }

  .error-slot.visible {
    visibility: visible;
  }
</style>
