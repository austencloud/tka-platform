<!--
  Keyboard Properties sub-panel - TKA key layout reference.
-->
<script lang="ts">
  import RetroButton from "../../../primitives/RetroButton.svelte";

  let {
    onback,
  }: {
    onback: () => void;
  } = $props();
</script>

<div class="sub-panel">
  <div class="sub-panel-header">
    <button class="back-btn" type="button" onclick={onback}>
      &#9668; Back
    </button>
    <span class="sub-panel-title">Keyboard Properties</span>
  </div>

  <fieldset class="sub-panel-group">
    <legend>Number Row &rarr; Greek Letters</legend>
    <div class="keycap-row">
      <div class="keycap"><span class="keycap-key">1</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Sigma;</span></div>
      <div class="keycap"><span class="keycap-key">2</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Delta;</span></div>
      <div class="keycap"><span class="keycap-key">3</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Theta;</span></div>
      <div class="keycap"><span class="keycap-key">4</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Omega;</span></div>
      <div class="keycap"><span class="keycap-key">5</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Phi;</span></div>
      <div class="keycap"><span class="keycap-key">6</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Psi;</span></div>
      <div class="keycap"><span class="keycap-key">7</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Lambda;</span></div>
    </div>
  </fieldset>

  <fieldset class="sub-panel-group">
    <legend>Numpad &rarr; Position Letters</legend>
    <div class="keycap-grid">
      <div class="keycap"><span class="keycap-key">Num1</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&alpha;</span></div>
      <div class="keycap"><span class="keycap-key">Num2</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&beta;</span></div>
      <div class="keycap"><span class="keycap-key">Num3</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&gamma;</span></div>
      <div class="keycap"><span class="keycap-key">Num4</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&zeta;</span></div>
      <div class="keycap"><span class="keycap-key">Num5</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&eta;</span></div>
      <div class="keycap"><span class="keycap-key">Num6</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&tau;</span></div>
      <div class="keycap"><span class="keycap-key">Num7</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&#8853;</span></div>
    </div>
    <div class="numpad-note">
      <span class="keycap keycap-wide"><span class="keycap-key">Num&minus;</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">-</span></span>
      Dash suffix (e.g. &Sigma; then Num&minus; &rarr; &Sigma;-)
    </div>
  </fieldset>

  <div class="keyboard-footer sunken-panel">
    <div>Repeat rate: &#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9617;&#9617;&#9617; Fast</div>
    <div class="stub-spacer"></div>
    <span class="stub-note">Keyboard type: Enhanced 101-key (TKA layout)</span>
  </div>

  <div class="sub-panel-buttons">
    <RetroButton label="OK" isDefault={true} onclick={onback} />
  </div>
</div>

<style>
  .sub-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sub-panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .back-btn {
    min-width: 60px;
    min-height: 21px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    padding: 2px 8px;
    cursor: default;
  }

  .sub-panel-title {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: 12px;
    font-weight: bold;
    color: var(--retro-black, #000);
  }

  .sub-panel-group {
    border: 1px solid var(--retro-button-shadow, #808080);
    padding: 8px;
    margin: 0;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
  }

  .sub-panel-group legend {
    font-weight: bold;
    color: var(--retro-black, #000);
    padding: 0 4px;
  }

  .sub-panel-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    padding-top: 4px;
  }

  .keycap-row {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }

  .keycap-grid {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 3px;
    justify-content: start;
  }

  .keycap {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 3px 5px;
    background: var(--retro-button-face, #c0c0c0);
    border: 1px solid;
    border-color:
      var(--retro-white, #fff)
      var(--retro-button-shadow, #808080)
      var(--retro-button-shadow, #808080)
      var(--retro-white, #fff);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: 10px;
    color: var(--retro-black, #000);
    white-space: nowrap;
  }

  .keycap-wide {
    padding: 3px 8px;
  }

  .keycap-key {
    font-weight: bold;
    font-size: 10px;
  }

  .keycap-arrow {
    color: var(--retro-dark-gray, #808080);
    font-size: 9px;
  }

  .keycap-symbol {
    font-weight: bold;
    font-size: 11px;
    color: var(--retro-navy, #000080);
  }

  .numpad-note {
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }

  .keyboard-footer {
    padding: 8px;
    background: var(--retro-field-bg, #fff);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }

  .stub-spacer {
    height: 6px;
  }

  .stub-note {
    font-size: 10px;
    color: var(--retro-dark-gray, #808080);
    font-style: italic;
  }
</style>
