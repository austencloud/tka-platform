<script lang="ts">
  import type { TrackerStatus } from "../../domain/models/festival-tracker";

  interface Props {
    entry: {
      type: "festival" | "deadline";
      name: string;
      status?: TrackerStatus;
      daysLeft?: number;
    };
  }

  const { entry }: Props = $props();

  // Color by tracker status for festival entries
  function statusColor(status: TrackerStatus | undefined): string {
    switch (status) {
      case "interested":  return "var(--blue-text, #93c5fd)";
      case "applying":
      case "applied":     return "var(--gold-text, #fbbf24)";
      case "accepted":
      case "attending":   return "var(--green-text, #86efac)";
      case "declined":    return "var(--theme-text-dim, rgba(255,255,255,0.5))";
      default:            return "var(--theme-text-dim, rgba(255,255,255,0.5))";
    }
  }

  function statusBarColor(status: TrackerStatus | undefined): string {
    switch (status) {
      case "interested":  return "var(--blue-text, #93c5fd)";
      case "applying":
      case "applied":     return "var(--gold-text, #fbbf24)";
      case "accepted":
      case "attending":   return "var(--green-text, #86efac)";
      case "declined":    return "var(--theme-text-dim, rgba(255,255,255,0.5))";
      default:            return "var(--theme-text-dim, rgba(255,255,255,0.5))";
    }
  }

  const isUrgent = $derived(
    entry.type === "deadline" &&
    entry.daysLeft !== undefined &&
    entry.daysLeft <= 7
  );

  const barColor = $derived(
    entry.type === "deadline"
      ? isUrgent
        ? "var(--semantic-error, #ef4444)"
        : "var(--red-text, #fca5a5)"
      : statusBarColor(entry.status)
  );

  const textColor = $derived(
    entry.type === "deadline"
      ? isUrgent
        ? "var(--semantic-error, #ef4444)"
        : "var(--red-text, #fca5a5)"
      : statusColor(entry.status)
  );

  const label = $derived(
    entry.type === "deadline" ? `Deadline: ${entry.name}` : entry.name
  );
</script>

<span
  class="entry-pill"
  class:urgent={isUrgent}
  style="--bar-color: {barColor}; --text-color: {textColor};"
  title={label}
>
  <span class="pill-bar" aria-hidden="true"></span>
  <span class="pill-label">{label}</span>
</span>

<style>
  .entry-pill {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    min-height: 20px;
    padding: 2px 4px 2px 0;
    border-radius: var(--radius-sm, 4px);
    overflow: hidden;
    box-sizing: border-box;
  }

  .pill-bar {
    flex-shrink: 0;
    width: 3px;
    align-self: stretch;
    border-radius: 1px;
    background: var(--bar-color);
    min-height: 16px;
  }

  .pill-label {
    flex: 1;
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entry-pill.urgent .pill-label {
    font-weight: 600;
  }
</style>
