<!--
  AvatarSelectModal

  The avatar tab used to render the whole picker grid inline in a narrow dock,
  which meant choosing a body from 60px thumbnails. This gives the choice its
  own room: a live 3D preview of the focused avatar on the left, the existing
  picker grid on the right, and one explicit Select action.

  Composition only. BaseModal owns the dialog, PerformerAvatarPicker owns the
  grid and its keyboard model, AvatarPreviewStage owns the focused figure, and
  the host owns the commit (prepare / apply / pending / error) through onCommit.
-->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import {
    AVATAR_DEFINITIONS,
    DEFAULT_AVATAR_ID,
    type AvatarId,
  } from "@austencloud/scene-3d";
  import PerformerAvatarPicker from "../PerformerAvatarPicker.svelte";
  import AvatarPreviewStage from "./AvatarPreviewStage.svelte";

  interface Props {
    open: boolean;
    currentAvatarId: AvatarId | null;
    /** Mirrors the host's in-flight avatar load so the grid keeps its spinner. */
    pendingAvatarId?: AvatarId | null;
    /** The dock sets --performer-color on its own subtree; a top-layer dialog
        sits outside that subtree, so the color travels as a prop. */
    performerColor?: string;
    /** Hover/focus prewarm, owned by the host so one debounce serves the whole
        avatar flow rather than the modal keeping a second one. */
    onIntent: (id: AvatarId) => void;
    onCancelIntent: () => void;
    onCommit: (id: AvatarId) => void;
    onClose: () => void;
  }

  let {
    open = $bindable(false),
    currentAvatarId,
    pendingAvatarId = null,
    performerColor = "var(--theme-accent)",
    onIntent,
    onCancelIntent,
    onCommit,
    onClose,
  }: Props = $props();

  let focusedId = $state<AvatarId>(DEFAULT_AVATAR_ID);

  // Arrow-key traversal moves focus faster than a GLTF loads. The grid
  // highlight and the meta text follow every keypress; the 3D stage waits for
  // the focus to settle, so holding an arrow key crosses the grid instead of
  // queueing a model load per tile.
  const PREVIEW_SETTLE_MS = 180;
  let previewId = $state<AvatarId>(DEFAULT_AVATAR_ID);
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearSettle(): void {
    if (settleTimer === null) return;
    clearTimeout(settleTimer);
    settleTimer = null;
  }

  function focusAvatar(id: AvatarId, immediate = false): void {
    focusedId = id;
    clearSettle();
    if (immediate) {
      previewId = id;
      return;
    }
    settleTimer = setTimeout(() => {
      settleTimer = null;
      previewId = id;
    }, PREVIEW_SETTLE_MS);
  }

  onDestroy(clearSettle);

  // Re-anchor on every open: a modal that reopens still holding last session's
  // browsing position would misrepresent what the performer is wearing now.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      focusAvatar(currentAvatarId ?? DEFAULT_AVATAR_ID, true);
    });
  });

  const focusedDef = $derived(
    AVATAR_DEFINITIONS.find((definition) => definition.id === focusedId) ?? null
  );
  const isCurrent = $derived(currentAvatarId === focusedId);

  function commit(): void {
    if (isCurrent) return;
    clearSettle();
    onCancelIntent();
    onCommit(focusedId);
    onClose();
  }

  function close(): void {
    clearSettle();
    onCancelIntent();
    onClose();
  }
</script>

<BaseModal
  bind:open
  onclose={close}
  size="xl"
  class="avatar-select-modal"
  labelledBy="avatar-select-title"
>
  {#snippet header()}
    <div class="modal-head" style:--performer-color={performerColor}>
      <h2 id="avatar-select-title">Choose your avatar</h2>
      <button
        class="close-btn"
        type="button"
        aria-label="Close avatar picker"
        onclick={close}
      >
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
  {/snippet}

  <div class="select-shell" style:--performer-color={performerColor}>
    <div class="select-body">
      <div class="preview-pane">
        <AvatarPreviewStage avatarId={previewId} />

        <div class="focus-meta">
          <span class="focus-name">{focusedDef?.name ?? "Avatar"}</span>
          <span class="focus-desc">{focusedDef?.description ?? ""}</span>
        </div>

        <!-- aria-disabled rather than disabled: the button stays focusable so
             a keyboard user can reach it and hear why it is inert. commit()
             short-circuits on the same condition. -->
        <button
          class="select-btn"
          class:is-current={isCurrent}
          type="button"
          aria-disabled={isCurrent}
          onclick={commit}
        >
          {isCurrent ? "This is your avatar" : "Select this avatar"}
        </button>
      </div>

      <div class="picker-pane">
        <PerformerAvatarPicker
          selectedAvatarId={focusedId}
          appliedAvatarId={currentAvatarId}
          groupLabel="Preview avatar"
          {pendingAvatarId}
          onSelect={(id) => focusAvatar(id)}
          {onIntent}
          {onCancelIntent}
        />
      </div>
    </div>
  </div>
</BaseModal>

<style>
  /* data-size="xl" is min(90vw, 1400px) — right for a full workspace, far too
     wide for one figure and a tile grid. Capped above the token's own mobile
     breakpoint so the full-bleed phone layout is left alone. */
  @media (min-width: 521px) {
    :global(dialog.base-modal[data-size="xl"].avatar-select-modal) {
      width: min(92vw, 56rem);
    }
  }

  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px 12px;
  }

  h2 {
    margin: 0;
    font-size: var(--font-size-lg, 1.25rem);
    font-weight: 700;
    color: var(--theme-text);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px solid var(--theme-stroke);
    background: var(--surface-inset-deep);
    color: var(--theme-text-dim);
    font-size: 1rem;
    cursor: pointer;
    transition:
      color 140ms ease,
      border-color 140ms ease;
  }

  .close-btn:hover {
    color: var(--theme-text);
    border-color: color-mix(in srgb, var(--performer-color) 45%, transparent);
  }

  /* The query container is the shell, not the grid: an element cannot answer a
     container query against its own size. */
  .select-shell {
    container-type: inline-size;
    padding: 0 20px 20px;
  }

  .select-body {
    display: grid;
    grid-template-columns: minmax(18rem, 2fr) minmax(0, 3fr);
    gap: 16px;
    min-height: 24rem;
  }

  .preview-pane {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .preview-pane :global(.stage) {
    flex: 1;
  }

  .focus-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .focus-name {
    font-size: 1rem;
    font-weight: 650;
    color: var(--theme-text);
  }

  /* Descriptions run one or two lines. Reserving both keeps the 3D stage from
     resizing (and re-rendering) as the focus moves across the grid. */
  .focus-desc {
    min-height: 2.6em;
    font-size: 0.875rem;
    line-height: 1.3;
    color: var(--theme-text-dim);
  }

  .select-btn {
    min-height: 48px;
    padding: 12px 18px;
    border-radius: 10px;
    border: 1px solid
      color-mix(in srgb, var(--performer-color) 45%, transparent);
    background: color-mix(in srgb, var(--performer-color) 20%, transparent);
    color: var(--theme-text);
    font-size: 0.9375rem;
    font-weight: 650;
    cursor: pointer;
    transition:
      background 140ms ease,
      border-color 140ms ease;
  }

  .select-btn:hover:not(.is-current) {
    background: color-mix(in srgb, var(--performer-color) 32%, transparent);
    border-color: var(--performer-color);
  }

  .select-btn.is-current {
    background: var(--surface-inset-deep);
    border-color: var(--theme-stroke);
    color: var(--theme-text-dim);
    cursor: default;
  }

  /* min-height: 0 is what lets the pane actually scroll — a grid item's auto
     minimum otherwise grows the row to the full grid height, which would drag
     the 3D canvas taller with it. */
  .picker-pane {
    min-width: 0;
    min-height: 0;
    max-height: min(60vh, 34rem);
    overflow-y: auto;
  }

  button:focus-visible {
    outline: 2px solid var(--performer-color);
    outline-offset: 2px;
  }

  @container (max-width: 45rem) {
    .select-body {
      grid-template-columns: minmax(0, 1fr);
    }

    .preview-pane :global(.stage) {
      min-height: 14rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn,
    .select-btn {
      transition: none;
    }
  }
</style>
