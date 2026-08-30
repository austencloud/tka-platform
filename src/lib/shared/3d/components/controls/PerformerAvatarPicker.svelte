<script lang="ts">
  import { AVATAR_DEFINITIONS, type AvatarId } from "@austencloud/scene-3d";
  import { avatarThumbnailUrl } from "../../constants/r2-cdn";

  interface Props {
    selectedAvatarId: AvatarId | null;
    pendingAvatarId: AvatarId | null;
    groupLabel?: string;
    onSelect: (id: AvatarId) => void;
    onIntent: (id: AvatarId) => void;
    onCancelIntent: () => void;
  }

  let {
    selectedAvatarId,
    pendingAvatarId,
    groupLabel = "Select avatar",
    onSelect,
    onIntent,
    onCancelIntent,
  }: Props = $props();

  let loadedThumbs = $state(new Set<string>());

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
</script>

<div class="avatar-picker">
  <div class="avatar-grid" role="radiogroup" aria-label={groupLabel}>
    {#each AVATAR_DEFINITIONS as definition, index (definition.id)}
      {@const thumbnailUrl = avatarThumbnailUrl(definition.id)}
      <button
        class="avatar-card"
        class:selected={selectedAvatarId === definition.id}
        class:preparing={pendingAvatarId === definition.id}
        class:has-thumb={loadedThumbs.has(definition.id)}
        class:personal={definition.availability === "local-evaluation"}
        type="button"
        role="radio"
        aria-checked={selectedAvatarId === definition.id}
        aria-busy={pendingAvatarId === definition.id}
        tabindex={selectedAvatarId === definition.id ||
        (selectedAvatarId === null && index === 0)
          ? 0
          : -1}
        data-avatar-id={definition.id}
        onpointerenter={() => onIntent(definition.id as AvatarId)}
        onpointerleave={onCancelIntent}
        onfocus={() => onIntent(definition.id as AvatarId)}
        onblur={onCancelIntent}
        onkeydown={(event) => moveSelection(event, definition.id as AvatarId)}
        onclick={() => onSelect(definition.id as AvatarId)}
        title={definition.description}
        aria-label={pendingAvatarId === definition.id
          ? `${definition.name}, loading`
          : selectedAvatarId === definition.id
            ? `${definition.name}, active avatar`
            : definition.name}
      >
        {#if pendingAvatarId === definition.id}
          <span class="avatar-loading" aria-hidden="true"></span>
        {/if}
        <i
          class="fas {definition.icon ?? 'fa-user'} avatar-fallback-icon"
          class:hidden={loadedThumbs.has(definition.id)}
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
        {#if selectedAvatarId === definition.id}
          <span class="avatar-selected-mark" aria-hidden="true">
            <i class="fas fa-check"></i>
          </span>
        {/if}
        {#if definition.availability === "local-evaluation"}
          <span class="avatar-personal-badge" aria-hidden="true">Yours</span>
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
    gap: 0.625rem;
  }

  .avatar-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3125rem;
    aspect-ratio: 1;
    width: 100%;
    min-width: 0;
    min-height: 0;
    padding: 0.625rem 0.375rem;
    overflow: hidden;
    border: 2px solid var(--theme-stroke);
    border-radius: 0.875rem;
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast),
      transform var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .avatar-card.has-thumb {
    justify-content: flex-end;
    padding: 0;
  }

  .avatar-card.personal {
    border-color: color-mix(
      in srgb,
      var(--performer-color) 42%,
      var(--theme-stroke)
    );
    background: color-mix(
      in srgb,
      var(--performer-color) 10%,
      var(--theme-card-bg)
    );
  }

  .avatar-card.personal .avatar-fallback-icon {
    font-size: 2rem;
  }

  .avatar-fallback-icon {
    font-size: 1.5rem;
  }

  .avatar-fallback-icon.hidden {
    display: none;
  }

  .avatar-thumb {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    opacity: 0;
    transition:
      opacity var(--transition-fast),
      transform var(--transition-fast);
  }

  .avatar-thumb.loaded {
    opacity: 0.82;
  }

  .avatar-card.has-thumb:hover .avatar-thumb,
  .avatar-card.has-thumb.selected .avatar-thumb {
    opacity: 1;
    transform: scale(1.025);
  }

  .avatar-selected-mark {
    position: absolute;
    z-index: 2;
    top: 0.375rem;
    left: 0.375rem;
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
    z-index: 2;
    top: 0.375rem;
    right: 0.375rem;
    padding: 0.1875rem 0.4375rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface-inset-deep) 88%, black);
    color: var(--theme-text);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    line-height: 1.2;
  }

  .avatar-card-name {
    position: relative;
    z-index: 1;
    width: 100%;
    padding: 0.75rem 0.375rem 0.4375rem;
    overflow: hidden;
    color: currentColor;
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
    line-height: 1.2;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .avatar-card.has-thumb .avatar-card-name {
    background: linear-gradient(
      transparent,
      color-mix(in srgb, var(--surface-darker) 94%, black)
    );
  }

  .avatar-card:hover {
    border-color: color-mix(
      in srgb,
      var(--performer-color) 48%,
      var(--theme-stroke)
    );
    background: color-mix(
      in srgb,
      var(--performer-color) 12%,
      var(--theme-card-bg)
    );
    color: var(--theme-text);
    transform: translateY(-0.125rem);
  }

  .avatar-card.selected {
    border-color: var(--performer-color);
    background: color-mix(
      in srgb,
      var(--performer-color) 20%,
      var(--theme-card-bg)
    );
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
    z-index: 3;
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

    .avatar-card.personal:last-child:nth-child(4n + 1) {
      grid-column: 2;
    }
  }

  @container (min-width: 56rem) {
    .avatar-grid {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }

    .avatar-card.personal:last-child:nth-child(8n + 1) {
      grid-column: 4;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .avatar-card,
    .avatar-thumb {
      transition: none;
    }

    .avatar-card:hover,
    .avatar-card.has-thumb:hover .avatar-thumb,
    .avatar-card.has-thumb.selected .avatar-thumb {
      transform: none;
    }

    .avatar-loading {
      animation: none;
    }
  }
</style>
