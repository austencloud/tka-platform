<!--
  ReadyStep - Final step of the create tutorial

  Shows a workspace mockup with the user's real sequence rendered in a StepGrid,
  buttons in their actual positions glowing with numbered indicators, and a
  legend panel explaining each button.
-->
<script lang="ts">
  import StepGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte";
  import { createTutorialState } from "../../../state/create-tutorial-state.svelte";
  import { pictographDataToStepData } from "$lib/shared/pictograph/shared/domain/utils/step-pictograph-conversion";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

  interface Props {
    onAdvance: () => void;
  }

  const { onAdvance }: Props = $props();

  // Convert tutorial data to StepGrid-compatible format
  const startPositionStep = $derived.by(() => {
    const startPicto = createTutorialState.startPosition;
    if (!startPicto) return null;

    const sp: StartPositionData = {
      ...startPicto,
      isStartPosition: true as const,
    };

    return {
      ...sp,
      stepNumber: 0,
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
    } as StepData;
  });

  const beatSteps = $derived<StepData[]>(
    createTutorialState.beats.map((beat, i) =>
      pictographDataToStepData(beat, beat.id ?? `tutorial-beat-${i}`),
    ),
  );

  const displayWord = $derived(
    createTutorialState.beats.map((b) => b.letter ?? "").join(""),
  );

  interface ButtonInfo {
    label: string;
    icon: string;
    iconType: "fa" | "svg";
    colorClass: string;
    description: string;
  }

  const BUTTONS: ButtonInfo[] = [
    {
      label: "Undo",
      icon: "undo-svg",
      iconType: "svg",
      colorClass: "accent",
      description: "Removes the last beat you added.",
    },
    {
      label: "Save to Library",
      icon: "fa-bookmark",
      iconType: "fa",
      colorClass: "accent",
      description: "Stores your sequence so you can find it later.",
    },
    {
      label: "Sequence Actions",
      icon: "fa-tools",
      iconType: "fa",
      colorClass: "success",
      description: "Mirror, flip, rotate, and transform your sequence.",
    },
    {
      label: "View and Share",
      icon: "fa-play",
      iconType: "fa",
      colorClass: "success",
      description: "Watch your sequence animated with props, or share it.",
    },
    {
      label: "Clear",
      icon: "fa-broom",
      iconType: "fa",
      colorClass: "error",
      description: "Wipes the sequence so you can start fresh.",
    },
    {
      label: "Step Editor",
      icon: "fa-hand-pointer",
      iconType: "fa",
      colorClass: "info",
      description: "Tap any beat to adjust turns, rotation, and duration.",
    },
  ];
</script>

<div class="tutorial-step">
  <h1 class="title">Your workspace</h1>
  <p class="subtitle">Here's where everything lives.</p>

  <div class="workspace-mockup">
    <!-- LEFT: Workspace preview with buttons in real positions -->
    <div class="workspace-panel">
      <!-- Top bar: Undo (left) | Word (center) | Save (right) -->
      <div class="top-bar">
        <div class="button-spot">
          <span class="badge">1</span>
          <div class="mock-button accent glow">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9 14L4 9L9 4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M4 9H15A6 6 0 0 1 15 21H13"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>

        <span class="word-label">{displayWord}</span>

        <div class="button-spot">
          <span class="badge">2</span>
          <div class="mock-button accent glow">
            <i class="fa-solid fa-bookmark" aria-hidden="true"></i>
          </div>
        </div>
      </div>

      <!-- Step grid showing the real sequence -->
      <div class="grid-area">
        {#if beatSteps.length > 0}
          <StepGrid
            steps={beatSteps}
            startPosition={startPositionStep}
          />
        {/if}

        <!-- Tap hint overlay -->
        <div class="tap-hint">
          <i class="fas fa-hand-pointer" aria-hidden="true"></i>
          <span>Tap any beat to edit it</span>
        </div>
      </div>

      <!-- Bottom bar: Actions (left) | View (center) | Clear (right) -->
      <div class="bottom-bar">
        <div class="button-spot">
          <span class="badge">3</span>
          <div class="mock-button success glow">
            <i class="fas fa-tools" aria-hidden="true"></i>
          </div>
        </div>

        <div class="button-spot">
          <span class="badge">4</span>
          <div class="mock-button success glow">
            <i class="fas fa-play" aria-hidden="true"></i>
          </div>
        </div>

        <div class="button-spot">
          <span class="badge">5</span>
          <div class="mock-button error glow">
            <i class="fa-solid fa-broom" aria-hidden="true"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT: Legend panel -->
    <div class="legend-panel">
      {#each BUTTONS as btn, i}
        <div class="legend-item">
          <span class="legend-badge {btn.colorClass}">{i + 1}</span>
          <div class="legend-text">
            <strong>{btn.label}</strong>
            <span class="legend-desc">{btn.description}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <button class="go-button" onclick={onAdvance}>
    Start building <i class="fas fa-arrow-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .tutorial-step {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    /* Fill more of the screen */
    max-width: 1100px;
    width: 100%;
    text-align: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .title {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
    line-height: 1.5;
  }

  /* Workspace mockup: side-by-side, fills available space */
  .workspace-mockup {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 20px;
    width: 100%;
    flex: 1;
    min-height: 0;
  }

  /* Left panel: workspace preview */
  .workspace-panel {
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-radius: 12px;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    /* Fill vertical space */
    min-height: clamp(280px, 45vh, 550px);
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    flex-shrink: 0;
  }

  .word-label {
    font-size: 1.05rem;
    font-weight: 600;
    color: white;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .grid-area {
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
  }

  /* Tap hint floating at bottom of grid */
  .tap-hint {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: color-mix(in srgb, var(--semantic-info, #38bdf8) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-info, #38bdf8) 35%, transparent);
    border-radius: 20px;
    color: var(--semantic-info, #38bdf8);
    font-size: 0.8rem;
    font-weight: 500;
    white-space: nowrap;
    pointer-events: none;
    animation: tap-hint-pulse 2.4s ease-in-out infinite;
  }

  .tap-hint i {
    font-size: 0.85rem;
  }

  @keyframes tap-hint-pulse {
    0%, 100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
  }

  .bottom-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    flex-shrink: 0;
  }

  /* Button spots with numbered badges */
  .button-spot {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .badge {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    color: #111;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    line-height: 1;
  }

  /* Mock buttons matching real button styles */
  .mock-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    color: white;
    font-size: 1.1rem;
  }

  .mock-button.accent {
    background: linear-gradient(
      135deg,
      var(--theme-accent-strong, #8b5cf6) 0%,
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 85%, #6d28d9) 100%
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 30%, transparent);
  }

  .mock-button.success {
    background: linear-gradient(
      135deg,
      var(--semantic-success, #22c55e) 0%,
      color-mix(in srgb, var(--semantic-success, #22c55e) 85%, #16a34a) 100%
    );
    border: 1px solid
      color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent);
  }

  .mock-button.error {
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 80%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
  }

  /* Glow animation on buttons */
  .mock-button.glow {
    animation: button-glow 2.4s ease-in-out infinite;
  }

  .mock-button.glow.accent {
    animation: button-glow-accent 2.4s ease-in-out infinite;
  }

  .mock-button.glow.success {
    animation: button-glow-success 2.4s ease-in-out infinite;
  }

  .mock-button.glow.error {
    animation: button-glow-error 2.4s ease-in-out infinite;
  }

  @keyframes button-glow-accent {
    0%, 100% {
      box-shadow: 0 4px 12px
        color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 40%, transparent);
    }
    50% {
      box-shadow:
        0 4px 16px
          color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 60%, transparent),
        0 0 28px
          color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 35%, transparent);
    }
  }

  @keyframes button-glow-success {
    0%, 100% {
      box-shadow: 0 4px 12px
        color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent);
    }
    50% {
      box-shadow:
        0 4px 16px
          color-mix(in srgb, var(--semantic-success, #22c55e) 60%, transparent),
        0 0 28px
          color-mix(in srgb, var(--semantic-success, #22c55e) 35%, transparent);
    }
  }

  @keyframes button-glow-error {
    0%, 100% {
      box-shadow: 0 4px 12px
        color-mix(in srgb, var(--semantic-error, #ef4444) 40%, transparent);
    }
    50% {
      box-shadow:
        0 4px 16px
          color-mix(in srgb, var(--semantic-error, #ef4444) 60%, transparent),
        0 0 28px
          color-mix(in srgb, var(--semantic-error, #ef4444) 35%, transparent);
    }
  }

  /* Legend panel */
  .legend-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    justify-content: center;
  }

  .legend-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    text-align: left;
  }

  .legend-badge {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 1px;
    line-height: 1;
  }

  .legend-badge.accent {
    background: var(--theme-accent-strong, #8b5cf6);
    color: white;
  }

  .legend-badge.success {
    background: var(--semantic-success, #22c55e);
    color: white;
  }

  .legend-badge.error {
    background: var(--semantic-error, #ef4444);
    color: white;
  }

  .legend-badge.info {
    background: var(--semantic-info, #38bdf8);
    color: white;
  }

  .legend-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .legend-text strong {
    color: white;
    font-size: 0.95rem;
  }

  .legend-desc {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    font-size: 0.85rem;
    line-height: 1.4;
  }

  /* Go button */
  .go-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 32px;
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
    margin-top: 4px;
    flex-shrink: 0;
  }

  .go-button:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 50%,
      transparent
    );
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 30%, transparent);
  }

  .go-button:active {
    transform: scale(0.97);
  }

  .go-button:focus-visible {
    outline: 2px solid var(--theme-accent-strong, #8b5cf6);
    outline-offset: 2px;
  }

  /* Mobile: stack vertically */
  @media (max-width: 640px) {
    .workspace-mockup {
      grid-template-columns: 1fr;
    }

    .workspace-panel {
      min-height: clamp(240px, 40vh, 420px);
    }

    .legend-panel {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 10px;
      padding: 10px;
    }

    .legend-item {
      flex: 1 1 45%;
      min-width: 140px;
    }
  }

  @media (max-width: 480px) {
    .tutorial-step {
      padding: 14px;
      gap: 10px;
    }
    .title {
      font-size: 1.25rem;
    }
    .go-button {
      padding: 12px 24px;
    }
    .mock-button {
      width: 42px;
      height: 42px;
      font-size: 0.95rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mock-button.glow,
    .mock-button.glow.accent,
    .mock-button.glow.success,
    .mock-button.glow.error {
      animation: none;
      box-shadow: 0 0 12px rgba(255, 255, 255, 0.2);
    }
    .go-button {
      transition: none;
    }
    .tap-hint {
      animation: none;
      opacity: 0.85;
    }
  }
</style>
