<script lang="ts">
  /**
   * SequenceSetupPanel - Configure sequences for selected animation mode
   *
   * Shows sequence slots for the selected mode and allows filling them
   */

  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { ComposeMode } from "$lib/features/compose/shared/state/compose-module-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import SequenceBrowserPanel from "$lib/shared/animation-engine/components/SequenceBrowserPanel.svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";

  interface Props {
    selectedMode: ComposeMode;
    requiredSlots: string[];
    sequenceSlots: Map<string, SequenceData | null>;
    isConfigurationComplete: boolean;
    onBack: () => void;
    onSetSequence: (slotId: string, sequence: SequenceData | null) => void;
    onClearSlot: (slotId: string) => void;
    onStartPlayback: () => void;
  }

  let {
    selectedMode,
    requiredSlots,
    sequenceSlots,
    isConfigurationComplete,
    onBack,
    onSetSequence,
    onClearSlot,
    onStartPlayback,
  }: Props = $props();

  // Animation visibility state
  let isVisible = $state(false);

  // Sequence browser state
  let browserOpen = $state(false);
  let currentSlotId = $state<string | null>(null);

  // Device detection
  let deviceDetector: IDeviceDetector | null = null;
  let responsiveSettings = $state<ResponsiveSettings | null>(null);
  const isMobile = $derived(
    responsiveSettings?.isMobile || responsiveSettings?.isTablet || false
  );

  // Haptic feedback
  let hapticService: IHapticFeedback | undefined;

  // Transition constants
  const DURATION = { normal: 200, emphasis: 280 };
  const STAGGER = { normal: 50 };
  const SLIDE = { sm: 8, md: 12 };

  // Slot metadata
  const slotMetadata: Record<string, { label: string; icon: string }> = {
    primary: { label: "Primary Sequence", icon: "fa-play" },
    secondary: { label: "Secondary Sequence", icon: "fa-clone" },
    "grid-0": { label: "Top Left", icon: "fa-square" },
    "grid-1": { label: "Top Right", icon: "fa-square" },
    "grid-2": { label: "Bottom Left", icon: "fa-square" },
    "grid-3": { label: "Bottom Right", icon: "fa-square" },
  };

  onMount(() => {
    try {
      deviceDetector = container.items.deviceDetector;
      hapticService = container.items.hapticFeedback;
      responsiveSettings = deviceDetector.getResponsiveSettings();

      const cleanup = deviceDetector.onCapabilitiesChanged(() => {
        responsiveSettings = deviceDetector!.getResponsiveSettings();
      });

      setTimeout(() => {
        isVisible = true;
      }, 30);

      return cleanup;
    } catch (error) {
      console.warn("SequenceSetupPanel: Failed to resolve services", error);
      return undefined;
    }
  });

  function handleSelectSequence(slotId: string) {
    hapticService?.trigger("selection");
    currentSlotId = slotId;
    browserOpen = true;
  }

  function handleSequenceSelected(sequence: SequenceData) {
    if (currentSlotId) {
      onSetSequence(currentSlotId, sequence);
    }
    browserOpen = false;
    currentSlotId = null;
  }

  function handleClearSlot(slotId: string) {
    hapticService?.trigger("selection");
    onClearSlot(slotId);
  }

  function handleBack() {
    hapticService?.trigger("selection");
    onBack();
  }

  function handleStart() {
    hapticService?.trigger("success");
    onStartPlayback();
  }
</script>

<div class="setup-panel">
  {#if isVisible}
    <!-- Back Button -->
    <button
      class="back-button"
      onclick={handleBack}
      transition:fly={{
        y: -SLIDE.sm,
        duration: DURATION.normal,
        easing: cubicOut,
      }}
    >
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      Back to Modes
    </button>

    <!-- Title -->
    <h2
      class="panel-title"
      transition:fly={{
        y: -SLIDE.sm,
        duration: DURATION.normal,
        delay: 50,
        easing: cubicOut,
      }}
    >
      Configure {selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)} Mode
    </h2>

    <!-- Slots Grid -->
    <div
      class="slots-grid"
      transition:fly={{
        y: SLIDE.md,
        duration: DURATION.normal,
        delay: 100,
        easing: cubicOut,
      }}
    >
      {#each requiredSlots as slotId, i (slotId)}
        {@const sequence = sequenceSlots.get(slotId)}
        {@const meta = slotMetadata[slotId]}

        <div class="slot-card" style="--delay: {i * STAGGER.normal}ms">
          <div class="slot-header">
            <i class="fas {meta?.icon ?? 'fa-square'}" aria-hidden="true"></i>
            <span class="slot-label">{meta?.label ?? slotId}</span>
          </div>

          {#if sequence}
            <!-- Filled slot -->
            <div class="slot-filled">
              <div class="sequence-info">
                <span class="sequence-name"
                  >{sequence.name || sequence.word}</span
                >
                <span class="sequence-meta">
                  {sequence.beats.length} beats
                  {#if sequence.author}
                    • by {sequence.author}
                  {/if}
                </span>
              </div>

              <div class="slot-actions">
                <button
                  class="change-btn"
                  onclick={() => handleSelectSequence(slotId)}
                  aria-label="Change sequence for {meta?.label ?? slotId}"
                >
                  <i class="fas fa-sync" aria-hidden="true"></i>
                  Change
                </button>
                <button
                  class="clear-btn"
                  onclick={() => handleClearSlot(slotId)}
                  aria-label="Clear {meta?.label ?? slotId}"
                >
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          {:else}
            <!-- Empty slot -->
            <button
              class="slot-empty"
              onclick={() => handleSelectSequence(slotId)}
              aria-label="Select sequence for {meta?.label ?? slotId}"
            >
              <i class="fas fa-plus" aria-hidden="true"></i>
              <span>Select Sequence</span>
            </button>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Start Button -->
    <button
      class="start-button"
      disabled={!isConfigurationComplete}
      onclick={handleStart}
      transition:fly={{
        y: SLIDE.md,
        duration: DURATION.normal,
        delay: 150,
        easing: cubicOut,
      }}
    >
      <i class="fas fa-play" aria-hidden="true"></i>
      Start Animation
    </button>

    {#if !isConfigurationComplete}
      <p
        class="helper-text"
        transition:fly={{
          y: SLIDE.sm,
          duration: DURATION.normal,
          delay: 200,
          easing: cubicOut,
        }}
      >
        Fill all sequence slots to continue
      </p>
    {/if}
  {/if}

  <!-- Sequence Browser Panel -->
  <SequenceBrowserPanel
    mode={(currentSlotId as any) || "primary"}
    show={browserOpen}
    placement={isMobile ? "bottom" : "right"}
    onSelect={handleSequenceSelected}
    onClose={() => {
      browserOpen = false;
      currentSlotId = null;
    }}
  />
</div>

<style>
  .setup-panel {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: var(--theme-card-bg);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    color: var(--theme-text);
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) var(--ease-out),
      border-color var(--duration-fast, 150ms) var(--ease-out);
    align-self: flex-start;
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .panel-title {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    letter-spacing: -0.02em;
    text-align: center;
  }

  .slots-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }

  @media (min-width: 640px) {
    .slots-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 900px) and (max-width: 1199px) {
    .slots-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .slot-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    transition:
      background var(--duration-fast, 150ms) var(--ease-out),
      border-color var(--duration-fast, 150ms) var(--ease-out);
  }

  .slot-header {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--theme-text-dim);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .slot-header i {
    font-size: var(--font-size-sm);
  }

  .slot-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 100px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.04);
    border: 2px dashed rgba(255, 255, 255, 0.2);
    border-radius: 14px;
    color: var(--theme-text-dim);
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) var(--ease-out),
      border-color var(--duration-fast, 150ms) var(--ease-out),
      color var(--duration-fast, 150ms) var(--ease-out);
  }

  .slot-empty:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.3);
    color: var(--theme-text);
  }

  .slot-empty i {
    font-size: var(--font-size-xl);
  }

  .slot-filled {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sequence-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sequence-name {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .sequence-meta {
    font-size: 0.875rem;
    color: var(--theme-text-dim);
  }

  .slot-actions {
    display: flex;
    gap: 8px;
  }

  .change-btn,
  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) var(--ease-out),
      color var(--duration-fast, 150ms) var(--ease-out);
  }

  .change-btn {
    flex: 1;
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: var(--semantic-info);
  }

  .change-btn:hover {
    background: rgba(59, 130, 246, 0.25);
    color: var(--semantic-info);
  }

  .clear-btn {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--semantic-error);
    padding: 10px 12px;
  }

  .clear-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    color: var(--semantic-error);
  }

  .start-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: var(--min-touch-target);
    padding: 16px 32px;
    background: linear-gradient(
      135deg,
      var(--semantic-success) 0%,
      #059669 100%
    );
    border: none;
    border-radius: 16px;
    color: white;
    font-size: 1.125rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      filter var(--duration-fast, 150ms) var(--ease-out),
      transform var(--duration-fast, 150ms) var(--ease-out),
      opacity var(--duration-fast, 150ms) var(--ease-out);
    align-self: center;
    max-width: 400px;
    width: 100%;
  }

  .start-button:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(var(--hover-lift-sm, -1px));
  }

  .start-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .helper-text {
    margin: 0;
    text-align: center;
    font-size: 0.875rem;
    color: var(--theme-text-dim);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .setup-panel {
      padding: 16px;
      gap: 20px;
    }

    .panel-title {
      font-size: 1.5rem;
    }

    .slot-card {
      padding: 16px;
    }

    .start-button {
      font-size: 1rem;
      min-height: var(--min-touch-target);
    }
  }

  @media (max-width: 480px) {
    .setup-panel {
      padding: 12px;
      gap: 16px;
    }

    .panel-title {
      font-size: 1.25rem;
    }

    .back-button {
      padding: 10px 16px;
      font-size: 0.875rem;
    }

    .start-button {
      min-height: var(--min-touch-target);
      padding: 14px 24px;
      font-size: 0.9375rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
    }
  }
</style>
