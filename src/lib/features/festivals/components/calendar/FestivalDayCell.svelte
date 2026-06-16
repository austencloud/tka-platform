<script lang="ts">
  import type { TrackerStatus } from "../../domain/models/festival-tracker";
  import FestivalCalendarEntry from "./FestivalCalendarEntry.svelte";

  export interface CalendarEntry {
    type: "festival" | "deadline";
    name: string;
    festivalId: string;
    status?: TrackerStatus;
    daysLeft?: number;
  }

  interface Props {
    date: Date;
    entries: CalendarEntry[];
    isCurrentMonth: boolean;
    isToday: boolean;
  }

  const { date, entries, isCurrentMonth, isToday }: Props = $props();

  const MAX_VISIBLE = 3;
  const visibleEntries = $derived(entries.slice(0, MAX_VISIBLE));
  const overflowCount = $derived(Math.max(0, entries.length - MAX_VISIBLE));
  const dayNumber = $derived(date.getDate());
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="day-cell"
  class:today={isToday}
  class:outside-month={!isCurrentMonth}
  role="gridcell"
  aria-current={isToday ? "date" : undefined}
  aria-label="{date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}{entries.length > 0 ? `, ${entries.length} item${entries.length !== 1 ? 's' : ''}` : ''}"
  tabindex="0"
>
  <span class="day-number" aria-hidden="true">{dayNumber}</span>

  <div class="entries-container" aria-hidden="true">
    {#each visibleEntries as entry (entry.festivalId + entry.type)}
      <FestivalCalendarEntry {entry} />
    {/each}
  </div>

  {#if overflowCount > 0}
    <span class="overflow-label" aria-hidden="true">+{overflowCount} more</span>
  {/if}
</div>

<style>
  .day-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
    min-height: 90px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    outline: none;
    overflow: hidden;
    box-sizing: border-box;
  }

  .day-cell:focus-visible {
    box-shadow: inset 0 0 0 2px var(--theme-accent, #6366f1);
    z-index: 1;
  }

  .day-cell.today {
    box-shadow: inset 0 0 0 2px var(--theme-accent, #6366f1);
  }

  .day-cell.outside-month {
    opacity: 0.45;
  }

  .day-number {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    line-height: 1;
    color: var(--theme-text, #ffffff);
    align-self: flex-start;
    padding: 1px 3px;
    border-radius: var(--radius-sm, 4px);
    flex-shrink: 0;
  }

  .today .day-number {
    color: var(--theme-accent, #6366f1);
    font-weight: 700;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
  }

  .entries-container {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .overflow-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    padding: 0 4px;
    align-self: flex-start;
    line-height: 1.4;
  }

  @media (max-width: 767px) {
    .day-cell {
      min-height: 52px;
      padding: 3px;
    }

    .day-number {
      font-size: var(--font-size-compact, 12px);
    }
  }
</style>
