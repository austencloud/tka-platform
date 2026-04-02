<script lang="ts">
  import {
    SKIN_OPTIONS,
    HAIR_OPTIONS,
    JACKET_OPTIONS,
    type AvatarState,
  } from "../../state/avatar-state.svelte";

  interface Props {
    avatar: AvatarState;
    onenter: () => void;
  }

  let { avatar, onenter }: Props = $props();
</script>

<div class="picker-overlay">
  <div class="picker">
    <h2 class="picker-title">Choose Your Visitor</h2>

    <!-- Large preview -->
    <div class="preview-large">
      <div class="preview-shadow"></div>
      <div class="preview-hair" style="background: {avatar.config.hairColor};"></div>
      <div class="preview-head" style="background: {avatar.skinGradient};"></div>
      <div class="preview-body" style="background: {avatar.jacketGradient};"></div>
    </div>

    <!-- Tile-size previews -->
    <div class="preview-tiles">
      {#each [48, 32, 24] as size}
        <div class="preview-tile-wrap">
          <div class="preview-tile" style="width: {size}px; height: {size}px;">
            <div
              class="mini-hair"
              style="
                background: {avatar.config.hairColor};
                width: {size * 0.4}px; height: {size * 0.22}px;
                left: {size * 0.3}px; top: {size * 0.02}px;
              "
            ></div>
            <div
              class="mini-head"
              style="
                background: {avatar.skinGradient};
                width: {size * 0.38}px; height: {size * 0.32}px;
                left: {size * 0.31}px; top: {size * 0.06}px;
              "
            ></div>
            <div
              class="mini-body"
              style="
                background: {avatar.jacketGradient};
                width: {size * 0.7}px; height: {size * 0.5}px;
                left: {size * 0.15}px; top: {size * 0.35}px;
              "
            ></div>
          </div>
          <span class="preview-tile-label">{size}px</span>
        </div>
      {/each}
    </div>

    <!-- Skin -->
    <div class="choice-row">
      <span class="choice-label">Skin</span>
      <div class="swatches">
        {#each SKIN_OPTIONS as color}
          <button
            class="swatch"
            class:selected={avatar.config.skinColor === color}
            style="background: {color};"
            onclick={() => avatar.setSkin(color)}
            aria-label="Skin tone"
          ></button>
        {/each}
      </div>
    </div>

    <!-- Hair -->
    <div class="choice-row">
      <span class="choice-label">Hair</span>
      <div class="swatches">
        {#each HAIR_OPTIONS as color}
          <button
            class="swatch"
            class:selected={avatar.config.hairColor === color}
            style="background: {color};"
            onclick={() => avatar.setHair(color)}
            aria-label="Hair color"
          ></button>
        {/each}
      </div>
    </div>

    <!-- Jacket -->
    <div class="choice-row">
      <span class="choice-label">Jacket</span>
      <div class="swatches">
        {#each JACKET_OPTIONS as colors}
          <button
            class="swatch"
            class:selected={avatar.config.jacketColors[0] === colors[0]}
            style="background: {colors[0]};"
            onclick={() => avatar.setJacket(colors)}
            aria-label="Jacket color"
          ></button>
        {/each}
      </div>
    </div>

    <button class="enter-btn" onclick={() => { avatar.markChosen(); onenter(); }}>
      Enter the Archive
    </button>

    <p class="footnote">You can change this later in Settings</p>
  </div>
</div>

<style>
  .picker-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 8, 6, 0.98);
    z-index: 100;
  }

  .picker {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 40px;
    max-width: 400px;
  }

  .picker-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    font-weight: 400;
    letter-spacing: 0.06em;
    color: rgba(200, 180, 140, 0.8);
    margin: 0;
  }

  /* Large preview */
  .preview-large {
    position: relative;
    width: 80px;
    height: 80px;
  }

  .preview-shadow {
    position: absolute;
    bottom: 2px;
    left: 14px;
    width: 52px;
    height: 12px;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 50%;
  }

  .preview-hair {
    position: absolute;
    left: 24px;
    top: 1px;
    width: 32px;
    height: 18px;
    border-radius: 50% 50% 30% 30%;
    z-index: 3;
    transition: background 0.2s;
  }

  .preview-head {
    position: absolute;
    left: 26px;
    top: 5px;
    width: 28px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.1);
    z-index: 2;
    transition: background 0.2s;
  }

  .preview-body {
    position: absolute;
    left: 12px;
    top: 26px;
    width: 56px;
    height: 40px;
    border-radius: 10px 10px 5px 5px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    z-index: 1;
    transition: background 0.2s;
  }

  /* Tile previews */
  .preview-tiles {
    display: flex;
    gap: 16px;
    align-items: flex-end;
  }

  .preview-tile-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .preview-tile {
    position: relative;
    background: #2a2520;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .mini-hair {
    position: absolute;
    border-radius: 50% 50% 30% 30%;
    z-index: 3;
    transition: background 0.2s;
  }

  .mini-head {
    position: absolute;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.1);
    z-index: 2;
    transition: background 0.2s;
  }

  .mini-body {
    position: absolute;
    border-radius: 3px 3px 2px 2px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    z-index: 1;
    transition: background 0.2s;
  }

  .preview-tile-label {
    font-size: 10px;
    color: rgba(200, 180, 140, 0.3);
  }

  /* Choice rows */
  .choice-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .choice-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(200, 180, 140, 0.35);
  }

  .swatches {
    display: flex;
    gap: 8px;
  }

  .swatch {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2.5px solid transparent;
    cursor: pointer;
    transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
    padding: 0;
  }

  .swatch:hover {
    transform: scale(1.12);
  }

  .swatch.selected {
    border-color: rgba(200, 180, 140, 0.6);
    box-shadow: 0 0 0 3px rgba(200, 180, 140, 0.15);
  }

  .enter-btn {
    margin-top: 8px;
    padding: 12px 40px;
    background: rgba(200, 180, 140, 0.06);
    border: 1.5px solid rgba(200, 180, 140, 0.2);
    border-radius: 8px;
    color: rgba(200, 180, 140, 0.65);
    font-family: Georgia, serif;
    font-size: 15px;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s;
  }

  .enter-btn:hover {
    background: rgba(200, 180, 140, 0.1);
    border-color: rgba(200, 180, 140, 0.35);
    color: rgba(200, 180, 140, 0.9);
  }

  .footnote {
    color: rgba(200, 180, 140, 0.18);
    font-size: 11px;
    margin: 0;
  }
</style>
