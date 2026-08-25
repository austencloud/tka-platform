<script lang="ts">
  import { Popover } from "bits-ui";

  import { getFilmDirectorContext } from "../_lib/film-director-context";
  import {
    filmOriginIsSaved,
    filmOriginLabel,
    type FilmOrigin,
  } from "../_lib/film-origin";

  let {
    origin,
    hasPreviousVersion = false,
    busy = false,
    onSave,
    onSaveAsNew,
    onRestore,
  }: {
    origin: FilmOrigin;
    hasPreviousVersion?: boolean;
    busy?: boolean;
    onSave: () => void;
    onSaveAsNew: () => void;
    onRestore: () => void;
  } = $props();

  const director = getFilmDirectorContext();

  let open = $state(false);

  const saved = $derived(filmOriginIsSaved(origin));
  const label = $derived(filmOriginLabel(origin, director.film.title));

  function run(action: () => void): void {
    open = false;
    action();
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <button {...props} class="film-button" aria-label="Film">
        <i class="fas fa-clapperboard" aria-hidden="true"></i>
        <span>Film</span>
      </button>
    {/snippet}
  </Popover.Trigger>

  <Popover.Content side="top" align="end" sideOffset={10} collisionPadding={12}>
    {#snippet child({ props, open: isOpen })}
      {#if isOpen}
        <div {...props} class="film-panel">
          <header>
            <span class="kicker">{saved ? "Saved film" : "Starting point"}</span>
            <strong>{label}</strong>
          </header>

          <button type="button" disabled={busy} onclick={() => run(onSave)}>
            <i class="fas fa-floppy-disk" aria-hidden="true"></i>
            {saved ? "Save" : "Save film"}
          </button>

          {#if saved}
            <button type="button" disabled={busy} onclick={() => run(onSaveAsNew)}>
              <i class="fas fa-copy" aria-hidden="true"></i>
              Save as new
            </button>
          {/if}

          {#if hasPreviousVersion}
            <button type="button" disabled={busy} onclick={() => run(onRestore)}>
              <i class="fas fa-rotate-left" aria-hidden="true"></i>
              Restore previous version
            </button>
          {/if}

          <div class="divider" aria-hidden="true"></div>

          <button
            type="button"
            aria-pressed={director.editorOpen}
            onclick={() => run(director.toggleEditor)}
          >
            <i class="fas fa-code" aria-hidden="true"></i>
            Scene JSON
          </button>
        </div>
      {/if}
    {/snippet}
  </Popover.Content>
</Popover.Root>

<style>
  .film-button {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0 0.9rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.7rem;
    color: var(--theme-text, #fff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 750;
    white-space: nowrap;
    cursor: pointer;
  }

  .film-button:hover {
    border-color: var(--theme-accent, #9d8cff);
  }

  .film-button:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  .film-panel {
    z-index: 80;
    display: grid;
    width: min(20rem, calc(100vw - 1.5rem));
    gap: 0.35rem;
    padding: 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.9rem;
    color: var(--theme-text, #fff);
    background: var(--theme-panel-bg, #10111b);
    box-shadow: 0 1.5rem 3rem rgba(0, 0, 0, 0.45);
  }

  header {
    display: grid;
    gap: 0.15rem;
    padding: 0 0.25rem 0.5rem;
  }

  .kicker {
    color: var(--theme-accent, #b0a4ff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .film-panel button {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0 0.7rem;
    border: 1px solid transparent;
    border-radius: 0.6rem;
    color: inherit;
    background: transparent;
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    text-align: left;
    cursor: pointer;
  }

  .film-panel button:hover:not(:disabled) {
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.14));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
  }

  .film-panel button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .film-panel button:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: -2px;
  }

  .film-panel button i {
    width: 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    text-align: center;
  }

  .divider {
    height: 1px;
    margin: 0.3rem 0.25rem;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.14));
  }
</style>
