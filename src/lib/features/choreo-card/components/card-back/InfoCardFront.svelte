<!--
  InfoCardFront - "How to Read a Choreo Card"

  Front side of the rules card. Vertically centered, consistent
  visual language, personality over help-doc sterility.
  500×700 print resolution.
-->
<script lang="ts">
  import { getCardBackThemeVisuals } from "./card-back-theme-visuals";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  const theme = $derived(getCardBackThemeVisuals(settingsService.settings.backgroundType));
</script>

<div class="border-frame" style="background: {theme.borderGradient};">
  <div class="card" style="background: {theme.background};">
    <div class="content">

      <div class="spacer-sm"></div>

      <h1 class="title">How to Read</h1>
      <h2 class="subtitle">a Choreo Card</h2>

      <div class="spacer-md"></div>

      <!-- Each item: number badge + explanation. Consistent, scannable. -->
      <div class="steps">

        <div class="step">
          <span class="step-num">1</span>
          <p class="step-text">Each cell is one step. Read left to right, top to bottom. The grid is your choreography.</p>
        </div>

        <div class="step">
          <span class="step-num">2</span>
          <div class="step-text">
            <span class="color-swatch blue"></span> and
            <span class="color-swatch red"></span> are your two props.
            Arrows show the path each one travels through the step.
          </div>
        </div>

        <div class="step">
          <span class="step-num">3</span>
          <p class="step-text">The letter below each step is its name in The Kinetic Alphabet. If two steps share a letter, they share a movement.</p>
        </div>

        <div class="step">
          <span class="step-num">4</span>
          <p class="step-text">The first cell marked <em>Start</em> shows where to hold your props before step 1.</p>
        </div>

        <div class="step">
          <span class="step-num">5</span>
          <p class="step-text">The sequence loops. After the last step, you're back at step 1. Keep going.</p>
        </div>

      </div>

      <div class="spacer-md"></div>

      <div class="divider"></div>

      <div class="spacer-sm"></div>

      <!-- Greek letter pronunciation table -->
      <h3 class="section-label">Pronunciation</h3>
      <div class="pronunciation-grid">
        <span class="pron-item"><strong>Α</strong> Alpha</span>
        <span class="pron-item"><strong>Β</strong> Beta</span>
        <span class="pron-item"><strong>Γ</strong> Gamma</span>
        <span class="pron-item"><strong>Σ</strong> Sigma</span>
        <span class="pron-item"><strong>Δ</strong> Delta</span>
        <span class="pron-item"><strong>Θ</strong> Theta</span>
        <span class="pron-item"><strong>Ω</strong> Omega</span>
        <span class="pron-item"><strong>Φ</strong> Phi</span>
        <span class="pron-item"><strong>Ψ</strong> Psi</span>
        <span class="pron-item"><strong>Λ</strong> Lambda</span>
        <span class="pron-item"><strong>τ</strong> Tau</span>
        <span class="pron-item"><strong>-</strong> Dash</span>
      </div>

      <div class="spacer-lg"></div>

      <div class="qr-hint">
        <i class="fas fa-qrcode"></i>
        <span>Scan a card's QR code to see it animated in the app</span>
      </div>

      <div class="spacer-sm"></div>

      <div class="footer">tkaflowarts.com</div>

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
    padding: 28px 30px;
    box-sizing: border-box;
  }

  .spacer-sm { height: 8px; flex-shrink: 0; }
  .spacer-md { height: 16px; flex-shrink: 0; }
  .spacer-lg { flex: 1; }

  .title {
    margin: 0;
    text-align: center;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 0.03em;
  }

  .subtitle {
    margin: 2px 0 0;
    text-align: center;
    font-size: 17px;
    font-weight: 400;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Numbered steps */
  .steps {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .step-num {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.25));
    font-size: 13px;
    font-weight: 700;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    margin-top: 1px;
  }

  .step-text {
    margin: 0;
    font-size: 13.5px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    line-height: 1.45;
  }

  .step-text em {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.8));
    font-style: italic;
  }

  /* Color swatches inline */
  .color-swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    vertical-align: middle;
    margin: 0 1px;
  }
  .color-swatch.blue { background: var(--tka-blue-hand, #3b82f6); }
  .color-swatch.red { background: var(--tka-red-hand, #ef4444); }

  /* Pronunciation grid */
  .section-label {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-align: center;
  }

  .pronunciation-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px 8px;
    text-align: center;
  }

  .pron-item {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
  }

  .pron-item strong {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.75));
    font-family: Georgia, serif;
    font-size: 14px;
    margin-right: 3px;
  }

  /* QR hint */
  .qr-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.35));
  }

  .qr-hint i {
    font-size: 14px;
    opacity: 0.6;
  }

  .footer {
    text-align: center;
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.25));
    letter-spacing: 0.06em;
  }
</style>
