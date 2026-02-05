<script lang="ts">
  /**
   * DateSeparator
   *
   * Visual separator showing date between message groups
   */

  interface Props {
    date: Date;
  }

  let { date }: Props = $props();

  function formatDateLabel(d: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (messageDate.getTime() === today.getTime()) {
      return "Today";
    }
    if (messageDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    }

    // Within last 7 days - show day name
    const daysDiff = Math.floor(
      (today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff < 7) {
      return d.toLocaleDateString(undefined, { weekday: "long" });
    }

    // Older - show full date
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        messageDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
</script>

<div
  class="date-separator"
  role="separator"
  aria-label="Messages from {formatDateLabel(date)}"
>
  <span class="date-label">{formatDateLabel(date)}</span>
</div>

<style>
  .date-separator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 0;
  }

  .date-label {
    padding: 4px 12px;
    background: var(--theme-card-bg);
    border-radius: 12px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
