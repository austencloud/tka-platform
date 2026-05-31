<!--
  PropPickerStep - Let user choose their favorite prop

  Shows a curated grid of 8 main prop types.
  User taps to select their favorite, which becomes their default.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";

  interface Props {
    initialValue?: PropType;
    onNext: (propType: PropType) => void;
    onBack: () => void;
    onSkip: () => void;
  }

  const { initialValue, onNext, onBack, onSkip }: Props = $props();

  // Initialize with null, sync with initialValue when provided
  let selectedProp = $state<PropType | null>(null);

  // Sync with initialValue when component mounts or value changes
  $effect(() => {
    if (initialValue !== undefined) {
      selectedProp = initialValue;
    }
  });

  // Curated list of 8 main prop types for first-run selection
  const FEATURED_PROPS: PropType[] = [
    PropType.STAFF,
    PropType.CLUB,
    PropType.FAN,
    PropType.TRIAD,
    PropType.MINIHOOP,
    PropType.BUUGENG,
    PropType.TRIQUETRA,
    PropType.EIGHTRINGS,
  ];

  function handleSelect(propType: PropType) {
    selectedProp = propType;
  }

  function handleContinue() {
    if (selectedProp) {
      onNext(selectedProp);
    }
  }
</script>

<div class="prop-picker-step">
  <div class="icon-container">
    <i class="fas fa-fire" aria-hidden="true"></i>
  </div>

  <h1 class="title">What's your favorite prop?</h1>

  <p class="subtitle">We'll set this as your default</p>

  <div class="props-grid">
    {#each FEATURED_PROPS as propType}
      {@const info = getPropTypeDisplayInfo(propType)}
      <button
        class="prop-card"
        class:selected={selectedProp === propType}
        onclick={() => handleSelect(propType)}
        aria-pressed={selectedProp === propType}
        aria-label={`Select ${info.label}`}
      >
        <img
          src={info.image}
          alt={info.label}
          class="prop-image"
          loading="lazy"
        />
        <span class="prop-label">{info.label}</span>
        {#if selectedProp === propType}
          <div class="selected-badge">
            <i class="fas fa-check" aria-hidden="true"></i>
          </div>
        {/if}
      </button>
    {/each}
  </div>

  <div class="button-row">
    <button
      type="button"
      class="back-button"
      onclick={onBack}
      aria-label="Go back"
    >
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
    </button>

    <button
      type="button"
      class="next-button"
      disabled={!selectedProp}
      onclick={handleContinue}
    >
      Continue <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </button>
  </div>

  <button type="button" class="skip-link" onclick={onSkip}>
    Skip for now
  </button>
</div>

<style>
  .prop-picker-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 520px;
    width: 100%;
    text-align: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .icon-container {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, #f97316 15%, transparent);
    border-radius: 18px;
    font-size: 1.5rem;
    color: #f97316;
  }

  .title {
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .props-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    width: 100%;
    padding: 4px;
    margin: 8px 0;
  }

  .prop-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 6px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
    min-height: 90px;
  }

  .prop-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateY(-2px);
  }

  .prop-card.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 20%,
      transparent
    );
    border-color: var(--theme-accent-strong, #8b5cf6);
    transform: scale(1.02);
  }

  .prop-card:active {
    transform: scale(0.97);
  }

  .prop-image {
    width: 48px;
    height: 48px;
    object-fit: contain;
    opacity: 0.85;
    filter: brightness(1.1);
  }

  .prop-card:hover .prop-image,
  .prop-card.selected .prop-image {
    opacity: 1;
  }

  .prop-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--theme-text, white);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .selected-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-accent-strong, #8b5cf6);
    border-radius: 50%;
    color: white;
    font-size: 0.6rem;
    animation: pop-in var(--duration-normal) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes pop-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
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
    background: rgba(255, 255, 255, 0.08);
    color: white;
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
  }

  .next-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  /* Mobile - 3 columns with scroll */
  @media (max-width: 480px) {
    .prop-picker-step {
      padding: 16px;
    }

    .props-grid {
      grid-template-columns: repeat(3, 1fr);
      max-height: 280px;
      overflow-y: auto;
    }

    .icon-container {
      width: 56px;
      height: 56px;
      font-size: 1.3rem;
    }

    .title {
      font-size: 1.25rem;
    }

    .prop-image {
      width: 40px;
      height: 40px;
    }

    .prop-label {
      font-size: 0.65rem;
    }
  }

  /* Very small screens - 2 columns */
  @media (max-width: 360px) {
    .props-grid {
      grid-template-columns: repeat(2, 1fr);
      max-height: 260px;
    }

    .prop-card {
      min-height: 80px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .prop-card,
    .back-button,
    .next-button,
    .skip-link {
      transition: none;
    }

    .prop-card:hover,
    .prop-card:active,
    .prop-card.selected {
      transform: none;
    }

    .selected-badge {
      animation: none;
    }
  }
</style>
