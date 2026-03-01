<!--
WordInputCard.svelte - Card wrapping WordInput for Spell mode
Follows BaseCard visual pattern with gradient background.
Replaces LengthCard when mode=SPELL in the card grid.
-->
<script lang="ts">
  import CardHeader from "./shared/CardHeader.svelte";
  import { container } from "$lib/shared/di";
  import type { IGreekKeyMapper } from "$lib/shared/keyboard/services/contracts/IGreekKeyMapper";
  import {
    uppercasePreservingGreek,
    insertAtCursor,
  } from "$lib/shared/keyboard/domain/greek-input-helpers";

  let {
    value = "",
    onInput,
    onSubmit,
    color = "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
    shadowColor = "160deg 70% 40%",
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    value: string;
    onInput: (value: string) => void;
    onSubmit?: () => void;
    color?: string;
    shadowColor?: string;
    cardIndex?: number;
    headerFontSize?: string;
  }>();

  const greekKeyMapper = container.items.greekKeyMapper as IGreekKeyMapper;

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    // Uppercase Latin but preserve Greek lowercase (α, β, γ, etc.)
    const uppercased = uppercasePreservingGreek(target.value);
    if (target.value !== uppercased) {
      target.value = uppercased;
    }
    onInput(uppercased);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && value.trim()) {
      event.preventDefault();
      onSubmit?.();
      return;
    }

    // Skip Greek mapping when modifiers held
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

    // Skip numpad keys when NumLock is off
    if (event.code.startsWith("Numpad") && !event.getModifierState("NumLock")) return;

    const symbol = greekKeyMapper.getSymbol(event.code);
    if (!symbol) return;

    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const cursor = input.selectionStart ?? value.length;
    const result = insertAtCursor(value, symbol, cursor);
    const uppercased = uppercasePreservingGreek(result.value);

    input.value = uppercased;
    input.setSelectionRange(result.cursor, result.cursor);
    onInput(uppercased);
  }

  function handleClear() {
    onInput("");
  }
</script>

<div
  class="word-input-card"
  style="--card-color: {color}; --shadow-color: {shadowColor}; --card-index: {cardIndex};"
>
  <CardHeader title="Word" {headerFontSize} />
  <div class="input-row">
    <input
      type="text"
      class="word-field"
      placeholder="WORD"
      {value}
      oninput={handleInput}
      onkeydown={handleKeydown}
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
    />
    {#if value.length > 0}
      <button class="clear-btn" onclick={handleClear} aria-label="Clear word">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    {/if}
  </div>
</div>

<style>
  .word-input-card {
    container-type: size;
    container-name: word-input-card;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    padding: clamp(6px, 2cqh, 12px) clamp(4px, 1.5cqw, 8px);
    border-radius: 16px;
    background: var(--card-color);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;
    color: white;

    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.12),
      0 1px 2px hsl(var(--shadow-color) / 0.15),
      0 2px 4px hsl(var(--shadow-color) / 0.12),
      0 4px 8px hsl(var(--shadow-color) / 0.1),
      inset 0 1px 0 var(--theme-stroke, rgba(255, 255, 255, 0.1));

    /* Entrance animation */
    animation: cardFadeIn var(--duration-emphasis, 300ms) cubic-bezier(0.4, 0, 0.2, 1)
      calc(var(--card-index) * 40ms) both;
  }

  /* Glossy sheen overlay */
  .word-input-card::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-text, white) 30%, transparent) 0%,
      color-mix(in srgb, var(--theme-text, white) 15%, transparent) 40%,
      color-mix(in srgb, var(--theme-text, white) 5%, transparent) 70%,
      transparent 100%
    );
    border-radius: 16px 16px 0 0;
    pointer-events: none;
    z-index: 1;
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    flex: 1;
    min-height: 0;
    position: relative;
    z-index: 2;
  }

  .word-field {
    flex: 1;
    min-width: 0;
    background: rgba(0, 0, 0, 0.25);
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    color: white;
    font-size: var(--card-text-size, clamp(14px, 2vmin, 22px));
    font-weight: 700;
    letter-spacing: 1.5px;
    text-align: center;
    padding: 4px 8px;
    height: 100%;
    outline: none;
    font-family: inherit;
    transition: border-color 150ms ease;
  }

  .word-field::placeholder {
    color: rgba(255, 255, 255, 0.4);
    font-weight: 500;
    letter-spacing: 2px;
  }

  .word-field:focus {
    border-color: rgba(255, 255, 255, 0.5);
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-size: 12px;
    transition: all 100ms ease;
  }

  .clear-btn:hover {
    background: rgba(0, 0, 0, 0.4);
    color: white;
  }

  .clear-btn:active {
    transform: scale(0.92);
  }

  @keyframes cardFadeIn {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .word-input-card {
      animation: none;
    }
    .word-field,
    .clear-btn {
      transition: none;
    }
  }
</style>
