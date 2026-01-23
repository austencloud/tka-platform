<script lang="ts">
  import VoiceInputButton from "./VoiceInputButton.svelte";
  import ImageUpload from "./ImageUpload.svelte";
  import type { DraftSaveStatus } from "../../services/contracts/IFormDraftPersister";

  let {
    value,
    error,
    placeholder,
    isStreaming = false,
    isMobile = false,
    isTouchDevice = false,
    draftStatus = "idle",
    images = $bindable([]),
    disabled = false,
    isInputMode = false,
    onInput,
    onKeydown,
    onVoiceTranscript,
    onInterimTranscript,
    onRecordingEnd,
    onVoiceTimeout,
    onClearText,
    onFocusChange,
  } = $props<{
    value: string;
    error?: string;
    placeholder: string;
    isStreaming?: boolean;
    isMobile?: boolean;
    /** Touch device - hides keyboard shortcuts like "(Shift+Enter to submit)" */
    isTouchDevice?: boolean;
    draftStatus?: DraftSaveStatus;
    images?: string[];
    disabled?: boolean;
    isInputMode?: boolean;
    onInput: (value: string) => void;
    onKeydown: (event: KeyboardEvent) => void;
    onVoiceTranscript: (transcript: string, isFinal: boolean) => void;
    onInterimTranscript: (transcript: string) => void;
    onRecordingEnd: () => void;
    onVoiceTimeout: () => void;
    onClearText: () => void;
    onFocusChange?: (focused: boolean) => void;
  }>();

  let textareaElement = $state<HTMLTextAreaElement | null>(null);
  let isFocused = $state(false);

  function handleFocus() {
    isFocused = true;
    onFocusChange?.(true);

    // On mobile, scroll the textarea into view after keyboard animation
    if (isMobile && textareaElement) {
      setTimeout(() => {
        textareaElement?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }

  function handleBlur() {
    isFocused = false;
    onFocusChange?.(false);
  }

  /** Called when user taps Done on mobile keyboard or presses the Done button */
  export function dismissKeyboard() {
    textareaElement?.blur();
  }

  const minChars = 10;
  const charsNeeded = $derived(Math.max(0, minChars - value.trim().length));
  const charsMet = $derived(value.trim().length >= minChars);
</script>

<div class="field" class:input-mode={isInputMode}>
  <label for="fb-description" class="sr-only"
    >Feedback description (minimum 10 characters)</label
  >
  <div class="textarea-wrapper">
    <textarea
      bind:this={textareaElement}
      id="fb-description"
      class="field-textarea"
      class:has-error={!!error}
      class:streaming={isStreaming}
      class:focused={isFocused}
      {value}
      oninput={(e) => onInput(e.currentTarget.value)}
      onkeydown={onKeydown}
      onfocus={handleFocus}
      onblur={handleBlur}
      placeholder={`${placeholder}${isTouchDevice ? "" : " (Shift+Enter to submit)"}`}
      rows="6"
      inputmode="text"
      enterkeyhint="done"
      aria-invalid={!!error}
      aria-describedby={error ? "fb-description-error" : undefined}
    ></textarea>
    <div class="voice-input-wrapper">
      <VoiceInputButton
        onTranscript={onVoiceTranscript}
        {onInterimTranscript}
        {onRecordingEnd}
        onTimeout={onVoiceTimeout}
        {disabled}
      />
    </div>
  </div>
  <div class="field-footer">
    <div class="field-hint">
      <span
        class="char-count"
        class:met={charsMet}
        aria-live="polite"
        aria-atomic="true"
      >
        {#if !charsMet}
          {charsNeeded} more needed
        {:else}
          <i class="fas fa-check" aria-hidden="true"></i>
        {/if}
      </span>
      {#if draftStatus === "saved"}
        <span class="draft-saved" aria-live="polite">
          <i class="fas fa-cloud-upload-alt" aria-hidden="true"></i>
          Draft saved
        </span>
      {/if}
      {#if error}
        <span class="field-error" id="fb-description-error" role="alert"
          >{error}</span
        >
      {/if}
    </div>
    <div class="field-actions">
      {#if value.trim().length > 0}
        <button
          type="button"
          class="clear-text-btn"
          onclick={onClearText}
          aria-label="Clear feedback text"
          title="Clear text"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
      <ImageUpload bind:images {disabled} />
    </div>
  </div>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 1cqi, 8px);
  }

  .field-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: clamp(8px, 2cqi, 12px);
  }

  .field-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .textarea-wrapper {
    position: relative;
    background: color-mix(in srgb, var(--theme-panel-bg) 80%, transparent);
    border: 1.5px solid
      color-mix(
        in srgb,
        var(--active-type-color) 20%,
        var(--theme-stroke, var(--theme-stroke))
      );
    border-radius: clamp(8px, 1.8cqi, 12px);
    transition:
      border-color 200ms ease,
      background 200ms ease;
  }

  .textarea-wrapper:hover {
    border-color: color-mix(
      in srgb,
      var(--active-type-color) 45%,
      rgba(255, 255, 255, 0.15)
    );
  }

  .textarea-wrapper:focus-within {
    border-color: var(
      --active-type-color,
      var(--theme-accent, var(--semantic-info))
    );
    background: color-mix(
      in srgb,
      var(--active-type-color) 5%,
      var(--theme-panel-bg, rgba(18, 18, 28, 0.98))
    );
    /* Subtle glow on focus for clear visual state */
    box-shadow: 0 0 0 3px
      color-mix(
        in srgb,
        var(--active-type-color, var(--theme-accent)) 20%,
        transparent
      );
  }

  .textarea-wrapper:has(.field-textarea.has-error) {
    border-color: var(--semantic-error, var(--semantic-error));
  }

  .textarea-wrapper:has(.field-textarea.streaming) {
    border-color: var(--theme-accent-strong);
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 8%,
      rgba(0, 0, 0, 0.25)
    );
    box-shadow: 0 0 0 2px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 15%,
        transparent
      );
  }

  .field-textarea {
    width: 100%;
    padding: clamp(8px, 2cqi, 12px) clamp(10px, 2.5cqi, 16px);
    padding-right: clamp(48px, 10cqi, 60px); /* Room for voice button */
    background: transparent;
    border: none;
    color: var(--theme-text);
    font-size: 1rem;
    font-family: inherit;
    min-height: clamp(72px, 15cqi, 100px);
    resize: none;
    line-height: 1.5;
  }

  .field-textarea:focus {
    outline: none;
  }

  .field-textarea::placeholder {
    color: color-mix(in srgb, var(--theme-text-dim) 80%, transparent);
  }

  .clear-text-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    width: clamp(36px, 8cqi, 44px);
    height: clamp(36px, 8cqi, 44px);
    background: transparent;
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-error) 40%,
        var(--theme-stroke, var(--theme-stroke-strong))
      );
    border-radius: clamp(6px, 1.5cqi, 8px);
    color: color-mix(
      in srgb,
      var(--semantic-error) 70%,
      var(--theme-text-dim, var(--theme-text-dim))
    );
    cursor: pointer;
    transition:
      all 150ms ease,
      border-color 150ms ease;
    padding: 0;
    flex-shrink: 0;
  }

  .clear-text-btn:hover {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border-color: var(--semantic-error);
    color: var(--semantic-error);
  }

  .clear-text-btn:active {
    transform: scale(0.95);
  }

  .clear-text-btn i {
    font-size: clamp(0.8rem, 2cqi, 0.95rem);
  }

  .voice-input-wrapper {
    position: absolute;
    bottom: clamp(10px, 2.5cqi, 16px);
    right: clamp(10px, 2.5cqi, 16px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }

  .field-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: clamp(14px, 3cqi, 18px);
  }

  .char-count {
    font-size: clamp(0.7rem, 1.8cqi, 0.8rem);
    font-weight: 500;
    color: color-mix(
      in srgb,
      var(--theme-text-dim, var(--theme-text-dim)) 80%,
      transparent
    );
    transition: color var(--duration-fast) ease;
  }

  .char-count.met {
    color: var(--semantic-success, var(--semantic-success));
  }

  .field-error {
    margin: 0;
    font-size: clamp(0.7rem, 1.8cqi, 0.8rem);
    font-weight: 500;
    color: var(--semantic-error, var(--semantic-error));
  }

  .draft-saved {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: clamp(0.7rem, 1.8cqi, 0.8rem);
    font-weight: 500;
    color: var(--semantic-success);
    animation: fadeInOut 2s ease-in-out;
  }

  .draft-saved i {
    font-size: 0.9em;
    opacity: 0.8;
  }

  @keyframes fadeInOut {
    0% {
      opacity: 0;
      transform: translateY(-4px);
    }
    20% {
      opacity: 1;
      transform: translateY(0);
    }
    80% {
      opacity: 1;
      transform: translateY(0);
    }
    100% {
      opacity: 0;
      transform: translateY(-4px);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .draft-saved {
      animation: none;
    }
  }

  /* Input mode - textarea expands to fill available space */
  .field.input-mode {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0; /* Allow flex shrinking */
    overflow: hidden;
  }

  .field.input-mode .textarea-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .field.input-mode .field-textarea {
    flex: 1;
    min-height: 100px;
    max-height: 100%;
    overflow-y: auto;
  }

  /* Hide voice button in textarea during input mode - it's in the toolbar */
  .field.input-mode .voice-input-wrapper {
    display: none;
  }

  /* Keep footer visible in input mode but compact - image upload is important */
  .field.input-mode .field-footer {
    margin-top: 8px;
  }

  /* Hide the char count hint in input mode - it's less relevant */
  .field.input-mode .field-hint .char-count {
    display: none;
  }
</style>
