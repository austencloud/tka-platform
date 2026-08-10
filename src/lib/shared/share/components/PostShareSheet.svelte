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

  // One filled call-to-action, the rest as compact tiles — the hierarchy an OS
  // share sheet uses, so the obvious move reads as obvious.
  const primaryDestination = $derived(
    destinations.find((destination) => destination.primary) ?? null
  );
  const secondaryDestinations = $derived(
    destinations.filter((destination) => !destination.primary)
  );

  const previewReady = $derived(
    !qrDataUrl &&
      ((artifact === "card" && !!cardPreviewUrl) ||
        (artifact === "video" && !!videoBlobUrl))
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
  focusContainerOnOpen={true}
  onOpenChange={(open) => {
    if (!open && isOpen) onClose();
  }}
>
  <div class="sheet">
    <header class="sheet-header">
      <div class="title-group">
        <span class="eyebrow">Share</span>
        <h2>{word}</h2>
      </div>
      <button
        type="button"
        class="close"
        onclick={onClose}
        aria-label="Close share sheet"
      >
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </header>

    <!-- A compact glass pill, not a full-width bar: two short labels size to
         their labels (.claude/rules/visual-verification-mandatory.md). It sits
         above the artwork rather than on it, because the card preview IS the
         content and an overlay would cover a pictograph. -->
    {#if !qrDataUrl}
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
          size="sm"
          color="accent"
        />
      </div>
    {/if}

    <div class="stage" class:showing-media={!!previewReady}>
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
        <!-- One scrolling chip row instead of a label row plus a chip row: the
             presets and "save this one" are the same gesture family, and the
             placeholder already names the field. -->
        <label class="visually-hidden" for="post-share-caption">Caption</label>

        <div class="presets">
          {#each presets as preset (preset.id)}
            <FilterChipBase
              label={preset.label}
              mode="action"
              size="sm"
              onclick={() => applyPreset(preset.text)}
            />
          {/each}
          <FilterChipBase
            label="Save current"
            icon="fa-solid fa-plus"
            mode="action"
            size="sm"
            disabled={!caption.trim()}
            onclick={saveCurrentAsPreset}
          />
        </div>

        <textarea
          id="post-share-caption"
          bind:value={caption}
          oninput={() => (captionTouched = true)}
          rows="3"
          placeholder="Write a caption…"
        ></textarea>
      </div>

      {#if primaryDestination}
        <button
          type="button"
          class="cta"
          disabled={!activeBlob || busyDestination !== null || qrPending}
          onclick={() => runDestination(primaryDestination.id)}
        >
          <i
            class={busyDestination === primaryDestination.id || qrPending
              ? "fa-solid fa-circle-notch fa-spin"
              : primaryDestination.icon}
            aria-hidden="true"
          ></i>
          <span class="cta-text">
            <span class="cta-label">{primaryDestination.label}</span>
            {#if primaryDestination.hint}
              <span class="cta-hint">{primaryDestination.hint}</span>
            {/if}
          </span>
        </button>
      {/if}

      {#if secondaryDestinations.length}
        <div class="tiles">
          {#each secondaryDestinations as destination (destination.id)}
            <button
              type="button"
              class="tile"
              aria-label={destination.label}
              title={destination.hint
                ? `${destination.label} · ${destination.hint}`
                : destination.label}
              disabled={(destination.id !== "copy-caption" && !activeBlob) ||
                busyDestination !== null ||
                qrPending}
              onclick={() => runDestination(destination.id)}
            >
              <span class="tile-icon">
                <i
                  class={busyDestination === destination.id
                    ? "fa-solid fa-circle-notch fa-spin"
                    : destination.icon}
                  aria-hidden="true"
                ></i>
              </span>
              <span class="tile-label">{destination.short}</span>
            </button>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Reserved row: status text appears and disappears without moving the
         sheet's contents. -->
    <p class="status" role="status" class:visible={!!(statusMessage || qrError)}>
      {qrError || statusMessage || " "}
    </p>
  </div>
</Drawer>

<style>
  /* Skin the shared Drawer rather than re-declaring a sheet: glass over the
     app, a hairline top edge, and a shadow that lifts it off the page. */
  :global(.post-share-drawer) {
    --sheet-bg: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-surface, #14141c) 92%, transparent) 0%,
      color-mix(in srgb, var(--theme-surface, #14141c) 98%, transparent) 100%
    );
    --sheet-filter: blur(28px) saturate(160%);
    --sheet-shadow: 0 -1.5rem 4rem rgba(0, 0, 0, 0.55);
    --sheet-border-radius-top-left: 1.5rem;
    --sheet-border-radius-top-right: 1.5rem;
  }

  /* Phone portrait is the tight case, so it is the base: everything from the
     title to the tile row has to fit above the fold at 375x667. Taller
     viewports get the roomier version back in the min-height tier below. */
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1rem;
    width: min(34rem, 100%);
    margin: 0 auto;
  }

  .sheet-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .title-group {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .eyebrow {
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.55));
  }

  .sheet-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 650;
    line-height: 1.15;
    letter-spacing: -0.01em;
    color: var(--theme-text, #fff);
    overflow-wrap: anywhere;
  }

  .close {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    /* Visual size is 36px; the padding carries the hit area to the 44px floor. */
    margin: -0.25rem -0.25rem 0 0;
    padding: 0.25rem;
    box-sizing: content-box;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.06));
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: 1rem;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      transform 0.12s ease;
  }

  .close:hover {
    background: var(--theme-surface-3, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, #fff);
  }

  .close:active {
    transform: scale(0.94);
  }

  /* Fixed box: the preview, the pending spinner and the QR view all live here,
     so swapping between them never resizes the sheet. */
  .stage {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 12rem;
    padding: 0.75rem;
    border-radius: 1.125rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background:
      radial-gradient(
        120% 100% at 50% 0%,
        rgba(255, 255, 255, 0.05) 0%,
        transparent 70%
      ),
      var(--theme-surface-2, rgba(255, 255, 255, 0.04));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }

  /* Capped in rem, not %: the stage row is content-sized, so a percentage here
     resolves against an indefinite height and stops capping anything. Each
     cap is the tier's stage min-height minus its padding. */
  .preview {
    max-width: 100%;
    max-height: 10.5rem;
    object-fit: contain;
    border-radius: 0.75rem;
    box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.45);
  }

  .stage-pending {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 0.9375rem;
  }

  /* One glass pill, centered above the artwork. The control itself IS the
     pill — nesting a 999px wrapper around its 8px corners left a visible
     rectangle inside the capsule. Width is its labels', never the sheet's
     (.claude/rules/visual-verification-mandatory.md). */
  .artifact-picker {
    align-self: center;
    max-width: 100%;
  }

  .artifact-picker :global(.segmented-control) {
    width: auto;
    border-radius: 999px;
    background: rgba(10, 10, 14, 0.5);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
  }

  .artifact-picker :global(.indicator) {
    border-radius: 999px;
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
    border-radius: 0.75rem;
    background: #fff;
    padding: 0.5rem;
    box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.45);
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

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Scrolls rather than wraps: a second chip line is 44px the phone doesn't
     have, and a row that grows by a line is layout shift. */
  .presets {
    display: flex;
    gap: 0.375rem;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 0.125rem;
    /* Bleed to the sheet edges so a scrolled row reads as scrollable. */
    margin-inline: -1rem;
    padding-inline: 1rem;
  }

  .presets::-webkit-scrollbar {
    display: none;
  }

  .presets > :global(*) {
    flex: 0 0 auto;
  }

  textarea {
    width: 100%;
    resize: vertical;
    padding: 0.75rem 0.875rem;
    border-radius: 0.875rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: 0.9375rem;
    line-height: 1.45;
    height: 4rem;
    min-height: 4rem;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  textarea::placeholder {
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
  }

  textarea:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent, #6366f1) 28%, transparent);
  }

  /* One filled action. Buttons, never text links: every clickable here reads as
     clickable (.claude/rules/clickables-look-like-buttons.md). */
  .cta {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    width: 100%;
    min-height: 3rem;
    padding: 0.75rem 1.125rem;
    border: none;
    border-radius: 1rem;
    background: linear-gradient(
      135deg,
      var(--theme-accent, #6366f1) 0%,
      var(--theme-accent-strong, #8b5cf6) 100%
    );
    color: var(--theme-on-accent, #fff);
    font: inherit;
    text-align: left;
    cursor: pointer;
    box-shadow: 0 0.625rem 1.5rem
      color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent);
    transition:
      transform 0.12s ease,
      box-shadow 0.15s ease,
      filter 0.15s ease;
  }

  .cta i {
    font-size: 1.125rem;
    width: 1.5rem;
    text-align: center;
  }

  .cta-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .cta-label {
    font-size: 1rem;
    font-weight: 600;
  }

  .cta-hint {
    font-size: 0.8125rem;
    opacity: 0.8;
  }

  .cta:hover:not(:disabled) {
    filter: brightness(1.06);
    box-shadow: 0 0.75rem 2rem
      color-mix(in srgb, var(--theme-accent, #6366f1) 45%, transparent);
  }

  .cta:active:not(:disabled) {
    transform: scale(0.985);
  }

  .cta:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* Equal columns: the row must not reflow as the destination set changes with
     artifact or device (.claude/rules/no-layout-shift.md). */
  .tiles {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 0.5rem;
  }

  .tile {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 0.4375rem;
    min-height: 2.75rem;
    padding: 0.5rem 0.375rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 1rem;
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font: inherit;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      transform 0.12s ease;
  }

  .tile-icon {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 999px;
    background: var(--theme-surface-3, rgba(255, 255, 255, 0.09));
    color: var(--theme-text, #fff);
    font-size: 0.9375rem;
  }

  .tile-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.72));
    white-space: nowrap;
  }

  .tile:hover:not(:disabled) {
    background: var(--theme-surface-3, rgba(255, 255, 255, 0.09));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
  }

  .tile:active:not(:disabled) {
    transform: scale(0.96);
  }

  .tile:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding: 0.5rem 1.125rem;
    border-radius: 999px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
    font: inherit;
    cursor: pointer;
  }

  .secondary:hover {
    background: var(--theme-surface-3, rgba(255, 255, 255, 0.12));
  }

  /* Always occupies its row: appearing text must not push the sheet. */
  .status {
    margin: 0;
    min-height: 1.25rem;
    text-align: center;
    font-size: 0.8125rem;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    visibility: hidden;
  }

  .status.visible {
    visibility: visible;
  }

  /* A phone in portrait has to fit the whole sheet above the fold, so the stage
     stays small there and only claims its full height once the viewport can
     afford it. */
  @media (min-height: 800px) {
    .sheet {
      gap: 1rem;
      padding: 1.25rem;
    }

    .sheet-header h2 {
      font-size: 1.5rem;
    }

    .stage {
      min-height: 16rem;
    }

    .preview {
      max-height: 14.5rem;
    }

    textarea {
      height: 5.5rem;
      min-height: 5.5rem;
    }

    .cta {
      min-height: 3.5rem;
    }

    .tile {
      flex-direction: column;
      gap: 0.4375rem;
      padding: 0.75rem 0.375rem;
    }

    .tile-icon {
      width: 2.75rem;
      height: 2.75rem;
      font-size: 1.0625rem;
    }
  }

  /* Wide and short (folded Z Fold landscape, small laptops in a browser with
     chrome): stacked, the 16rem preview pushes every action below the fold.
     Put the preview beside the controls and use the wide axis instead. */
  @media (min-width: 700px) and (max-height: 620px) {
    .sheet {
      display: grid;
      width: min(52rem, 100%);
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
      grid-template-areas:
        "stage header"
        "stage picker"
        "stage caption"
        "stage cta"
        "stage tiles"
        "stage status";
      grid-template-rows: auto auto auto auto auto 1fr;
      align-content: start;
      column-gap: 1.25rem;
      row-gap: 0.5rem;
      padding: 0.25rem 1rem 0.5rem;
    }

    .sheet-header {
      grid-area: header;
    }
    .stage {
      grid-area: stage;
      min-height: 0;
      align-self: stretch;
    }
    .artifact-picker {
      grid-area: picker;
      justify-self: start;
    }
    .caption-block {
      grid-area: caption;
    }
    .cta {
      grid-area: cta;
      min-height: 3rem;
    }
    .tiles {
      grid-area: tiles;
      align-self: start;
    }
    .status {
      grid-area: status;
      min-height: 0.875rem;
      font-size: 0.75rem;
    }

    .sheet-header h2 {
      font-size: 1.25rem;
    }

    .preview {
      max-height: 100%;
    }

    textarea {
      height: 3.25rem;
      min-height: 3.25rem;
    }
  }

  /* A bottom drawer on a 4K panel reads as a phone strip unless the sheet grows
     with the canvas (.claude/rules/4k-native-layout.md, 1680 seam). */
  @media (min-width: 1680px) {
    .sheet {
      width: min(42rem, 100%);
      gap: 1.25rem;
      padding: 1.5rem;
    }

    .sheet-header h2 {
      font-size: 1.875rem;
    }

    .stage {
      min-height: 20rem;
    }

    .preview {
      max-height: 18.5rem;
    }

    .cta-label,
    textarea {
      font-size: 1.0625rem;
    }

    .cta-hint,
    .tile-label,
    .status {
      font-size: 0.9375rem;
    }

    .artifact-picker :global(.segment),
    .presets :global(.chip-label) {
      font-size: 0.9375rem;
    }
  }

  /* 2350, not 2600: 4K at 150% scaling lands here, and it is the tier a single
     big-screen seam always misses (.claude/rules/4k-native-layout.md). */
  @media (min-width: 2350px) {
    .sheet {
      width: min(52rem, 100%);
      gap: 1.5rem;
      padding: 2rem;
    }

    .sheet-header h2 {
      font-size: 2.25rem;
    }

    .eyebrow {
      font-size: 0.8125rem;
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

    .cta {
      min-height: 4.5rem;
      border-radius: 1.25rem;
    }

    .cta i {
      font-size: 1.5rem;
      width: 2rem;
    }

    .cta-label,
    textarea {
      font-size: 1.3125rem;
    }

    .cta-hint,
    .tile-label,
    .status {
      font-size: 1.0625rem;
    }

    .tile-icon {
      width: 3rem;
      height: 3rem;
      font-size: 1.25rem;
    }

    .close {
      width: 3rem;
      height: 3rem;
      font-size: 1.375rem;
    }

    .artifact-picker :global(.segment),
    .presets :global(.chip-label) {
      font-size: 1.125rem;
    }
  }

  /* 4K at 100%, or a TV across the room: nothing is scaling for you, so type
     and elements step again rather than the band alone. */
  @media (min-width: 3200px) {
    .sheet {
      width: min(64rem, 100%);
      gap: 1.75rem;
      padding: 2.5rem;
    }

    .sheet-header h2 {
      font-size: 2.75rem;
    }

    .eyebrow {
      font-size: 1rem;
    }

    .stage {
      min-height: 32rem;
    }

    .preview {
      max-height: 30rem;
    }

    .qr-view img {
      width: 19rem;
      height: 19rem;
    }

    .cta {
      min-height: 5.5rem;
      border-radius: 1.5rem;
    }

    .cta i {
      font-size: 1.875rem;
      width: 2.5rem;
    }

    .cta-label,
    textarea {
      font-size: 1.625rem;
    }

    .cta-hint,
    .tile-label,
    .status {
      font-size: 1.3125rem;
    }

    .tile-icon {
      width: 3.75rem;
      height: 3.75rem;
      font-size: 1.5rem;
    }

    .close {
      width: 3.75rem;
      height: 3.75rem;
      font-size: 1.75rem;
    }

    .artifact-picker :global(.segment),
    .presets :global(.chip-label) {
      font-size: 1.375rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cta,
    .tile,
    .close,
    textarea {
      transition: none;
    }

    .cta:active:not(:disabled),
    .tile:active:not(:disabled),
    .close:active {
      transform: none;
    }
  }
</style>
