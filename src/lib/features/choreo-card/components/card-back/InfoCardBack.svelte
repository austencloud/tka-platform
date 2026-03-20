<!--
  InfoCardBack — "Your Deck" reference card

  Back side of the rules card. Explains the corner badges,
  levels, LOOPs, and how to sort/chain sequences.
  Same 500×700 print resolution as choreo cards.
-->
<script lang="ts">
  import { getCardBackThemeVisuals } from "./card-back-theme-visuals";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  const theme = $derived(getCardBackThemeVisuals(settingsService.settings.backgroundType));
</script>

<div class="border-frame" style="background: {theme.borderGradient};">
  <div class="card" style="background: {theme.background};">
    <div class="content">

      <h1 class="title">Your Deck</h1>

      <div class="divider"></div>

      <!-- Corner badges explanation -->
      <h3 class="section-title">Card Corners</h3>
      <div class="corner-grid">
        <div class="corner-item">
          <span class="corner-badge-example" style="background: radial-gradient(circle, #93c5fd, #3b82f6); color: black;">1</span>
          <span class="corner-desc"><strong>Top left</strong> Level</span>
        </div>
        <div class="corner-item">
          <span class="corner-icon"><i class="fas fa-sync-alt"></i></span>
          <span class="corner-desc"><strong>Top right</strong> LOOP type</span>
        </div>
        <div class="corner-item">
          <span class="corner-number">8</span>
          <span class="corner-desc"><strong>Bottom left</strong> Steps</span>
        </div>
        <div class="corner-item">
          <span class="corner-glyph">α</span>
          <span class="corner-desc"><strong>Bottom right</strong> Start position</span>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Levels -->
      <h3 class="section-title">Levels</h3>
      <div class="level-list">
        <div class="level-row"><span class="level-num">1</span> No turns (foundation)</div>
        <div class="level-row"><span class="level-num">2</span> Whole turns</div>
        <div class="level-row"><span class="level-num">3</span> Half turns and float</div>
      </div>

      <div class="divider"></div>

      <!-- LOOPs -->
      <h3 class="section-title">LOOPs</h3>
      <p class="body-text">Most sequences are LOOPs — the last beat connects back to the first. Play on repeat.</p>

      <div class="divider"></div>

      <!-- Sorting tip -->
      <h3 class="section-title">Chaining Sequences</h3>
      <p class="body-text">Group cards by start position (α, β, γ). Any two cards with the same start position can be played back to back.</p>

      <div class="spacer"></div>

      <div class="footer">Choreo Card · TKA</div>

    </div>
  </div>
</div>

<style>
  .border-frame {
    width: 100%;
    height: 100%;
    border-radius: 12px;
    padding: 4px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .card {
    width: 100%;
    height: 100%;
    color: #ffffff;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    overflow: hidden;
    border-radius: 8px;
    box-sizing: border-box;
  }

  .content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 32px 28px;
    box-sizing: border-box;
  }

  .title {
    margin: 0;
    text-align: center;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.12);
    margin: 12px 0;
  }

  .section-title {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.7);
  }

  /* Corner badges grid: 2x2 */
  .corner-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .corner-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .corner-badge-example {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    font-family: Cambria, serif;
    font-size: 16px;
    font-weight: bold;
    flex-shrink: 0;
  }

  .corner-icon {
    width: 26px;
    text-align: center;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
    flex-shrink: 0;
  }

  .corner-number {
    width: 26px;
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.6);
    flex-shrink: 0;
  }

  .corner-glyph {
    width: 26px;
    text-align: center;
    font-family: Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.6);
    flex-shrink: 0;
  }

  .corner-desc {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.3;
  }

  .corner-desc strong {
    color: rgba(255, 255, 255, 0.8);
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Level list */
  .level-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .level-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
  }

  .level-num {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    font-family: Cambria, serif;
    font-size: 13px;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.7);
    flex-shrink: 0;
  }

  .body-text {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.5;
  }

  .spacer { flex: 1; }

  .footer {
    text-align: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
    letter-spacing: 0.06em;
  }
</style>
