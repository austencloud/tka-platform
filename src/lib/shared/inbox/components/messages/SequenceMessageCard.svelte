<script lang="ts">
  /**
   * SequenceMessageCard
   *
   * Renders a sequence as a tappable card within a message.
   * Links directly to the sequence in Browse for viewing.
   * Shows deleted state if the sequence no longer exists.
   */

  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import type { MessageAttachment } from "$lib/shared/messaging/domain/models/message-models";
  import { goto } from "$app/navigation";
  import { inboxState } from "../../state/inbox-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { buildThumbnailUrl } from "../../state/send-sequence-state.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { getShortCodeShareMessage } from "$lib/shared/qr/domain/short-code-error";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import { decodeLegacySequenceAttachment } from "../../domain/message-attachment-builders";

  interface Props {
    attachment: MessageAttachment;
    isOwn: boolean;
  }

  let { attachment, isOwn }: Props = $props();

  // We don't pre-check if sequence exists - sequences can be in publicSequences OR user libraries
  // Instead we trust the attachment metadata and handle "not found" at navigation time
  let isDeleted = $state(false);
  let isChecking = $state(false);

  // Haptic feedback service
  let hapticService: HapticFeedback | undefined;

  // Extract sequence metadata
  const sequenceId = $derived(attachment.metadata?.sequenceId);
  const sequenceShortCode = $derived(attachment.metadata?.sequenceShortCode);
  const shortCodeRoute = $derived(
    attachment.url?.startsWith("/q/")
      ? attachment.url
      : sequenceShortCode
        ? `/q/${encodeURIComponent(sequenceShortCode)}`
        : null
  );
  const sequenceWord = $derived(
    attachment.metadata?.sequenceWord ||
      attachment.metadata?.title ||
      "Sequence"
  );
  const sequenceName = $derived(attachment.metadata?.sequenceName);
  // sequenceCloudWord is the raw sequence.word used as the cloud storage filename.
  // New messages include this explicitly. Old messages don't have it, so we fall
  // back to sequenceName (which is seq.name) then sequenceWord (display name).
  const sequenceCloudWord = $derived(attachment.metadata?.sequenceCloudWord);

  // Build an ordered list of thumbnail URLs to try. The <img> onerror handler
  // cycles through these so old messages (which may have mismatched keys) still
  // have a chance to show a thumbnail.
  const thumbnailCandidates: string[] = $derived.by(() => {
    const candidates: string[] = [];
    const seen = new Set<string>();

    function add(word: string | undefined | null) {
      if (!word || word === "Sequence") return;
      const url = buildThumbnailUrl(String(word), "staff", false);
      if (!seen.has(url)) {
        seen.add(url);
        candidates.push(url);
      }
    }

    // Best: explicit cloud word (new messages)
    add(sequenceCloudWord);
    // Next: sequenceWord - for public sequences this is usually the raw word
    // (displayName and intendedWord are typically undefined)
    add(sequenceWord);
    // Last: sequenceName (seq.name) - can have prefixes like "Circular" that
    // don't match cloud storage, so try this after the raw word
    add(sequenceName);

    // Also try whatever was stored at send time (could be a different format)
    const stored =
      attachment.metadata?.sequenceThumbnail || attachment.thumbnailUrl;
    if (stored && !seen.has(stored)) {
      candidates.push(stored);
    }

    return candidates;
  });

  // Index into the candidates list - incremented by onerror
  let candidateIndex = $state(0);
  const thumbnailUrl = $derived(thumbnailCandidates[candidateIndex] ?? null);
  const authorName = $derived(attachment.metadata?.sequenceAuthor);
  const stepCount = $derived(attachment.metadata?.sequenceStepCount);

  // Initialize haptic service
  onMount(() => {
    hapticService = getHapticFeedback();
  });

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

<div
  class="sequence-card"
  class:own={isOwn}
  class:deleted={isDeleted}
  class:clickable={!isDeleted && !isChecking}
>
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
    <!-- Normal state -->
    <button
      class="card-content"
      onclick={handleClick}
      type="button"
      disabled={isChecking}
    >
      {#if thumbnailUrl}
        <div class="thumbnail-container">
          <img
            src={thumbnailUrl}
            alt={sequenceWord}
            class="thumbnail"
            loading="lazy"
            onerror={(e) => {
              console.warn(
                `[SequenceMessageCard] thumbnail failed (${candidateIndex + 1}/${thumbnailCandidates.length}):`,
                thumbnailUrl
              );
              // Try the next candidate URL before giving up
              if (candidateIndex < thumbnailCandidates.length - 1) {
                candidateIndex++;
              } else {
                console.warn(
                  `[SequenceMessageCard] all candidates exhausted for "${sequenceWord}". metadata:`,
                  attachment.metadata
                );
                const parent = (e.currentTarget as HTMLElement).parentElement;
                if (parent) parent.style.display = "none";
              }
            }}
          />
        </div>
      {/if}

      <div class="card-info">
        <h4 class="sequence-title">
          {#if attachment.metadata?.sequenceWord}
            <TKAWordGlyph
              word={attachment.metadata.sequenceWord}
              height={16}
              darkMode
            />
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
        {#if isChecking}
          <span class="checking-hint">
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Checking sequence...
          </span>
        {:else}
          <span class="tap-hint">
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            Tap to view
          </span>
        {/if}
      </div>
    </button>
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
    min-width: 200px;
    max-width: 280px;
    transition: all var(--duration-normal) ease;
  }

  .sequence-card.clickable:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-accent, var(--semantic-info));
    transform: translateY(-1px);
  }

  .sequence-card.own {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .sequence-card.own.clickable:hover {
    background: rgba(255, 255, 255, 0.15);
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

  /* Inner button for clickable state */
  .card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    text-align: left;
    width: 100%;
    color: inherit;
  }

  .card-content:disabled {
    cursor: default;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* Thumbnail */
  .thumbnail-container {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.2);
  }

  .thumbnail {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: rgba(0, 0, 0, 0.1);
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

  .tap-hint,
  .checking-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact);
    color: var(--theme-accent, var(--semantic-info));
    opacity: 0.8;
  }

  .checking-hint {
    color: var(--theme-text-dim);
  }

  .own .tap-hint {
    color: rgba(255, 255, 255, 0.8);
  }

  .tap-hint i,
  .checking-hint i {
    font-size: var(--font-size-compact);
  }
</style>
