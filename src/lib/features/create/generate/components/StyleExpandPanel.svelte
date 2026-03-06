<!--
StyleExpandPanel.svelte - 3-axis style config (Prop Reversals, Hand Reversals, Dashes)

Displayed inside CompactSettingsToolbar's morph expand overlay when "Style" chip is active.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  let {
    constraintPreset,
    handPathMode,
    motionTypeFilter,
    haptic,
    onPropsChange,
    onHandsChange,
    onDashesChange,
  }: {
    constraintPreset: "smooth" | "mixed" | "high-reversal";
    handPathMode: "smooth" | "mixed" | "high";
    motionTypeFilter: "no-dash" | "prefer-dash" | null;
    haptic: IHapticFeedback | null;
    onPropsChange: (v: "smooth" | "mixed" | "high-reversal") => void;
    onHandsChange: (v: "smooth" | "mixed" | "high") => void;
    onDashesChange: (v: "no-dash" | "mixed" | "prefer-dash") => void;
  } = $props();

  const propsOptions = [
    { value: "smooth", label: "Smooth" },
    { value: "mixed", label: "Mixed" },
    { value: "high-reversal", label: "High" },
  ] as const;

  const handsOptions = [
    { value: "smooth", label: "Smooth" },
    { value: "mixed", label: "Mixed" },
    { value: "high", label: "High" },
  ] as const;

  const dashOptions = [
    { value: "no-dash", label: "Low" },
    { value: "mixed", label: "Mixed" },
    { value: "prefer-dash", label: "High" },
  ] as const;

  let currentDashValue = $derived.by(() => {
    if (motionTypeFilter === "no-dash") return "no-dash";
    if (motionTypeFilter === "prefer-dash") return "prefer-dash";
    return "mixed";
  });

  function handleProps(v: "smooth" | "mixed" | "high-reversal") {
    haptic?.trigger("selection");
    onPropsChange(v);
  }

  function handleHands(v: "smooth" | "mixed" | "high") {
    haptic?.trigger("selection");
    onHandsChange(v);
  }

  function handleDashes(v: "no-dash" | "mixed" | "prefer-dash") {
    haptic?.trigger("selection");
    onDashesChange(v);
  }
</script>

<div class="style-panel">
  <div class="style-axis">
    <span class="style-axis-label">Prop Reversals</span>
    <div class="style-axis-options">
      {#each propsOptions as opt}
        <button
          class="option-btn"
          class:selected={constraintPreset === opt.value}
          onclick={() => handleProps(opt.value)}
        >{opt.label}</button>
      {/each}
    </div>
  </div>
  <div class="style-axis">
    <span class="style-axis-label">Hand Reversals</span>
    <div class="style-axis-options">
      {#each handsOptions as opt}
        <button
          class="option-btn"
          class:selected={handPathMode === opt.value}
          onclick={() => handleHands(opt.value)}
        >{opt.label}</button>
      {/each}
    </div>
  </div>
  <div class="style-axis">
    <span class="style-axis-label">Dashes</span>
    <div class="style-axis-options">
      {#each dashOptions as opt}
        <button
          class="option-btn"
          class:selected={currentDashValue === opt.value}
          onclick={() => handleDashes(opt.value)}
        >{opt.label}</button>
      {/each}
    </div>
  </div>
</div>

<style>
  .style-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    flex: 1;
    justify-content: center;
  }

  .style-axis {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .style-axis-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    opacity: 0.75;
    text-align: center;
  }

  .style-axis-options {
    display: flex;
    gap: 6px;
  }

  .option-btn {
    flex: 1;
    min-height: 44px;
    background: rgba(0, 0, 0, 0.25);
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-weight: 700;
    font-size: var(--font-size-min, 14px);
    padding: 4px 8px;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  .option-btn:active {
    transform: scale(0.96);
  }

  .option-btn.selected {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  @media (prefers-reduced-motion: reduce) {
    .option-btn {
      transition: none;
    }
  }
</style>
