<!--
  PostShareSheet.svelte — viewer → Instagram/Facebook in as few steps as the
  platform allows.

  Owns the whole handoff: which artifact, what the caption says, and where it
  goes. Rendered ONLY from SequenceViewerShell so the drawer, /q/[code] and
  /sequence/[id] are identical by construction (.claude/rules/sequence-viewer-shell.md).

  Two behaviors are load-bearing and easy to regress:

  1. The sheet NEVER blocks on a render. The card is cached and lands
     immediately; picking Video kicks the export off and the destination
     buttons stay disabled-with-progress until the blob exists.
  2. Nothing here resizes when state changes. The preview stage is a fixed
     aspect box, the status line reserves its row, and the QR view swaps
     inside a min-height stage (.claude/rules/no-layout-shift.md).
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { getSharer } from "$lib/shared/share/get-sharer";
  import { getVideoUploader } from "$lib/shared/share/get-video-uploader";
  import { getQRCodeGenerator } from "$lib/shared/qr/get-qr-code-generator";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getCaptionPresetManager } from "$lib/shared/share/state/caption-presets.svelte";
  import {
    buildArtifactFilename,
    copyCaption,
    copyImageAndOpenFacebook,
    downloadArtifact,
    resolveDestinations,
    shareArtifactNatively,
    type HandoffDestinationId,
    type HandoffResult,
    type ShareArtifact,
  } from "$lib/shared/share/services/post-handoff";

  interface Props {
    isOpen: boolean;
    sequence: SequenceData | null;
    /** Canonical share link for this sequence — seeds the caption presets. */
    shareUrl: string;
    /** Object URL of an already-rendered export, if the viewer has one. */
    videoBlobUrl: string | null;
    isExportingVideo: boolean;
    /** 0–1 render progress, or null when idle. */
    exportProgress: number | null;
    /** Asks the viewer to start a video export. Non-blocking. */
    onRequestVideo: () => void;
    /** Fires when the sheet dismisses itself (backdrop, escape, swipe). */
    onClose: () => void;
  }

  let {
    isOpen,
    sequence,
    shareUrl,
    videoBlobUrl,
    isExportingVideo,
    exportProgress,
    onRequestVideo,
    onClose,
  }: Props = $props();

  const captions = getCaptionPresetManager();

  // Drawer owns its own open flag (it animates out), so mirror the prop in and
  // report dismissals back out rather than binding the caller's state.
  let drawerOpen = $state(false);

  $effect(() => {
    drawerOpen = isOpen;
  });

  let artifact = $state<ShareArtifact>("card");
  let caption = $state("");
  let captionTouched = $state(false);
  let statusMessage = $state("");
  let busyDestination = $state<HandoffDestinationId | null>(null);

  let cardBlob = $state<Blob | null>(null);
  let cardPreviewUrl = $state<string | null>(null);
  let videoBlob = $state<Blob | null>(null);

  let qrDataUrl = $state<string | null>(null);
  let qrPending = $state(false);
  let qrError = $state("");

  const word = $derived(
    simplifyRepeatedWord(
      sequence?.displayName || sequence?.word || sequence?.intendedWord || ""
    )
  );

  const presets = $derived(
    captions.buildPresets({
      word: sequence?.word || sequence?.displayName || "",
      url: shareUrl,
    })
  );

  const activeBlob = $derived(artifact === "video" ? videoBlob : cardBlob);

  const filename = $derived(buildArtifactFilename(word, artifact));

  const destinations = $derived(
    resolveDestinations({ artifact, blob: activeBlob, filename })
  );

  const videoBusy = $derived(artifact === "video" && !videoBlob);

  const progressLabel = $derived.by(() => {
    if (!videoBusy) return "";
    if (isExportingVideo && exportProgress !== null) {
      return `Rendering video… ${Math.round(exportProgress * 100)}%`;
    }
    return "Rendering video…";
  });

  // Card first: getCardImageBlob is cached, so the sheet is actionable the
  // moment it opens. Runs on open rather than at module scope so a viewer that
  // never shares never pays the render.
  $effect(() => {
    if (!isOpen || !sequence || cardBlob) return;

    const target = sequence;
    let stale = false;

    void (async () => {
      try {
        const blob = await getSharer().getCardImageBlob(target, {
          darkMode: getImageCompositionManager().darkMode,
        });
        if (stale) return;
        cardBlob = blob;
        cardPreviewUrl = URL.createObjectURL(blob);
      } catch (error) {
        console.error("[PostShareSheet] Card render failed:", error);
        if (!stale) statusMessage = "Couldn't render the card";
      }
    })();

    return () => {
      stale = true;
    };
  });

  // The viewer owns the export; this only adopts the resulting blob.
  $effect(() => {
    const url = videoBlobUrl;
    if (!url) return;

    let stale = false;
    void (async () => {
      try {
        const blob = await (await fetch(url)).blob();
        if (!stale) videoBlob = blob;
      } catch (error) {
        console.error("[PostShareSheet] Could not read exported video:", error);
      }
    })();

    return () => {
      stale = true;
    };
  });

  // Seed the caption once, and stop the moment the user types — the textarea
  // is the source of truth from then on.
  $effect(() => {
    if (!isOpen || captionTouched) return;
    const first = presets[0];
    if (first) caption = first.text;
  });

  $effect(() => {
    return () => {
      if (cardPreviewUrl) URL.revokeObjectURL(cardPreviewUrl);
    };
  });

  function handleArtifactChange(next: ShareArtifact): void {
    artifact = next;
    statusMessage = "";
    qrDataUrl = null;

    if (next === "video" && !videoBlob && !isExportingVideo) {
      onRequestVideo();
    }
  }

  function applyPreset(text: string): void {
    caption = text;
    captionTouched = true;
  }

  function saveCurrentAsPreset(): void {
    captions.saveCustomPreset(caption);
    statusMessage = "Saved as a preset";
  }

  async function sendToPhone(): Promise<void> {
    const blob = activeBlob;
    if (!blob || !sequence?.id) {
      qrError = "Save this sequence first so it has somewhere to upload to.";
      return;
    }

    qrPending = true;
    qrError = "";

    try {
      const { url } = await getVideoUploader().uploadShareArtifact(
        sequence.id,
        blob,
        artifact
      );
      const image = await getQRCodeGenerator().generateUrlAsImage(url, 512);
      qrDataUrl = image.src;
    } catch (error) {
      console.error("[PostShareSheet] Phone handoff failed:", error);
      qrError = "Couldn't prepare the handoff. Sign in and try again.";
    } finally {
      qrPending = false;
    }
  }

  async function runDestination(id: HandoffDestinationId): Promise<void> {
    const blob = activeBlob;
    statusMessage = "";
    busyDestination = id;

    try {
      let result: HandoffResult;

      switch (id) {
        case "native-share":
          if (!blob) return;
          result = await shareArtifactNatively(blob, filename, caption);
          break;
        case "download":
          if (!blob) return;
          result = await downloadArtifact(blob, filename);
          break;
        case "copy-image-facebook":
          if (!blob) return;
          result = await copyImageAndOpenFacebook(blob);
          break;
        case "copy-caption":
          result = await copyCaption(caption);
          break;
        case "send-to-phone":
          await sendToPhone();
          return;
      }

      if (result.status !== "canceled" && result.message) {
        statusMessage = result.message;
      }
    } finally {
      busyDestination = null;
    }
  }

  function closeQrView(): void {
    qrDataUrl = null;
    qrError = "";
  }
</script>

<Drawer
  bind:isOpen={drawerOpen}
  placement="bottom"
  ariaLabel="Share this sequence"
  class="post-share-drawer"
  onOpenChange={(open) => {
    if (!open && isOpen) onClose();
  }}
>
  <div class="sheet">
    <header class="sheet-header">
      <h2>Share {word}</h2>
    </header>

    <!-- Two short labels: the control sizes to them, it does not span the
         sheet (.claude/rules/visual-verification-mandatory.md, wide-control). -->
    <div class="artifact-picker">
      <SegmentedControl
        options={[
          { value: "card", label: "Card" },
          { value: "video", label: "Video" },
        ]}
        value={artifact}
        onchange={handleArtifactChange}
        ariaLabel="What to share"
        semantics="radiogroup"
      />
    </div>

    <div class="stage">
      {#if qrDataUrl}
        <div class="qr-view">
          <img src={qrDataUrl} alt="QR code linking to the uploaded file" />
          <p>Scan with your phone, save it, then post from Instagram.</p>
          <button type="button" class="secondary" onclick={closeQrView}>
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
            Back
          </button>
        </div>
      {:else if artifact === "card" && cardPreviewUrl}
        <img class="preview" src={cardPreviewUrl} alt="Sequence card preview" />
      {:else if artifact === "video" && videoBlobUrl}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video class="preview" src={videoBlobUrl} autoplay loop muted playsinline
        ></video>
      {:else}
        <div class="stage-pending" role="status">
          <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
          <span>{progressLabel || "Preparing…"}</span>
        </div>
      {/if}
    </div>

    {#if !qrDataUrl}
      <div class="caption-block">
        <div class="caption-head">
          <label for="post-share-caption">Caption</label>
          <button
            type="button"
            class="link-action"
            onclick={saveCurrentAsPreset}
            disabled={!caption.trim()}
          >
            Save as preset
          </button>
        </div>

        <div class="presets">
          {#each presets as preset (preset.id)}
            <FilterChipBase
              label={preset.label}
              mode="action"
              size="sm"
              onclick={() => applyPreset(preset.text)}
            />
          {/each}
        </div>

        <textarea
          id="post-share-caption"
          bind:value={caption}
          oninput={() => (captionTouched = true)}
          rows="3"
          placeholder="Write a caption…"
        ></textarea>
      </div>

      <div class="destinations">
        {#each destinations as destination (destination.id)}
          <button
            type="button"
            class="destination"
            class:primary={destination.primary}
            disabled={(destination.id !== "copy-caption" && !activeBlob) ||
              busyDestination !== null ||
              qrPending}
            onclick={() => runDestination(destination.id)}
          >
            <i
              class={busyDestination === destination.id || (destination.id === "send-to-phone" && qrPending)
                ? "fa-solid fa-circle-notch fa-spin"
                : destination.icon}
              aria-hidden="true"
            ></i>
            <span class="destination-text">
              <span class="destination-label">{destination.label}</span>
              {#if destination.hint}
                <span class="destination-hint">{destination.hint}</span>
              {/if}
            </span>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Reserved row: status text appears and disappears without moving the
         sheet's contents. -->
    <p class="status" role="status" class:visible={!!(statusMessage || qrError)}>
      {qrError || statusMessage || " "}
    </p>
  </div>
</Drawer>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    width: min(34rem, 100%);
    margin: 0 auto;
  }


  .artifact-picker {
    width: min(16rem, 100%);
  }

  .sheet-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  /* Fixed box: the preview, the pending spinner and the QR view all live here,
     so swapping between them never resizes the sheet. */
  .stage {
    display: grid;
    place-items: center;
    min-height: 16rem;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.06));
  }

  .preview {
    max-width: 100%;
    max-height: 14.5rem;
    object-fit: contain;
    border-radius: 0.5rem;
  }

  .stage-pending {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: 0.9375rem;
  }

  .qr-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
  }

  .qr-view img {
    width: 11rem;
    height: 11rem;
    border-radius: 0.5rem;
    background: #fff;
    padding: 0.5rem;
  }

  .qr-view p {
    margin: 0;
    max-width: 22rem;
    font-size: 0.875rem;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
  }

  .caption-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .caption-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .caption-head label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  textarea {
    width: 100%;
    resize: vertical;
    padding: 0.625rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.14));
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: 0.9375rem;
    line-height: 1.4;
  }

  textarea:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 1px;
  }

  .destinations {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Buttons, never text links — every clickable here reads as clickable
     (.claude/rules/clickables-look-like-buttons.md). */
  .destination {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.75rem;
    padding: 0.625rem 0.875rem;
    border-radius: 0.625rem;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.14));
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .destination:hover:not(:disabled) {
    background: var(--theme-surface-3, rgba(255, 255, 255, 0.12));
    border-color: var(--theme-accent, #6366f1);
  }

  .destination.primary {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-on-accent, #fff);
  }

  .destination.primary:hover:not(:disabled) {
    filter: brightness(1.08);
    background: var(--theme-accent, #6366f1);
  }

  .destination:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .destination i {
    width: 1.25rem;
    text-align: center;
  }

  .destination-text {
    display: flex;
    flex-direction: column;
  }

  .destination-label {
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .destination-hint {
    font-size: 0.8125rem;
    opacity: 0.75;
  }

  .link-action {
    background: none;
    border: none;
    padding: 0.25rem;
    color: var(--theme-accent, #6366f1);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .link-action:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .secondary {
    min-height: 2.75rem;
    padding: 0.5rem 1rem;
    border-radius: 0.625rem;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.14));
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
    font: inherit;
    cursor: pointer;
  }

  /* Always occupies its row — appearing text must not push the sheet. */
  .status {
    margin: 0;
    min-height: 1.25rem;
    font-size: 0.875rem;
    text-align: center;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    visibility: hidden;
  }

  .status.visible {
    visibility: visible;
  }

  @media (prefers-reduced-motion: reduce) {
    .destination {
      transition: none;
    }
  }
  /* Wide and short (folded Z Fold landscape, small laptops in a browser with
     chrome): stacked, the 16rem preview pushes every destination below the
     fold. Put the preview beside the controls and use the wide axis instead. */
  @media (min-width: 700px) and (max-height: 620px) {
    .sheet {
      display: grid;
      width: min(52rem, 100%);
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
      grid-template-areas:
        "stage header"
        "stage picker"
        "stage caption"
        "stage destinations"
        "stage status";
      grid-template-rows: auto auto auto 1fr auto;
      align-content: start;
      column-gap: 1.25rem;
      row-gap: 0.375rem;
      padding: 0.5rem 1rem;
    }

    .status {
      min-height: 0.875rem;
      font-size: 0.75rem;
    }

    .caption-block {
      gap: 0.375rem;
    }

    .presets {
      gap: 0.25rem;
    }

    .sheet-header {
      grid-area: header;
    }
    .artifact-picker {
      grid-area: picker;
    }
    .stage {
      grid-area: stage;
      min-height: 0;
      align-self: stretch;
    }
    .caption-block {
      grid-area: caption;
    }
    /* Two rows of two: four stacked rows do not fit 412px of height. */
    .destinations {
      grid-area: destinations;
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-content: start;
      gap: 0.5rem;
    }
    .status {
      grid-area: status;
    }

    .preview {
      max-height: 100%;
    }

    textarea {
      height: 3.25rem;
      min-height: 3.25rem;
    }

    /* The labels carry the meaning here; the hints are what push the last row
       off a 412px-tall screen. */
    .destination-hint {
      display: none;
    }
  }

  /* A bottom drawer on a 4K panel reads as a phone strip unless the sheet
     grows with the canvas (.claude/rules/4k-native-layout.md, 1680 seam). */
  @media (min-width: 1680px) {
    .sheet {
      width: min(42rem, 100%);
      gap: 1.25rem;
      padding: 1.5rem;
    }

    .sheet-header h2 {
      font-size: 1.5rem;
    }

    .stage {
      min-height: 20rem;
    }

    .preview {
      max-height: 18.5rem;
    }

    .destination-label,
    textarea {
      font-size: 1.0625rem;
    }

    .destination-hint,
    .caption-head label,
    .link-action,
    .status {
      font-size: 0.9375rem;
    }
  }

  @media (min-width: 2600px) {
    .sheet {
      width: min(52rem, 100%);
      gap: 1.5rem;
      padding: 2rem;
    }

    .sheet-header h2 {
      font-size: 1.875rem;
    }

    .stage {
      min-height: 26rem;
    }

    .preview {
      max-height: 24.5rem;
    }

    .qr-view img {
      width: 15rem;
      height: 15rem;
    }

    .destination {
      min-height: 3.5rem;
      padding: 0.875rem 1.125rem;
    }

    .destination-label,
    textarea {
      font-size: 1.25rem;
    }

    .destination-hint,
    .caption-head label,
    .link-action,
    .status {
      font-size: 1.0625rem;
    }

    .destination i {
      width: 1.75rem;
      font-size: 1.25rem;
    }
  }

</style>
