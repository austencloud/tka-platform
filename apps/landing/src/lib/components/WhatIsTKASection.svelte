<!--
  WhatIsTKASection.svelte (Landing - standalone)

  Two-part demonstration:
  1. Motion Types - three animations showing static, shift, dash
  2. Levels - tabbed view showing one level at a time with 8-count sequences

  Controls at top. No "Try Another" - sequences auto-cycle with cross-fade.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { SequenceData } from "@tka/types";
  import { DEMO_PROP_TYPES } from "$lib/landing-content";
  import LandingAnimationDemo from "./LandingAnimationDemo.svelte";
  import LandingPositionDemo from "./LandingPositionDemo.svelte";

  const APP_DOMAIN = "https://tkascribe.com";

  interface MotionTypeDef {
    label: string;
    description: string;
    key: "static" | "shift" | "dash";
  }

  const MOTION_TYPES: MotionTypeDef[] = [
    {
      label: "Static",
      description: "Hands stay in place while props rotate.",
      key: "static",
    },
    {
      label: "Shift",
      description: "Hands move to adjacent grid points.",
      key: "shift",
    },
    {
      label: "Dash",
      description: "One hand crosses to the opposite grid point.",
      key: "dash",
    },
  ];

  interface LevelDef {
    label: string;
    description: string;
    key: "level1" | "level2" | "level3";
  }

  const LEVELS: LevelDef[] = [
    {
      label: "No Turns",
      description:
        "Zero turns on every motion. Hands shift between grid points but props don't spin. Pure position and movement.",
      key: "level1",
    },
    {
      label: "Whole Turns",
      description:
        "Props spin 1, 2, or 3 full rotations per beat. Same positions and movements, now with rotation layered on top.",
      key: "level2",
    },
    {
      label: "All Turns",
      description:
        "Half-turns, quarter turns, and float. The full vocabulary of prop rotation at every fractional increment.",
      key: "level3",
    },
  ];

  // Shared state
  let darkMode = $state(true);
  let currentPropIndex = $state(0);
  let switching = $state(false);

  // Sequence data loaded from JSON
  let allSequences: Record<string, SequenceData[]> = $state({});
  let loaded = $state(false);

  // Level tab selection
  let selectedLevel = $state(0);

  const currentPropType = $derived(DEMO_PROP_TYPES[currentPropIndex] ?? "staff");

  // Motion type sequences (one per type)
  const staticSequences = $derived(
    allSequences["motionTypes"]?.filter((s: SequenceData) => s.id === "mt-static") ?? []
  );
  const shiftSequences = $derived(
    allSequences["motionTypes"]?.filter((s: SequenceData) => s.id === "mt-shift") ?? []
  );
  const dashSequences = $derived(
    allSequences["motionTypes"]?.filter((s: SequenceData) => s.id === "mt-dash") ?? []
  );

  // Level sequences - prefer 8-count
  function getLevelSeqs(index: number): SequenceData[] {
    const key = LEVELS[index]?.key ?? "level1";
    const all = allSequences[key] ?? [];
    const eightCount = all.filter((s: SequenceData) => s.steps.length === 8);
    return eightCount.length > 0 ? eightCount : all;
  }

  const currentLevelSeqs = $derived(getLevelSeqs(selectedLevel));
  const currentLevelDef = $derived(LEVELS[selectedLevel]!);

  function getMotionTypeSeqs(key: string): SequenceData[] {
    if (key === "static") return staticSequences;
    if (key === "shift") return shiftSequences;
    return dashSequences;
  }

  function handleToggleLights() {
    darkMode = !darkMode;
  }

  function handleChangeProp() {
    if (switching) return;
    switching = true;
    currentPropIndex = (currentPropIndex + 1) % DEMO_PROP_TYPES.length;
    setTimeout(() => {
      switching = false;
    }, 500);
  }

  onMount(() => {
    let mounted = true;

    (async () => {
      try {
        const response = await fetch("/data/demo-sequences.json");
        if (!response.ok) throw new Error("Failed to load demo sequences");
        const data = await response.json();

        if (!mounted) return;

        allSequences = data;
        loaded = true;

        currentPropIndex = Math.floor(Math.random() * DEMO_PROP_TYPES.length);
      } catch (e) {
        console.error("Failed to load demo sequences:", e);
      }
    })();

    return () => {
      mounted = false;
    };
  });
</script>

<section class="what-is" id="what">
  <div class="container">
    <div class="section-header">
      <h2>Sheet music for spinners</h2>
      <p class="subtitle">
        Each pictograph captures one beat: where your hands are, how your
        props rotate, which direction they travel. String beats into words.
        Words become choreography you can read, share, and teach without video.
      </p>
    </div>

    {#if loaded}
      <!-- Controls at top -->
      <div class="controls">
        <button
          class="control-btn lights-btn"
          class:lights-on={!darkMode}
          onclick={handleToggleLights}
          aria-label={darkMode ? "Turn lights on" : "Turn lights off"}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            {#if darkMode}
              <circle cx="12" cy="12" r="5" />
              <path
                d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
              />
            {:else}
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
              />
            {/if}
          </svg>
        </button>

        <button
          class="control-btn prop-btn"
          onclick={handleChangeProp}
          disabled={switching}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              stroke-linecap="round"
            />
          </svg>
          <span>Change Prop</span>
        </button>
      </div>

      <!-- Positions: Alpha, Beta, Gamma -->
      <div class="subsection">
        <h3 class="subsection-title">Three positions</h3>
        <p class="subsection-desc">
          Two hands on a grid. Three ways they relate to each other.
        </p>
        <LandingPositionDemo {darkMode} />
      </div>

      <!-- Motion Types: three fundamental hand movements -->
      <div class="subsection">
        <h3 class="subsection-title">Three motion types</h3>
        <p class="subsection-desc">
          Every beat uses one of three movements per hand.
        </p>

        <div class="motion-types-grid">
          {#each MOTION_TYPES as mt}
            {@const seqs = getMotionTypeSeqs(mt.key)}
            <div class="motion-type-column">
              <div class="motion-type-header">
                <h4>{mt.label}</h4>
                <p>{mt.description}</p>
              </div>
              {#if seqs.length > 0}
                <LandingAnimationDemo
                  sequences={seqs}
                  {darkMode}
                  propType={currentPropType}
                />
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Levels: one at a time with tab selector -->
      <div class="subsection">
        <h3 class="subsection-title">Levels of complexity</h3>
        <p class="subsection-desc">
          TKA organizes motion into levels, each building on the last.
        </p>

        <div class="level-tabs" role="tablist">
          {#each LEVELS as level, i}
            <button
              class="level-tab"
              class:active={selectedLevel === i}
              onclick={() => { selectedLevel = i; }}
              role="tab"
              aria-selected={selectedLevel === i}
            >
              <span class="level-tab-number">{i + 1}</span>
              <span class="level-tab-label">{level.label}</span>
            </button>
          {/each}
        </div>

        <div class="level-demo">
          <p class="level-description">{currentLevelDef.description}</p>

          {#if currentLevelSeqs.length > 0}
            <div class="level-animation">
              <LandingAnimationDemo
                sequences={currentLevelSeqs}
                {darkMode}
                propType={currentPropType}
              />
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="loading-state">
        <div class="spinner"></div>
      </div>
    {/if}

    <div class="learn-more">
      <a href={`${APP_DOMAIN}/about`} class="link-card">
        <strong>About TKA</strong>
        <span>Learn how the system works</span>
      </a>
      <a href={`${APP_DOMAIN}/roots`} class="link-card">
        <strong>Roots</strong>
        <span>History and notation fundamentals</span>
      </a>
    </div>
  </div>
</section>

<style>
  .what-is {
    padding: 120px 24px;
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .section-header {
    text-align: center;
    max-width: 680px;
    margin: 0 auto 48px;
  }

  h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    margin-bottom: 20px;
    font-weight: 600;
    line-height: 1.2;
  }

  .subtitle {
    font-size: clamp(1rem, 1.5vw, 1.125rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    line-height: 1.75;
  }

  /* Controls at top */
  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 48px;
  }

  .control-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border: none;
    border-radius: 100px;
    color: white;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .control-btn:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .control-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .control-btn svg {
    width: 18px;
    height: 18px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .lights-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    padding: 12px;
  }

  .lights-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .lights-btn.lights-on {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .prop-btn {
    background: linear-gradient(135deg, #0d9488, #14b8a6);
    box-shadow: 0 4px 16px rgba(13, 148, 136, 0.3);
  }

  .prop-btn:hover:not(:disabled) {
    box-shadow: 0 8px 24px rgba(13, 148, 136, 0.4);
  }

  /* Subsection headers */
  .subsection {
    margin-bottom: 64px;
  }

  .subsection-title {
    font-size: clamp(1.25rem, 3vw, 1.75rem);
    font-weight: 600;
    text-align: center;
    margin-bottom: 8px;
    line-height: 1.3;
  }

  .subsection-desc {
    text-align: center;
    font-size: clamp(0.9375rem, 1.25vw, 1.0625rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin-bottom: 32px;
    line-height: 1.6;
  }

  /* Motion types: three columns */
  .motion-types-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
  }

  .motion-type-column {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .motion-type-header {
    text-align: center;
  }

  .motion-type-header h4 {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 4px;
    line-height: 1.3;
  }

  .motion-type-header p {
    font-size: 0.875rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.5;
  }

  /* Level tabs */
  .level-tabs {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 24px;
  }

  .level-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .level-tab:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.85);
  }

  .level-tab.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.5);
    color: #c7d2fe;
  }

  .level-tab-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .level-tab.active .level-tab-number {
    background: rgba(99, 102, 241, 0.3);
    color: #a5b4fc;
  }

  /* Single level demo */
  .level-demo {
    max-width: 600px;
    margin: 0 auto;
  }

  .level-description {
    text-align: center;
    font-size: 0.9375rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.6;
    margin-bottom: 20px;
  }

  .level-animation {
    width: 100%;
  }

  /* Learn more links */
  .learn-more {
    display: flex;
    justify-content: center;
    gap: 24px;
    flex-wrap: wrap;
  }

  .link-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 20px 32px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s ease, background 0.2s ease;
    min-width: 200px;
    text-align: center;
  }

  .link-card:hover {
    border-color: var(--theme-accent, #6366f1);
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.06));
  }

  .link-card strong {
    font-size: 1.125rem;
    color: var(--theme-text, #ffffff);
  }

  .link-card span {
    font-size: 0.875rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .loading-state {
    display: flex;
    justify-content: center;
    padding: 80px 0;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Tablet */
  @media (max-width: 1100px) {
    .motion-types-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }

    .motion-type-column:last-child {
      grid-column: 1 / -1;
      max-width: 50%;
      justify-self: center;
    }
  }

  /* Mobile */
  @media (max-width: 700px) {
    .what-is {
      padding: 80px 16px;
    }

    .motion-types-grid {
      grid-template-columns: 1fr;
      gap: 40px;
    }

    .motion-type-column:last-child {
      max-width: 100%;
    }

    .section-header {
      margin-bottom: 40px;
    }

    .subsection {
      margin-bottom: 48px;
    }

    .level-tabs {
      gap: 4px;
    }

    .level-tab {
      padding: 8px 14px;
      font-size: 0.8125rem;
    }

    .level-tab-label {
      display: none;
    }

    .level-demo {
      max-width: 100%;
    }
  }

  @media (max-width: 600px) {
    .control-btn {
      padding: 10px 18px;
      font-size: 0.875rem;
    }

    .control-btn svg {
      width: 16px;
      height: 16px;
    }

    .lights-btn {
      padding: 10px;
    }

    .learn-more {
      flex-direction: column;
      align-items: center;
    }

    .link-card {
      width: 100%;
      max-width: 280px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .link-card,
    .control-btn,
    .level-tab {
      transition: none;
    }

    .spinner {
      animation: none;
    }
  }
</style>
