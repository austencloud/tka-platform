<script lang="ts">
  import {
    CHARACTER_DEFINITIONS,
    type CharacterId,
  } from "$lib/shared/3d/domain/character-model";
  import { characterThumbnailUrl } from "../../constants/r2-cdn";

  interface Props {
    /** The tile the radiogroup treats as chosen. In the select modal this is
        the previewed character, which is not yet the applied one. */
    selectedCharacterId: CharacterId | null;
    /** The character actually on the performer(s) right now. Marked with a badge
        so previewing another body never erases where you started. */
    appliedCharacterId?: CharacterId | null;
    pendingCharacterId: CharacterId | null;
    /** Names what choosing a tile does, since it is not always "select". */
    groupLabel?: string;
    onSelect: (id: CharacterId) => void;
    onIntent: (id: CharacterId) => void;
    onCancelIntent: () => void;
  }

  let {
    selectedCharacterId,
    appliedCharacterId = null,
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
        aria-label={appliedCharacterId === definition.id
          ? `${definition.name}, current character`
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
        {#if appliedCharacterId === definition.id}
          <span class="character-current-badge" aria-hidden="true">Current</span
          >
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
    display: flex;
    flex-direction: column;
    gap: 10px;
    container-type: inline-size;
  }
  .character-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .character-card {
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
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast),
      transform var(--transition-fast);
  }
  .character-card.has-thumb {
    padding: 0;
    justify-content: flex-end;
  }
  .character-card.personal {
    grid-column: 2 / span 2;
    border-color: color-mix(
      in srgb,
      var(--performer-color) 35%,
      var(--theme-stroke)
    );
    background: color-mix(
      in srgb,
      var(--performer-color) 12%,
      var(--theme-card-bg)
    );
  }
  .character-card.personal .character-fallback-icon {
    font-size: 28px;
  }
  .character-fallback-icon {
    font-size: 19px;
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
    transition: opacity var(--transition-fast);
  }
  .character-thumb.loaded {
    opacity: 0.74;
  }
  .character-card.has-thumb:hover .character-thumb,
  .character-card.has-thumb.selected .character-thumb {
    opacity: 1;
  }
  .character-current-badge {
    position: absolute;
    z-index: 2;
    top: 4px;
    left: 4px;
    padding: 2px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--performer-color) 82%, black);
    color: white;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    line-height: 1.2;
  }
  .character-personal-badge {
    position: absolute;
    z-index: 2;
    top: 4px;
    right: 4px;
    padding: 2px 6px;
    border-radius: 999px;
    background: var(--surface-inset-deep);
    color: var(--theme-text-dim);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.2;
  }
  .character-card-name {
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
  .character-card.has-thumb .character-card-name {
    background: linear-gradient(
      transparent,
      color-mix(in srgb, var(--surface-darker) 82%, black)
    );
  }
  .character-card:hover {
    background: color-mix(in srgb, var(--performer-color) 10%, transparent);
    border-color: color-mix(in srgb, var(--performer-color) 30%, transparent);
    color: white;
    transform: translateY(-1px);
  }
  .character-card.selected {
    background: color-mix(in srgb, var(--performer-color) 22%, transparent);
    border-color: var(--performer-color);
    color: white;
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--performer-color) 24%, transparent);
  }
  .character-card.preparing {
    border-color: color-mix(in srgb, var(--performer-color) 55%, transparent);
  }
  .character-loading {
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
    animation: character-loading-spin var(--duration-dramatic) linear infinite;
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
  @container (min-width: 580px) {
    .character-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
    .character-card.personal {
      grid-column: auto / span 2;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .character-card,
    .character-thumb {
      transition: none;
    }
    .character-loading {
      animation: none;
    }
  }
</style>
