<!--
  PronounsEditor Component

  Inline editor for pronouns with preset chip shortcuts.
  Supports free-text input and common preset options.
-->
<script lang="ts">
  import type { HapticFeedback } from "../../../application/services/haptic-feedback";
  import type { User } from "firebase/auth";
  import { authState } from "../../../auth/state/auth-state.svelte";
  import { toast } from "../../../toast/state/toast-state.svelte";
  import { doc, getDoc } from "firebase/firestore";
  import { getFirestoreInstance } from "../../../auth/firebase";
  import { onMount } from "svelte";
  import { t } from "../../../i18n/i18n.svelte.js";

  interface Props {
    user: User;
    hapticService: HapticFeedback | null;
    onPronounsChanged?: (pronouns: string) => void;
  }

  let { user, hapticService, onPronounsChanged }: Props = $props();

  // Local state
  let currentPronouns = $state("");
  let editedPronouns = $state("");
  let isEditing = $state(false);
  let isSaving = $state(false);

  // Preset options
  const PRESETS = $derived([
    { key: "he/him", label: t("pronoun_preset_he_him") },
    { key: "she/her", label: t("pronoun_preset_she_her") },
    { key: "they/them", label: t("pronoun_preset_they_them") },
  ]);

  // Load current pronouns from Firestore on mount
  onMount(async () => {
    try {
      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        currentPronouns = userDoc.data()?.pronouns || "";
      }
    } catch (err) {
      console.error("Failed to load pronouns:", err);
    }
  });

  // Derived: can save if changed
  const isSaveDisabled = $derived(
    isSaving || editedPronouns.trim() === currentPronouns
  );

  function startEditing() {
    editedPronouns = currentPronouns;
    isEditing = true;
    hapticService?.trigger("selection");
  }

  function cancelEditing() {
    isEditing = false;
    editedPronouns = "";
  }

  function selectPreset(preset: string) {
    hapticService?.trigger("selection");
    // Toggle: if already selected, clear it
    if (editedPronouns.trim() === preset) {
      editedPronouns = "";
    } else {
      editedPronouns = preset;
    }
  }

  async function save() {
    const trimmed = editedPronouns.trim();

    // Don't save if unchanged
    if (trimmed === currentPronouns) {
      cancelEditing();
      return;
    }

    isSaving = true;
    try {
      await authState.updatePronouns(trimmed);
      currentPronouns = trimmed;
      hapticService?.trigger("success");
      toast.success(trimmed ? t("profile_pronouns_updated") : t("profile_pronouns_cleared"));
      onPronounsChanged?.(trimmed);
      isEditing = false;
    } catch (err) {
      console.error("Failed to update pronouns:", err);
      hapticService?.trigger("error");
      toast.error(err instanceof Error ? err.message : t("profile_pronouns_update_failed"));
    } finally {
      isSaving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !isSaveDisabled) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  }
</script>

<div class="section">
  <div class="label-row">
    <label class="label" for="pronouns-input">{t("profile_pronouns_label")}</label>
    <span class="optional-badge">{t("profile_optional")}</span>
  </div>
  {#if isEditing}
    <!-- Preset chips -->
    <div class="preset-chips" role="group" aria-label="Pronoun presets">
      {#each PRESETS as preset}
        <button
          type="button"
          class="preset-chip"
          class:selected={editedPronouns.trim() === preset.key}
          onclick={() => selectPreset(preset.key)}
          disabled={isSaving}
        >
          {preset.label}
        </button>
      {/each}
    </div>

    <!-- Free text input -->
    <div class="input-row">
      <input
        id="pronouns-input"
        type="text"
        class="input"
        bind:value={editedPronouns}
        onkeydown={handleKeydown}
        maxlength="50"
        placeholder={t("profile_pronouns_placeholder")}
        disabled={isSaving}
      />
      <div class="inline-actions">
        <button
          class="icon-btn save"
          onclick={save}
          disabled={isSaveDisabled}
          aria-label="Save pronouns"
        >
          {#if isSaving}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-check" aria-hidden="true"></i>
          {/if}
        </button>
        <button
          class="icon-btn cancel"
          onclick={cancelEditing}
          disabled={isSaving}
          aria-label="Cancel editing"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  {:else}
    <div
      class="value-row"
      onclick={startEditing}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && startEditing()}
      role="button"
      tabindex="0"
      aria-label="Edit pronouns"
    >
      <span class="current-value">{currentPronouns || t("profile_pronouns_not_set")}</span>
      <i class="fas fa-pen edit-icon" aria-hidden="true"></i>
    </div>
  {/if}
</div>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .label-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
  }

  .optional-badge {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    font-weight: 400;
    font-style: italic;
  }

  .value-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .value-row:hover,
  .value-row:focus {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .value-row:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .current-value {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .edit-icon {
    font-size: 12px;
    color: var(--theme-text-dim);
    opacity: 0;
    transition: opacity var(--duration-fast) ease;
  }

  .value-row:hover .edit-icon,
  .value-row:focus .edit-icon {
    opacity: 0.6;
  }

  @media (hover: none) {
    .edit-icon {
      opacity: 0.4;
    }
  }

  /* Preset chips */
  .preset-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .preset-chip {
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .preset-chip:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .preset-chip.selected {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: var(--theme-accent);
    color: var(--theme-accent);
  }

  .preset-chip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Input row */
  .input-row {
    display: flex;
    gap: 8px;
  }

  .inline-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .icon-btn.save {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .icon-btn.save:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.25);
  }

  .icon-btn.cancel {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .icon-btn.cancel:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.25);
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input {
    flex: 1;
    min-width: 0;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    transition: all var(--duration-normal) ease;
  }

  .input:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
    background: var(--theme-card-hover-bg);
  }

  .input::placeholder {
    color: var(--theme-text-dim);
    opacity: 0.6;
  }

  .input:disabled {
    opacity: 0.6;
  }

  /* Accessibility */
  .input:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .icon-btn:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .preset-chip:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .value-row,
    .edit-icon,
    .icon-btn,
    .preset-chip,
    .input {
      transition: none;
    }
  }
</style>
