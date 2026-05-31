<!--
ImagePanel.svelte - Choreo card visibility settings panel

Uses the real ChoreoCard component with an AABB example sequence,
so the preview matches exactly what the user will see when exporting.
-->
<script lang="ts">
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import { getAabbSequenceData } from "./example-data";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";

  interface Props {
    addWord: boolean;
    addStepNumbers: boolean;
    addDifficultyLevel: boolean;
    includeStartPosition: boolean;
    showQRCode: boolean;
    showLoopGlyph: boolean;
    showCreatorName: boolean;
    showNotes: boolean;
    showBirthday: boolean;
    customNotesText: string;
    darkMode: boolean;
    onToggle: (key: string) => void;
    onCustomNotesChange: (value: string) => void;
    onPictographToggle: (key: string) => void;
    isMobileHidden?: boolean;
  }

  let {
    addWord,
    addStepNumbers,
    addDifficultyLevel,
    includeStartPosition,
    showQRCode,
    showLoopGlyph,
    showCreatorName,
    showNotes,
    showBirthday,
    customNotesText,
    darkMode,
    onToggle,
    onCustomNotesChange,
    onPictographToggle,
    isMobileHidden = false,
  }: Props = $props();

  const aabbSequence = getAabbSequenceData();
  const userName = $derived(authState.user?.displayName || "Your Name");
</script>

<section class="settings-panel image-panel" class:mobile-hidden={isMobileHidden}>
  <header class="panel-header">
    <span class="panel-icon image-icon">
      <i class="fas fa-id-card" aria-hidden="true"></i>
    </span>
    <h3 class="panel-title">Choreo Card</h3>
  </header>

  <div class="preview-frame image-preview">
    <ChoreoCard
      sequence={aabbSequence}
      showWord={addWord}
      showStepNumbers={addStepNumbers}
      showDifficultyLevel={addDifficultyLevel}
      {includeStartPosition}
      {showQRCode}
      {showLoopGlyph}
      {showCreatorName}
      {showNotes}
      {showBirthday}
      {darkMode}
      {userName}
      {customNotesText}
      forceContain={true}
    />
  </div>

  <div class="panel-controls">
    <!-- What gets included in the card layout -->
    <div class="control-group">
      <span class="group-label">Include</span>
      <div class="toggle-grid">
        <button
          class="toggle-btn"
          class:active={addWord}
          onclick={() => onToggle("word")}
        >
          Word
        </button>
        <button
          class="toggle-btn"
          class:active={addStepNumbers}
          onclick={() => onToggle("stepNumbers")}
        >
          Step #s
        </button>
        <button
          class="toggle-btn"
          class:active={addDifficultyLevel}
          onclick={() => onToggle("difficulty")}
        >
          Difficulty
        </button>
      </div>
    </div>

    <!-- Display extras -->
    <div class="control-group">
      <span class="group-label">Display</span>
      <div class="toggle-grid">
        <button
          class="toggle-btn"
          class:active={showQRCode}
          onclick={() => onToggle("qrCode")}
        >
          QR Code
        </button>
        <button
          class="toggle-btn"
          class:active={showLoopGlyph}
          onclick={() => onToggle("loopGlyph")}
        >
          LOOP
        </button>
      </div>
    </div>

    <!-- Footer fields -->
    <div class="control-group">
      <span class="group-label">Footer</span>
      <div class="toggle-grid footer-toggles">
        <button
          class="toggle-btn"
          class:active={showCreatorName}
          onclick={() => onToggle("creatorName")}
        >
          Name
        </button>
        <button
          class="toggle-btn"
          class:active={showNotes}
          onclick={() => onToggle("notes")}
        >
          Notes
        </button>
        <button
          class="toggle-btn"
          class:active={showBirthday}
          onclick={() => onToggle("birthday")}
        >
          Date
        </button>
      </div>
    </div>

    <!-- Notes text override -->
    <div class="control-group notes-input-group">
      <label class="group-label" for="custom-notes">Custom Notes Text</label>
      <input
        id="custom-notes"
        type="text"
        class="notes-input"
        value={customNotesText}
        placeholder="Created using TKA Scribe"
        oninput={(e) => onCustomNotesChange(e.currentTarget.value)}
      />
    </div>
  </div>
</section>

<style>
  /* ── Panel shell ─────────────────────────────────────────── */

  .settings-panel {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-width: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    overflow: hidden;
  }

  .mobile-hidden {
    display: none;
  }

  /* ── Header ──────────────────────────────────────────────── */

  .panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px 12px;
    flex-shrink: 0;
  }

  .panel-icon {
    --icon-color: #34d399;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--icon-color) 15%, transparent);
    color: var(--icon-color);
    font-size: 14px;
    flex-shrink: 0;
  }

  .panel-title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  /* ── Preview frame ───────────────────────────────────────── */

  /*
   * The choreo card is landscape-oriented (wider than tall), so we skip
   * the square aspect-ratio constraint used by other panels and let the
   * preview content determine its own height.
   */
  .preview-frame {
    width: 100%;
    align-self: center;
    flex-shrink: 0;
    padding: 0 16px;
    box-sizing: border-box;
    min-height: 280px;
  }

  /* ── Controls ────────────────────────────────────────────── */

  .panel-controls {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px 16px 16px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  /* ── Toggle grid ─────────────────────────────────────────── */

  .toggle-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .footer-toggles {
    grid-template-columns: 1fr 1fr 1fr;
  }

  /* ── Toggle buttons ──────────────────────────────────────── */

  .toggle-btn {
    min-height: 44px;
    padding: 8px 10px;
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 80%, transparent);
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease;
    text-align: center;
    line-height: 1.2;
  }

  .toggle-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #ffffff);
  }

  .toggle-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-text, #ffffff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent) 15%, transparent), 0 2px 8px color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .toggle-btn.active:hover {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 55%, transparent);
  }

  /* ── Notes input ─────────────────────────────────────────── */

  .notes-input-group {
    gap: 6px;
  }

  .notes-input {
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-compact, 12px);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    transition: border-color 150ms ease;
    box-sizing: border-box;
  }

  .notes-input:focus {
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline: none;
  }

  .notes-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
  }

  /* ── Reduced motion ──────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .toggle-btn,
    .notes-input {
      transition: none;
    }
  }

  /* ── High contrast ───────────────────────────────────────── */

  @media (forced-colors: active) {
    .toggle-btn.active {
      border-color: Highlight;
      color: Highlight;
    }

    .settings-panel {
      border-color: ButtonBorder;
    }

    .notes-input {
      border-color: ButtonBorder;
      color: ButtonText;
      background: ButtonFace;
    }
  }
</style>
