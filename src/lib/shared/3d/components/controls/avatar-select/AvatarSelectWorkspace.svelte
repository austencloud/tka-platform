<!--
  The avatar chooser is an editor, not a dialog. This component owns the
  previewing experience wherever it is composed: the live figure, focused
  metadata, explicit Apply action, and the keyboard-aware avatar grid.

  The host still owns loading and applying an avatar. Keeping that boundary
  means an inline inspector and any future modal wrapper report the same
  analytics, errors, and undo history.
-->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import {
    AVATAR_DEFINITIONS,
    DEFAULT_AVATAR_ID,
    type AvatarId,
  } from "@austencloud/scene-3d";
  import PerformerAvatarPicker from "../PerformerAvatarPicker.svelte";
  import AvatarPreviewStage from "./AvatarPreviewStage.svelte";

  interface Props {
    currentAvatarId: AvatarId | null;
    pendingAvatarId?: AvatarId | null;
    performerColor?: string;
    /** Re-anchors the preview when the inspector changes performer scope. */
    scopeKey?: string;
    onIntent: (id: AvatarId) => void;
    onCancelIntent: () => void;
    onCommit: (id: AvatarId) => void;
  }

  let {
    currentAvatarId,
    pendingAvatarId = null,
    performerColor = "var(--theme-accent)",
    scopeKey = "avatar",
    onIntent,
    onCancelIntent,
    onCommit,
  }: Props = $props();

  let focusedId = $state<AvatarId>(currentAvatarId ?? DEFAULT_AVATAR_ID);
  let previewId = $state<AvatarId>(currentAvatarId ?? DEFAULT_AVATAR_ID);
  let anchorKey = $state("");

  // Arrow-key traversal can cross the grid faster than a model loads. The
  // selection moves immediately while the expensive preview waits briefly.
  const PREVIEW_SETTLE_MS = 180;
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

  $effect(() => {
    const nextAnchor = `${scopeKey}:${currentAvatarId ?? "mixed"}`;
    if (nextAnchor === anchorKey) return;
    anchorKey = nextAnchor;
    untrack(() => {
      focusAvatar(currentAvatarId ?? DEFAULT_AVATAR_ID, true);
    });
  });

  onDestroy(clearSettle);

  const focusedDef = $derived(
    AVATAR_DEFINITIONS.find((definition) => definition.id === focusedId) ?? null
  );
  const isCurrent = $derived(currentAvatarId === focusedId);
  const isPending = $derived(pendingAvatarId === focusedId);

  function commit(): void {
    if (isCurrent || isPending) return;
    clearSettle();
    onCancelIntent();
    onCommit(focusedId);
  }
</script>

<div class="avatar-select-shell" style:--performer-color={performerColor}>
  <div class="avatar-select-workspace">
    <div class="preview-pane">
      <AvatarPreviewStage avatarId={previewId} />

      <div class="focus-meta" aria-live="polite">
        <span class="focus-name">{focusedDef?.name ?? "Avatar"}</span>
        <span class="focus-desc">{focusedDef?.description ?? ""}</span>
      </div>

      <!-- The current choice remains focusable so keyboard users hear why the
         action is inactive instead of silently skipping the primary button. -->
      <button
        class="select-btn"
        class:is-current={isCurrent}
        type="button"
        aria-disabled={isCurrent || isPending}
        aria-busy={isPending}
        onclick={commit}
      >
        {#if isPending}
          <span class="button-spinner" aria-hidden="true"></span>
          Loading avatar…
        {:else}
          {isCurrent ? "This avatar is active" : "Use this avatar"}
        {/if}
      </button>
    </div>

    <div class="picker-pane">
      <div class="picker-heading">
        <strong>Choose an avatar</strong>
        <span>Focus a body to preview it before applying.</span>
      </div>
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

<style>
  .avatar-select-shell {
    min-width: 0;
    container-type: inline-size;
  }

  .avatar-select-workspace {
    display: grid;
    grid-template-columns: minmax(13rem, 2fr) minmax(18rem, 3fr);
    gap: 1rem;
    min-width: 0;
    min-height: 24rem;
  }

  .preview-pane {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    min-width: 0;
  }

  .preview-pane :global(.stage) {
    flex: 1;
  }

  .focus-meta,
  .picker-heading {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .focus-name,
  .picker-heading strong {
    color: var(--theme-text);
    font-size: 1rem;
    font-weight: 650;
  }

  .focus-desc {
    min-height: 2.6em;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    line-height: 1.3;
  }

  .picker-pane {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    min-width: 0;
    min-height: 0;
    max-height: min(60vh, 34rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .picker-heading span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
  }

  .select-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 48px;
    padding: 0.75rem 1.125rem;
    border: 1px solid
      color-mix(in srgb, var(--performer-color) 45%, transparent);
    border-radius: 0.625rem;
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
    border-color: var(--performer-color);
    background: color-mix(in srgb, var(--performer-color) 32%, transparent);
  }

  .select-btn.is-current {
    border-color: var(--theme-stroke);
    background: var(--surface-inset-deep);
    color: var(--theme-text-dim);
    cursor: default;
  }

  .select-btn:focus-visible {
    outline: 2px solid var(--performer-color);
    outline-offset: 2px;
  }

  .button-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid
      color-mix(in srgb, var(--performer-color) 28%, transparent);
    border-top-color: var(--performer-color);
    border-radius: 50%;
    animation: button-spin 700ms linear infinite;
  }

  @keyframes button-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @container (max-width: 34rem) {
    .avatar-select-workspace {
      grid-template-columns: minmax(0, 1fr);
    }

    .preview-pane :global(.stage) {
      min-height: 14rem;
    }

    .picker-pane {
      max-height: none;
      overflow-y: visible;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .select-btn {
      transition: none;
    }

    .button-spinner {
      animation-duration: 1400ms;
    }
  }
</style>
