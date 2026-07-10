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
   *
   * P2 (Guide Companion v2): Transform (mirror/color-swap/rotate) opens a
   * bits-ui Popover menu — same wrapping pattern as the BPM popover above —
   * and reuses the existing pure transform services (decoupled from
   * CreateModuleContext, so safe to call from a guide route):
   *   - mirrorSequence / swapColors from sequence-transformer.ts (module-level
   *     functions binding the shared motionQueryHandler singleton)
   *   - rotateSequenceGeometry from sequence-derived-fields.ts (pure geometry
   *     rotation; `steps` is in 45° increments, so 90° = 2)
   * Remix copies the /q scan host's composer-handoff mechanism exactly
   * (QScanPage.svelte `openInComposer`): stash the SequenceData under the
   * `tka-pending-edit-sequence` localStorage key that
   * deep-link-sequence-handler.ts already reads on construct-tab mount, then
   * navigate. No sequence-viewer chrome imported — just the handoff data path.
   *
   * P3 (Guide Companion v2): "Edit steps" swaps the animator area for an
   * inline editing sub-panel — a mini strip of tappable PictographContainer
   * cells (tap step N to truncate + rebuild from there) plus an embedded
   * OptionPicker (hideFilters, simplified grid). Edits stage locally
   * (stagedStrip, plain $state — no per-tap Firestore writes); Save converts
   * the staged strip through sequenceToStrip/guide-inline-edit and calls
   * saveOverride once. OptionPicker takes only currentSequence/currentGridMode
   * props (no CreateModuleContext dependency — verified by grep, no
   * getContext/setContext in option-picker/), so it's safe to embed directly
   * here. Plain `{#if editing}` swap, not <Crossfade> — the picker is heavy/
   * stateful (per crossfade-primitive.md, remounting is fine here since there's
   * no state to preserve across the swap, but a keyed crossfade would be the
   * wrong tool for a full sub-panel replacement anyway).
   */
  import { Popover } from "bits-ui";
  import { goto } from "$app/navigation";
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import BpmQuickPopover from "$lib/shared/animation-engine/components/controls/BpmQuickPopover.svelte";
  import CopyForAIButton from "$lib/shared/foundation/ui/CopyForAIButton.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import { getClaudeCodeCopier } from "$lib/shared/browse/get-claude-code-copier";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { sequenceToStrip, stripToSequence } from "../_data/guide-sequence-adapter";
  import {
    hasOverride,
    hasRevisionsCached,
    refreshRevisionAvailability,
    resetOverride,
    revertOverride,
    saveOverride,
  } from "../_data/guide-overrides.svelte";
  import {
    appendStep,
    deriveWordFromStrip,
    stepsOf,
    truncateStripAt,
  } from "../_data/guide-inline-edit";
  import { mirrorSequence, swapColors } from "$lib/shared/create/services/sequence-transformer";
  import { rotateSequenceGeometry } from "$lib/shared/create/services/sequence-derived-fields";
  import OptionPicker from "$lib/features/create/construct/option-picker/components/OptionPicker.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  const PENDING_EDIT_SEQUENCE_KEY = "tka-pending-edit-sequence";
  type TransformKind = "mirror" | "colorSwap" | "rotateCw" | "rotateCcw";

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
    /** Animated prop — hand for the hand chapters, staff for staff strips, or
     *  any PropType from the codex page's prop selector (the engine keys on
     *  this explicit prop, not motion.propType). */
    propType?: "hand" | "staff" | PropType;
    /** The clicked strip's identity — the key an override saves/reverts/resets
     *  under. Null when nothing is clicked yet. */
    stripKey?: string | null;
    /** Human page label for the Copy-for-AI header ("Guide: Level 1 › <title> › <word>"). */
    pageTitle?: string;
  } = $props();

  let bpm = $state(60);
  let bpmOpen = $state(false);
  let pickerOpen = $state(false);
  let transformOpen = $state(false);
  let transformBusy = $state(false);

  // Inline step editing (P3) — staged locally; nothing hits Firestore until Save.
  let editing = $state(false);
  let stagedStrip = $state<StepData[] | null>(null);
  let editSaving = $state(false);
  const stagedSteps = $derived(stagedStrip ? stepsOf(stagedStrip) : []);
  const editGridMode = $derived(
    (stagedStrip?.[0]?.gridMode as GridMode | undefined) ?? GridMode.DIAMOND
  );
  const editPropTypeOverride = $derived(propType === "staff" ? PropType.STAFF : PropType.HAND);

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

  /** Mirror / Color Swap / Rotate — pure transform services, decoupled from
   *  CreateModuleContext, so callable directly from this public guide route.
   *  rotateSequenceGeometry's `steps` unit is 45°; 90° = 2 steps. */
  async function runTransform(kind: TransformKind) {
    if (!stripKey || !sequence || transformBusy) return;
    transformBusy = true;
    try {
      let result: SequenceData;
      switch (kind) {
        case "mirror":
          result = await mirrorSequence(sequence, "both");
          break;
        case "colorSwap":
          result = swapColors(sequence);
          break;
        case "rotateCw":
          result = rotateSequenceGeometry(sequence, 2);
          break;
        case "rotateCcw":
          result = rotateSequenceGeometry(sequence, -2);
          break;
      }
      const strip = sequenceToStrip(result);
      await saveOverride(stripKey, strip, result.word);
      toast.success("Transform applied.");
    } catch (err) {
      console.error("[GuideCompanion] Transform failed:", err);
      toast.error("Failed to apply the transform.");
    } finally {
      transformBusy = false;
      transformOpen = false;
    }
  }

  /** Composer handoff — identical mechanism to QScanPage.svelte's
   *  `openInComposer`: stash the SequenceData under the well-known pending-edit
   *  key (deep-link-sequence-handler.ts reads it on construct-tab mount), then
   *  navigate. No sequence-viewer chrome imported. */
  function handleRemix() {
    if (!sequence) return;
    try {
      localStorage.setItem(PENDING_EDIT_SEQUENCE_KEY, JSON.stringify(sequence));
    } catch {
      // Storage unavailable (private mode) — still navigate; the composer
      // just starts empty.
    }
    void goto("/create/construct");
  }

  /** Enter edit mode — stage the current sequence's flat strip locally. */
  function startEdit() {
    if (!sequence || !stripKey) return;
    stagedStrip = sequenceToStrip(sequence);
    editing = true;
  }

  /** Tap step N in the mini strip: drop steps after N, resume picking from there. */
  function handleTruncateAt(stepNumber: number) {
    if (!stagedStrip) return;
    stagedStrip = truncateStripAt(stagedStrip, stepNumber);
  }

  /** OptionPicker selection — append the picked pictograph as the next step. */
  function handleEditOptionSelected(option: PictographData) {
    if (!stagedStrip) return;
    stagedStrip = appendStep(stagedStrip, option);
  }

  function cancelEdit() {
    editing = false;
    stagedStrip = null;
  }

  async function saveEdit() {
    if (!stagedStrip || !stripKey || editSaving) return;
    editSaving = true;
    try {
      const word = deriveWordFromStrip(stagedStrip);
      await saveOverride(stripKey, stagedStrip, word || undefined);
      toast.success("Guide sequence updated.");
      editing = false;
      stagedStrip = null;
    } catch (err) {
      console.error("[GuideCompanion] Save edit failed:", err);
      toast.error("Failed to save the edited sequence.");
    } finally {
      editSaving = false;
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
    {#if editing && stagedStrip}
      <div class="edit-panel">
        <div class="edit-strip" role="group" aria-label="Staged steps — tap a step to rebuild from there">
          {#each stagedStrip as box, i (box.id ?? i)}
            {@const stepNumber = box.stepNumber ?? 0}
            <button
              type="button"
              class="edit-cell"
              class:is-start={stepNumber === 0}
              onclick={() => handleTruncateAt(stepNumber)}
              aria-label={stepNumber === 0 ? "Start position" : `Step ${stepNumber} — tap to rebuild from here`}
            >
              <PictographContainer
                pictographData={box}
                gridMode={editGridMode}
                bluePropTypeOverride={editPropTypeOverride}
                redPropTypeOverride={editPropTypeOverride}
                stepNumberOverride={true}
              />
            </button>
          {/each}
        </div>

        <div class="edit-picker">
          <OptionPicker
            currentSequence={stagedSteps as unknown as PictographData[]}
            currentGridMode={editGridMode}
            onOptionSelected={handleEditOptionSelected}
            hideFilters={true}
          />
        </div>

        <div class="edit-actions" role="group" aria-label="Save or cancel editing">
          <button class="admin-btn" type="button" onclick={cancelEdit} disabled={editSaving}>
            <i class="fas fa-xmark" aria-hidden="true"></i>
            <span>Cancel</span>
          </button>
          <button class="admin-btn is-primary" type="button" onclick={saveEdit} disabled={editSaving}>
            <i class="fas fa-check" aria-hidden="true"></i>
            <span>{editSaving ? "Saving…" : "Save"}</span>
          </button>
        </div>
      </div>
    {:else}
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
        <Popover.Root bind:open={transformOpen}>
          <Popover.Trigger>
            {#snippet child({ props })}
              <button {...props} class="admin-btn" type="button" disabled={!sequence || transformBusy}>
                <i class="fas fa-shuffle" aria-hidden="true"></i>
                <span>Transform</span>
              </button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="top"
              align="center"
              sideOffset={12}
              collisionPadding={12}
              class="guide-transform-pop"
            >
              <div class="transform-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  class="transform-item"
                  disabled={transformBusy}
                  onclick={() => runTransform("mirror")}
                >
                  <i class="fas fa-left-right" aria-hidden="true"></i>
                  <span>Mirror</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  class="transform-item"
                  disabled={transformBusy}
                  onclick={() => runTransform("colorSwap")}
                >
                  <i class="fas fa-palette" aria-hidden="true"></i>
                  <span>Color Swap</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  class="transform-item"
                  disabled={transformBusy}
                  onclick={() => runTransform("rotateCw")}
                >
                  <i class="fas fa-rotate-right" aria-hidden="true"></i>
                  <span>Rotate 90° CW</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  class="transform-item"
                  disabled={transformBusy}
                  onclick={() => runTransform("rotateCcw")}
                >
                  <i class="fas fa-rotate-left" aria-hidden="true"></i>
                  <span>Rotate 90° CCW</span>
                </button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <button class="admin-btn" type="button" disabled={!sequence} onclick={handleRemix}>
          <i class="fas fa-pen-to-square" aria-hidden="true"></i>
          <span>Remix</span>
        </button>
        <button class="admin-btn" type="button" disabled={!sequence} onclick={startEdit}>
          <i class="fas fa-pen" aria-hidden="true"></i>
          <span>Edit steps</span>
        </button>
      </div>
    {/if}
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
  :global(.guide-transform-pop) {
    z-index: var(--z-dropdown, 1000);
  }
  .transform-menu {
    display: flex;
    flex-direction: column;
    min-width: 168px;
    padding: 6px;
    border-radius: 12px;
    background: var(--theme-card-bg, #1c1a24);
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }
  .transform-item {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 12px;
    border-radius: 8px;
    color: var(--theme-text, #e8e6f0);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--duration-fast, 150ms) ease;
  }
  .transform-item i {
    width: 1em;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }
  @media (hover: hover) and (pointer: fine) {
    .transform-item:hover:not(:disabled) {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    }
  }
  .transform-item:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }
  .transform-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Admin edit actions — same button styling family as .bpm-btn, in a row. */
  .admin-row {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
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
  .admin-btn.is-primary {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: #fff;
  }
  @media (hover: hover) and (pointer: fine) {
    .admin-btn.is-primary:hover:not(:disabled) {
      background: color-mix(in srgb, var(--theme-accent, #6366f1) 85%, white);
    }
  }

  /* Inline pictograph editing (P3) — mini strip + embedded OptionPicker. */
  .edit-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .edit-strip {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0.4rem;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .edit-cell {
    all: unset;
    cursor: pointer;
    box-sizing: border-box;
    width: 56px;
    height: 56px;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    border-radius: 8px;
    overflow: hidden;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    -webkit-tap-highlight-color: transparent;
    transition: border-color var(--duration-fast, 150ms) ease;
  }
  .edit-cell.is-start {
    border-color: var(--theme-accent, #6366f1);
  }
  @media (hover: hover) and (pointer: fine) {
    .edit-cell:hover {
      border-color: var(--theme-accent, #6366f1);
    }
  }
  .edit-cell:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }
  .edit-picker {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .edit-actions {
    flex: 0 0 auto;
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    .bpm-btn,
    .admin-btn,
    .transform-item,
    .edit-cell {
      transition: none;
    }
  }
</style>
