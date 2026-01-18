<!--
GenerateButtonCard.svelte - Generate button as a card in the grid
Integrates the "Generate New" button into the card grid layout so it scales with other cards
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
    onGenerateClicked,
    config,
    startEndOptions = null,
  } = $props<{
    isGenerating: boolean;
    onGenerateClicked: (options: any) => Promise<void>;
    config: UIGenerationConfig;
    startEndOptions?: StartEndOptions | null;
  }>();

  let hapticService: IHapticFeedback | null = $state(null);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  async function handleClick() {
    hapticService?.trigger("selection");
    // Pass start/end options to include position constraints
    const generationOptions = uiConfigToGenerationOptions(
      config,
      PropType.FAN,
      startEndOptions
    );
    await onGenerateClicked(generationOptions);
  }
</script>

<button
  class="generate-button-card"
  onclick={handleClick}
  disabled={isGenerating}
  type="button"
  aria-label={isGenerating ? t("generator_button_generating") : t("generator_button")}
>
  <div class="button-content">
    <FontAwesomeIcon icon="dice" style="solid" />
    <span>{isGenerating ? t("generator_button_generating") : t("generator_button")}</span>
  </div>
</button>

<style>
  .generate-button-card {
    width: 100%;
    height: 100%;
    border: none;

    /* 🟢 PURE GREEN MONOCHROMATIC: Green = GO psychology (no gold/yellow distraction) */
    background: linear-gradient(
      135deg,
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 85%,
          #065f46
        )
        0%,
      /* Deep green */ var(--semantic-success, var(--semantic-success)) 25%,
      /* Main green */
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 100%,
          #a7f3d0
        )
        50%,
      /* Bright green */ var(--semantic-success, var(--semantic-success)) 75%,
      /* Main green */
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 85%,
          #065f46
        )
        100% /* Deep green */
    );

    /* Flowing gradient animation + subtle pulse (NO glow animation to prevent overlay) */
    animation:
      meshGradientFlow 8s ease infinite,
      subtlePulse 2s ease-in-out infinite;

    color: var(--theme-text, white);
    border-radius: 20px;

    /* 🎯 TEXT SIZE - Use shared card text styling from parent container */
    font-size: var(--card-text-size);
    font-weight: var(--card-text-weight);
    letter-spacing: var(--card-text-spacing);
    text-shadow: var(--card-text-shadow);

    cursor: pointer;
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;

    /* 🔥 CONTAINED glow - stays within button boundaries */
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

    /* 🌟 ENHANCED but CONTAINED glow - no overlay on other cards */
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

    /* Enhance text glow on hover */
    text-shadow:
      0 2px 6px rgba(0, 0, 0, 0.6),
      0 0 25px color-mix(in srgb, var(--theme-text) 40%, transparent);

    /* Speed up animations on hover for urgency */
    animation-duration: 6s, 1.5s;
  }

  .generate-button-card:active:not(:disabled) {
    transform: scale(0.98);
    transition: all var(--duration-instant) ease;
  }

  .generate-button-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    animation: none;
    filter: grayscale(0.5);
  }

  /* Mobile: Disable Y-axis translation, use only press effect */
  @media (max-width: 768px) {
    .generate-button-card:hover:not(:disabled) {
      transform: none;
      filter: none;
    }

    .generate-button-card:focus:not(:disabled) {
      transform: none;
    }
  }

  /* 🌈 Mesh Gradient Flow - Organic flowing green colors */
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

  /* 💓 Subtle Pulse - Mimics heartbeat for subconscious urgency */
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
  }
</style>
