<!--
  AttributionQuestionStep - Self-reported attribution capture

  Asks users how they discovered the app to capture "dark social" and
  word-of-mouth that automatic tracking can't detect. Optional but encouraged.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type {
    SelfReportedSource,
    SelfReportedAttribution,
  } from "$lib/shared/attribution/domain/types";

  interface Props {
    onNext: (data?: SelfReportedAttribution) => void;
    onSkip: () => void;
  }

  const { onNext, onSkip }: Props = $props();

  // Options configuration
  const options: Array<{
    id: SelfReportedSource;
    icon: string;
    labelKey: string;
    hasFollowUp: boolean;
    followUpKey?: string;
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

  const selectedOption = $derived(options.find((o) => o.id === selected));
  const canContinue = $derived(selected !== null);

  function handleSelect(id: SelfReportedSource) {
    if (selected === id) {
      // Deselect
      selected = null;
      followUpValue = "";
    } else {
      selected = id;
      followUpValue = "";
    }
  }

  function handleContinue() {
    if (!selected) {
      onSkip();
      return;
    }

    const data: SelfReportedAttribution = {
      timestamp: new Date().toISOString(),
      source: selected,
    };

    // Add follow-up data based on source type
    if (followUpValue.trim()) {
      if (selected === "friend_or_colleague") {
        data.personName = followUpValue.trim();
      } else if (selected === "flow_event_or_festival") {
        data.eventName = followUpValue.trim();
      } else if (selected === "other") {
        data.details = followUpValue.trim();
      }
    }

    onNext(data);
  }
</script>

<div class="attribution-step">
  <div class="icon-container">
    <i class="fas fa-compass" aria-hidden="true"></i>
  </div>

  <h1 class="title">{t("attribution_question_title")}</h1>
  <p class="subtitle">{t("attribution_question_subtitle")}</p>

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

  <!-- Follow-up input for selected options that have one -->
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
    <button class="skip-button" onclick={onSkip}>
      {t("attribution_skip")}
    </button>
    <button
      class="continue-button"
      onclick={handleContinue}
      disabled={!canContinue}
    >
      {t("attribution_continue")} <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </button>
  </div>
</div>

<style>
  .attribution-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    max-width: 560px;
    width: 100%;
    text-align: center;
    padding: 32px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .icon-container {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
    border-radius: 20px;
    font-size: 2rem;
    color: var(--theme-accent-strong, #8b5cf6);
  }

  .title {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .subtitle {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: -8px 0 4px;
  }

  /* Options grid */
  .options-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    width: 100%;
  }

  .option-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    min-height: 52px;
    background: rgba(255, 255, 255, 0.04);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .option-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
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
    color: white;
  }

  .option-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 0.9rem;
    opacity: 0.7;
  }

  .option-card.selected .option-icon {
    opacity: 1;
    color: var(--theme-accent-strong, #8b5cf6);
  }

  .option-label {
    flex: 1;
    font-size: 0.9rem;
    font-weight: 500;
    line-height: 1.3;
  }

  .check-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-accent-strong, #8b5cf6);
    border-radius: 50%;
    font-size: 0.65rem;
    color: white;
  }

  /* Follow-up input */
  .followup-container {
    width: 100%;
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
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    color: white;
    font-size: 0.95rem;
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
    width: 100%;
    margin-top: 8px;
  }

  .skip-button {
    flex: 1;
    padding: 14px 20px;
    background: rgba(255, 255, 255, 0.06);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .skip-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .continue-button {
    flex: 2;
    display: flex;
    align-items: center;
    justify-content: center;
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
    transition: all 0.2s ease;
  }

  .continue-button:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 50%,
      transparent
    );
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 30%, transparent);
  }

  .continue-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Mobile */
  @media (max-width: 520px) {
    .attribution-step {
      padding: 20px 16px;
    }

    .icon-container {
      width: 64px;
      height: 64px;
      font-size: 1.5rem;
    }

    .title {
      font-size: 1.25rem;
    }

    .options-grid {
      grid-template-columns: 1fr;
    }

    .button-row {
      flex-direction: column-reverse;
    }

    .skip-button,
    .continue-button {
      flex: none;
      width: 100%;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .option-card,
    .followup-input,
    .skip-button,
    .continue-button {
      transition: none;
    }

    .followup-container {
      animation: none;
    }
  }
</style>
