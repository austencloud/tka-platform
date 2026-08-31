<script lang="ts">
  import { AVATAR_DEFINITIONS, type AvatarId } from "@austencloud/scene-3d";
  import { onDestroy } from "svelte";

  import type { AvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import { avatarThumbnailUrl } from "../../constants/r2-cdn";
  import AvatarCardLivePreview from "./avatar-select/AvatarCardLivePreview.svelte";

  interface Props {
    selectedAvatarId: AvatarId | null;
    pendingAvatarId: AvatarId | null;
    previewPerformer: AvatarInstanceState | null;
    groupLabel?: string;
    onSelect: (id: AvatarId) => void;
    onIntent: (id: AvatarId) => void;
    onCancelIntent: () => void;
  }

  let {
    selectedAvatarId,
    pendingAvatarId,
    previewPerformer,
    groupLabel = "Select avatar",
    onSelect,
    onIntent,
    onCancelIntent,
  }: Props = $props();

  const personalAvatarId =
    (AVATAR_DEFINITIONS.find(
      (definition) => definition.availability === "local-evaluation"
    )?.id as AvatarId | undefined) ?? null;

  let loadedThumbs = $state(new Set<string>());
  let hoveredAvatarId = $state<AvatarId | null>(null);
  let focusedAvatarId = $state<AvatarId | null>(null);
  let interactionReadyAvatarId = $state<AvatarId | null>(null);
  let personalPreviewReady = $state(false);
  let hoverPreviewTimer: ReturnType<typeof setTimeout> | null = null;

  const restingPreviewAvatarId = $derived(
    personalAvatarId ??
      selectedAvatarId ??
      (AVATAR_DEFINITIONS[0]?.id as AvatarId)
  );
  const livePreviewAvatarId = $derived(
    focusedAvatarId ?? hoveredAvatarId ?? restingPreviewAvatarId
  );
  const livePreviewActive = $derived(
    focusedAvatarId !== null || hoveredAvatarId !== null
  );

  function clearHoverPreviewTimer(): void {
    if (hoverPreviewTimer === null) return;
    clearTimeout(hoverPreviewTimer);
    hoverPreviewTimer = null;
  }

  function startPointerPreview(id: AvatarId): void {
    onIntent(id);
    clearHoverPreviewTimer();
    hoverPreviewTimer = setTimeout(() => {
      hoverPreviewTimer = null;
      interactionReadyAvatarId = null;
      hoveredAvatarId = id;
    }, 120);
  }

  function stopPointerPreview(id: AvatarId): void {
    onCancelIntent();
    clearHoverPreviewTimer();
    if (hoveredAvatarId === id) {
      hoveredAvatarId = null;
      interactionReadyAvatarId = null;
    }
  }

  function startFocusPreview(id: AvatarId): void {
    onIntent(id);
    focusedAvatarId = id;
    interactionReadyAvatarId = null;
  }

  function stopFocusPreview(id: AvatarId): void {
    onCancelIntent();
    if (focusedAvatarId === id) {
      focusedAvatarId = null;
      interactionReadyAvatarId = null;
    }
  }

  function moveSelection(event: KeyboardEvent, id: AvatarId): void {
    const currentIndex = AVATAR_DEFINITIONS.findIndex(
      (avatar) => avatar.id === id
    );
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex++;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex--;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = AVATAR_DEFINITIONS.length - 1;
    else return;

    event.preventDefault();
    nextIndex =
      (nextIndex + AVATAR_DEFINITIONS.length) % AVATAR_DEFINITIONS.length;
    const nextAvatar = AVATAR_DEFINITIONS[nextIndex];
    if (!nextAvatar) return;
    const group = (event.currentTarget as HTMLElement).closest(".avatar-grid");
    onSelect(nextAvatar.id as AvatarId);
    queueMicrotask(() => {
      group
        ?.querySelector<HTMLElement>(`[data-avatar-id="${nextAvatar.id}"]`)
        ?.focus();
    });
  }

  onDestroy(clearHoverPreviewTimer);
</script>

<div class="avatar-picker">
  <div class="avatar-grid" role="radiogroup" aria-label={groupLabel}>
    {#each AVATAR_DEFINITIONS as definition, index (definition.id)}
      {@const avatarId = definition.id as AvatarId}
      {@const thumbnailUrl = avatarThumbnailUrl(definition.id)}
      {@const isPersonalAvatar = personalAvatarId === definition.id}
      {@const hasLivePreview =
        isPersonalAvatar || livePreviewAvatarId === definition.id}
      {@const livePreviewReady = isPersonalAvatar
        ? personalPreviewReady
        : interactionReadyAvatarId === definition.id}
      <button
        class="avatar-card"
        class:selected={selectedAvatarId === definition.id}
        class:preparing={pendingAvatarId === definition.id}
        class:live-ready={livePreviewReady}
        type="button"
        role="radio"
        aria-checked={selectedAvatarId === definition.id}
        aria-busy={pendingAvatarId === definition.id}
        tabindex={selectedAvatarId === definition.id ||
        (selectedAvatarId === null && index === 0)
          ? 0
          : -1}
        data-avatar-id={definition.id}
        onpointerenter={() => startPointerPreview(avatarId)}
        onpointerleave={() => stopPointerPreview(avatarId)}
        onfocus={() => startFocusPreview(avatarId)}
        onblur={() => stopFocusPreview(avatarId)}
        onkeydown={(event) => moveSelection(event, avatarId)}
        onclick={() => onSelect(avatarId)}
        title={definition.description}
        aria-label={pendingAvatarId === definition.id
          ? `${definition.name}, loading`
          : selectedAvatarId === definition.id
            ? `${definition.name}, active avatar`
            : `${definition.name}, hover for live preview`}
      >
        <span class="portrait-backdrop" aria-hidden="true"></span>

        <i
          class="fas {definition.icon ?? 'fa-user'} avatar-fallback-icon"
          class:hidden={loadedThumbs.has(definition.id) ||
            (hasLivePreview && livePreviewReady)}
          aria-hidden="true"
        ></i>

        {#if thumbnailUrl}
          <img
            class="avatar-thumb"
            class:loaded={loadedThumbs.has(definition.id)}
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            onload={() =>
              (loadedThumbs = new Set(loadedThumbs).add(definition.id))}
          />
        {/if}

        {#if hasLivePreview}
          <span class="live-preview-layer" aria-hidden="true">
            <AvatarCardLivePreview
              {avatarId}
              sourcePerformer={previewPerformer}
              active={livePreviewAvatarId === definition.id &&
                livePreviewActive}
              onReady={() => {
                if (isPersonalAvatar) {
                  personalPreviewReady = true;
                } else if (livePreviewAvatarId === avatarId) {
                  interactionReadyAvatarId = avatarId;
                }
              }}
            />
          </span>
        {/if}

        {#if pendingAvatarId === definition.id}
          <span class="avatar-loading" aria-hidden="true"></span>
        {/if}
        {#if selectedAvatarId === definition.id}
          <span class="avatar-selected-mark" aria-hidden="true">
            <i class="fas fa-check"></i>
          </span>
        {/if}
        {#if definition.availability === "local-evaluation"}
          <span class="avatar-personal-badge" aria-hidden="true">You</span>
        {/if}

        <span class="avatar-card-name">{definition.name}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .avatar-picker {
    container-type: inline-size;
  }

  .avatar-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .avatar-card {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 4 / 3;
    width: 100%;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    padding: 0;
    overflow: hidden;
    border: 2px solid var(--theme-stroke);
    border-radius: 0.75rem;
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    isolation: isolate;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast),
      transform var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .portrait-backdrop {
    position: absolute;
    inset: 0;
    z-index: -2;
    background:
      radial-gradient(
        circle at 50% 34%,
        color-mix(in srgb, var(--performer-color) 15%, transparent),
        transparent 54%
      ),
      linear-gradient(160deg, var(--theme-card-bg), var(--surface-inset-deep));
  }

  .avatar-fallback-icon {
    color: color-mix(
      in srgb,
      var(--performer-color) 65%,
      var(--theme-text-dim)
    );
    font-size: clamp(1.5rem, 12cqi, 2.5rem);
    opacity: 0.72;
  }

  .avatar-fallback-icon.hidden {
    opacity: 0;
  }

  .avatar-thumb {
    position: absolute;
    inset: 0;
    z-index: -1;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    opacity: 0;
    transform: scale(2.15);
    transform-origin: 50% 17%;
    filter: saturate(0.92) contrast(1.04);
    transition:
      opacity var(--transition-fast),
      transform var(--transition-fast),
      filter var(--transition-fast);
  }

  .avatar-thumb.loaded {
    opacity: 0.9;
  }

  .live-preview-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
    opacity: 0;
    transition: opacity var(--transition-normal);
  }

  .avatar-card.live-ready .live-preview-layer {
    opacity: 1;
  }

  .avatar-selected-mark {
    position: absolute;
    z-index: 3;
    top: 0.3125rem;
    left: 0.3125rem;
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border: 1px solid color-mix(in srgb, white 42%, transparent);
    border-radius: 50%;
    background: color-mix(in srgb, var(--performer-color) 88%, black);
    color: white;
    font-size: 0.6875rem;
    box-shadow: 0 0.125rem 0.5rem color-mix(in srgb, black 45%, transparent);
  }

  .avatar-personal-badge {
    position: absolute;
    z-index: 3;
    top: 0.3125rem;
    right: 0.3125rem;
    padding: 0.1875rem 0.4375rem;
    border: 1px solid color-mix(in srgb, white 12%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface-inset-deep) 88%, black);
    color: var(--theme-text);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    line-height: 1.2;
    backdrop-filter: blur(0.375rem);
  }

  .avatar-card-name {
    position: absolute;
    z-index: 2;
    right: 0;
    bottom: 0;
    left: 0;
    padding: 1.25rem 0.375rem 0.375rem;
    overflow: hidden;
    color: var(--theme-text);
    font-size: clamp(var(--font-size-min, 14px), 1.65cqi, 1.125rem);
    font-weight: 680;
    line-height: 1.2;
    text-align: center;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px black;
    white-space: nowrap;
    background: linear-gradient(
      transparent,
      color-mix(in srgb, var(--surface-darker) 96%, black)
    );
  }

  .avatar-card:hover {
    border-color: color-mix(
      in srgb,
      var(--performer-color) 58%,
      var(--theme-stroke)
    );
    color: var(--theme-text);
    transform: translateY(-0.125rem);
    box-shadow: 0 0.4rem 1rem color-mix(in srgb, black 38%, transparent);
  }

  .avatar-card:hover .avatar-thumb,
  .avatar-card:focus-visible .avatar-thumb {
    opacity: 1;
    transform: scale(2.2);
    filter: saturate(1) contrast(1.06);
  }

  .avatar-card.selected {
    border-color: var(--performer-color);
    color: var(--theme-text);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--performer-color) 32%, transparent),
      0 0.375rem 1.25rem
        color-mix(in srgb, var(--performer-color) 22%, transparent);
  }

  .avatar-card.preparing {
    border-color: color-mix(in srgb, var(--performer-color) 68%, transparent);
  }

  .avatar-loading {
    position: absolute;
    z-index: 4;
    top: 50%;
    left: 50%;
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid
      color-mix(in srgb, var(--performer-color) 25%, transparent);
    border-top-color: var(--performer-color);
    border-radius: 50%;
    animation: avatar-loading-spin calc(var(--duration-dramatic) * 2) linear
      infinite;
  }

  @keyframes avatar-loading-spin {
    from {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }

  button:focus-visible {
    outline: 2px solid var(--performer-color);
    outline-offset: 2px;
  }

  @container (min-width: 26rem) {
    .avatar-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @container (min-width: 42rem) {
    .avatar-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  @container (min-width: 62rem) {
    .avatar-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .avatar-card,
    .avatar-thumb,
    .live-preview-layer {
      transition: none;
    }

    .avatar-card:hover {
      transform: none;
    }

    .avatar-thumb,
    .avatar-card:hover .avatar-thumb,
    .avatar-card:focus-visible .avatar-thumb {
      transform: scale(2.15);
    }

    .avatar-loading {
      animation: none;
    }
  }
</style>
