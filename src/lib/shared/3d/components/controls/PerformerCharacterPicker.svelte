<script lang="ts">
  import {
    CHARACTER_DEFINITIONS,
    type CharacterId,
  } from "$lib/shared/3d/domain/character-model";
  import { characterThumbnailUrl } from "../../constants/r2-cdn";

  interface Props {
    selectedCharacterId: CharacterId | null;
    pendingCharacterId: CharacterId | null;
    groupLabel?: string;
    onSelect: (id: CharacterId) => void;
    onIntent: (id: CharacterId) => void;
    onCancelIntent: () => void;
  }

  let {
    selectedCharacterId,
    pendingCharacterId,
    groupLabel = "Select character",
    onSelect,
    onIntent,
    onCancelIntent,
  }: Props = $props();

  let loadedThumbs = $state(new Set<string>());

  function moveSelection(event: KeyboardEvent, id: CharacterId): void {
    const currentIndex = CHARACTER_DEFINITIONS.findIndex(
      (character) => character.id === id
    );
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex++;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex--;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = CHARACTER_DEFINITIONS.length - 1;
    else return;

    event.preventDefault();
    nextIndex =
      (nextIndex + CHARACTER_DEFINITIONS.length) % CHARACTER_DEFINITIONS.length;
    const nextCharacter = CHARACTER_DEFINITIONS[nextIndex];
    if (!nextCharacter) return;
    const group = (event.currentTarget as HTMLElement).closest(
      ".character-grid"
    );
    onSelect(nextCharacter.id as CharacterId);
    queueMicrotask(() => {
      group
        ?.querySelector<HTMLElement>(
          `[data-character-id="${nextCharacter.id}"]`
        )
        ?.focus();
    });
  }
</script>

<div class="character-picker">
  <div class="character-grid" role="radiogroup" aria-label={groupLabel}>
    {#each CHARACTER_DEFINITIONS as definition, index (definition.id)}
      {@const thumbnailUrl = characterThumbnailUrl(definition.id)}
      <button
        class="character-card"
        class:selected={selectedCharacterId === definition.id}
        class:preparing={pendingCharacterId === definition.id}
        class:has-thumb={loadedThumbs.has(definition.id)}
        class:personal={definition.availability === "local-evaluation"}
        type="button"
        role="radio"
        aria-checked={selectedCharacterId === definition.id}
        aria-busy={pendingCharacterId === definition.id}
        tabindex={selectedCharacterId === definition.id ||
        (selectedCharacterId === null && index === 0)
          ? 0
          : -1}
        data-character-id={definition.id}
        onpointerenter={() => onIntent(definition.id as CharacterId)}
        onpointerleave={onCancelIntent}
        onfocus={() => onIntent(definition.id as CharacterId)}
        onblur={onCancelIntent}
        onkeydown={(event) =>
          moveSelection(event, definition.id as CharacterId)}
        onclick={() => onSelect(definition.id as CharacterId)}
        title={definition.description}
        aria-label={pendingCharacterId === definition.id
          ? `${definition.name}, loading`
          : selectedCharacterId === definition.id
            ? `${definition.name}, active character`
            : definition.name}
      >
        {#if pendingCharacterId === definition.id}
          <span class="character-loading" aria-hidden="true"></span>
        {/if}
        <i
          class="fas {definition.icon ?? 'fa-user'} character-fallback-icon"
          class:hidden={loadedThumbs.has(definition.id)}
          aria-hidden="true"
        ></i>
        {#if thumbnailUrl}
          <img
            class="character-thumb"
            class:loaded={loadedThumbs.has(definition.id)}
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            onload={() =>
              (loadedThumbs = new Set(loadedThumbs).add(definition.id))}
          />
        {/if}
        {#if selectedCharacterId === definition.id}
          <span class="character-selected-mark" aria-hidden="true">
            <i class="fas fa-check"></i>
          </span>
        {/if}
        {#if definition.availability === "local-evaluation"}
          <span class="character-personal-badge" aria-hidden="true">Yours</span>
        {/if}
        <span class="character-card-name">{definition.name}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .character-picker {
    container-type: inline-size;
  }

  .character-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.625rem;
  }

  .character-card {
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

  .character-card.has-thumb {
    justify-content: flex-end;
    padding: 0;
  }

  .character-card.personal {
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

  .character-card.personal .character-fallback-icon {
    font-size: 2rem;
  }

  .character-fallback-icon {
    font-size: 1.5rem;
  }

  .character-fallback-icon.hidden {
    display: none;
  }

  .character-thumb {
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

  .character-thumb.loaded {
    opacity: 0.82;
  }

  .character-card.has-thumb:hover .character-thumb,
  .character-card.has-thumb.selected .character-thumb {
    opacity: 1;
    transform: scale(1.025);
  }

  .character-selected-mark {
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

  .character-personal-badge {
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

  .character-card-name {
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

  .character-card.has-thumb .character-card-name {
    background: linear-gradient(
      transparent,
      color-mix(in srgb, var(--surface-darker) 94%, black)
    );
  }

  .character-card:hover {
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

  .character-card.selected {
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

  .character-card.preparing {
    border-color: color-mix(in srgb, var(--performer-color) 68%, transparent);
  }

  .character-loading {
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
    animation: character-loading-spin calc(var(--duration-dramatic) * 2) linear
      infinite;
  }

  @keyframes character-loading-spin {
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
    .character-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .character-card.personal:last-child:nth-child(4n + 1) {
      grid-column: 2;
    }
  }

  @container (min-width: 56rem) {
    .character-grid {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }

    .character-card.personal:last-child:nth-child(8n + 1) {
      grid-column: 4;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .character-card,
    .character-thumb {
      transition: none;
    }

    .character-card:hover,
    .character-card.has-thumb:hover .character-thumb,
    .character-card.has-thumb.selected .character-thumb {
      transform: none;
    }

    .character-loading {
      animation: none;
    }
  }
</style>
