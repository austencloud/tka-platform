<!--
  PracticePanel.svelte - Practice Tab Container

  Always shows the training workspace (camera + beat grid) immediately.
  Sequence selection is integrated into the workspace UI for non-disruptive flow.
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import { getTrainPracticeState } from "../../state/train-practice-state.svelte";
  import TrainModePanel from "../TrainModePanel.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { activeChallengeState } from "../../state/active-challenge-state.svelte";
  import { formatChallengeRequirement } from "../../domain/models/train-challenge-models";

  const practiceState = getTrainPracticeState();

  // When active challenge changes, set mode appropriately
  $effect(() => {
    const challenge = activeChallengeState.activeChallenge;
    if (challenge?.requirement.metadata?.mode) {
      practiceState.setMode(challenge.requirement.metadata.mode);
    }
  });

  function handleSequenceSelect(sequence: SequenceData) {
    practiceState.setLastSequence(sequence);
  }

  function handleSequenceClear() {
    practiceState.clearLastSequence();
  }

  function handleSessionComplete() {
    // Add to recent sequences when training session completes
    if (practiceState.lastSequenceData) {
      practiceState.addToRecentSequences(practiceState.lastSequenceData);
    }
  }
</script>

<div class="practice-panel">
  <!-- Active Challenge Banner -->
  {#if activeChallengeState.activeChallenge}
    <div class="challenge-banner" transition:slide={{ duration: 300 }}>
      <div class="banner-content">
        <div class="banner-icon">
          <i class="fas fa-trophy" aria-hidden="true"></i>
        </div>
        <div class="banner-text">
          <h4>{activeChallengeState.activeChallenge.title}</h4>
          <p>
            {formatChallengeRequirement(
              activeChallengeState.activeChallenge.requirement
            )}
          </p>
        </div>
        <div class="banner-xp">
          <span>{activeChallengeState.activeChallenge.xpReward} XP</span>
        </div>
      </div>
      <button
        class="banner-close"
        aria-label="Dismiss active challenge banner"
        onclick={() => activeChallengeState.clearActiveChallenge()}
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/if}

  <!-- Main Content: Always show training workspace -->
  <div class="practice-content">
    <TrainModePanel
      sequence={practiceState.lastSequenceData}
      practiceMode={practiceState.currentMode}
      modeConfig={practiceState.getCurrentModeConfig()}
      challengeId={activeChallengeState.activeChallenge?.id}
      onSequenceSelect={handleSequenceSelect}
      onSequenceClear={handleSequenceClear}
      onSessionComplete={handleSessionComplete}
    />
  </div>
</div>

<style>
  .practice-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: transparent;
    container-type: size;
    container-name: practice-panel;
  }

  .practice-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Challenge Banner */
  .challenge-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: clamp(10px, 2.5cqw, 14px);
    padding: clamp(10px, 2.5cqh, 14px) clamp(12px, 3cqw, 18px);
    background: linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--semantic-warning, var(--semantic-warning)) 15%,
        transparent
      ),
      color-mix(
        in srgb,
        var(--semantic-warning, var(--semantic-warning)) 5%,
        transparent
      )
    );
    border-bottom: 1px solid
      color-mix(
        in srgb,
        var(--semantic-warning, var(--semantic-warning)) 30%,
        transparent
      );
    flex-shrink: 0;
  }

  .banner-content {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2.5cqw, 14px);
    flex: 1;
    min-width: 0;
  }

  .banner-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(32px, 6cqw, 40px);
    height: clamp(32px, 6cqw, 40px);
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 20%,
      transparent
    );
    border-radius: clamp(8px, 2cqw, 10px);
    color: var(--semantic-warning, var(--semantic-warning));
    font-size: var(--font-size-base);
    flex-shrink: 0;
  }

  .banner-text {
    flex: 1;
    min-width: 0;
  }

  .banner-text h4 {
    margin: 0 0 2px 0;
    font-size: clamp(13px, 3cqi, 15px);
    font-weight: 600;
    color: color-mix(in srgb, var(--theme-text, white) 95%, transparent);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .banner-text p {
    margin: 0;
    font-size: clamp(11px, 2.6cqi, 13px);
    color: var(--theme-text-dim, var(--theme-text-dim));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .banner-xp {
    display: flex;
    align-items: center;
    padding: clamp(6px, 1.6cqh, 10px) clamp(10px, 3cqw, 14px);
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 20%,
      transparent
    );
    border-radius: clamp(12px, 3cqw, 18px);
    flex-shrink: 0;
  }

  .banner-xp span {
    font-size: clamp(12px, 2.8cqi, 14px);
    font-weight: 600;
    color: var(--semantic-warning, var(--semantic-warning));
  }

  .banner-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: clamp(6px, 1.8cqw, 10px);
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal);
    flex-shrink: 0;
  }

  .banner-close:hover {
    background: var(--theme-stroke);
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
  }
</style>
