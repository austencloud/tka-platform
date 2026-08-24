<script lang="ts">
  import { getFilmDirectorContext } from "../_lib/film-director-context";

  const director = getFilmDirectorContext();
</script>

{#if director.editorOpen}
  <aside class="json-editor" aria-label="Film scene JSON editor">
    <div class="editor-heading">
      <div>
        <span>Director input</span>
        <h2>Scene JSON</h2>
      </div>
      <button
        type="button"
        onclick={director.toggleEditor}
        aria-label="Close scene JSON"
      >
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    </div>

    <p>
      Paste a version 1 film description. Apply validates every shot before the
      viewer changes.
    </p>

    <textarea
      class="themed-scrollbar"
      value={director.draft}
      oninput={(event) =>
        director.setDraft((event.currentTarget as HTMLTextAreaElement).value)}
      spellcheck="false"
      aria-label="Film scene JSON"
      aria-invalid={director.validationError ? "true" : undefined}
    ></textarea>

    <div class="error-slot" aria-live="polite">
      {#if director.validationError}
        <span
          ><i class="fas fa-triangle-exclamation" aria-hidden="true"
          ></i>{director.validationError}</span
        >
      {/if}
    </div>

    <div class="editor-actions">
      <button class="secondary" type="button" onclick={director.resetDraft}
        >Reset</button
      >
      <button class="primary" type="button" onclick={director.applyDraft}
        >Apply scene</button
      >
    </div>
  </aside>
{/if}

<style>
  .json-editor {
    position: absolute;
    inset: max(0.75rem, env(safe-area-inset-top))
      max(0.75rem, env(safe-area-inset-right))
      max(0.75rem, env(safe-area-inset-bottom)) auto;
    z-index: 100;
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) minmax(2.5rem, auto) auto;
    gap: 0.8rem;
    width: min(38rem, calc(100% - 1.5rem));
    padding: 1rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.16));
    border-radius: 1rem;
    color: var(--theme-text, #fff);
    background: var(--theme-panel-bg, #10111b);
    box-shadow: 0 2rem 6rem rgba(0, 0, 0, 0.58);
  }

  .editor-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .editor-heading span {
    color: var(--theme-accent, #a99cff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 780;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    margin-top: 0.15rem;
    font-size: 1.3rem;
  }

  p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.66));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.5;
  }

  textarea {
    width: 100%;
    min-height: 0;
    resize: none;
    padding: 0.9rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.75rem;
    outline: none;
    color: #e8e8f2;
    background: #090a11;
    font:
      0.82rem/1.5 "Cascadia Code",
      "SFMono-Regular",
      Consolas,
      monospace;
    tab-size: 2;
  }

  textarea:focus {
    border-color: var(--theme-accent, #9d8cff);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent, #9d8cff) 24%, transparent);
  }

  .error-slot {
    min-height: 2.5rem;
    overflow: auto;
    color: var(--semantic-error, #ff8f8f);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.4;
  }

  .error-slot span {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
  }

  button {
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0 0.9rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.16));
    border-radius: 0.7rem;
    color: inherit;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    font: inherit;
    font-weight: 750;
    cursor: pointer;
  }

  button:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.34));
  }

  button:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  .primary {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #9d8cff) 68%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #7869eb) 34%,
      var(--theme-card-bg, #242431)
    );
  }

  @media (max-width: 42rem) {
    .json-editor {
      inset: 0;
      width: 100%;
      border: 0;
      border-radius: 0;
      padding: max(0.8rem, env(safe-area-inset-top))
        max(0.8rem, env(safe-area-inset-right))
        max(0.8rem, env(safe-area-inset-bottom))
        max(0.8rem, env(safe-area-inset-left));
    }
  }
</style>
