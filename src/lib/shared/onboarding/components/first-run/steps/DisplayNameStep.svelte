<!--
  DisplayNameStep - Confirm or customize display name

  Pre-fills with user's name from auth (Google/email signup).
  User can confirm the suggested name or customize it.
-->
<script lang="ts">
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";

  interface Props {
    onNext: (displayName: string) => void;
    onBack?: () => void;
    onSkip: () => void;
  }

  const { onNext, onBack, onSkip }: Props = $props();

  // Get existing display name from auth (Google/email signup already collected this)
  const authDisplayName = $derived(authState.user?.displayName || "");

  let displayName = $state("");
  let isEditing = $state(false);
  let inputElement: HTMLInputElement | null = $state(null);

  // Pre-fill with the auth display name (initial load only, not while editing)
  $effect(() => {
    if (!isEditing && authDisplayName && !displayName) {
      displayName = authDisplayName;
    }
  });

  // Focus input when editing starts
  $effect(() => {
    if (isEditing && inputElement) {
      inputElement.focus();
      inputElement.select();
    }
  });

  const hasAuthName = $derived(!!authDisplayName);
  const currentName = $derived(displayName.trim() || authDisplayName);

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (currentName) {
      onNext(currentName);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && currentName) {
      e.preventDefault();
      onNext(currentName);
    }
    if (e.key === "Escape") {
      isEditing = false;
      displayName = authDisplayName;
    }
  }

  function startEditing() {
    isEditing = true;
  }
</script>

<div class="display-name-step">
  <div class="icon-container">
    <i class="fas fa-user" aria-hidden="true"></i>
  </div>

  <h1 class="title">What should we call you?</h1>

  <p class="subtitle">This is how you'll appear in the community</p>

  <form class="name-form" onsubmit={handleSubmit}>
    {#if hasAuthName && !isEditing}
      <!-- Show suggested name with option to edit -->
      <div class="suggested-name">
        <span class="name-display">{currentName}</span>
        <button
          type="button"
          class="edit-button"
          onclick={startEditing}
          aria-label="Edit name"
        >
          <i class="fas fa-pen" aria-hidden="true"></i>
        </button>
      </div>
    {:else}
      <!-- Input field for editing or if no auth name -->
      <input
        bind:this={inputElement}
        type="text"
        class="name-input"
        placeholder="Your name or nickname"
        bind:value={displayName}
        onkeydown={handleKeydown}
        maxlength="50"
        autocomplete="name"
        spellcheck="false"
      />
      {#if isEditing}
        <button
          type="button"
          class="cancel-edit"
          onclick={() => {
            isEditing = false;
            displayName = authDisplayName;
          }}
        >
          <i class="fas fa-times" aria-hidden="true"></i>
          Cancel
        </button>
      {/if}
    {/if}

    <p class="hint">You can change this anytime in settings</p>

    <div class="button-row">
      {#if onBack}
        <button
          type="button"
          class="back-button"
          onclick={onBack}
          aria-label="Go back"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
        </button>
      {/if}

      <button type="submit" class="next-button" disabled={!currentName}>
        Continue <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </button>
    </div>
  </form>

  <button type="button" class="skip-link" onclick={onSkip}>
    Skip for now
  </button>
</div>

<style>
  .display-name-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    padding: 32px;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.6));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .icon-container {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
    border-radius: 20px;
    font-size: 1.75rem;
    color: var(--theme-accent-strong, #8b5cf6);
  }

  .title {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .name-form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
    margin-top: 8px;
  }

  /* Suggested name display (when auth name exists) */
  .suggested-name {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 12%,
      transparent
    );
    border: 2px solid
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 30%, transparent);
    border-radius: 14px;
    width: 100%;
    justify-content: center;
  }

  .name-display {
    font-size: 1.25rem;
    font-weight: 600;
    color: white;
  }

  .edit-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .edit-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.15));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    color: var(--theme-text, white);
  }

  .cancel-edit {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .cancel-edit:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, white);
  }

  .name-input {
    width: 100%;
    padding: 16px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    color: white;
    font-size: 1.1rem;
    font-weight: 500;
    text-align: center;
    transition: all var(--duration-normal) ease;
  }

  .name-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .name-input:focus {
    outline: none;
    border-color: var(--theme-accent, #a78bfa);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 8%,
      transparent
    );
  }

  .hint {
    font-size: 0.875rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  .button-row {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .back-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .next-button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 24px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 40%,
      transparent
    );
    border: 2px solid
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 60%, transparent);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .next-button:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 50%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 80%,
      transparent
    );
  }

  .next-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .next-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .skip-link {
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.9rem;
    cursor: pointer;
    transition: color var(--duration-normal) ease;
    margin-top: 4px;
  }

  .skip-link:hover {
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  /* Mobile */
  @media (max-width: 480px) {
    .display-name-step {
      padding: 16px;
    }

    .icon-container {
      width: 64px;
      height: 64px;
      font-size: 1.5rem;
    }

    .title {
      font-size: 1.3rem;
    }

    .name-input {
      padding: 14px 16px;
      font-size: 1rem;
    }

    .next-button {
      padding: 12px 20px;
      font-size: 0.95rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .name-input,
    .back-button,
    .next-button,
    .skip-link,
    .edit-button,
    .cancel-edit {
      transition: none;
    }

    .next-button:active:not(:disabled) {
      transform: none;
    }
  }
</style>
