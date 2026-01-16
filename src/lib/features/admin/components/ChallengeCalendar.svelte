<script lang="ts">
  /**
   * Challenge Calendar
   *
   * Calendar view showing scheduled challenges
   */

  import type { ChallengeScheduleEntry } from "../domain/models/AdminModels";

  // Props
  let {
    scheduleEntries,
    onDateSelect,
    onDeleteChallenge,
  }: {
    scheduleEntries: ChallengeScheduleEntry[];
    onDateSelect: (date: string) => void;
    onDeleteChallenge?: (challengeId: string) => void;
  } = $props();

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function isToday(dateStr: string): boolean {
    const today = new Date().toISOString().split("T")[0] || "";
    return dateStr === today;
  }

  function isPast(dateStr: string): boolean {
    const today = new Date().toISOString().split("T")[0] || "";
    return dateStr < today;
  }

  function handleDelete(event: MouseEvent, challengeId: string) {
    event.stopPropagation();
    // Confirmation is handled at the parent level (DailyChallengeScheduler)
    onDeleteChallenge?.(challengeId);
  }
</script>

<div class="calendar">
  <h3 class="calendar-title">
    <i class="fas fa-calendar-alt" aria-hidden="true"></i>
    Challenge Schedule
  </h3>

  <div class="calendar-grid">
    {#each scheduleEntries as entry (entry.date)}
      <div class="calendar-day-wrapper">
        <button
          class="calendar-day"
          class:scheduled={entry.isScheduled}
          class:today={isToday(entry.date)}
          class:past={isPast(entry.date)}
          onclick={() => onDateSelect(entry.date)}
        >
          <div class="day-header">
            <span class="day-label">{formatDate(entry.date)}</span>
            {#if isToday(entry.date)}
              <span class="today-badge">Today</span>
            {/if}
          </div>

          <div class="day-content">
            {#if entry.isScheduled && entry.challenge}
              <div class="challenge-indicator">
                <i class="fas fa-check-circle" aria-hidden="true"></i>
                <span class="challenge-title">{entry.challenge.title}</span>
              </div>
            {:else}
              <div class="no-challenge">
                <i class="fas fa-plus-circle" aria-hidden="true"></i>
                <span>Add Challenge</span>
              </div>
            {/if}
          </div>
        </button>
        {#if entry.isScheduled && entry.challenge && onDeleteChallenge}
          <button
            class="delete-button"
            onclick={(e) => handleDelete(e, entry.challenge!.id)}
            aria-label="Delete challenge"
            title="Delete challenge"
          >
            <i class="fas fa-trash" aria-hidden="true"></i>
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .calendar {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .calendar-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0 0 1.5rem 0;
    font-size: 1.4rem;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .calendar-day-wrapper {
    position: relative;
  }

  .calendar-day {
    background: var(--theme-card-bg);
    border: 2px solid var(--theme-stroke);
    border-radius: 8px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    color: var(--text-color, #ffffff);
  }

  .calendar-day:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  .calendar-day.scheduled {
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  }

  .calendar-day.today {
    border-color: rgba(255, 215, 0, 0.6);
    background: rgba(255, 215, 0, 0.1);
  }

  .calendar-day.past {
    opacity: 0.6;
  }

  .day-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .day-label {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .today-badge {
    background: rgba(255, 215, 0, 0.3);
    color: #ffd700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;
  }

  .day-content {
    min-height: 60px;
    display: flex;
    align-items: center;
  }

  .challenge-indicator {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .challenge-indicator i {
    color: #4ade80;
    font-size: 1.5rem;
  }

  .challenge-title {
    font-size: 0.9rem;
    line-height: 1.3;
    opacity: 0.9;
  }

  .delete-button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    padding: 4px 8px;
    color: var(--semantic-error);
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s ease;
    font-size: 0.85rem;
    z-index: 1;
  }

  .calendar-day-wrapper:hover .delete-button {
    opacity: 1;
  }

  .delete-button:hover {
    background: rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.5);
    transform: scale(1.05);
  }

  .delete-button:active {
    transform: scale(0.95);
  }

  .no-challenge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    opacity: 0.5;
  }

  .no-challenge i {
    font-size: 1.5rem;
  }

  .no-challenge span {
    font-size: 0.85rem;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .calendar {
      padding: 1rem;
    }

    .calendar-grid {
      grid-template-columns: 1fr;
    }

    .calendar-day {
      padding: 0.75rem;
    }
  }
</style>
