<!--
  ActHeader.svelte - Editable act name and description with music controls
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { ActData, MusicPlayerState } from "../domain/types/write";
  import { onMount } from "svelte";

  interface Props {
    act: ActData;
    musicPlayerState?: MusicPlayerState;
    disabled?: boolean;
    onActInfoChanged?: (name: string, description: string) => void;
    onMusicLoadRequested?: () => void;
  }

  let {
    act,
    musicPlayerState,
    disabled = false,
    onActInfoChanged,
    onMusicLoadRequested,
  }: Props = $props();

  let hapticService: HapticFeedback;
  let nameInput = $state("");
  let descriptionInput = $state("");
  let isEditingName = $state(false);
  let isEditingDescription = $state(false);

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  $effect(() => {
    nameInput = act.name || "";
    descriptionInput = act.description || "";
  });

  function startEditingName() {
    if (disabled) return;
    hapticService?.trigger("selection");
    isEditingName = true;
  }

  function finishEditingName() {
    isEditingName = false;
    if (nameInput !== act.name) {
      onActInfoChanged?.(nameInput, act.description || "");
    }
  }

  function handleNameKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") finishEditingName();
    else if (event.key === "Escape") {
      nameInput = act.name || "";
      isEditingName = false;
    }
  }

  function startEditingDescription() {
    if (disabled) return;
    hapticService?.trigger("selection");
    isEditingDescription = true;
  }

  function finishEditingDescription() {
    isEditingDescription = false;
    if (descriptionInput !== act.description) {
      onActInfoChanged?.(act.name || "", descriptionInput);
    }
  }

  function handleDescriptionKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      finishEditingDescription();
    } else if (event.key === "Escape") {
      descriptionInput = act.description || "";
      isEditingDescription = false;
    }
  }

  function handleMusicClick() {
    if (disabled) return;
    hapticService?.trigger("selection");
    onMusicLoadRequested?.();
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }
</script>

<div class="act-header" class:disabled>
  <!-- Name -->
  <div class="field">
    {#if isEditingName}
      <input
        class="field-input title-input"
        type="text"
        bind:value={nameInput}
        onblur={finishEditingName}
        onkeydown={handleNameKeydown}
        placeholder="Act name..."
      />
    {:else}
      <button
        class="field-display title-display"
        class:placeholder={!nameInput}
        onclick={startEditingName}
        type="button"
      >
        {nameInput || "Untitled Act"}
        <i class="fas fa-pen edit-icon" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  <!-- Description -->
  <div class="field">
    {#if isEditingDescription}
      <textarea
        class="field-input desc-input"
        bind:value={descriptionInput}
        onblur={finishEditingDescription}
        onkeydown={handleDescriptionKeydown}
        placeholder="Add a description..."
        rows="2"
      ></textarea>
    {:else}
      <button
        class="field-display desc-display"
        class:placeholder={!descriptionInput}
        onclick={startEditingDescription}
        type="button"
      >
        {descriptionInput || "Add a description..."}
      </button>
    {/if}
  </div>

  <!-- Stats row -->
  <div class="stats-row">
    <button
      class="music-btn"
      onclick={handleMusicClick}
      {disabled}
      type="button"
    >
      <i class="fas fa-music" aria-hidden="true"></i>
      <span class="music-label">
        {#if musicPlayerState?.filename}
          {musicPlayerState.filename}
          {#if musicPlayerState.duration}
            <span class="duration"
              >({formatDuration(musicPlayerState.duration / 1000)})</span
            >
          {/if}
        {:else}
          Add music
        {/if}
      </span>
    </button>

    <div class="stat">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
      <span>{act.sequences?.length || 0} sequences</span>
    </div>
  </div>
</div>

<style>
  .act-header {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .act-header.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .field {
    position: relative;
  }

  .field-input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(0, 0, 0, 0.2);
    border: 2px solid var(--theme-accent, #6366f1);
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-family: inherit;
    outline: none;
  }

  .field-input:focus {
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
  }

  .title-input {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
  }

  .desc-input {
    font-size: var(--font-size-sm, 14px);
    resize: none;
    min-height: 60px;
  }

  .field-display {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    text-align: left;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .field-display:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .field-display:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .field-display.placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-style: italic;
  }

  .title-display {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
  }

  .desc-display {
    font-size: var(--font-size-sm, 14px);
    line-height: 1.4;
  }

  .edit-icon {
    flex-shrink: 0;
    font-size: 0.7rem;
    opacity: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: opacity var(--duration-fast) ease;
  }

  .field-display:hover .edit-icon {
    opacity: 1;
  }

  .stats-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding-top: var(--spacing-xs);
  }

  .music-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .music-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .music-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .music-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .music-btn i {
    color: var(--theme-accent, #f43f5e);
    font-size: 0.8rem;
  }

  .music-label {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .duration {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .stat {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .stat i {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  @media (max-width: 480px) {
    .stats-row {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-xs);
    }

    .music-label {
      max-width: 150px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .field-display,
    .music-btn,
    .edit-icon {
      transition: none;
    }
  }
</style>
