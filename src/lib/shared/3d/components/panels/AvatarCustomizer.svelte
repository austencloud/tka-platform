<script lang="ts">
  /**
   * AvatarCustomizer Panel
   *
   * UI for customizing the 3D figure's appearance:
   * - Body type toggle (masculine/feminine)
   * - Skin tone selection (preset colors)
   */

  import type { BodyType } from "@austencloud/scene-3d";

  interface Props {
    bodyType: BodyType;
    skinTone: string;
    onBodyTypeChange: (type: BodyType) => void;
    onSkinToneChange: (color: string) => void;
  }

  let { bodyType, skinTone, onBodyTypeChange, onSkinToneChange }: Props =
    $props();

  // Skin tone presets - diverse range
  const SKIN_TONES = [
    { name: "Fair", color: "#ffe0bd" },
    { name: "Light", color: "#f5d0b5" },
    { name: "Medium Light", color: "#d4a574" },
    { name: "Medium", color: "#c68642" },
    { name: "Medium Dark", color: "#8d5524" },
    { name: "Dark", color: "#5c3317" },
  ];
</script>

<div class="avatar-customizer">
  <h4 class="section-title">Avatar</h4>

  <!-- Body Type Toggle -->
  <div class="control-group">
    <span class="control-label">Body Type</span>
    <div class="toggle-group" role="group" aria-label="Body type">
      <button
        class="toggle-btn"
        class:active={bodyType === "masculine"}
        onclick={() => onBodyTypeChange("masculine")}
        aria-label="Body type: Masculine"
        aria-pressed={bodyType === "masculine"}
      >
        <i class="fas fa-mars" aria-hidden="true"></i>
        <span>Masculine</span>
      </button>
      <button
        class="toggle-btn"
        class:active={bodyType === "feminine"}
        onclick={() => onBodyTypeChange("feminine")}
        aria-label="Body type: Feminine"
        aria-pressed={bodyType === "feminine"}
      >
        <i class="fas fa-venus" aria-hidden="true"></i>
        <span>Feminine</span>
      </button>
    </div>
  </div>

  <!-- Skin Tone Selector -->
  <div class="control-group">
    <span class="control-label">Skin Tone</span>
    <div class="skin-tone-grid" role="group" aria-label="Skin tone">
      {#each SKIN_TONES as tone}
        <button
          class="skin-swatch"
          class:active={skinTone === tone.color}
          style:background-color={tone.color}
          onclick={() => onSkinToneChange(tone.color)}
          aria-label={tone.name}
          title={tone.name}
        >
          {#if skinTone === tone.color}
            <i class="fas fa-check" aria-hidden="true"></i>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .avatar-customizer {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .section-title {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim);
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .control-label {
    font-size: 0.8rem;
    color: var(--theme-text-dim);
  }

  .toggle-group {
    display: flex;
    gap: 0.5rem;
  }

  .toggle-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .toggle-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .toggle-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-accent);
  }

  .toggle-btn i {
    font-size: 0.9rem;
  }

  .skin-tone-grid {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .skin-swatch {
    width: var(--min-touch-target); /* WCAG AA touch target */
    height: var(--min-touch-target);
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all var(--duration-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skin-swatch:hover {
    transform: scale(1.1);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .skin-swatch.active {
    border-color: var(--theme-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .skin-swatch i {
    color: color-mix(in srgb, var(--theme-text) 50%, transparent);
    font-size: 0.8rem;
    text-shadow: 0 0 2px var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
</style>
