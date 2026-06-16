<script lang="ts">
  /**
   * SkillProgressionList
   * Displays a list of skill progressions with their progress levels.
   */

  import type {
    SkillProgression,
    UserSkillProgress,
  } from "$lib/shared/gamification/domain/models/challenge-models";

  interface Props {
    skills: SkillProgression[];
    progressMap: Map<string, UserSkillProgress>;
    compact?: boolean;
    onSkillSelect?: (skillId: string) => void;
  }

  let { skills, progressMap, compact = false, onSkillSelect }: Props = $props();

  // Get progress for a skill
  function getProgress(skillId: string): UserSkillProgress | null {
    return progressMap.get(skillId) ?? null;
  }

  // Calculate progress percentage for a skill
  function getProgressPercent(skill: SkillProgression): number {
    const progress = getProgress(skill.skillId);
    if (!progress) return 0;

    const currentLevel = skill.levels[progress.currentLevel - 1];
    if (!currentLevel) return 100; // Completed

    return Math.round(
      (progress.levelProgress / currentLevel.requirement.target) * 100
    );
  }

  // Get level title
  function getLevelTitle(skill: SkillProgression): string {
    const progress = getProgress(skill.skillId);
    if (!progress) return "Not Started";
    if (progress.isCompleted) return "Mastered";

    const currentLevel = skill.levels[progress.currentLevel - 1];
    return currentLevel?.title ?? "Level " + progress.currentLevel;
  }

  // Category colors
  const categoryColors: Record<string, string> = {
    letter_mastery: "#06b6d4",
    concept_mastery: "var(--theme-accent-strong)",
    practice_goals: "var(--semantic-warning)",
  };

  function getCategoryColor(category: string): string {
    return categoryColors[category] ?? "#6b7280";
  }
</script>

<div class="skill-list" class:compact>
  {#each skills as skill (skill.skillId)}
    {@const progress = getProgress(skill.skillId)}
    {@const progressPercent = getProgressPercent(skill)}
    {@const levelTitle = getLevelTitle(skill)}
    {@const isCompleted = progress?.isCompleted ?? false}
    {@const categoryColor = getCategoryColor(skill.skillCategory)}

    <button
      class="skill-item"
      class:completed={isCompleted}
      onclick={() => onSkillSelect?.(skill.skillId)}
      style="--category-color: {categoryColor}"
    >
      <!-- Icon -->
      <div class="skill-icon">
        {#if skill.icon.startsWith("fa-")}
          <i class="fas {skill.icon}" aria-hidden="true"></i>
        {:else}
          <span class="letter-icon">{skill.icon}</span>
        {/if}
      </div>

      <!-- Info -->
      <div class="skill-info">
        <div class="skill-header">
          <h4>{skill.skillName}</h4>
          <span class="level-badge" class:mastered={isCompleted}>
            {levelTitle}
          </span>
        </div>

        {#if !compact}
          <p class="skill-description">{skill.description}</p>
        {/if}

        <!-- Progress bar -->
        <div class="skill-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width: {progressPercent}%"
              class:completed={isCompleted}
            ></div>
          </div>
          <span class="progress-text">
            {#if isCompleted}
              <i class="fas fa-check" aria-hidden="true"></i> Complete
            {:else if progress}
              Level {progress.currentLevel}/{skill.totalLevels}
            {:else}
              0/{skill.totalLevels} levels
            {/if}
          </span>
        </div>
      </div>

      <!-- XP Reward -->
      <div class="skill-xp">
        <i class="fas fa-star" aria-hidden="true"></i>
        <span>{skill.xpPerLevel * skill.totalLevels}</span>
      </div>
    </button>
  {/each}

  {#if skills.length === 0}
    <div class="empty-state">
      <i class="fas fa-medal" aria-hidden="true"></i>
      <p>No skills to display</p>
    </div>
  {/if}
</div>

<style>
  /* ============================================================================
     BASE STYLES - iPhone SE (320px) Mobile-First
     ============================================================================ */
  .skill-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skill-list.compact {
    gap: 6px;
  }

  .skill-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    text-align: left;
    width: 100%;
  }

  .compact .skill-item {
    padding: 8px;
    gap: 8px;
  }

  .skill-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .skill-item.completed {
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent);
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 5%, transparent);
  }

  .skill-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: color-mix(in srgb, var(--category-color) 20%, transparent);
    border-radius: 8px;
    color: var(--category-color);
    font-size: var(--font-size-sm);
    flex-shrink: 0;
  }

  .compact .skill-icon {
    width: 32px;
    height: 32px;
    font-size: var(--font-size-compact);
  }

  .letter-icon {
    font-size: var(--font-size-base);
    font-weight: 700;
  }

  .compact .letter-icon {
    font-size: var(--font-size-sm);
  }

  .skill-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .skill-header {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .skill-header h4 {
    margin: 0;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .level-badge {
    padding: 1px 6px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text-dim);
    white-space: nowrap;
  }

  .level-badge.mastered {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 20%, transparent);
    color: var(--semantic-success, #22c55e);
  }

  .skill-description {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .skill-progress {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .progress-bar {
    flex: 1;
    height: 5px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2.5px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--category-color);
    border-radius: 2.5px;
    transition: width var(--duration-emphasis) ease;
  }

  .progress-fill.completed {
    background: var(--semantic-success);
  }

  .progress-text {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    white-space: nowrap;
  }

  .progress-text i {
    color: var(--semantic-success);
    margin-right: 3px;
  }

  .skill-xp {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 6px;
    background: color-mix(in srgb, var(--semantic-warning, #f59e0b) 15%, transparent);
    border-radius: 12px;
    color: var(--semantic-warning, #f59e0b);
    font-size: var(--font-size-compact);
    font-weight: 600;
    flex-shrink: 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 30px 16px;
    text-align: center;
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-compact);
  }

  /* ============================================================================
     LARGE MOBILE (481px+)
     ============================================================================ */
  @media (min-width: 481px) {
    .skill-list {
      gap: 10px;
    }

    .skill-list.compact {
      gap: 8px;
    }

    .skill-item {
      gap: 12px;
      padding: 14px;
      border-radius: 11px;
    }

    .compact .skill-item {
      padding: 10px;
      gap: 10px;
    }

    .skill-icon {
      width: 40px;
      height: 40px;
      font-size: var(--font-size-base);
      border-radius: 9px;
    }

    .compact .skill-icon {
      width: 34px;
      height: 34px;
      font-size: var(--font-size-compact);
    }

    .letter-icon {
      font-size: var(--font-size-lg);
    }

    .compact .letter-icon {
      font-size: var(--font-size-sm);
    }

    .skill-info {
      gap: 7px;
    }

    .skill-header {
      gap: 7px;
    }

    .skill-header h4 {
      font-size: var(--font-size-compact);
    }

    .level-badge {
      padding: 2px 7px;
      font-size: var(--font-size-compact);
    }

    .skill-description {
      font-size: var(--font-size-compact);
      line-height: 1.4;
    }

    .skill-progress {
      gap: 10px;
    }

    .progress-bar {
      height: 5.5px;
    }

    .progress-text {
      font-size: var(--font-size-compact);
    }

    .skill-xp {
      gap: 4px;
      padding: 4px 8px;
      font-size: var(--font-size-compact);
    }

    .empty-state {
      gap: 12px;
      padding: 35px 20px;
    }

    .empty-state i {
      font-size: var(--font-size-3xl);
    }

    .empty-state p {
      font-size: var(--font-size-compact);
    }
  }

  /* ============================================================================
     TABLET (641px+)
     ============================================================================ */
  @media (min-width: 641px) {
    .skill-list {
      gap: 12px;
    }

    .skill-list.compact {
      gap: 8px;
    }

    .skill-item {
      gap: 16px;
      padding: 16px;
      border-radius: 12px;
    }

    .compact .skill-item {
      padding: 12px;
      gap: 12px;
    }

    .skill-icon {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-lg);
      border-radius: 10px;
    }

    .compact .skill-icon {
      width: 36px;
      height: 36px;
      font-size: var(--font-size-sm);
    }

    .letter-icon {
      font-size: var(--font-size-xl);
    }

    .compact .letter-icon {
      font-size: var(--font-size-base);
    }

    .skill-info {
      gap: 8px;
    }

    .skill-header {
      gap: 8px;
    }

    .skill-header h4 {
      font-size: var(--font-size-sm);
      white-space: normal;
    }

    .level-badge {
      padding: 2px 8px;
      font-size: var(--font-size-compact);
      border-radius: 4px;
    }

    .skill-description {
      white-space: normal;
      display: -webkit-box;
      line-clamp: 2;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .skill-progress {
      gap: 12px;
    }

    .progress-bar {
      height: 6px;
      border-radius: 3px;
    }

    .progress-fill {
      border-radius: 3px;
    }

    .progress-text {
      font-size: var(--font-size-compact);
    }

    .progress-text i {
      margin-right: 4px;
    }

    .skill-xp {
      gap: 4px;
      padding: 4px 10px;
      font-size: var(--font-size-compact);
      border-radius: 16px;
    }

    .empty-state {
      gap: 12px;
      padding: 40px 20px;
    }

    .empty-state i {
      font-size: var(--font-size-3xl);
    }

    .empty-state p {
      font-size: var(--font-size-sm);
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .skill-item,
    .progress-fill {
      transition: none;
    }
  }
</style>
