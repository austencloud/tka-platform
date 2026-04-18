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
    gap: clamp(8px, 2vw, 24px);
    padding: clamp(16px, 3vw, 32px) clamp(8px, 2vw, 24px) clamp(12px, 2vw, 24px);
  }

  .lcard {
    flex: 0 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(6px, 1vw, 14px);
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
    margin-top: clamp(6px, 1vw, 12px);
    font-size: clamp(10px, 0.6vw + 0.4rem, 13px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
    line-height: 1.3;
  }

  .lnum {
    width: clamp(18px, 2vw, 26px);
    height: clamp(18px, 2vw, 26px);
    border-radius: 50%;
    font-family: Cambria, serif;
    font-weight: bold;
    font-size: clamp(11px, 0.8vw + 0.3rem, 14px);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #000;
    margin-bottom: clamp(4px, 1vw, 10px);
  }

  .lcard.dim { opacity: 0.5; }
  .lcard.dim img {
    width: clamp(64px, 14vw, 120px);
    height: clamp(64px, 14vw, 120px);
    filter: grayscale(1) brightness(0.85);
  }
  .lcard.dim .lnum { filter: grayscale(1) brightness(0.85); }

  .lcard.current {
    background: color-mix(in srgb, var(--theme-accent, #2196f3) 14%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #2196f3) 35%, transparent);
    padding: clamp(10px, 2vw, 22px);
    transform: translateY(clamp(2px, 0.6vw, 8px));
  }
  .lcard.current img {
    width: clamp(120px, 24vw, 240px);
    height: clamp(120px, 24vw, 240px);
  }
  .lcard.current .lnum {
    width: clamp(24px, 2.4vw, 34px);
    height: clamp(24px, 2.4vw, 34px);
    font-size: clamp(13px, 1vw + 0.3rem, 18px);
  }
  .lcard.current .lname {
    color: var(--theme-text, #e8e8ea);
    font-size: clamp(12px, 0.7vw + 0.5rem, 15px);
    font-weight: 600;
    margin-top: clamp(8px, 1.2vw, 14px);
  }

  @media (prefers-reduced-motion: reduce) {
    .lcard { transition: none; }
  }
</style>
