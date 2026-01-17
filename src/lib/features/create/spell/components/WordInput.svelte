<!--
WordInput.svelte - Text input for word entry

Features:
- Text input with placeholder
- Button to toggle letter palette
- Backspace/clear functionality
-->
<script lang="ts">
  let {
    value = "",
    onInput,
    disabled = false,
    onFocusChange,
  }: {
    value: string;
    onInput: (value: string) => void;
    disabled?: boolean;
    /** Called when input focus state changes */
    onFocusChange?: (focused: boolean) => void;
  } = $props();

  function handleFocus() {
    onFocusChange?.(true);
  }

  function handleBlur() {
    // Small delay to allow clicking on palette buttons before hiding
    setTimeout(() => {
      onFocusChange?.(false);
    }, 150);
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    onInput(target.value);
  }

  function handleClear() {
    onInput("");
  }

  function handleBackspace() {
    if (value.length > 0) {
      onInput(value.slice(0, -1));
    }
  }
</script>

<div class="word-input-container">
  <div class="input-wrapper">
    <input
      type="text"
      class="word-input"
      placeholder="Type your word..."
      {value}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      {disabled}
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
    />

    <div class="input-actions">
      {#if value.length > 0}
        <button
          class="action-button"
          onclick={handleBackspace}
          title="Backspace"
          aria-label="Delete last character"
          {disabled}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"
            />
          </svg>
        </button>

        <button
          class="action-button"
          onclick={handleClear}
          title="Clear all"
          aria-label="Clear all text"
          {disabled}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <div class="input-hint">
    Type letters A-Z or use the Greek palette for special characters
  </div>
</div>

<style>
  .word-input-container {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-xs, 4px);
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    padding: var(--settings-spacing-sm, 8px);
    transition: border-color var(--duration-normal) ease;
  }

  .input-wrapper:focus-within {
    border-color: var(--theme-accent, #6366f1);
  }

  .word-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-lg, 18px);
    font-family: inherit;
    padding: var(--settings-spacing-sm, 8px);
    outline: none;
    min-width: 0;
  }

  .word-input::placeholder {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .word-input:disabled {
    opacity: 0.5;
  }

  .input-actions {
    display: flex;
    gap: var(--settings-spacing-xs, 4px);
    flex-shrink: 0;
  }

  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .action-button:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    padding-left: var(--settings-spacing-sm, 8px);
  }
</style>
