<script lang="ts">
  /**
   * Reader companion — the right-hand panel that live-animates the sequence a
   * page hands up. Wraps the standalone InlineAnimationPlayer in MINIMAL chrome
   * (tap-to-play canvas + thin progress line + hover badge — the showcase idiom,
   * feedback_minimal_player_chrome); NOT the retired UnifiedTimeline scrubber.
   *
   * Tempo (Guide Companion v2, 2026-07-10): BPM chips demoted off the top —
   * a small "N BPM" button below the animator opens BpmQuickPopover in a
   * bits-ui Popover, same wrapping pattern as PracticeBar.svelte:190 (content
   * primitive is reused; NO sequence-viewer chrome internals imported).
   *
   * Admin-only additions: Copy-for-AI in the header (hand a broken sequence to
   * Claude instead of describing it) and an edit action row (Replace via
   * SequencePickerModal, Revert/Reset via guide-overrides.svelte). Edits persist
   * in Firestore for every reader after refresh — see guide-overrides.svelte.ts.
   */
  import { Popover } from "bits-ui";
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import BpmQuickPopover from "$lib/shared/animation-engine/components/controls/BpmQuickPopover.svelte";
  import CopyForAIButton from "$lib/shared/foundation/ui/CopyForAIButton.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import { getClaudeCodeCopier } from "$lib/shared/browse/get-claude-code-copier";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { sequenceToStrip } from "../_data/guide-sequence-adapter";
  import {
    hasOverride,
    hasRevisionsCached,
    refreshRevisionAvailability,
    resetOverride,
    revertOverride,
    saveOverride,
  } from "../_data/guide-overrides.svelte";

  let {
    sequence,
    onClose,
    onStep,
    propType = "hand",
    stripKey = null,
    pageTitle = "",
  }: {
    sequence: SequenceData | null;
    onClose: () => void;
    /** Live playback step from the player, forwarded so the reader can ring the
     *  matching on-screen strip cell (see GuideActiveStep). */
    onStep?: (currentStep: number) => void;
    /** Animated prop — hand for the hand chapters, staff for staff strips
     *  (the engine keys on this explicit prop, not motion.propType). */
    propType?: "hand" | "staff";
    /** The clicked strip's identity — the key an override saves/reverts/resets
     *  under. Null when nothing is clicked yet. */
    stripKey?: string | null;
    /** Human page label for the Copy-for-AI header ("Guide: Level 1 › <title> › <word>"). */
    pageTitle?: string;
  } = $props();

  let bpm = $state(60);
  let bpmOpen = $state(false);
  let pickerOpen = $state(false);

  // Revert availability is fetched lazily (Firestore read) whenever a new
  // strip is clicked while signed in as admin — cached in the override module
  // so the button can read it synchronously.
  $effect(() => {
    const key = stripKey;
    if (key && authState.isAdmin) refreshRevisionAvailability(key);
  });

  async function copyForAIData(): Promise<string> {
    if (!sequence) return "";
    const header = `Guide: Level 1 › ${pageTitle} › ${sequence.word ?? ""}`;
    const body = await getClaudeCodeCopier().generatePrompt(sequence);
    return `${header}\n\n${body}`;
  }

  async function handleReplace(picked: SequenceData) {
    pickerOpen = false;
    if (!stripKey) return;
    try {
      const strip = sequenceToStrip(picked);
      await saveOverride(stripKey, strip, picked.word);
      toast.success("Guide sequence replaced.");
    } catch (err) {
      console.error("[GuideCompanion] Replace failed:", err);
      toast.error("Failed to save the replacement.");
    }
  }

  async function handleRevert() {
    if (!stripKey) return;
    try {
      const ok = await revertOverride(stripKey);
      toast[ok ? "success" : "error"](ok ? "Reverted to the previous save." : "Nothing to revert.");
    } catch (err) {
      console.error("[GuideCompanion] Revert failed:", err);
      toast.error("Failed to revert.");
    }
  }

  async function handleReset() {
    if (!stripKey) return;
    try {
      await resetOverride(stripKey);
      toast.success("Reset to the original guide sequence.");
    } catch (err) {
      console.error("[GuideCompanion] Reset failed:", err);
      toast.error("Failed to reset.");
    }
  }
</script>

<div class="companion">
  <div class="head">
    <span class="ttl">Animation</span>
    <div class="head-actions">
      {#if authState.isAdmin}
        <CopyForAIButton
          variant="icon-only"
          size="sm"
          ariaLabel="Copy sequence for AI"
          getData={copyForAIData}
          disabled={!sequence}
        />
      {/if}
      <button class="close" onclick={onClose} aria-label="Close animation">✕</button>
    </div>
  </div>

  <div class="body">
    {#if sequence}
      {#key sequence.id}
        <InlineAnimationPlayer
          {sequence}
          autoPlay={true}
          chrome="minimal"
          externalBpm={bpm}
          bluePropType={propType}
          redPropType={propType}
          onStepChange={onStep}
        />
      {/key}
    {:else}
      <p class="hint">Click a sequence on the page to animate it.</p>
    {/if}

    <div class="tempo-row">
      <Popover.Root bind:open={bpmOpen}>
        <Popover.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              class="bpm-btn"
              type="button"
              aria-label={`Set tempo, currently ${bpm} BPM`}
            >
              <span class="bpm-value">{bpm}</span>
              <span class="bpm-unit">BPM <i class="fas fa-caret-up" aria-hidden="true"></i></span>
            </button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" align="center" sideOffset={12} collisionPadding={12} class="guide-bpm-pop">
            <BpmQuickPopover {bpm} onBpmChange={(v) => (bpm = v)} onClose={() => (bpmOpen = false)} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>

    {#if authState.isAdmin && stripKey}
      <div class="admin-row" role="group" aria-label="Edit this guide sequence">
        <button class="admin-btn" type="button" onclick={() => (pickerOpen = true)}>
          <i class="fas fa-right-left" aria-hidden="true"></i>
          <span>Replace</span>
        </button>
        <button
          class="admin-btn"
          type="button"
          disabled={!hasRevisionsCached(stripKey)}
          onclick={handleRevert}
        >
          <i class="fas fa-rotate-left" aria-hidden="true"></i>
          <span>Revert</span>
        </button>
        <button
          class="admin-btn"
          type="button"
          disabled={!hasOverride(stripKey)}
          onclick={handleReset}
        >
          <i class="fas fa-arrow-rotate-right" aria-hidden="true"></i>
          <span>Reset</span>
        </button>
      </div>
    {/if}
  </div>
</div>

<SequencePickerModal open={pickerOpen} onSelect={handleReplace} onClose={() => (pickerOpen = false)} />

<style>
  .companion {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--theme-text, #e8e6f0);
  }
  .head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem 0.6rem 1rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .ttl {
    font: 700 0.9rem system-ui, sans-serif;
    color: var(--theme-text, #e8e6f0);
  }
  .head-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .close {
    all: unset;
    cursor: pointer;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 1rem;
  }
  @media (hover: hover) and (pointer: fine) {
    .close:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
      color: var(--theme-text, #fff);
    }
  }
  .close:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #8b5cf6) 70%, transparent);
    outline-offset: -2px;
  }

  /* The player fills the panel — the canvas is the hero, no centering margins. */
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.75rem;
    overflow-y: auto;
  }
  .body :global(.inline-animation-player) {
    flex: 1;
    min-width: 0;
  }
  .hint {
    margin: auto;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font: italic 0.9rem/1.4 "Cormorant Garamond", Georgia, serif;
    text-align: center;
  }

  /* Tempo — a small button below the animator, not a top-of-panel strip. */
  .tempo-row {
    flex: 0 0 auto;
    display: flex;
    justify-content: center;
  }
  .bpm-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-height: var(--min-touch-target, 44px);
    min-width: var(--min-touch-target, 44px);
    padding: 6px 16px;
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    -webkit-tap-highlight-color: transparent;
    transition: background var(--duration-fast, 150ms) ease, border-color var(--duration-fast, 150ms) ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .bpm-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    }
  }
  .bpm-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }
  .bpm-value {
    font-size: 1.05rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    min-width: 2.5ch;
    text-align: center;
    color: var(--theme-text, #fff);
  }
  .bpm-unit {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
  .bpm-unit i {
    font-size: 9px;
    opacity: 0.8;
  }
  :global(.guide-bpm-pop) {
    z-index: var(--z-dropdown, 1000);
  }

  /* Admin edit actions — same button styling family as .bpm-btn, in a row. */
  .admin-row {
    flex: 0 0 auto;
    display: flex;
    justify-content: center;
    gap: 8px;
    padding-top: 0.4rem;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }
  .admin-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 14px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--duration-fast, 150ms) ease, opacity var(--duration-fast, 150ms) ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .admin-btn:hover:not(:disabled) {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
      color: var(--theme-text, #fff);
    }
  }
  .admin-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }
  .admin-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .bpm-btn,
    .admin-btn {
      transition: none;
    }
  }
</style>
