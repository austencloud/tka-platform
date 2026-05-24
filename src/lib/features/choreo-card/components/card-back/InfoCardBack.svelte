<!--
  InfoCardBack - "Your Deck" reference card

  Back side of the rules card. Explains corner badges, levels,
  LOOPs, and chaining. Better spacing, real badge visuals,
  chaining section given visual weight.
  500×700 print resolution.
-->
<script lang="ts">
  import { getCardBackThemeVisuals } from "./card-back-theme-visuals";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  const theme = $derived(getCardBackThemeVisuals(settingsService.settings.backgroundType));

  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";

  const LEVEL_INFO = [
    { num: 1, label: "Base Motions" },
    { num: 2, label: "Whole Turns" },
    { num: 3, label: "Half Turns, Floats" },
  ];
</script>

<div class="border-frame" style="background: {theme.borderGradient};">
  <div class="card" style="background: {theme.background};">
    <div class="content">

      <div class="spacer-sm"></div>

      <h1 class="title">Your Deck</h1>

      <div class="spacer-md"></div>

      <!-- Corner badges: visual diagram -->
      <h3 class="section-label">Every Card Has Four Corners</h3>
      <div class="corner-diagram">
        <div class="diagram-card">
          <div class="diagram-tl">
            <DifficultyBadge level={1} size="22px" fontSize="14px" />
          </div>
          <div class="diagram-tr"><i class="fas fa-sync-alt"></i></div>
          <div class="diagram-center">WORD</div>
          <div class="diagram-bl">8</div>
          <div class="diagram-br">α</div>
        </div>
        <div class="corner-labels">
          <div class="label-row">
            <span class="label-item"><strong>Level</strong> difficulty</span>
            <span class="label-item right"><strong>LOOP</strong> pattern type</span>
          </div>
          <div class="label-row">
            <span class="label-item"><strong>Steps</strong> length</span>
            <span class="label-item right"><strong>Start</strong> α β or γ</span>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Levels with real gradients -->
      <h3 class="section-label">Levels</h3>
      <div class="level-list">
        {#each LEVEL_INFO as lv}
          <div class="level-row">
            <DifficultyBadge level={lv.num} size="26px" fontSize="15px" />
            <span class="level-desc">{lv.label}</span>
          </div>
        {/each}
      </div>

      <div class="divider"></div>

      <!-- LOOPs -->
      <h3 class="section-label">LOOPs</h3>
      <p class="body-text">The last step connects to the first. Play on repeat. The card back tells you what changes each cycle.</p>

      <div class="divider"></div>

      <!-- Chaining: the payoff section, given more room -->
      <h3 class="section-label">Chaining</h3>
      <div class="chain-highlight">
        <p class="chain-text">Group cards by start position. Any two α cards play back to back. Same for β and γ.</p>
        <div class="chain-visual">
          <span class="chain-badge">α</span>
          <span class="chain-arrow">→</span>
          <span class="chain-badge">α</span>
          <span class="chain-arrow">→</span>
          <span class="chain-badge">α</span>
          <span class="chain-dots">...</span>
        </div>
      </div>

      <div class="spacer-lg"></div>

      <div class="footer">Choreo Card · The Kinetic Alphabet</div>

    </div>
  </div>
</div>

<style>
  .border-frame {
    width: 100%;
    height: 100%;
    border-radius: 0;
    padding: 4px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .card {
    width: 100%;
    height: 100%;
    color: var(--theme-text, #ffffff);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    overflow: hidden;
    border-radius: 0;
    box-sizing: border-box;
  }

  .content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 28px 28px;
    box-sizing: border-box;
  }

  .spacer-sm { height: 8px; flex-shrink: 0; }
  .spacer-md { height: 14px; flex-shrink: 0; }
  .spacer-lg { flex: 1; }

  .title {
    margin: 0;
    text-align: center;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: 0.03em;
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: 12px 0;
  }

  .section-label {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  /* Corner diagram: mini card representation */
  .corner-diagram {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 4px;
  }

  .diagram-card {
    position: relative;
    width: 100%;
    height: 100px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .diagram-center {
    font-family: Georgia, serif;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    letter-spacing: 0.1em;
  }

  .diagram-tl { position: absolute; top: 6px; left: 8px; }
  .diagram-tr { position: absolute; top: 8px; right: 10px; font-size: 14px; color: var(--theme-text-muted, rgba(255, 255, 255, 0.5)); }
  .diagram-bl { position: absolute; bottom: 6px; left: 10px; font-size: 16px; font-weight: 700; color: var(--theme-text-muted, rgba(255, 255, 255, 0.5)); }
  .diagram-br { position: absolute; bottom: 6px; right: 10px; font-family: Georgia, serif; font-size: 18px; font-weight: 700; color: var(--theme-text-muted, rgba(255, 255, 255, 0.5)); }


  .corner-labels {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
  }

  .label-item {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .label-item.right {
    text-align: right;
  }

  .label-item strong {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    font-weight: 600;
  }

  /* Level list: horizontal row of badge + label */
  .level-list {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .level-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .level-row :global(.difficulty-badge) {
    flex-shrink: 0;
  }

  .level-desc {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.55));
    text-align: center;
  }

  .body-text {
    margin: 0;
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    line-height: 1.5;
  }

  /* Chaining highlight section */
  .chain-highlight {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .chain-text {
    margin: 0;
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    line-height: 1.5;
  }

  .chain-visual {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .chain-badge {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.25));
    font-family: Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
  }

  .chain-arrow {
    font-size: 16px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  .chain-dots {
    font-size: 16px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.2));
    letter-spacing: 2px;
  }

  .footer {
    text-align: center;
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.25));
    letter-spacing: 0.06em;
  }
</style>
