<!--
  ComposerExportDemo

  A real export demo: one button runs the app's ACTUAL thumbnail renderer
  (ThumbnailRenderer.render — src/lib/shared/browse/services/thumbnail-renderer.ts:86)
  on the baked CΨΩX fixture and shows the resulting PNG with a download link.

  This calls getThumbnailRenderer().render(...) directly rather than going
  through ThumbnailRenderOrchestrator (which adds cloud/local cache layers this
  marketing demo doesn't need). The input-building + URL.createObjectURL
  pattern mirrors the orchestrator's own real call site:
  src/lib/shared/browse/services/thumbnail-render-orchestrator.ts:303-324.
  Format is forced to PNG at full quality, matching the app's real "export as
  image" path (src/lib/shared/export-panel/services/export-orchestrator.ts:111)
  rather than the lossy WebP the gallery grid uses for its cached thumbnails.

  DEMO_SEQUENCE already carries full step data, a set loopType, and a start
  position, so this render never touches Firestore or the LOOP detector — it
  only exercises the composition/text renderers (the actual pixel pipeline).

  The renderer returns a Blob with dimensions this component can't know ahead
  of time (grid layout is computed from step count + header/footer inside
  ImageComposer). Rather than guess a ratio and risk a resize-driven shift when
  the real image lands, the stage is a fixed-aspect box with the image fit via
  object-fit: contain — the box never changes size, only its contents.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { DEMO_SEQUENCE } from "../_data/demo-beats";

  type Phase = "idle" | "rendering" | "done" | "error";

  let phase = $state<Phase>("idle");
  let imageUrl = $state<string | null>(null);

  onDestroy(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  });

  async function renderExport() {
    if (phase === "rendering") return;
    phase = "rendering";
    try {
      const [{ getThumbnailRenderer }, { PropType }] = await Promise.all([
        import("$lib/shared/browse/get-thumbnail-renderer"),
        import("$lib/shared/pictograph/prop/domain/enums/prop-type"),
      ]);

      const renderer = getThumbnailRenderer();
      const { blob } = await renderer.render(
        DEMO_SEQUENCE,
        {
          sequenceName: DEMO_SEQUENCE.word,
          sequenceId: DEMO_SEQUENCE.id,
          bluePropType: PropType.STAFF,
          redPropType: PropType.STAFF,
          catDogModeEnabled: false,
          lightMode: false,
          variant: "gallery",
          loopType: DEMO_SEQUENCE.loopType,
        },
        { format: "PNG", quality: 1.0 }
      );

      const previousUrl = imageUrl;
      const url = URL.createObjectURL(blob);
      imageUrl = url;
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      phase = "done";
    } catch (err) {
      console.error("[ComposerExportDemo] Render failed:", err);
      phase = "error";
    }
  }
</script>

<div class="export-demo">
  <div class="stage">
    {#if imageUrl && phase === "done"}
      <img src={imageUrl} alt="Rendered export of the CΨΩX demo sequence" class="export-image" />
    {:else}
      <div class="placeholder">
        <span class="tka-font placeholder-word">CΨΩX</span>
        {#if phase === "error"}
          <span class="placeholder-hint">Render hiccup. Try again.</span>
        {:else}
          <span class="placeholder-hint">Tap render to run the real export pipeline.</span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="action-row">
    <button
      type="button"
      class="render-button"
      onclick={renderExport}
      disabled={phase === "rendering"}
    >
      <i class="fas {phase === 'rendering' ? 'fa-circle-notch fa-spin' : 'fa-image'}" aria-hidden="true"></i>
      <span>{phase === "rendering" ? "Rendering..." : "Render the export"}</span>
    </button>
    {#if phase === "done" && imageUrl}
      <a class="download-link" href={imageUrl} download="cpox-export.png">
        <i class="fas fa-download" aria-hidden="true"></i>
        <span>Download PNG</span>
      </a>
    {/if}
  </div>
</div>

<style>
  .export-demo {
    margin-top: 1.8rem;
  }

  .stage {
    position: relative;
    aspect-ratio: 3 / 4;
    max-width: min(24rem, 100%);
    margin: 0 auto;
    border-radius: 18px;
    overflow: hidden;
    background: oklch(0.16 0.018 270 / 0.45);
    border: 1px solid oklch(0.4 0.04 270 / 0.14);
    display: grid;
    place-items: center;
  }

  .export-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 1.5rem;
    text-align: center;
  }

  .placeholder-word {
    font-size: 1.8rem;
    opacity: 0.35;
    color: oklch(0.88 0.03 270);
  }

  .placeholder-hint {
    font-size: 0.85rem;
    font-style: italic;
    color: oklch(0.6 0.02 270);
  }

  .action-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    margin-top: 1.3rem;
  }

  .render-button {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    min-height: 48px;
    padding: 0 1.8rem;
    font-size: 1.02rem;
    font-weight: 650;
    font-family: inherit;
    color: #fff;
    border: none;
    border-radius: 13px;
    background: linear-gradient(135deg, #14b8a6, #22c55e);
    box-shadow: 0 14px 32px oklch(0.6 0.15 170 / 0.32);
    cursor: pointer;
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      opacity 160ms ease;
  }
  .render-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 20px 44px oklch(0.6 0.15 170 / 0.46);
  }
  .render-button:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .download-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0 1.2rem;
    font-size: 0.9rem;
    font-weight: 550;
    color: oklch(0.85 0.03 270);
    background: oklch(0.22 0.02 270 / 0.6);
    border: 1px solid oklch(0.4 0.04 270 / 0.22);
    border-radius: 11px;
    text-decoration: none;
    cursor: pointer;
    transition:
      background 160ms ease,
      border-color 160ms ease;
  }
  .download-link:hover {
    background: oklch(0.28 0.02 270 / 0.7);
    border-color: oklch(0.5 0.05 270 / 0.35);
  }

  @media (prefers-reduced-motion: reduce) {
    .render-button {
      transition: none;
    }
    .render-button:hover:not(:disabled) {
      transform: none;
    }
    .download-link {
      transition: none;
    }
  }
</style>
