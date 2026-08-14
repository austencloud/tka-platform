<script lang="ts">
  /**
   * SequenceMessageCard
   *
   * Renders a playable sequence preview within a message.
   * Opens the canonical full viewer through a separate action.
   * Shows deleted state if the sequence no longer exists.
   */

  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import type { MessageAttachment } from "$lib/shared/messaging/domain/models/message-models";
  import { goto } from "$app/navigation";
  import { inboxState } from "../../state/inbox-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import SequenceMessagePreview from "./SequenceMessagePreview.svelte";
  import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { getShortCodeShareMessage } from "$lib/shared/qr/domain/short-code-error";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import { decodeLegacySequenceAttachment } from "../../domain/message-attachment-builders";
  import { buildSequenceSharePayload } from "../../domain/build-sequence-share-payload";
  import type { SequenceSharePayload } from "../../domain/models/sequence-share-payload";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    attachment: MessageAttachment;
    isOwn: boolean;
  }

  let { attachment, isOwn }: Props = $props();

  // We don't pre-check if sequence exists - sequences can be in publicSequences OR user libraries
  // Instead we trust the attachment metadata and handle "not found" at navigation time
  let isDeleted = $state(false);
  let isChecking = $state(false);
  let resolvedPreview = $state<SequenceSharePayload | null>(null);

  const PREVIEW_RESOLVE_RETRY_DELAY_MS = 900;

  // Haptic feedback service
  let hapticService: HapticFeedback | undefined;

  // Extract sequence metadata
  const sequenceId = $derived(attachment.metadata?.sequenceId);
  const sequenceShortCode = $derived(attachment.metadata?.sequenceShortCode);
  const attachedRoute = $derived(
    attachment.url?.startsWith("/q/") ||
      attachment.url?.startsWith("/sequence/")
      ? attachment.url
      : null
  );
  const shortCodeRoute = $derived(
    attachedRoute?.startsWith("/q/")
      ? attachedRoute
      : sequenceShortCode && !attachedRoute
        ? `/q/${encodeURIComponent(sequenceShortCode)}`
        : null
  );
  const sequenceWord = $derived(
    simplifyRepeatedWord(
      resolvedPreview?.sequenceWord ||
        attachment.metadata?.sequenceWord ||
        attachment.metadata?.title ||
        "Sequence"
    )
  );
  const sequenceGlyphWord = $derived(
    attachment.metadata?.sequenceWord ||
      (resolvedPreview?.sequenceCloudWord
        ? resolvedPreview.sequenceWord
        : undefined)
  );
  const sequenceName = $derived(
    resolvedPreview?.sequenceName || attachment.metadata?.sequenceName
      ? simplifyRepeatedWord(
          resolvedPreview?.sequenceName ||
            attachment.metadata?.sequenceName ||
            ""
        )
      : undefined
  );
  // Only durable URLs become posters. Guessing storage filenames generated a
  // stream of 404s for valid links such as YR0L; the live player now resolves
  // the sequence independently and the poster falls back to a local word mark.
  const posterUrl = $derived(
    resolvedPreview?.sequenceThumbnail ||
      attachment.metadata?.sequenceThumbnail ||
      attachment.thumbnailUrl ||
      null
  );
  const authorName = $derived(
    resolvedPreview?.sequenceAuthor || attachment.metadata?.sequenceAuthor
  );
  const stepCount = $derived(
    resolvedPreview?.sequenceStepCount || attachment.metadata?.sequenceStepCount
  );

  // Initialize haptic service
  onMount(() => {
    hapticService = getHapticFeedback();
  });

  async function loadPreviewSequence(): Promise<SequenceData | null> {
    let payload = await resolvePreviewMetadata();
    if (!payload) {
      // Inbox messages can render before the authenticated Firestore stream is
      // ready. One delayed retry keeps a valid shared link from flashing a
      // permanent unavailable state during that startup window.
      await new Promise((resolve) =>
        setTimeout(resolve, PREVIEW_RESOLVE_RETRY_DELAY_MS)
      );
      payload = await resolvePreviewMetadata();
    }
    if (!payload) return null;
    resolvedPreview = payload;
    return payload.sequence;
  }

  async function resolvePreviewMetadata(): Promise<SequenceSharePayload | null> {
    try {
      const embeddedSequence = decodeLegacySequenceAttachment(attachment);
      if (embeddedSequence) return buildSequenceSharePayload(embeddedSequence);
    } catch (caught) {
      console.debug(
        "[SequenceMessageCard] Embedded preview could not be decoded:",
        caught
      );
    }

    const identifier = sequenceShortCode || sequenceId;
    if (!identifier) return null;

    let sequence: SequenceData | null = null;
    try {
      sequence = await getShortCodeManager().resolveShortCode(identifier);
    } catch (caught) {
      console.debug(
        "[SequenceMessageCard] Short-link preview lookup was unavailable:",
        caught
      );
    }

    if (!sequence && !sequenceShortCode) {
      try {
        const { loadByIdentifier } =
          await import("$lib/shared/sequence-viewer/services/sequence-data-provider");
        sequence = await loadByIdentifier(identifier);
      } catch (caught) {
        console.debug(
          "[SequenceMessageCard] Sequence preview lookup was unavailable:",
          caught
        );
      }
    }

    return sequence ? buildSequenceSharePayload(sequence) : null;
  }

  async function resolveSequenceRoute(): Promise<string | null> {
    if (shortCodeRoute) return shortCodeRoute;

    const legacySequence = decodeLegacySequenceAttachment(attachment);
    if (legacySequence) {
      const { code } = await getShortCodeManager().createShortCode(
        legacySequence,
        { embedSequenceData: true }
      );
      return `/q/${encodeURIComponent(code)}`;
    }

    if (attachedRoute) return attachedRoute;

    return sequenceId ? `/sequence/${encodeURIComponent(sequenceId)}` : null;
  }

  async function handleClick() {
    if (isDeleted || isChecking) return;

    hapticService?.trigger("selection");
    isChecking = true;

    try {
      const sequenceRoute = await resolveSequenceRoute();
      if (!sequenceRoute) {
        isDeleted = true;
        return;
      }

      inboxState.close();
      await goto(sequenceRoute);
    } catch (caught) {
      const failure =
        caught instanceof Error ? caught : new Error(String(caught));
      console.error("[SequenceMessageCard] Failed to open sequence:", failure);
      getErrorHandler().showUserError({
        message:
          getShortCodeShareMessage(caught) ??
          "This sequence could not be opened.",
        technicalDetails: failure.message,
        error: failure,
        severity: "error",
        context: {
          module: "inbox",
          tab: "messages",
          action: "openSequenceAttachment",
        },
      });
    } finally {
      isChecking = false;
    }
  }
</script>

<div class="sequence-card" class:own={isOwn} class:deleted={isDeleted}>
  {#if isDeleted}
    <!-- Deleted state -->
    <div class="card-header">
      <div class="deleted-badge">
        <i class="fas fa-trash-alt" aria-hidden="true"></i>
        <span>Unavailable</span>
      </div>
    </div>
    <h4 class="sequence-title deleted-title">{sequenceWord}</h4>
    <p class="deleted-notice">This sequence is no longer available</p>
  {:else}
    <div class="card-content">
      <SequenceMessagePreview
        word={sequenceWord}
        {posterUrl}
        loadSequence={loadPreviewSequence}
      />

      <div class="card-info">
        <h4 class="sequence-title">
          {#if sequenceGlyphWord}
            <TKAWordGlyph word={sequenceGlyphWord} height={16} darkMode />
          {:else}
            {sequenceWord}
          {/if}
        </h4>

        {#if sequenceName && sequenceName !== sequenceWord}
          <p class="sequence-name">{sequenceName}</p>
        {/if}

        <div class="meta-row">
          {#if authorName}
            <span class="author">
              <i class="fas fa-user" aria-hidden="true"></i>
              {authorName}
            </span>
          {/if}
          {#if stepCount}
            <span class="steps">
              <i class="fas fa-music" aria-hidden="true"></i>
              {stepCount} steps
            </span>
          {/if}
        </div>
      </div>

      <div class="card-footer">
        <button
          type="button"
          class="open-sequence"
          onclick={handleClick}
          disabled={isChecking}
        >
          {#if isChecking}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            <span>Opening</span>
          {:else}
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            <span>Open sequence</span>
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .sequence-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    text-align: left;
    width: 100%;
    min-width: 0;
    max-width: 20rem;
  }

  .sequence-card.own {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  /* Deleted state */
  .sequence-card.deleted {
    opacity: 0.6;
    border-style: dashed;
  }

  .deleted-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    color: var(--semantic-error);
  }

  .deleted-badge i {
    font-size: var(--font-size-compact);
  }

  .deleted-title {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .deleted-notice {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    font-style: italic;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sequence-title {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
    line-height: 1.3;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .own .sequence-title {
    color: white;
  }

  .sequence-name {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    line-height: 1.3;
  }

  .own .sequence-name {
    color: rgba(255, 255, 255, 0.8);
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
  }

  .author,
  .steps {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .own .author,
  .own .steps {
    color: rgba(255, 255, 255, 0.7);
  }

  .author i,
  .steps i {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.8;
  }

  .card-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke);
  }

  .open-sequence {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: var(--touch-target-min, 44px);
    padding: 0.5rem 0.875rem;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 999px;
    color: var(--theme-text, #ffffff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition:
      background var(--duration-fast, 120ms) ease,
      border-color var(--duration-fast, 120ms) ease;
  }

  .open-sequence i {
    font-size: var(--font-size-compact);
  }

  .open-sequence:hover:not(:disabled) {
    border-color: var(--theme-accent, var(--semantic-info));
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.14));
  }

  .open-sequence:focus-visible {
    outline: 2px solid var(--theme-accent, var(--semantic-info));
    outline-offset: 2px;
  }

  .open-sequence:disabled {
    cursor: wait;
    opacity: 0.72;
  }

  @media (prefers-reduced-motion: reduce) {
    .open-sequence {
      transition: none;
    }
  }
</style>
