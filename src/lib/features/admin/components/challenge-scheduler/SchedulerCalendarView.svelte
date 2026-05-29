<script lang="ts">
  import type { ChallengeScheduleEntry } from "../../domain/models/admin-models";

  interface CalendarDay {
    date: string;
    day: number;
    isCurrentMonth: boolean;
    entry?: ChallengeScheduleEntry;
  }

  interface Props {
    calendarDays: CalendarDay[];
    currentMonth: Date;
    selectedDate: string | null;
    onDateSelect: (date: string) => void;
    onNavigateMonth: (delta: number) => void;
    onGoToToday: () => void;
  }

  let {
    calendarDays,
    currentMonth,
    selectedDate,
    onDateSelect,
    onNavigateMonth,
    onGoToToday,
  }: Props = $props();

  const today = $derived(new Date().toISOString().split("T")[0] ?? "");
  const monthName = $derived(
    currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  );

  function isToday(dateStr: string): boolean {
    return dateStr === today;
  }

  function isPast(dateStr: string): boolean {
    return dateStr < today;
  }
</script>

<div class="calendar-container">
  <div class="calendar-nav">
    <button
      class="nav-btn"
      onclick={() => onNavigateMonth(-1)}
      aria-label="Previous month"
    >
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </button>
    <div class="month-display">
      <span class="month-name">{monthName}</span>
      <button class="today-btn" onclick={onGoToToday}>Today</button>
    </div>
    <button
      class="nav-btn"
      onclick={() => onNavigateMonth(1)}
      aria-label="Next month"
    >
      <i class="fas fa-chevron-right" aria-hidden="true"></i>
    </button>
  </div>

  <div class="calendar-grid">
    <div class="weekday-header">
      {#each ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as day}
        <div class="weekday">{day}</div>
      {/each}
    </div>
    <div class="days-grid">
      {#each calendarDays as day (day.date)}
        <button
          class="calendar-day"
          class:other-month={!day.isCurrentMonth}
          class:today={isToday(day.date)}
          class:past={isPast(day.date)}
          class:scheduled={day.entry?.isScheduled}
          class:selected={selectedDate === day.date}
          onclick={() => onDateSelect(day.date)}
        >
          <span class="day-number">{day.day}</span>
          {#if day.entry?.isScheduled}
            <div class="scheduled-dot"></div>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .calendar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .calendar-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .nav-btn {
    width: var(--min-touch-target); /* WCAG AA touch target */
    height: var(--min-touch-target);
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-normal) ease;
  }

  .nav-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .month-display {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .month-name {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .today-btn {
    padding: 0.35rem 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: transparent;
    color: rgba(255, 255, 255, 0.8);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all var(--duration-normal) ease;
  }

  .today-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .calendar-grid {
    flex: 1;
  }

  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    margin-bottom: 8px;
  }

  .weekday {
    text-align: center;
    font-size: 0.8rem;
    font-weight: 600;
    opacity: 0.5;
    padding: 0.5rem;
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .calendar-day {
    aspect-ratio: 1;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: #fff;
    transition: all var(--duration-fast) ease;
    position: relative;
  }

  .calendar-day:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .calendar-day.other-month {
    opacity: 0.3;
  }

  .calendar-day.past:not(.today) {
    opacity: 0.5;
  }

  .calendar-day.today {
    background: rgba(255, 215, 0, 0.15);
    border-color: rgba(255, 215, 0, 0.4);
  }

  .calendar-day.today .day-number {
    color: #ffd700;
    font-weight: 700;
  }

  .calendar-day.scheduled {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .calendar-day.selected {
    background: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 80%, transparent);
    transform: scale(1.05);
  }

  .day-number {
    font-size: 0.95rem;
    font-weight: 500;
  }

  .scheduled-dot {
    width: 6px;
    height: 6px;
    background: #4ade80;
    border-radius: 50%;
    position: absolute;
    bottom: 6px;
  }

  @media (max-width: 768px) {
    .calendar-day {
      font-size: 0.85rem;
    }
  }
</style>
