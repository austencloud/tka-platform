<!--
  AttributionPrompt - Deferred slide-up attribution question

  Appears after users have engaged with the app for a while,
  asking how they discovered TKA Composer. Non-intrusive and dismissible.
-->
<script lang="ts">
  import { getAttributionPersister } from "../getAttributionPersister";
  import { getAttributionPromptTrigger } from "../getAttributionPromptTrigger";
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { TranslationKey } from "$lib/shared/i18n/i18n-types.js";
  import { getAttributionPromptState } from "../state/attribution-prompt-state.svelte";
  import type {
    SelfReportedSource,
    SelfReportedAttribution,
  } from "../domain/types";

  const promptState = getAttributionPromptState();

  // Options configuration
  const options: Array<{
    id: SelfReportedSource;
    icon: string;
    labelKey: TranslationKey;
    hasFollowUp: boolean;
    followUpKey?: TranslationKey;
  }> = [
    {
      id: "search_engine",
      icon: "fa-magnifying-glass",
      labelKey: "attribution_source_search",
      hasFollowUp: false,
    },
    {
      id: "social_media",
      icon: "fa-hashtag",
      labelKey: "attribution_source_social",
      hasFollowUp: false,
    },
    {
      id: "youtube_video",
      icon: "fa-play",
      labelKey: "attribution_source_youtube",
      hasFollowUp: false,
    },
    {
      id: "friend_or_colleague",
      icon: "fa-user-group",
      labelKey: "attribution_source_friend",
      hasFollowUp: true,
      followUpKey: "attribution_followup_placeholder_friend",
    },
    {
      id: "flow_event_or_festival",
      icon: "fa-fire",
      labelKey: "attribution_source_event",
      hasFollowUp: true,
      followUpKey: "attribution_followup_placeholder_event",
    },
    {
      id: "online_community",
      icon: "fa-comments",
      labelKey: "attribution_source_community",
      hasFollowUp: false,
    },
    {
      id: "other",
      icon: "fa-ellipsis",
      labelKey: "attribution_source_other",
      hasFollowUp: true,
      followUpKey: "attribution_followup_placeholder_other",
    },
  ];

  let selected = $state<SelfReportedSource | null>(null);
  let followUpValue = $state("");
  let isSubmitting = $state(false);

  const selectedOption = $derived(options.find((o) => o.id === selected));
  const canSubmit = $derived(selected !== null);

  function handleSelect(id: SelfReportedSource) {
    if (selected === id) {
      selected = null;
      followUpValue = "";
    } else {
      selected = id;
      followUpValue = "";
    }
  }

  async function handleSubmit() {
    if (!selected || isSubmitting) return;

    isSubmitting = true;

    try {
      const data: SelfReportedAttribution = {
        timestamp: new Date().toISOString(),
        source: selected,
      };

      if (followUpValue.trim()) {
        if (selected === "friend_or_colleague") {
          data.personName = followUpValue.trim();
        } else if (selected === "flow_event_or_festival") {
          data.eventName = followUpValue.trim();
        } else if (selected === "other") {
          data.details = followUpValue.trim();
        }
      }

      // Save to attribution persister
      await getAttributionPersister().addSelfReportedData(data);

      // Record completion
      getAttributionPromptTrigger().recordPromptCompleted();

      // Trigger haptic feedback
      getHapticFeedback().trigger("success");

      promptState.hide();
    } catch (error) {
      console.error("[AttributionPrompt] Failed to save:", error);
    } finally {
      isSubmitting = false;
    }
  }

  function handleDismiss() {
    getAttributionPromptTrigger().recordPromptDismissed();
    getHapticFeedback().trigger("selection");
    promptState.hide();
  }

  function handleBackdropClick(e: MouseEvent) {
    // Only dismiss if clicking the backdrop, not the panel
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  }
</script>

{#if promptState.isVisible}
  <div
    class="prompt-overlay"
    onclick={handleBackdropClick}
    onkeydown={(e) => { if (e.key === 'Escape') handleDismiss(); }}
    role="presentation"
  >
    <div class="prompt-panel" role="dialog" aria-labelledby="prompt-title" aria-modal="true">
      <button
        class="close-button"
        onclick={handleDismiss}
        aria-label={t("common_close")}
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>

      <div class="prompt-header">
        <div class="icon-container">
          <i class="fas fa-compass" aria-hidden="true"></i>
        </div>
        <h2 id="prompt-title" class="title">{t("attribution_question_title")}</h2>
        <p class="subtitle">{t("attribution_question_subtitle")}</p>
      </div>

      <div class="options-grid" role="radiogroup" aria-label={t("attribution_question_title")}>
        {#each options as option (option.id)}
          <button
            class="option-card"
            class:selected={selected === option.id}
            onclick={() => handleSelect(option.id)}
            role="radio"
            aria-checked={selected === option.id}
          >
            <span class="option-icon">
              <i class="fas {option.icon}" aria-hidden="true"></i>
            </span>
            <span class="option-label">{t(option.labelKey)}</span>
            {#if selected === option.id}
              <span class="check-indicator">
                <i class="fas fa-check" aria-hidden="true"></i>
              </span>
            {/if}
          </button>
        {/each}
      </div>

      {#if selectedOption?.hasFollowUp && selectedOption.followUpKey}
        <div class="followup-container">
          <input
            type="text"
            class="followup-input"
            placeholder={t(selectedOption.followUpKey)}
            bind:value={followUpValue}
            maxlength="100"
          />
        </div>
      {/if}

      <div class="button-row">
        <button class="dismiss-button" onclick={handleDismiss}>
          {t("attribution_skip")}
        </button>
        <button
          class="submit-button"
          onclick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
        >
          {#if isSubmitting}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else}
            {t("attribution_continue")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .prompt-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .prompt-panel {
    position: relative;
    width: 100%;
    max-width: 560px;
    max-height: 85vh;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 24px 24px 0 0;
    padding: 28px 24px 32px;
    animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .close-button {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.06);
    border: none;
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  .prompt-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    margin-bottom: 20px;
  }

  .icon-container {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
    border-radius: 16px;
    font-size: 1.5rem;
    color: var(--theme-accent-strong, #8b5cf6);
  }

  .title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--theme-text, white);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .subtitle {
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  /* Options grid */
  .options-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .option-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    min-height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .option-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .option-card.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 50%,
      transparent
    );
    color: var(--theme-text, white);
  }

  .option-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    font-size: 0.85rem;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .option-card.selected .option-icon {
    opacity: 1;
    color: var(--theme-accent-strong, #8b5cf6);
  }

  .option-label {
    flex: 1;
    font-size: 0.85rem;
    font-weight: 500;
    line-height: 1.3;
  }

  .check-indicator {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-accent-strong, #8b5cf6);
    border-radius: 50%;
    font-size: 0.6rem;
    color: white;
  }

  /* Follow-up input */
  .followup-container {
    margin-bottom: 16px;
    animation: slideDown 0.2s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .followup-input {
    width: 100%;
    padding: 12px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    color: var(--theme-text, white);
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .followup-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .followup-input:focus {
    border-color: var(--theme-accent-strong, #8b5cf6);
  }

  /* Buttons */
  .button-row {
    display: flex;
    gap: 12px;
  }

  .dismiss-button {
    flex: 1;
    padding: 14px 16px;
    min-height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .dismiss-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, white);
  }

  .submit-button {
    flex: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    min-height: var(--min-touch-target);
    background: var(--theme-accent-strong, #8b5cf6);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .submit-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 85%, white);
    box-shadow: 0 4px 16px
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 40%, transparent);
  }

  .submit-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Mobile */
  @media (max-width: 520px) {
    .prompt-panel {
      padding: 24px 16px 28px;
      border-radius: 20px 20px 0 0;
    }

    .options-grid {
      grid-template-columns: 1fr;
    }

    .button-row {
      flex-direction: column-reverse;
    }

    .dismiss-button,
    .submit-button {
      flex: none;
      width: 100%;
    }
  }

  /* Desktop - add bottom margin for the panel */
  @media (min-width: 521px) {
    .prompt-panel {
      margin-bottom: 24px;
      border-radius: 24px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .prompt-overlay,
    .prompt-panel,
    .option-card,
    .followup-input,
    .dismiss-button,
    .submit-button,
    .close-button {
      animation: none;
      transition: none;
    }

    .followup-container {
      animation: none;
    }
  }
</style>
