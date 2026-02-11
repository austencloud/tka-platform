<!--
  ArenaBattleView.svelte - Core arena experience

  Two animated sequences side by side (desktop) or stacked (mobile).
  User picks which they prefer. Vote updates Glicko-2 ratings and
  transitions to the next matchup.

  Desktop: Left/Right arrow keys to vote, Space to skip
  Mobile: Tap panel to vote
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import ArenaMatchupPanel from "./ArenaMatchupPanel.svelte";
  import ArenaDivider from "./ArenaDivider.svelte";
  import ArenaStreakCounter from "./ArenaStreakCounter.svelte";
  import ArenaVoteConfirmation from "./ArenaVoteConfirmation.svelte";
  import { arenaState } from "../../state/arena-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IArenaOrchestrator } from "../../services/contracts/IArenaOrchestrator";
  import { getAuthSync } from "$lib/shared/auth/firebase";

  // Auth context
  let userId = $state<string | null>(null);

  // Get orchestrator from DI
  const orchestrator: IArenaOrchestrator = container?.items?.arenaOrchestrator;

  // Vote feedback animation state
  let voteResult = $state<"left" | "right" | null>(null);
  let winnerWord = $state("");
  let transitioning = $state(false);
  let showKeyboardHints = $state(true);

  onMount(async () => {
    // Get auth state
    try {
      const auth = getAuthSync();
      userId = auth.currentUser?.uid ?? null;

      if (!userId) {
        arenaState.error = "Sign in to vote on sequences";
        arenaState.isLoading = false;
        return;
      }

      await orchestrator.initialize(userId);
      arenaState.currentMatchup = orchestrator.getCurrentMatchup();
      arenaState.isLoading = false;
    } catch (err) {
      console.error("[Arena] Failed to initialize:", err);
      arenaState.error = "Failed to load arena";
      arenaState.isLoading = false;
    }

    // Hide keyboard hints after first interaction
    const dismissHints = () => {
      showKeyboardHints = false;
      document.removeEventListener("keydown", dismissHints);
    };
    document.addEventListener("keydown", dismissHints);
  });

  function handleKeydown(e: KeyboardEvent) {
    if (transitioning || !arenaState.currentMatchup) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      vote("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      vote("right");
    } else if (e.key === " ") {
      e.preventDefault();
      skip();
    }
  }

  async function vote(side: "left" | "right") {
    if (transitioning || !arenaState.currentMatchup) return;
    arenaState.isVoting = true;
    transitioning = true;

    const matchup = arenaState.currentMatchup;
    const winnerId = side === "left" ? matchup.entryA.id : matchup.entryB.id;
    winnerWord = side === "left" ? matchup.entryA.word : matchup.entryB.word;
    voteResult = side;

    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    try {
      await orchestrator.vote(winnerId);
    } catch (err) {
      console.error("[Arena] Vote failed:", err);
    }

    // Hold vote feedback animation
    await new Promise((r) => setTimeout(r, 600));

    // Transition to next matchup
    voteResult = null;
    winnerWord = "";
    arenaState.currentMatchup = orchestrator.getCurrentMatchup();
    arenaState.sessionStreak = orchestrator.getSessionStreak();
    arenaState.matchupsCompleted = orchestrator.getMatchupsCompleted();

    transitioning = false;
    arenaState.isVoting = false;
  }

  async function skip() {
    if (transitioning) return;
    transitioning = true;
    arenaState.sessionStreak = 0;

    await orchestrator.skip();
    arenaState.currentMatchup = orchestrator.getCurrentMatchup();

    transitioning = false;
  }

  // Global keyboard listener
  let keydownHandler: (e: KeyboardEvent) => void;
  onMount(() => {
    keydownHandler = handleKeydown;
    document.addEventListener("keydown", keydownHandler);
  });
  onDestroy(() => {
    if (keydownHandler) {
      document.removeEventListener("keydown", keydownHandler);
    }
  });
</script>

<div class="battle-view">
  {#if arenaState.error}
    <div class="battle-error" role="alert">
      <i class="fas fa-lock" aria-hidden="true"></i>
      <p>{arenaState.error}</p>
    </div>
  {:else if arenaState.isLoading}
    <div class="battle-loading" role="status" aria-live="polite" aria-busy="true">
      <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
      <p>Loading matchup...</p>
    </div>
  {:else if arenaState.currentMatchup}
    {@const matchup = arenaState.currentMatchup}

    <div class="matchup-container">
      <ArenaMatchupPanel
        entry={matchup.entryA}
        rating={matchup.ratingA}
        data={matchup.dataA}
        side="left"
        {voteResult}
        disabled={transitioning}
        onvote={() => vote("left")}
      />

      <ArenaDivider />

      <ArenaMatchupPanel
        entry={matchup.entryB}
        rating={matchup.ratingB}
        data={matchup.dataB}
        side="right"
        {voteResult}
        disabled={transitioning}
        onvote={() => vote("right")}
      />
    </div>

    <div class="controls-bar">
      <ArenaStreakCounter streak={arenaState.sessionStreak} />

      <button
        class="skip-button"
        onclick={skip}
        disabled={transitioning}
        aria-label="Skip this matchup"
        type="button"
      >
        <i class="fas fa-forward" aria-hidden="true"></i>
        Skip
      </button>

      {#if showKeyboardHints}
        <div class="keyboard-hints" aria-hidden="true">
          <kbd>&larr;</kbd> Left
          <kbd>&rarr;</kbd> Right
          <kbd>Space</kbd> Skip
        </div>
      {/if}
    </div>

    <ArenaVoteConfirmation winner={winnerWord} />
  {:else}
    <div class="battle-empty" role="status">
      <i class="fas fa-inbox" aria-hidden="true"></i>
      <p>No matchups available right now</p>
    </div>
  {/if}
</div>

<style>
  .battle-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    gap: 12px;
  }

  .matchup-container {
    display: flex;
    flex: 1;
    gap: 0;
    align-items: stretch;
    min-height: 0;
    position: relative;
  }

  /* Desktop: side by side */
  @media (min-width: 768px) {
    .matchup-container {
      flex-direction: row;
      gap: 8px;
    }
  }

  /* Mobile: stacked */
  @media (max-width: 767px) {
    .matchup-container {
      flex-direction: column;
      gap: 8px;
    }
  }

  .controls-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 8px 0;
    flex-shrink: 0;
  }

  .skip-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    min-height: 48px;
    min-width: 48px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: border-color 0.2s ease, color 0.2s ease;
  }

  .skip-button:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .skip-button:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .skip-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .keyboard-hints {
    display: none;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  @media (min-width: 768px) {
    .keyboard-hints {
      display: flex;
    }
  }

  .keyboard-hints kbd {
    padding: 2px 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
    font-size: var(--font-size-compact, 12px);
    font-family: inherit;
  }

  .battle-loading,
  .battle-error,
  .battle-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex: 1;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  .battle-error {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .battle-loading i,
  .battle-error i,
  .battle-empty i {
    font-size: 32px;
  }

  .battle-loading p,
  .battle-error p,
  .battle-empty p {
    margin: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .skip-button {
      transition: none;
    }
  }
</style>
