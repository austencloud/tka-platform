<!--
GenerateButtonCard.svelte - Generate button as a card in the grid
Always renders as a pure button. Word input is now in WordInputCard.
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

  let {
    isGenerating,
    hasSettingsChanged = false,
    onGenerateClicked,
    config,
    startEndOptions = null,
    needsCycleCompletion = false,
    onCompleteCycle,
  } = $props<{
    isGenerating: boolean;
    hasSettingsChanged?: boolean;
    onGenerateClicked: (options: any) => Promise<void>;
    config: UIGenerationConfig;
    startEndOptions?: StartEndOptions | null;
    /** When true, show "Complete Cycle" button alongside generate */
    needsCycleCompletion?: boolean;
    /** Called when user clicks "Complete Cycle" */
    onCompleteCycle?: () => void;
  }>();

  const isDisabled = $derived(isGenerating);

  let buttonLabel = $derived(
    isGenerating
      ? t("generator_button_generating")
      : hasSettingsChanged
        ? t("generator_button_regenerate")
        : t("generator_button")
  );

  let buttonIcon = $derived(hasSettingsChanged && !isGenerating ? "arrows-rotate" : "dice");

  let hapticService: IHapticFeedback | null = $state(null);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  async function handleClick() {
    if (isDisabled) return;
    hapticService?.trigger("selection");
    const generationOptions = uiConfigToGenerationOptions(
      config,
      PropType.FAN,
      startEndOptions
    );
    await onGenerateClicked(generationOptions);
  }

  function handleCompleteCycle() {
    hapticService?.trigger("selection");
    onCompleteCycle?.();
  }
</script>

{#if needsCycleCompletion}
  <div class="generate-row">
    <button
      class="complete-cycle-btn"
      onclick={handleCompleteCycle}
      disabled={isGenerating}
      type="button"
      aria-label="Complete orientation cycle"
    >
      <div class="button-content">
        <FontAwesomeIcon icon="rotate" style="solid" />
        <span>Complete Cycle</span>
      </div>
    </button>
    <button
      class="generate-button-card generate-half"
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
  </div>
{:else}
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

  .generate-button-card:focus-visible {
    outline: 2px solid var(--theme-text, white);
    outline-offset: 2px;
  }

  /* ─── Complete Cycle + Generate side-by-side ─── */

  .generate-row {
    display: flex;
    width: 100%;
    height: 100%;
    gap: clamp(4px, 1cqi, 8px);
  }

  .complete-cycle-btn {
    flex: 1;
    border: none;
    background: var(--theme-accent, rgba(99, 102, 241, 0.85));
    color: var(--theme-text, white);
    border-radius: 20px;
    font-size: clamp(14px, 1.8vmin, 22px);
    font-weight: var(--card-text-weight);
    letter-spacing: 0.2px;
    text-shadow: var(--card-text-shadow);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 4px 12px color-mix(in srgb, var(--theme-accent, rgba(99, 102, 241, 0.85)) 40%, transparent),
      0 2px 6px var(--theme-shadow);
  }

  .complete-cycle-btn:hover:not(:disabled) {
    filter: brightness(1.15);
    transform: scale(1.02);
  }

  .complete-cycle-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition: all var(--duration-instant) ease;
  }

  .complete-cycle-btn:focus-visible {
    outline: 2px solid var(--theme-text, white);
    outline-offset: 2px;
  }

  .complete-cycle-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .generate-half {
    flex: 1;
  }

  /* ─── Button styles ─── */

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

  .generate-button-card:hover:not(:disabled) {
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

  .generate-button-card:active:not(:disabled) {
    transform: scale(0.98);
    transition: all var(--duration-instant) ease;
  }

  button.generate-button-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    animation: none;
    filter: grayscale(0.5);
  }

  /* Mobile: Disable hover effects */
  @media (max-width: 768px) {
    .generate-button-card:hover:not(:disabled) {
      transform: none;
      filter: none;
    }

    .generate-button-card:focus:not(:disabled) {
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

    .complete-cycle-btn {
      transition: none;
    }
  }
</style>
