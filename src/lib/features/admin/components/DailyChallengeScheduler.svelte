<script lang="ts">
  /**
   * Daily Challenge Scheduler
   * Admin tool for scheduling and managing daily challenges
   */

  import { onMount } from "svelte";
  import {
    getScheduledChallenges,
    createChallenge,
    deleteChallenge,
  } from "../services/admin-challenge-manager";
  import type {
    ChallengeScheduleEntry,
    ChallengeFormData,
  } from "../domain/models/admin-models";
  import SchedulerStatsGrid from "./challenge-scheduler/SchedulerStatsGrid.svelte";
  import SchedulerCalendarView from "./challenge-scheduler/SchedulerCalendarView.svelte";
  import SchedulerTimelineView from "./challenge-scheduler/SchedulerTimelineView.svelte";
  import ChallengeFormPanel from "./challenge-scheduler/ChallengeFormPanel.svelte";
  import AdminModal from "$lib/shared/admin/components/AdminModal.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  // State
  let isLoading = $state(true);
  let scheduleEntries = $state<ChallengeScheduleEntry[]>([]);
  let selectedDate = $state<string | null>(null);
  let showCreationPanel = $state(false);
  let currentMonth = $state(new Date());
  let viewMode = $state<"calendar" | "timeline">("calendar");

  // Delete confirmation modal state
  let showDeleteModal = $state(false);
  let pendingDeleteId = $state<string | null>(null);

  // Derived
  const stats = $derived.by(() => {
    const today = new Date().toISOString().split("T")[0] ?? "";
    const scheduled = scheduleEntries.filter((e) => e.isScheduled);
    const upcoming = scheduled.filter((e) => e.date >= today);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const thisWeek = scheduled.filter((e) => {
      return (
        e.date >= (weekStart.toISOString().split("T")[0] ?? "") &&
        e.date <= (weekEnd.toISOString().split("T")[0] ?? "")
      );
    });

    return {
      total: scheduled.length,
      upcoming: upcoming.length,
      thisWeek: thisWeek.length,
      unscheduled: scheduleEntries.length - scheduled.length,
    };
  });

  const calendarDays = $derived.by(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    interface CalendarDay {
      date: string;
      day: number;
      isCurrentMonth: boolean;
      entry?: ChallengeScheduleEntry;
    }

    const days: CalendarDay[] = [];

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      const dateStr = date.toISOString().split("T")[0] ?? "";
      days.push({
        date: dateStr,
        day: date.getDate(),
        isCurrentMonth: false,
        entry: scheduleEntries.find((e) => e.date === dateStr),
      });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toISOString().split("T")[0] ?? "";
      days.push({
        date: dateStr,
        day: d,
        isCurrentMonth: true,
        entry: scheduleEntries.find((e) => e.date === dateStr),
      });
    }

    // Next month padding (fill to 42 cells for 6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      const dateStr = date.toISOString().split("T")[0] ?? "";
      days.push({
        date: dateStr,
        day: i,
        isCurrentMonth: false,
        entry: scheduleEntries.find((e) => e.date === dateStr),
      });
    }

    return days;
  });

  const upcomingChallenges = $derived.by(() => {
    const today = new Date().toISOString().split("T")[0] ?? "";
    return scheduleEntries
      .filter((e) => e.isScheduled && e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7);
  });

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    isLoading = true;
    try {
      // Calculate date range: 1 month ago to 2 months ahead
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setDate(1);

      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 2);
      endDate.setDate(0);

      const entries = await getScheduledChallenges(startDate, endDate);
      scheduleEntries = entries;
    } catch (error) {
      console.error("Failed to load scheduler data:", error);
    } finally {
      isLoading = false;
    }
  }

  function handleDateSelect(date: string) {
    selectedDate = date;
    showCreationPanel = true;
  }

  function handleClosePanel() {
    selectedDate = null;
    showCreationPanel = false;
  }

  function navigateMonth(delta: number) {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + delta);
    currentMonth = newMonth;
  }

  function goToToday() {
    currentMonth = new Date();
  }

  async function handleScheduleChallenge(data: {
    sequenceId: string;
    sequenceName: string;
    title: string;
    description: string;
    difficulty: "beginner" | "intermediate" | "advanced";
    xpReward: number;
  }) {
    if (!selectedDate) return;

    try {
      const formData: ChallengeFormData = {
        date: selectedDate,
        sequenceId: data.sequenceId,
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        xpReward: data.xpReward,
        type: "build_sequence",
        target: 1,
        metadata: {
          sequenceId: data.sequenceId,
          sequenceName: data.sequenceName,
        },
      };

      await createChallenge(formData);
      toast.success(t("admin_challenge_scheduled"));
      await loadData();
      handleClosePanel();
    } catch (error) {
      console.error("Failed to schedule challenge:", error);
      toast.error(t("admin_schedule_failed"));
    }
  }

  function handleDeleteChallenge(challengeId: string) {
    pendingDeleteId = challengeId;
    showDeleteModal = true;
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;

    try {
      await deleteChallenge(pendingDeleteId);
      toast.success(t("admin_challenge_deleted"));
      await loadData();
    } catch (error) {
      console.error("Failed to delete challenge:", error);
      toast.error(t("admin_delete_failed"));
    } finally {
      showDeleteModal = false;
      pendingDeleteId = null;
    }
  }

  function cancelDelete() {
    showDeleteModal = false;
    pendingDeleteId = null;
  }
</script>

<div class="scheduler">
  {#if isLoading}
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <p>{t("admin_loading_challenge_data")}</p>
    </div>
  {:else}
    <SchedulerStatsGrid {stats} />

    <div class="main-content">
      <div class="calendar-panel">
        <div class="panel-header">
          <div class="view-toggle" role="group" aria-label={t("visibility_animation")}>
            <button
              class="toggle-btn"
              class:active={viewMode === "calendar"}
              onclick={() => (viewMode = "calendar")}
              aria-pressed={viewMode === "calendar"}
            >
              <i class="fas fa-calendar-alt" aria-hidden="true"></i>
              {t("admin_calendar")}
            </button>
            <button
              class="toggle-btn"
              class:active={viewMode === "timeline"}
              onclick={() => (viewMode = "timeline")}
              aria-pressed={viewMode === "timeline"}
            >
              <i class="fas fa-list" aria-hidden="true"></i>
              {t("admin_timeline")}
            </button>
          </div>
        </div>

        {#if viewMode === "calendar"}
          <SchedulerCalendarView
            {calendarDays}
            {currentMonth}
            {selectedDate}
            onDateSelect={handleDateSelect}
            onNavigateMonth={navigateMonth}
            onGoToToday={goToToday}
          />
        {:else}
          <SchedulerTimelineView
            {upcomingChallenges}
            onDeleteChallenge={handleDeleteChallenge}
            onSwitchToCalendar={() => (viewMode = "calendar")}
          />
        {/if}
      </div>

      <ChallengeFormPanel
        {selectedDate}
        showPanel={showCreationPanel}
        onClose={handleClosePanel}
        onSchedule={handleScheduleChallenge}
      />
    </div>
  {/if}
</div>

{#if showDeleteModal}
  <AdminModal
    title={t("admin_delete_challenge")}
    message={t("admin_confirm_delete_challenge")}
    variant="danger"
    confirmLabel={t("action_delete")}
    cancelLabel={t("action_cancel")}
    onConfirm={confirmDelete}
    onCancel={cancelDelete}
  />
{/if}

<style>
  .scheduler {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1.5rem;
    gap: 1.5rem;
    overflow-y: auto;
    max-width: 1600px;
    margin: 0 auto;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    gap: 1rem;
    opacity: 0.6;
  }

  .loading-state i {
    font-size: 2.5rem;
  }

  .main-content {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 1.5rem;
    flex: 1;
    min-height: 0;
  }

  .calendar-panel {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .view-toggle {
    display: flex;
    background: var(--theme-card-bg);
    border-radius: 8px;
    padding: 4px;
  }

  .toggle-btn {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    transition: all var(--duration-normal) ease;
  }

  .toggle-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    color: #fff;
  }

  .toggle-btn:hover:not(.active) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  @media (max-width: 1024px) {
    .main-content {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .scheduler {
      padding: 1rem;
    }
  }
</style>
