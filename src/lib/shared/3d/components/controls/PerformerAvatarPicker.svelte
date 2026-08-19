<script lang="ts">
  import { AVATAR_DEFINITIONS, type AvatarId } from "@austencloud/scene-3d";
  import { avatarThumbnailUrl } from "../../constants/r2-cdn";

  interface Props {
    selectedAvatarId: AvatarId | null;
    pendingAvatarId: AvatarId | null;
    onSelect: (id: AvatarId) => void;
    onIntent: (id: AvatarId) => void;
    onCancelIntent: () => void;
  }

  let {
    selectedAvatarId,
    pendingAvatarId,
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
  <div class="picker-intro">
    <strong>Choose an avatar</strong>
    <span>Hovering prepares models before you select them.</span>
  </div>
  <div class="avatar-grid" role="radiogroup" aria-label="Select avatar">
    {#each AVATAR_DEFINITIONS as definition, index (definition.id)}
      <button
        class="avatar-card"
        class:selected={selectedAvatarId === definition.id}
        class:preparing={pendingAvatarId === definition.id}
        class:has-thumb={loadedThumbs.has(definition.id)}
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
      >
        {#if pendingAvatarId === definition.id}
          <span class="avatar-loading" aria-hidden="true"></span>
        {/if}
        <i
          class="fas {definition.icon ?? 'fa-user'} avatar-fallback-icon"
          class:hidden={loadedThumbs.has(definition.id)}
          aria-hidden="true"
        ></i>
        <img
          class="avatar-thumb"
          class:loaded={loadedThumbs.has(definition.id)}
          src={avatarThumbnailUrl(definition.id)}
          alt=""
          loading="lazy"
          onload={() =>
            (loadedThumbs = new Set(loadedThumbs).add(definition.id))}
        />
        <span class="avatar-card-name">{definition.name}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .avatar-picker {
    display: flex;
    flex-direction: column;
    gap: 10px;
    container-type: inline-size;
  }
  .picker-intro {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .picker-intro strong {
    color: var(--theme-text);
    font-size: 15px;
    line-height: 1.2;
  }
  .picker-intro span {
    color: var(--theme-text-dim);
    font-size: 14px;
    line-height: 1.35;
  }
  .avatar-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .avatar-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 0;
    min-height: 82px;
    padding: 8px 5px;
    overflow: hidden;
    position: relative;
    background: var(--theme-card-bg);
    border: 1.5px solid transparent;
    border-radius: 10px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition:
      background 140ms ease,
      border-color 140ms ease,
      color 140ms ease,
      transform 160ms ease;
  }
  .avatar-card.has-thumb {
    padding: 0;
    justify-content: flex-end;
  }
  .avatar-fallback-icon {
    font-size: 19px;
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
    transition: opacity 160ms ease;
  }
  .avatar-thumb.loaded {
    opacity: 0.74;
  }
  .avatar-card.has-thumb:hover .avatar-thumb,
  .avatar-card.has-thumb.selected .avatar-thumb {
    opacity: 1;
  }
  .avatar-card-name {
    position: relative;
    z-index: 1;
    width: 100%;
    padding: 3px 5px 5px;
    font-size: 14px;
    font-weight: 650;
    text-align: center;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .avatar-card.has-thumb .avatar-card-name {
    background: linear-gradient(
      transparent,
      color-mix(in srgb, var(--surface-darker) 82%, black)
    );
  }
  .avatar-card:hover {
    background: color-mix(in srgb, var(--performer-color) 10%, transparent);
    border-color: color-mix(in srgb, var(--performer-color) 30%, transparent);
    color: white;
    transform: translateY(-1px);
  }
  .avatar-card.selected {
    background: color-mix(in srgb, var(--performer-color) 22%, transparent);
    border-color: var(--performer-color);
    color: white;
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--performer-color) 24%, transparent);
  }
  .avatar-card.preparing {
    border-color: color-mix(in srgb, var(--performer-color) 55%, transparent);
  }
  .avatar-loading {
    position: absolute;
    z-index: 2;
    top: 50%;
    left: 50%;
    width: 20px;
    height: 20px;
    border: 2px solid
      color-mix(in srgb, var(--performer-color) 25%, transparent);
    border-top-color: var(--performer-color);
    border-radius: 50%;
    animation: avatar-loading-spin 700ms linear infinite;
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
  @container (min-width: 580px) {
    .avatar-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .avatar-card,
    .avatar-thumb {
      transition: none;
    }
    .avatar-loading {
      animation-duration: 1400ms;
    }
  }
</style>
