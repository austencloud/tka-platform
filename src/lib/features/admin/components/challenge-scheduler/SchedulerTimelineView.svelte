<script lang="ts">
  import type { ChallengeScheduleEntry } from "../../domain/models/admin-models";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    upcomingChallenges: ChallengeScheduleEntry[];
    onDeleteChallenge: (challengeId: string) => void;
    onSwitchToCalendar: () => void;
  }

  let { upcomingChallenges, onDeleteChallenge, onSwitchToCalendar }: Props =
    $props();

  const today = $derived(new Date().toISOString().split("T")[0] ?? "");

  function isToday(dateStr: string): boolean {
    return dateStr === today;
  }

  function getDifficultyColor(difficulty: string): string {
    switch (difficulty) {
      case "beginner":
        return "#4ade80";
      case "intermediate":
        return "var(--semantic-warning)";
      case "advanced":
        return "var(--semantic-error)";
      default:
        return "#94a3b8";
    }
  }
</script>

<div class="timeline-container">
  <h3 class="timeline-title">
    <i class="fas fa-stream" aria-hidden="true"></i>
    Upcoming Challenges
  </h3>
  {#if upcomingChallenges.length === 0}
    <div class="empty-timeline">
      <i class="fas fa-calendar-times" aria-hidden="true"></i>
      <p>{t("empty_no_upcoming")}</p>
      <button class="add-challenge-btn" onclick={onSwitchToCalendar}>
        <i class="fas fa-plus" aria-hidden="true"></i>
        {t("scheduler_schedule_challenge")}
      </button>
    </div>
  {:else}
    <div class="timeline-list">
      {#each upcomingChallenges as entry (entry.date)}
        <div class="timeline-item" class:today={isToday(entry.date)}>
          <div class="timeline-date">
            <span class="date-day">{new Date(entry.date).getDate()}</span>
            <span class="date-month"
              >{new Date(entry.date).toLocaleDateString("en-US", {
                month: "short",
              })}</span
            >
            {#if isToday(entry.date)}
              <span class="today-badge">{t("calendar_today")}</span>
            {/if}
          </div>
          <div class="timeline-content">
            <h4>{entry.challenge?.title ?? "Untitled Challenge"}</h4>
            <p>{entry.challenge?.description ?? ""}</p>
            <div class="timeline-meta">
              <span
                class="difficulty-badge"
                style="color: {getDifficultyColor(
                  entry.challenge?.difficulty ?? ''
                )}"
              >
                {entry.challenge?.difficulty ?? "intermediate"}
              </span>
              <span class="xp-badge">
                <i class="fas fa-star" aria-hidden="true"></i>
                {entry.challenge?.xpReward ?? 50} XP
              </span>
            </div>
          </div>
          <button
            class="timeline-delete"
            onclick={() =>
              entry.challenge && onDeleteChallenge(entry.challenge.id)}
            aria-label={t("scheduler_delete_challenge")}
          >
            <i class="fas fa-trash" aria-hidden="true"></i>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .timeline-container {
    /* Brand purple gradient (shared with ChallengeFormPanel). No global token
       matches this exact 2-stop ramp; scoped per never-hand-roll fix pattern. */
    --challenge-brand-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    flex: 1;
    overflow-y: auto;
  }

  .timeline-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
  }

  .empty-timeline {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    gap: 1rem;
    opacity: 0.6;
  }

  .empty-timeline i {
    font-size: 3rem;
  }

  .add-challenge-btn {
    padding: 0.75rem 1.5rem;
    background: var(--challenge-brand-gradient);
    border: none;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    transition: all var(--duration-normal) ease;
  }

  .add-challenge-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .timeline-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .timeline-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    transition: all var(--duration-normal) ease;
  }

  .timeline-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .timeline-item.today {
    border-color: rgba(255, 215, 0, 0.4);
    background: rgba(255, 215, 0, 0.05);
  }

  .timeline-date {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 60px;
  }

  .date-day {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
  }

  .date-month {
    font-size: 0.75rem;
    opacity: 0.6;
    text-transform: uppercase;
  }

  .today-badge {
    background: rgba(255, 215, 0, 0.3);
    color: #ffd700;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: var(--font-size-compact, 12px);
    font-weight: bold;
    margin-top: 4px;
  }

  .timeline-content {
    flex: 1;
  }

  .timeline-content h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .timeline-content p {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .timeline-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.8rem;
  }

  .difficulty-badge {
    text-transform: capitalize;
    font-weight: 500;
  }

  .xp-badge {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--semantic-warning);
  }

  .timeline-delete {
    width: var(--min-touch-target); /* WCAG AA touch target */
    height: var(--min-touch-target);
    border: none;
    background: rgba(239, 68, 68, 0.1);
    color: var(--semantic-error);
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: all var(--duration-normal) ease;
  }

  .timeline-item:hover .timeline-delete {
    opacity: 1;
  }

  .timeline-delete:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .timeline-container::-webkit-scrollbar {
    width: 6px;
  }

  .timeline-container::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .timeline-container::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
  }
</style>
