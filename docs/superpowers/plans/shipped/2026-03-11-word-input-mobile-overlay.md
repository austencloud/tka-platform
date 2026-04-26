# Word Input Mobile Overlay Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline word input focus on mobile with a focused overlay that sits above the card grid, preventing the virtual keyboard from covering the Generate button.

**Architecture:** On mobile, tapping the word card opens a `WordInputOverlay` that takes over the screen with a backdrop + input field. The existing `MobileInputToolbar` (moved to shared) sits above the keyboard with a Done button. Desktop behavior is unchanged.

**Tech Stack:** Svelte 5, TypeScript, existing MobileInputToolbar keyboard detection

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/shared/components/MobileInputToolbar.svelte` | **Create** (move from feedback) | Keyboard-aware toolbar with Done button |
| `src/lib/features/feedback/components/submit/FeedbackForm.svelte` | **Modify** | Update import path |
| `src/lib/features/create/generate/state/spell-mode-state.svelte.ts` | **Modify** | Add `isWordInputOpen` flag |
| `src/lib/features/create/generate/components/cards/WordInputOverlay.svelte` | **Create** | Focused overlay with input + backdrop |
| `src/lib/features/create/generate/components/cards/WordInputCard.svelte` | **Modify** | Open overlay on mobile tap |
| `src/lib/features/create/generate/components/GeneratePanel.svelte` | **Modify** | Host overlay, wire state |

---

## Chunk 1: Move MobileInputToolbar to Shared

### Task 1: Move MobileInputToolbar to shared location

**Files:**
- Create: `src/lib/shared/components/MobileInputToolbar.svelte`
- Delete: `src/lib/features/feedback/components/submit/MobileInputToolbar.svelte`
- Modify: `src/lib/features/feedback/components/submit/FeedbackForm.svelte`

- [ ] **Step 1: Copy MobileInputToolbar to shared**

Copy the file from `src/lib/features/feedback/components/submit/MobileInputToolbar.svelte` to `src/lib/shared/components/MobileInputToolbar.svelte`.

The component currently imports feedback-specific dependencies:
- `VoiceInputButton` from `./VoiceInputButton.svelte`
- `IVoiceRecorder` and `VoiceRecordingResult` types from `../../services/contracts/IVoiceRecorder`
- `t` from `$lib/shared/i18n/i18n.svelte.js`

To make it reusable, refactor the props interface. Remove the voice recorder, recording start/end callbacks, and submit button from the component. These are feedback-specific concerns. The shared version should only provide:

```typescript
let {
  visible = false,
  disabled = false,
  onDone,
  onKeyboardHeightChange,
} = $props<{
  visible: boolean;
  disabled?: boolean;
  onDone: () => void;
  onKeyboardHeightChange?: (height: number) => void;
}>();
```

The template should render only the Done button (no voice button, no submit button). Keep the `toolbar-left` slot area as a `{@render}` snippet slot so consumers can inject custom left-side content:

```typescript
let {
  visible = false,
  disabled = false,
  onDone,
  onKeyboardHeightChange,
  leftContent,
} = $props<{
  visible: boolean;
  disabled?: boolean;
  onDone: () => void;
  onKeyboardHeightChange?: (height: number) => void;
  leftContent?: import("svelte").Snippet;
}>();
```

Template:
```svelte
{#if shouldShow}
  <div class="mobile-input-toolbar" ...>
    <div class="toolbar-content">
      <div class="toolbar-left">
        {#if leftContent}
          {@render leftContent()}
        {/if}
      </div>
      <div class="toolbar-right">
        <button type="button" class="done-button" onclick={onDone} {disabled} aria-label="Done">
          <span class="done-text">Done</span>
        </button>
      </div>
    </div>
  </div>
{/if}
```

All keyboard detection logic (VirtualKeyboard API, visualViewport fallback, DevTools simulation guard, debounced height) stays in this shared component unchanged.

- [ ] **Step 2: Update FeedbackForm to use shared MobileInputToolbar**

In `src/lib/features/feedback/components/submit/FeedbackForm.svelte`:

Change import from:
```typescript
import MobileInputToolbar from "./MobileInputToolbar.svelte";
```
To:
```typescript
import MobileInputToolbar from "$lib/shared/components/MobileInputToolbar.svelte";
```

Update the MobileInputToolbar usage to pass feedback-specific content via the `leftContent` snippet and handle submit separately. The feedback form should render its own submit button and voice button in the `leftContent` snippet:

```svelte
<MobileInputToolbar
  visible={isTextareaFocused}
  disabled={formState.isSubmitting}
  onDone={handleMobileToolbarDone}
  onKeyboardHeightChange={(height) => {
    if (height > 0) hasSeenVirtualKeyboard = true;
    onKeyboardHeightChange?.(height);
  }}
>
  {#snippet leftContent()}
    <VoiceInputButton ... />
    <button type="button" class="submit-button" ...>Submit</button>
  {/snippet}
</MobileInputToolbar>
```

Move the submit button and voice button styles from the old MobileInputToolbar.svelte into FeedbackForm.svelte's `<style>` block (scoped to the feedback form), since they're feedback-specific.

- [ ] **Step 3: Delete old MobileInputToolbar from feedback folder**

Delete `src/lib/features/feedback/components/submit/MobileInputToolbar.svelte`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No TypeScript errors, no missing imports.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/components/MobileInputToolbar.svelte src/lib/features/feedback/
git commit -m "refactor: move MobileInputToolbar to shared components

Extracts keyboard detection and Done button into a reusable shared
component. Feedback-specific content (voice, submit) now passed via
snippet slot."
```

---

## Chunk 2: Add overlay state and build WordInputOverlay

### Task 2: Add isWordInputOpen to spell mode state

**Files:**
- Modify: `src/lib/features/create/generate/state/spell-mode-state.svelte.ts`

- [ ] **Step 1: Add the flag**

In `createSpellModeState()`, add:

```typescript
let isWordInputOpen = $state(false);

function openWordInput() {
  isWordInputOpen = true;
}

function closeWordInput() {
  isWordInputOpen = false;
}
```

Add to the return object:

```typescript
get isWordInputOpen() { return isWordInputOpen; },
openWordInput,
closeWordInput,
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/generate/state/spell-mode-state.svelte.ts
git commit -m "feat: add isWordInputOpen state for mobile overlay"
```

### Task 3: Create WordInputOverlay component

**Files:**
- Create: `src/lib/features/create/generate/components/cards/WordInputOverlay.svelte`

- [ ] **Step 1: Create the overlay component**

```svelte
<!--
  WordInputOverlay - Focused word input for mobile devices

  Opens as a fullscreen overlay when user taps the word card on mobile.
  Prevents the virtual keyboard from covering the Generate button.
  Uses shared MobileInputToolbar for keyboard-aware Done button.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import MobileInputToolbar from "$lib/shared/components/MobileInputToolbar.svelte";
  import type { IGreekKeyMapper } from "$lib/shared/keyboard/services/contracts/IGreekKeyMapper";
  import {
    uppercasePreservingGreek,
    insertAtCursor,
  } from "$lib/shared/keyboard/domain/greek-input-helpers";

  let {
    wordValue = "",
    onWordChange,
    onClose,
  } = $props<{
    wordValue?: string;
    onWordChange?: (value: string) => void;
    onClose: () => void;
  }>();

  let inputElement = $state<HTMLInputElement | null>(null);
  let greekKeyMapper: IGreekKeyMapper | null = null;
  let isInputFocused = $state(false);

  onMount(() => {
    greekKeyMapper = container.items.greekKeyMapper as IGreekKeyMapper;

    // Auto-focus after a brief delay to let the overlay animate in
    requestAnimationFrame(() => {
      inputElement?.focus();
    });

    // Close overlay on browser back button
    function handlePopState() {
      onClose();
    }
    // Push a history entry so back button closes overlay instead of navigating
    history.pushState({ wordInputOverlay: true }, "");
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  });

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const uppercased = uppercasePreservingGreek(target.value);
    if (target.value !== uppercased) {
      target.value = uppercased;
    }
    onWordChange?.(uppercased);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.code.startsWith("Numpad") && !event.getModifierState("NumLock")) return;

    const symbol = greekKeyMapper?.getSymbol(event.code);
    if (!symbol) return;

    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const cursor = input.selectionStart ?? wordValue.length;
    const result = insertAtCursor(wordValue, symbol, cursor);
    const uppercased = uppercasePreservingGreek(result.value);

    input.value = uppercased;
    input.setSelectionRange(result.cursor, result.cursor);
    onWordChange?.(uppercased);
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleDone() {
    inputElement?.blur();
    onClose();
  }

  function handleClear() {
    onWordChange?.("");
    inputElement?.focus();
  }
</script>

<div class="overlay-backdrop" onclick={handleBackdropClick} role="presentation">
  <div class="overlay-card">
    <div class="overlay-header">
      <span class="overlay-title">Spell a Word</span>
      <button class="close-btn" onclick={onClose} aria-label="Close" type="button">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <div class="input-container">
      <input
        bind:this={inputElement}
        type="text"
        class="word-field"
        placeholder="A-Z"
        value={wordValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onfocus={() => (isInputFocused = true)}
        onblur={() => (isInputFocused = false)}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
      />
      {#if wordValue.trim()}
        <button class="clear-btn" onclick={handleClear} aria-label="Clear word" type="button">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>

    {#if wordValue.trim()}
      <div class="word-preview">{wordValue.trim()}</div>
    {/if}
  </div>
</div>

<MobileInputToolbar
  visible={isInputFocused}
  onDone={handleDone}
/>

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    animation: fadeIn 150ms ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .overlay-card {
    width: min(90%, 400px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
    animation: slideDown 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .overlay-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--theme-text, white);
    letter-spacing: 0.3px;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text, white);
    cursor: pointer;
    font-size: 16px;
    transition: all 150ms ease;
  }

  .close-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
  }

  .close-btn:active {
    transform: scale(0.95);
  }

  .input-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .word-field {
    flex: 1;
    min-width: 0;
    background: var(--theme-shadow, rgba(0, 0, 0, 0.3));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: 14px;
    color: var(--theme-text, white);
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 3px;
    text-align: center;
    padding: 14px 16px;
    font-family: inherit;
    transition: border-color 150ms ease;
  }

  .word-field:focus {
    border-color: var(--theme-accent, #4a9eff);
    outline: none;
    background: var(--theme-shadow-strong, rgba(0, 0, 0, 0.4));
  }

  .word-field:focus-visible {
    outline: 2px solid var(--theme-text, white);
    outline-offset: 2px;
  }

  .word-field::placeholder {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    font-weight: 500;
    letter-spacing: 4px;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.25));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    font-size: 16px;
    transition: all 100ms ease;
  }

  .clear-btn:hover {
    background: var(--theme-card-hover-bg, rgba(0, 0, 0, 0.4));
    color: var(--theme-text, white);
  }

  .clear-btn:active {
    transform: scale(0.92);
  }

  .word-preview {
    text-align: center;
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    letter-spacing: 2px;
    font-weight: 600;
  }

  @media (prefers-reduced-motion: reduce) {
    .overlay-backdrop,
    .overlay-card {
      animation: none;
    }
    .close-btn,
    .clear-btn,
    .word-field {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/generate/components/cards/WordInputOverlay.svelte src/lib/features/create/generate/state/spell-mode-state.svelte.ts
git commit -m "feat: add WordInputOverlay component for mobile word input"
```

---

## Chunk 3: Wire overlay into WordInputCard and GeneratePanel

### Task 4: Make WordInputCard open overlay on mobile

**Files:**
- Modify: `src/lib/features/create/generate/components/cards/WordInputCard.svelte`

- [ ] **Step 1: Add mobile tap interception**

Add new props to WordInputCard:

```typescript
let {
  // ... existing props ...
  isMobile = false,
  onOpenOverlay,
} = $props<{
  // ... existing types ...
  isMobile?: boolean;
  onOpenOverlay?: () => void;
}>();
```

On mobile, intercept focus on the input to open the overlay instead. Add a handler:

```typescript
function handleFocus(event: FocusEvent) {
  if (isMobile && onOpenOverlay) {
    // Prevent the inline input from actually focusing on mobile
    (event.target as HTMLInputElement).blur();
    onOpenOverlay();
  }
}
```

Add `onfocus={handleFocus}` to the `<input>` element. On desktop (isMobile=false), focus works normally as before.

Also make the entire card tappable on mobile by adding a click handler to the outer div:

```typescript
function handleCardTap() {
  if (isMobile && onOpenOverlay) {
    onOpenOverlay();
  }
}
```

Add `onclick={handleCardTap}` and `role={isMobile ? "button" : undefined}` to the `.word-input-card` div. Add `cursor: pointer` on mobile via a `class:mobile={isMobile}` binding.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/generate/components/cards/WordInputCard.svelte
git commit -m "feat: WordInputCard opens overlay on mobile tap"
```

### Task 5: Wire overlay into GeneratePanel

**Files:**
- Modify: `src/lib/features/create/generate/components/GeneratePanel.svelte`
- Modify: `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte`

- [ ] **Step 1: Pass overlay props through CardBasedSettingsContainer**

In `CardBasedSettingsContainer.svelte`, add new props:

```typescript
let {
  // ... existing props ...
  isMobile = false,
  onOpenWordInput,
} = $props<{
  // ... existing types ...
  isMobile?: boolean;
  onOpenWordInput?: () => void;
}>();
```

In the card rendering section, pass these to WordInputCard:

```svelte
{:else if card.id === "word-input"}
  <WordInputCard
    {...card.props as any}
    color={cardColors.mode.color}
    shadowColor={cardColors.mode.shadowColor}
    {isMobile}
    onOpenOverlay={onOpenWordInput}
  />
```

- [ ] **Step 2: Wire in GeneratePanel**

In `GeneratePanel.svelte`:

Import the overlay:
```typescript
import WordInputOverlay from "./cards/WordInputOverlay.svelte";
```

Detect mobile (use the existing deviceState):
```typescript
const isMobile = $derived(deviceState.isMobile);
```

Pass to CardBasedSettingsContainer:
```svelte
<CardBasedSettingsContainer
  ...existing props...
  isMobile={isMobile}
  onOpenWordInput={() => spellModeState.openWordInput()}
/>
```

Render the overlay conditionally after the panel:
```svelte
{#if spellModeState.isWordInputOpen}
  <WordInputOverlay
    wordValue={spellModeState.inputWord}
    onWordChange={(v) => spellModeState.setInputWord(v)}
    onClose={() => spellModeState.closeWordInput()}
  />
{/if}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build, no type errors.

- [ ] **Step 4: Test on mobile**

Open the app on a mobile device or use Chrome DevTools mobile emulation:
1. Navigate to the Generate tab
2. Tap the Word card — overlay should appear with input auto-focused
3. Type a word — Greek key mapping should work, text should uppercase
4. Tap Done in toolbar — overlay closes, word is preserved
5. Tap backdrop — overlay closes
6. Generate button should be fully visible after overlay closes
7. On desktop — word card should work as before (inline input, no overlay)

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/generate/components/
git commit -m "feat: wire WordInputOverlay into generate panel

On mobile, tapping the word card opens a focused overlay with keyboard-
aware Done button. Desktop behavior unchanged."
```
