<!--
  InfoCardFront — "How to Read" reference card

  Front side of the rules card included with every printed deck.
  Explains how to read a choreo card's pictograph grid.
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

      <h1 class="title">How to Read</h1>
      <h2 class="subtitle">a Choreo Card</h2>

      <div class="divider"></div>

      <div class="section">
        <div class="row">
          <span class="icon"><i class="fas fa-th"></i></span>
          <p class="text">Each cell is <strong>one beat</strong>. Read left to right, top to bottom.</p>
        </div>
      </div>

      <div class="section">
        <div class="row">
          <span class="icon blue-dot"></span>
          <span class="icon red-dot"></span>
          <p class="text"><strong class="blue">Blue</strong> = one prop. <strong class="red">Red</strong> = the other. Arrows show the path each prop travels.</p>
        </div>
      </div>

      <div class="section">
        <div class="row">
          <span class="icon letter">A</span>
          <p class="text">The <strong>letter</strong> below each beat is its TKA name. Same letter = same movement.</p>
        </div>
      </div>

      <div class="section">
        <div class="row">
          <span class="icon letter">α</span>
          <p class="text">The <strong>start position</strong> shows where to hold your props before beat 1.</p>
        </div>
      </div>

      <div class="section">
        <div class="row">
          <span class="icon"><i class="fas fa-qrcode"></i></span>
          <p class="text"><strong>Scan the QR code</strong> to open this sequence in the app with animation.</p>
        </div>
      </div>

      <div class="divider"></div>

      <p class="tip">Practice each beat slowly. Once smooth, speed up. The sequence loops — beat 1 follows the last beat.</p>

      <div class="spacer"></div>

      <div class="footer">tkaflowarts.com</div>

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
    padding: 36px 32px;
    box-sizing: border-box;
  }

  .title {
    margin: 0;
    text-align: center;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .subtitle {
    margin: 2px 0 0;
    text-align: center;
    font-size: 18px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.04em;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.12);
    margin: 16px 0;
  }

  .section {
    margin-bottom: 14px;
  }

  .row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.6);
  }

  .blue-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #3b82f6;
    margin-right: -8px;
  }

  .red-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ef4444;
  }

  .letter {
    font-family: Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.7);
  }

  .text {
    margin: 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.65);
    line-height: 1.5;
  }

  .text strong {
    color: #ffffff;
    font-weight: 600;
  }

  .blue { color: #60a5fa; }
  .red { color: #f87171; }

  .tip {
    margin: 0;
    font-size: 14px;
    font-style: italic;
    color: rgba(255, 255, 255, 0.45);
    line-height: 1.5;
    text-align: center;
  }

  .spacer { flex: 1; }

  .footer {
    text-align: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
    letter-spacing: 0.06em;
  }
</style>
