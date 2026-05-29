<!--
VTGVisualizer - Animated visualization of VTG (Velocity-Timing-Direction) modes
Shows how hands coordinate their movements in different VTG patterns
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";

  type VTGMode = "SS" | "TS" | "SO" | "TO" | "QS" | "QO";

  let {
    mode = "SS" as VTGMode,
    autoPlay = false,
    showLabels = true,
  } = $props<{
    mode?: VTGMode;
    autoPlay?: boolean;
    showLabels?: boolean;
  }>();

  const hapticService = getHapticFeedback();

  // VTG mode info
  const VTG_INFO: Record<
    VTGMode,
    {
      name: string;
      color: string;
      direction: string;
      timing: string;
      description: string;
    }
  > = {
    SS: {
      name: "Split-Same",
      color: "#22D3EE",
      direction: "Split (opposite directions)",
      timing: "Same (synchronized)",
      description: "Hands move in opposite directions at the same time",
    },
    TS: {
      name: "Together-Same",
      color: "#4ADE80",
      direction: "Together (same direction)",
      timing: "Same (synchronized)",
      description: "Hands move in the same direction at the same time",
    },
    SO: {
      name: "Same-Opposite",
      color: "#F472B6",
      direction: "Same direction",
      timing: "Opposite (staggered half-beat)",
      description: "Hands move same direction, but staggered timing",
    },
    TO: {
      name: "Together-Opposite",
      color: "#FB923C",
      direction: "Together (same direction)",
      timing: "Opposite (staggered)",
      description: "Hands move together but start at opposite times",
    },
    QS: {
      name: "Quarter-Same",
      color: "#A78BFA",
      direction: "Same direction",
      timing: "Quarter (90� offset)",
      description: "Hands move same direction with quarter-beat offset",
    },
    QO: {
      name: "Quarter-Opposite",
      color: "var(--semantic-warning)",
      direction: "Opposite directions",
      timing: "Quarter (90� offset)",
      description: "Hands move opposite with quarter-beat timing",
    },
  };

  const LEFT_HAND_COLOR = "var(--prop-blue, #4A9EFF)";
  const RIGHT_HAND_COLOR = "var(--prop-red, #FF4A9E)";

  // Animation state
  let animating = $state(false);
  let animationProgress = $state(0);
  let hasPlayed = $state(false);

  // Get timing offset for each hand based on VTG mode
  function getHandProgress(
    baseProgress: number,
    isLeft: boolean,
    vtgMode: VTGMode
  ): number {
    switch (vtgMode) {
      case "SS": // Split-Same: both move at same time
      case "TS": // Together-Same: both move at same time
        return baseProgress;
      case "SO": // Same-Opposite: staggered by half
      case "TO": // Together-Opposite: staggered by half
        return isLeft ? baseProgress : (baseProgress + 0.5) % 1;
      case "QS": // Quarter-Same: staggered by quarter
      case "QO": // Quarter-Opposite: staggered by quarter
        return isLeft ? baseProgress : (baseProgress + 0.25) % 1;
      default:
        return baseProgress;
    }
  }

  // Get position based on progress (oscillating movement)
  function getPosition(
    progress: number,
    isLeft: boolean,
    vtgMode: VTGMode
  ): { x: number; y: number } {
    const centerX = 50;
    const centerY = 50;
    const radius = 25;

    // Determine if hands move together or split
    const isSplit = vtgMode === "SS" || vtgMode === "QO";
    const angle = progress * Math.PI * 2;

    if (isSplit) {
      // Split: hands move in opposite directions
      const direction = isLeft ? 1 : -1;
      return {
        x:
          centerX +
          Math.cos(angle * direction) * radius * (isLeft ? -0.6 : 0.6),
        y: centerY + Math.sin(angle) * radius * 0.4,
      };
    } else {
      // Together: hands move in same direction
      return {
        x: centerX + Math.cos(angle) * radius * (isLeft ? -0.6 : 0.6),
        y: centerY + Math.sin(angle) * radius * 0.4,
      };
    }
  }

  // Current hand positions
  const leftPos = $derived(() => {
    const modeVal = mode as VTGMode;
    const prog = getHandProgress(animationProgress, true, modeVal);
    return getPosition(prog, true, modeVal);
  });

  const rightPos = $derived(() => {
    const modeVal = mode as VTGMode;
    const prog = getHandProgress(animationProgress, false, modeVal);
    return getPosition(prog, false, modeVal);
  });

  // Animation loop
  function playAnimation() {
    if (animating) return;

    animating = true;
    animationProgress = 0;
    hasPlayed = true;
    hapticService?.trigger("selection");

    const duration = 2000; // 2 seconds for full cycle
    const startTime = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime;
      animationProgress = (elapsed % duration) / duration;

      if (elapsed < duration * 2) {
        // Run 2 full cycles
        requestAnimationFrame(animate);
      } else {
        animationProgress = 0;
        animating = false;
      }
    }

    requestAnimationFrame(animate);
  }

  // Auto-play on mount if enabled
  $effect(() => {
    if (autoPlay && !hasPlayed) {
      const timer = setTimeout(playAnimation, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  });
</script>

<div class="vtg-visualizer">
  <!-- Mode badge -->
  {#if true}
    {@const modeVal = mode as VTGMode}
    {@const info = VTG_INFO[modeVal]}
    <div class="mode-badge" style="--badge-color: {info.color}">
      <span class="badge-code">{modeVal}</span>
      <span class="badge-name">{info.name}</span>
    </div>
  {/if}

  <!-- Animation canvas -->
  <svg viewBox="0 0 100 100" class="vtg-canvas">
    <!-- Background grid -->
    <circle
      cx="50"
      cy="50"
      r="30"
      fill="none"
      stroke="var(--theme-stroke)"
      stroke-width="0.5"
      stroke-dasharray="2 2"
    />
    <line
      x1="20"
      y1="50"
      x2="80"
      y2="50"
      stroke="var(--theme-card-bg)"
      stroke-width="0.5"
    />
    <line
      x1="50"
      y1="20"
      x2="50"
      y2="80"
      stroke="var(--theme-card-bg)"
      stroke-width="0.5"
    />

    <!-- Center point -->
    <circle cx="50" cy="50" r="2" fill="var(--theme-stroke, rgba(255,255,255,0.2))" />

    <!-- Hand trails (when animating) -->
    {#if animating}
      {#if true}
        {@const left = leftPos()}
        {@const right = rightPos()}
        <circle
          cx={left.x}
          cy={left.y}
          r="4"
          fill={LEFT_HAND_COLOR}
          opacity="0.15"
        />
        <circle
          cx={right.x}
          cy={right.y}
          r="4"
          fill={RIGHT_HAND_COLOR}
          opacity="0.15"
        />
      {/if}
    {/if}

    <!-- Hand positions -->
    {#if true}
      {@const left = leftPos()}
      {@const right = rightPos()}

      <!-- Left hand -->
      <circle
        cx={left.x}
        cy={left.y}
        r="10"
        fill={LEFT_HAND_COLOR}
        opacity="0.2"
        class="hand-glow"
      />
      <circle
        cx={left.x}
        cy={left.y}
        r="6"
        fill={LEFT_HAND_COLOR}
        class="hand-point"
      />

      <!-- Right hand -->
      <circle
        cx={right.x}
        cy={right.y}
        r="10"
        fill={RIGHT_HAND_COLOR}
        opacity="0.2"
        class="hand-glow"
      />
      <circle
        cx={right.x}
        cy={right.y}
        r="6"
        fill={RIGHT_HAND_COLOR}
        class="hand-point"
      />

      <!-- Labels -->
      {#if showLabels}
        <text
          x={left.x}
          y={left.y - 12}
          text-anchor="middle"
          fill={LEFT_HAND_COLOR}
          font-size="5"
          font-weight="600">L</text
        >
        <text
          x={right.x}
          y={right.y - 12}
          text-anchor="middle"
          fill={RIGHT_HAND_COLOR}
          font-size="5"
          font-weight="600">R</text
        >
      {/if}
    {/if}
  </svg>

  <!-- Info panel -->
  {#if true}
    {@const modeVal = mode as VTGMode}
    {@const info = VTG_INFO[modeVal]}
    <div class="info-panel">
      <div class="info-row">
        <span class="info-label">Direction:</span>
        <span class="info-value">{info.direction}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Timing:</span>
        <span class="info-value">{info.timing}</span>
      </div>
    </div>
  {/if}

  <!-- Play button -->
  <button class="play-button" onclick={playAnimation} disabled={animating} aria-label={animating ? "Playing animation" : "Play animation"}>
    {#if animating}
      <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
      Playing...
    {:else}
      <i class="fa-solid fa-play" aria-hidden="true"></i>
      Play Animation
    {/if}
  </button>
</div>

<style>
  .vtg-visualizer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
  }

  /* Mode badge */
  .mode-badge {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 1rem;
    background: color-mix(in srgb, var(--badge-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--badge-color) 40%, transparent);
    border-radius: 20px;
  }

  .badge-code {
    font-size: 1rem;
    font-weight: 800;
    color: var(--badge-color);
    font-family: monospace;
  }

  .badge-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--badge-color);
  }

  /* Canvas */
  .vtg-canvas {
    width: 100%;
    max-width: 240px;
    height: auto;
    aspect-ratio: 1;
  }

  .hand-glow {
    animation: pulseGlow 1.5s ease-in-out infinite;
  }

  @keyframes pulseGlow {
    0%,
    100% {
      opacity: 0.2;
    }
    50% {
      opacity: 0.35;
    }
  }

  .hand-point {
    filter: drop-shadow(0 0 4px currentColor);
  }

  /* Info panel */
  .info-panel {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    width: 100%;
    max-width: 240px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.8125rem;
  }

  .info-label {
    color: var(--theme-text-dim);
  }

  .info-value {
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    font-weight: 500;
  }

  /* Play button */
  .play-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, #22d3ee) 20%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent, #22d3ee) 20%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--theme-accent, #22d3ee) 40%, transparent);
    border-radius: 10px;
    color: var(--theme-accent, #22d3ee);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-width: 140px;
  }

  .play-button:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, #22d3ee) 30%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent, #22d3ee) 30%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--theme-accent, #22d3ee) 60%, transparent);
  }

  .play-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .hand-glow {
      animation: none;
    }
  }
</style>
