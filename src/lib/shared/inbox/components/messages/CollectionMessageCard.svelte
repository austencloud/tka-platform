<script lang="ts">
  import type { MessageAttachment } from "$lib/shared/messaging/domain/models/message-models";
  import { goto } from "$app/navigation";

  interface Props {
    attachment: MessageAttachment;
    isOwn?: boolean;
  }

  let { attachment, isOwn = false }: Props = $props();
  const metadata = $derived(attachment.metadata);
  const collectionName = $derived(
    metadata?.collectionName || attachment.name || "Collection"
  );
  const sequenceCount = $derived(metadata?.collectionSequenceCount ?? 0);
  const roleLabel = $derived(
    metadata?.collectionAccessRole === "editor" ? "Can edit" : "Can view"
  );
  const iconClass = $derived.by(() => {
    const icon = metadata?.collectionIcon || "fa-folder";
    return icon.includes("fa-solid") || icon.includes("fas")
      ? icon
      : `fa-solid ${icon}`;
  });

  function openCollection(): void {
    if (attachment.url) void goto(attachment.url);
  }
</script>

<button
  type="button"
  class="collection-card"
  class:own={isOwn}
  onclick={openCollection}
  disabled={!attachment.url}
  aria-label={`Open ${collectionName}`}
>
  <span
    class="collection-icon"
    style:--collection-color={metadata?.collectionColor ||
      "var(--theme-accent)"}
  >
    <i class={iconClass} aria-hidden="true"></i>
  </span>
  <span class="collection-info">
    <span class="kicker">Shared collection</span>
    <strong>{collectionName}</strong>
    <span class="details">
      {sequenceCount}
      {sequenceCount === 1 ? "sequence" : "sequences"}
      <span aria-hidden="true">•</span>
      {roleLabel}
    </span>
  </span>
  <span class="open-hint">
    Open
    <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
  </span>
</button>

<style>
  .collection-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px;
    width: min(280px, 100%);
    min-width: 220px;
    padding: 12px;
    border: 1px solid var(--theme-stroke);
    border-radius: 14px;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    text-align: left;
    transition:
      transform var(--duration-fast) ease,
      border-color var(--duration-fast) ease,
      background var(--duration-fast) ease;
  }

  .collection-card:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: var(--theme-accent);
    background: var(--theme-card-hover-bg);
  }

  .collection-card:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .collection-card:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .collection-card.own {
    border-color: rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .collection-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 13px;
    background: color-mix(in srgb, var(--collection-color) 20%, transparent);
    color: var(--collection-color);
    font-size: 22px;
  }

  .collection-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .kicker,
  .details {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
  }

  .own .kicker,
  .own .details {
    color: rgba(255, 255, 255, 0.76);
  }

  strong {
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-size-sm, 14px);
  }

  .details {
    display: flex;
    gap: 6px;
    margin-top: 3px;
  }

  .open-hint {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 7px;
    min-height: 28px;
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke);
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
  }

  .own .open-hint {
    color: white;
  }

  @media (prefers-reduced-motion: reduce) {
    .collection-card {
      transition: none;
    }
  }
</style>
