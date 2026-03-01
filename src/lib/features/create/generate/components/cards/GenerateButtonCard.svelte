<!--
GenerateButtonCard.svelte - Generate button as a card in the grid
In spell mode, embeds a word input field directly in the generate bar.
In freeform mode, renders as a pure button.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { onMount } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import type { UIGenerationConfig } from "../../state/generate-config.svelte";
  import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { uiConfigToGenerationOptions } from "$lib/features/create/generate/shared/utils/config-mapper";
  import type { IGreekKeyMapper } from "$lib/shared/keyboard/services/contracts/IGreekKeyMapper";
  import {
    uppercasePreservingGreek,
    insertAtCursor,
  } from "$lib/shared/keyboard/domain/greek-input-helpers";

  let {
    isGenerating,
    hasSettingsChanged = false,
    onGenerateClicked,
    config,
    startEndOptions = null,
    disabled = false,
    spellMode = false,
    wordInputValue = "",
    onWordInput,
    onWordSubmit,
  } = $props<{
    isGenerating: boolean;
    hasSettingsChanged?: boolean;
    onGenerateClicked: (options: any) => Promise<void>;
    config: UIGenerationConfig;
    startEndOptions?: StartEndOptions | null;
    disabled?: boolean;
    spellMode?: boolean;
    wordInputValue?: string;
    onWordInput?: (value: string) => void;
    onWordSubmit?: () => void;
  }>();

  const isDisabled = $derived(isGenerating || disabled);

  let buttonLabel = $derived(
    isGenerating
      ? t("generator_button_generating")
      : hasSettingsChanged
        ? t("generator_button_regenerate")
        : t("generator_button")
  );

  let buttonIcon = $derived(hasSettingsChanged && !isGenerating ? "arrows-rotate" : "dice");

  let hapticService: IHapticFeedback | null = $state(null);
  let greekKeyMapper: IGreekKeyMapper | null = $state(null);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
    if (spellMode) {
      greekKeyMapper = container.items.greekKeyMapper as IGreekKeyMapper;
    }
  });

  async function handleClick() {
    hapticService?.trigger("selection");
    const generationOptions = uiConfigToGenerationOptions(
      config,
      PropType.FAN,
      startEndOptions
    );
    await onGenerateClicked(generationOptions);
  }

  // ─── Spell mode input handlers ───

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const uppercased = uppercasePreservingGreek(target.value);
    if (target.value !== uppercased) {
      target.value = uppercased;
    }
    onWordInput?.(uppercased);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && wordInputValue.trim()) {
      event.preventDefault();
      onWordSubmit?.();
      return;
    }

    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.code.startsWith("Numpad") && !event.getModifierState("NumLock")) return;

    const symbol = greekKeyMapper?.getSymbol(event.code);
    if (!symbol) return;

    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const cursor = input.selectionStart ?? wordInputValue.length;
    const result = insertAtCursor(wordInputValue, symbol, cursor);
    const uppercased = uppercasePreservingGreek(result.value);

    input.value = uppercased;
    input.setSelectionRange(result.cursor, result.cursor);
    onWordInput?.(uppercased);
  }

  function handleClear() {
    onWordInput?.("");
  }

  async function handleGenerateClick() {
    if (isDisabled) return;
    hapticService?.trigger("selection");
    if (spellMode) {
      onWordSubmit?.();
    } else {
      await handleClick();
    }
  }
</script>

{#if spellMode}
  <!-- Spell mode: word input embedded in the generate bar -->
  <div
    class="generate-button-card spell-bar"
    class:dirty={hasSettingsChanged && !isGenerating}
    class:disabled={isDisabled}
  >
    <input
      type="text"
      class="spell-input"
      placeholder="TYPE A WORD"
      value={wordInputValue}
      oninput={handleInput}
      onkeydown={handleKeydown}
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      disabled={isGenerating}
    />

    {#if wordInputValue.length > 0 && !isGenerating}
      <button class="clear-btn" onclick={handleClear} aria-label="Clear word" type="button">
        <FontAwesomeIcon icon="times" style="solid" />
      </button>
    {/if}

    <button
      class="generate-icon-btn"
      onclick={handleGenerateClick}
      disabled={isDisabled}
      type="button"
      aria-label={buttonLabel}
    >
      {#if isGenerating}
        <FontAwesomeIcon icon="spinner" style="solid" class="fa-spin" />
      {:else}
        <FontAwesomeIcon icon={buttonIcon} style="solid" />
      {/if}
    </button>
  </div>
{:else}
  <!-- Freeform mode: pure generate button -->
  <button
    class="generate-button-card"
    class:dirty={hasSettingsChanged && !isGenerating}
    onclick={handleClick}
    disabled={isDisabled}
    type="button"
    aria-label={buttonLabel}
  >
    <div class="button-content">
      <FontAwesomeIcon icon={buttonIcon} style="solid" />
      <span>{buttonLabel}</span>
    </div>
  </button>
{/if}

<style>
  .generate-button-card {
    width: 100%;
    height: 100%;
    border: none;

    background: linear-gradient(
      135deg,
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 85%,
          #065f46
        )
        0%,
      var(--semantic-success, var(--semantic-success)) 25%,
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 100%,
          #a7f3d0
        )
        50%,
      var(--semantic-success, var(--semantic-success)) 75%,
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 85%,
          #065f46
        )
        100%
    );

    animation:
      meshGradientFlow 8s ease infinite,
      subtlePulse 2s ease-in-out infinite;

    color: var(--theme-text, white);
    border-radius: 20px;

    font-size: var(--card-text-size);
    font-weight: var(--card-text-weight);
    letter-spacing: var(--card-text-spacing);
    text-shadow: var(--card-text-shadow);

    cursor: pointer;
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;

    box-shadow:
      0 4px 12px
        color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 40%,
          transparent
        ),
      0 2px 6px var(--theme-shadow),
      inset 0 1px 0 var(--theme-stroke-strong),
      inset 0 -1px 0 var(--theme-shadow);
  }

  /* ─── Spell bar: horizontal layout with input + icon ─── */

  .spell-bar {
    cursor: default;
    padding: 0 6px 0 12px;
    gap: 6px;
    justify-content: stretch;
  }

  .spell-input {
    flex: 1;
    min-width: 0;
    background: rgba(0, 0, 0, 0.2);
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: white;
    font-size: var(--card-text-size, clamp(14px, 2vmin, 22px));
    font-weight: 700;
    letter-spacing: 1.5px;
    text-align: center;
    padding: 4px 12px;
    height: calc(100% - 12px);
    outline: none;
    font-family: inherit;
    transition: border-color 150ms ease;
  }

  .spell-input::placeholder {
    color: rgba(255, 255, 255, 0.35);
    font-weight: 500;
    letter-spacing: 2px;
  }

  .spell-input:focus {
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(0, 0, 0, 0.3);
  }

  .spell-input:disabled {
    opacity: 0.5;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-size: 14px;
    transition: all 100ms ease;
  }

  .clear-btn:hover {
    background: rgba(0, 0, 0, 0.4);
    color: white;
  }

  .clear-btn:active {
    transform: scale(0.92);
  }

  .generate-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(40px, 8cqw, 56px);
    height: calc(100% - 10px);
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.2);
    border: 1.5px solid rgba(255, 255, 255, 0.25);
    border-radius: 14px;
    color: white;
    cursor: pointer;
    font-size: clamp(16px, 2.5vmin, 24px);
    transition: all 150ms ease;
  }

  .generate-icon-btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.35);
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.05);
  }

  .generate-icon-btn:active:not(:disabled) {
    transform: scale(0.94);
  }

  .generate-icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .spell-bar.disabled {
    opacity: 0.5;
    filter: grayscale(0.5);
    animation: none;
  }

  /* ─── Freeform button styles ─── */

  .generate-button-card.dirty {
    box-shadow:
      0 0 0 3px var(--semantic-warning, #f59e0b),
      0 4px 12px
        color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 40%,
          transparent
        ),
      0 2px 6px var(--theme-shadow),
      inset 0 1px 0 var(--theme-stroke-strong),
      inset 0 -1px 0 var(--theme-shadow);
  }

  .button-content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    gap: 0.5em;
  }

  .generate-button-card:hover:not(:disabled):not(.spell-bar) {
    filter: brightness(1.2) saturate(1.15);
    transform: scale(1.02);

    box-shadow:
      0 8px 20px
        color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 60%,
          transparent
        ),
      0 4px 12px var(--theme-shadow),
      inset 0 1px 0 var(--theme-stroke-strong),
      inset 0 -1px 0 var(--theme-shadow);

    text-shadow:
      0 2px 6px rgba(0, 0, 0, 0.6),
      0 0 25px color-mix(in srgb, var(--theme-text) 40%, transparent);

    animation-duration: 6s, 1.5s;
  }

  .generate-button-card:active:not(:disabled):not(.spell-bar) {
    transform: scale(0.98);
    transition: all var(--duration-instant) ease;
  }

  button.generate-button-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    animation: none;
    filter: grayscale(0.5);
  }

  /* Mobile: Disable hover effects on pure button */
  @media (max-width: 768px) {
    .generate-button-card:hover:not(:disabled):not(.spell-bar) {
      transform: none;
      filter: none;
    }

    .generate-button-card:focus:not(:disabled):not(.spell-bar) {
      transform: none;
    }
  }

  @keyframes meshGradientFlow {
    0%,
    100% {
      background-position: 0% 50%;
    }
    25% {
      background-position: 50% 100%;
    }
    50% {
      background-position: 100% 50%;
    }
    75% {
      background-position: 50% 0%;
    }
  }

  @keyframes subtlePulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.015);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .generate-button-card {
      animation: none;
    }

    .generate-button-card:hover:not(:disabled) {
      animation: none;
    }

    .spell-input,
    .clear-btn,
    .generate-icon-btn {
      transition: none;
    }
  }
</style>
