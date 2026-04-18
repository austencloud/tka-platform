<script lang="ts">
  import { DIFFICULTY_LEVELS, DEFAULT_DIFFICULTY_STYLE } from "$lib/shared/config/difficulty-styles";
  import { LEVEL_METADATA, type LevelNumber } from "$lib/shared/domain/curriculum/level-metadata";

  let { currentLevel }: { currentLevel: LevelNumber } = $props();

  const levels: LevelNumber[] = [1, 2, 3];

  function badgeStyle(level: LevelNumber) {
    const style = DIFFICULTY_LEVELS[level] ?? DEFAULT_DIFFICULTY_STYLE;
    return `background: ${style.cssBg}; border-color: ${style.border}; color: ${style.text};`;
  }
</script>

<div class="row">
  {#each levels as level (level)}
    {@const meta = LEVEL_METADATA[level]}
    {@const isCurrent = level === currentLevel}
    <div class="lcard" class:current={isCurrent} class:dim={!isCurrent}>
      <div class="lnum" style={badgeStyle(level)}>{level}</div>
      <img src={meta.image} alt="Level {level} example pictograph" />
      <div class="lname">{meta.name}</div>
    </div>
  {/each}
</div>

<style>
  .row {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 18px;
    padding: 28px 20px 20px;
  }

  .lcard {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.2s ease;
  }

  .lcard img {
    background: #fff;
    padding: 4px;
    border-radius: 8px;
    display: block;
  }

  .lcard .lname {
    margin-top: 10px;
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
    line-height: 1.3;
  }

  .lnum {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-family: Cambria, serif;
    font-weight: bold;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #000;
    margin-bottom: 8px;
  }

  .lcard.dim { opacity: 0.5; }
  .lcard.dim img {
    width: 110px;
    height: 110px;
    filter: grayscale(1) brightness(0.85);
  }
  .lcard.dim .lnum { filter: grayscale(1) brightness(0.85); }

  .lcard.current {
    background: color-mix(in srgb, var(--theme-accent, #2196f3) 14%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #2196f3) 35%, transparent);
    padding: 18px;
    transform: translateY(8px);
  }
  .lcard.current img { width: 200px; height: 200px; }
  .lcard.current .lnum { width: 32px; height: 32px; font-size: 17px; }
  .lcard.current .lname {
    color: var(--theme-text, #e8e8ea);
    font-size: 14px;
    font-weight: 600;
    margin-top: 12px;
  }

  @container (max-width: 360px) {
    .row {
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .lcard.current { transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .lcard { transition: none; }
  }
</style>
