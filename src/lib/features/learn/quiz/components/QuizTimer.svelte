<!--
	Quiz Timer Component

	Displays and manages countdown timer for quiz sessions.
	Handles timer state, visual feedback, and time warnings.
-->

<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  // Props
  let {
    timeRemaining = 120,
    totalTime = 120,
    isRunning = false,
    isPaused = false,
    showWarnings = true,
    size = "medium",
    ontimeup,
    onwarning,
    ontick,
    controls,
  } = $props<{
    timeRemaining?: number; // seconds
    totalTime?: number; // seconds
    isRunning?: boolean;
    isPaused?: boolean;
    showWarnings?: boolean;
    size?: "small" | "medium" | "large";
    ontimeup?: () => void;
    onwarning?: (data: { timeRemaining: number }) => void;
    ontick?: (data: { timeRemaining: number }) => void;
    controls?: import("svelte").Snippet;
  }>();

  // State
  let interval: NodeJS.Timeout | null = null;
  let lastWarningTime = 0;

  // Derived state
  let formattedTime = $derived(formatTime(timeRemaining));
  let progressPercentage = $derived(
    totalTime > 0 ? (timeRemaining / totalTime) * 100 : 0
  );
  let timerClass = $derived(getTimerClass());
  let isWarning = $derived(timeRemaining <= 30 && timeRemaining > 10);
  let isCritical = $derived(timeRemaining <= 10);

  // Lifecycle
  onMount(() => {
    if (isRunning) {
      startTimer();
    }
  });

  onDestroy(() => {
    stopTimer();
  });

  // Watch for prop changes
  $effect(() => {
    if (isRunning && !interval) {
      startTimer();
    } else if (!isRunning && interval) {
      stopTimer();
    }
  });

  // Methods
  function startTimer() {
    if (interval) return;

    interval = setInterval(() => {
      if (timeRemaining > 0) {
        timeRemaining--;
        ontick?.({ timeRemaining });

        // Check for warnings
        if (showWarnings) {
          checkWarnings();
        }

        // Check if time is up
        if (timeRemaining <= 0) {
          ontimeup?.();
          stopTimer();
        }
      }
    }, 1000);
  }

  function stopTimer() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  function checkWarnings() {
    const warningTimes = [60, 30, 10, 5];

    for (const warningTime of warningTimes) {
      if (timeRemaining === warningTime && lastWarningTime !== warningTime) {
        lastWarningTime = warningTime;
        onwarning?.({ timeRemaining });
        break;
      }
    }
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  function getTimerClass(): string {
    let classes = ["quiz-timer", `size-${size}`];

    if (isCritical) {
      classes.push("critical");
    } else if (isWarning) {
      classes.push("warning");
    }

    if (isPaused) {
      classes.push("paused");
    }

    if (!isRunning) {
      classes.push("stopped");
    }

    return classes.join(" ");
  }

  // Public methods (exposed via bind:this)
  export function start() {
    isRunning = true;
    startTimer();
  }

  export function pause() {
    isPaused = true;
    isRunning = false;
    stopTimer();
  }

  export function resume() {
    isPaused = false;
    isRunning = true;
    startTimer();
  }

  export function stop() {
    isRunning = false;
    isPaused = false;
    stopTimer();
  }

  export function reset(newTime?: number) {
    stop();
    if (newTime !== undefined) {
      timeRemaining = newTime;
      totalTime = newTime;
    } else {
      timeRemaining = totalTime;
    }
    lastWarningTime = 0;
  }
</script>

<div class={timerClass}>
  <!-- Progress Ring -->
  <div class="timer-ring">
    <svg class="progress-ring" viewBox="0 0 120 120">
      <circle
        class="progress-ring-background"
        cx="60"
        cy="60"
        r="54"
        fill="transparent"
        stroke="var(--theme-stroke)"
        stroke-width="4"
      />
      <circle
        class="progress-ring-progress"
        cx="60"
        cy="60"
        r="54"
        fill="transparent"
        stroke-width="4"
        stroke-dasharray="339.292"
        stroke-dashoffset={339.292 - (progressPercentage / 100) * 339.292}
        transform="rotate(-90 60 60)"
      />
    </svg>

    <!-- Time Display -->
    <div class="time-display">
      <span class="time-text">{formattedTime}</span>
      {#if isPaused}
        <span class="status-text">PAUSED</span>
      {:else if !isRunning}
        <span class="status-text">STOPPED</span>
      {/if}
    </div>
  </div>

  <!-- Timer Controls (if needed) -->
  {#if controls}
    {@render controls()}
  {/if}
</div>

<style>
  .quiz-timer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .timer-ring {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .progress-ring {
    transform: rotate(-90deg);
  }

  .progress-ring-progress {
    transition:
      stroke-dashoffset 0.3s ease,
      stroke 0.3s ease;
    stroke: #667eea;
  }

  .time-display {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .time-text {
    font-weight: bold;
    color: #ffffff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    line-height: 1;
  }

  .status-text {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 500;
    margin-top: 0.25rem;
  }

  /* Size Variations */
  .size-small .progress-ring {
    width: 80px;
    height: 80px;
  }

  .size-small .time-text {
    font-size: 1rem;
  }

  .size-medium .progress-ring {
    width: 120px;
    height: 120px;
  }

  .size-medium .time-text {
    font-size: 1.5rem;
  }

  .size-large .progress-ring {
    width: 160px;
    height: 160px;
  }

  .size-large .time-text {
    font-size: 2rem;
  }

  /* Timer States */
  .quiz-timer.warning .progress-ring-progress {
    stroke: var(--semantic-warning);
    animation: warningPulse 1s ease-in-out infinite alternate;
  }

  .quiz-timer.warning .time-text {
    color: var(--semantic-warning);
  }

  .quiz-timer.critical .progress-ring-progress {
    stroke: var(--semantic-error);
    animation: criticalPulse 0.5s ease-in-out infinite alternate;
  }

  .quiz-timer.critical .time-text {
    color: var(--semantic-error);
    animation: criticalPulse 0.5s ease-in-out infinite alternate;
  }

  .quiz-timer.paused .progress-ring-progress {
    stroke: #6b7280;
    animation: none;
  }

  .quiz-timer.paused .time-text {
    color: #6b7280;
  }

  .quiz-timer.stopped .progress-ring-progress {
    stroke: #374151;
    animation: none;
  }

  .quiz-timer.stopped .time-text {
    color: #9ca3af;
  }

  /* Animations */
  @keyframes warningPulse {
    0% {
      opacity: 0.7;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes criticalPulse {
    0% {
      opacity: 0.5;
      transform: scale(1);
    }
    100% {
      opacity: 1;
      transform: scale(1.05);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .progress-ring-progress {
      transition: none;
    }

    .quiz-timer.warning .progress-ring-progress,
    .quiz-timer.critical .progress-ring-progress,
    .quiz-timer.critical .time-text {
      animation: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .progress-ring-background {
      stroke: rgba(255, 255, 255, 0.3);
      stroke-width: 6;
    }

    .progress-ring-progress {
      stroke-width: 6;
    }

    .quiz-timer.warning .progress-ring-progress {
      stroke: var(--semantic-warning);
    }

    .quiz-timer.critical .progress-ring-progress {
      stroke: var(--semantic-error);
    }
  }
</style>
