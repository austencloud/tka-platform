<!--
Learn Tab - Master learning interface

Four learning destinations:
- Concepts: Progressive concept mastery path
- Play: Fun games to test your pictograph skills
- Codex: Browse all letters and pictographs
- TIKA: AI-powered TKA tutor

Navigation via bottom tabs (mobile-first UX pattern)
-->
<script lang="ts">

import { getDelightOrchestrator } from "$lib/shared/delight/get-delight-orchestrator";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { onMount, untrack } from "svelte";
  import { getConceptProgressTracker } from "$lib/features/learn/get-concept-progress-tracker";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import ConceptPathView from "./components/ConceptPathView.svelte";
  import ConceptDetailView from "./components/ConceptDetailView.svelte";
  import CodexExplorer from "./codex/components/CodexExplorer.svelte";
  import QuizTab from "./quiz/components/QuizTab.svelte";
  import TikaTab from "$lib/features/tika/TikaModule.svelte";
  import GuideTab from "./guide/GuideTab.svelte";
  import type { LearnConcept } from "./domain/types";
  import { getConceptById } from "./domain/concepts";
  import {
    getActiveConceptId,
    setActiveConceptId,
    clearActiveConceptId,
  } from "./state/experience-persistence.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import { setDelightOrchestrator } from "$lib/shared/delight/context/delight-context";
  import ConfettiBurst from "$lib/shared/delight/components/ConfettiBurst.svelte";
  import AchievementToast from "$lib/shared/delight/components/AchievementToast.svelte";
  import { getEffectiveUserId } from "$lib/shared/auth/state/auth-state.svelte";

  type LearnMode = "concepts" | "play" | "codex" | "tika" | "guide";

  // Tab order for determining slide direction
  const TAB_ORDER: LearnMode[] = ["concepts", "play", "codex", "tika", "guide"];

  // Props
  let {
    onHeaderChange,
  }: {
    onHeaderChange?: (header: string) => void;
  } = $props();

  // Services from DI
  const delightOrchestrator = getDelightOrchestrator();
  const conceptProgressTracker = getConceptProgressTracker();

  // Provide delight orchestrator to child components via context
  setDelightOrchestrator(delightOrchestrator);

  // Active mode synced with navigation state
  let activeMode = $state<LearnMode>("concepts");

  // Slide direction for tab transitions (1 = right, -1 = left)
  let slideDirection = $state<1 | -1>(1);
  let previousMode = $state<LearnMode | null>(null);

  // Transition configuration
  const SLIDE_DISTANCE = 30; // pixels
  const SLIDE_DURATION = 200; // ms

  // Concept detail view state
  let selectedConcept = $state<LearnConcept | null>(null);
  let conceptOpenCount = $state(0); // Increments each open to force remount

  // Sync with navigation state (bottom nav controls this)
  $effect(() => {
    const navMode = navigationState.currentLearnMode;

    // Map navigation modes to active mode
    let newMode: LearnMode = "concepts";
    if (navMode === "concepts") {
      newMode = "concepts";
    } else if (
      navMode === "quiz" ||
      navMode === "drills" ||
      navMode === "play"
    ) {
      newMode = "play";
    } else if (navMode === "codex") {
      newMode = "codex";
    } else if (navMode === "tika") {
      newMode = "tika";
    } else if (navMode === "guide") {
      newMode = "guide";
    }

    // Calculate slide direction based on tab order
    if (previousMode !== null && newMode !== previousMode) {
      const oldIndex = TAB_ORDER.indexOf(previousMode);
      const newIndex = TAB_ORDER.indexOf(newMode);
      slideDirection = newIndex > oldIndex ? 1 : -1;
    }

    previousMode = activeMode;
    activeMode = newMode;
  });

  // Reset states when switching modes
  $effect(() => {
    const mode = activeMode;
    const prev = previousMode;
    // Only reset when mode actually changes
    if (mode !== prev && prev !== null) {
      untrack(() => {
        selectedConcept = null;
      });
    }
  });

  // Effect: Update header when mode or selected concept changes
  $effect(() => {
    if (!onHeaderChange) return;

    let header = "";

    if (activeMode === "concepts") {
      if (selectedConcept) {
        header = selectedConcept.name || t("learn_concept_details");
      } else {
        header = t("learn_learning_path");
      }
    } else if (activeMode === "play") {
      header = t("learn_play");
    } else if (activeMode === "codex") {
      header = t("learn_letters");
    } else if (activeMode === "tika") {
      header = "TIKA";
    } else if (activeMode === "guide") {
      header = "Level 1 Guide";
    }

    onHeaderChange(header);
  });

  // Initialize on mount
  onMount(async () => {
    // Set default mode if none persisted
    const navMode = navigationState.currentLearnMode;
    if (!navMode) {
      navigationState.setLearnMode("concepts");
    }

    // Restore active concept from persistence (survives refresh)
    const activeConceptId = getActiveConceptId();
    if (activeConceptId) {
      const concept = getConceptById(activeConceptId);
      if (concept) {
        conceptOpenCount++;
        selectedConcept = concept;
      }
    }
  });

  // Handle concept selection
  function handleConceptClick(concept: LearnConcept) {
    conceptOpenCount++; // Increment to force fresh mount
    selectedConcept = concept;
    setActiveConceptId(concept.id); // Persist for refresh survival
  }

  // Handle back from detail view
  function handleBackToPath() {
    selectedConcept = null;
    clearActiveConceptId(); // Clear persistence when closing
  }

  // Check if mode is active
  function isModeActive(mode: LearnMode): boolean {
    return activeMode === mode;
  }
</script>

<div class="learn-tab">
  <!-- Delight components (confetti and toasts) -->
  <ConfettiBurst orchestrator={delightOrchestrator} />
  <AchievementToast orchestrator={delightOrchestrator} />

  <!-- Content area - tab switching with slide transitions -->
  <div class="content-container">
    {#key activeMode}
      <div
        class="mode-panel"
        in:fly={{
          x: slideDirection * SLIDE_DISTANCE,
          duration: SLIDE_DURATION,
          easing: cubicOut,
        }}
        out:fly={{
          x: -slideDirection * SLIDE_DISTANCE,
          duration: SLIDE_DURATION,
          easing: cubicOut,
        }}
      >
        {#if isModeActive("concepts")}
          {#if selectedConcept}
            <!-- Key by openCount to force remount on each open -->
            {#key conceptOpenCount}
              <ConceptDetailView
                concept={selectedConcept}
                onClose={handleBackToPath}
              />
            {/key}
          {:else}
            <ConceptPathView onConceptClick={handleConceptClick} />
          {/if}
        {:else if isModeActive("play")}
          <QuizTab />
        {:else if isModeActive("codex")}
          <CodexExplorer />
        {:else if isModeActive("tika")}
          <TikaTab />
        {:else if isModeActive("guide")}
          <GuideTab />
        {/if}
      </div>
    {/key}
  </div>
</div>

<style>
  .learn-tab {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: transparent;
    color: var(--foreground, #ffffff);
    container-type: size;
    container-name: learn-tab;
  }

  /* Content container */
  .content-container {
    position: relative;
    flex: 1;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* Mode panels */
  .mode-panel {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
