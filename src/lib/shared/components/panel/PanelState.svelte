<script lang="ts">
  /**
   * PanelState - Loading, error, and empty state component
   *
   * Provides consistent state displays across panels.
   */

  import PanelSpinner from "./PanelSpinner.svelte";

  type StateType = "loading" | "error" | "empty" | "info";

  interface Props {
    /** Type of state to display */
    type: StateType;
    /** Optional title */
    title?: string;
    /** Optional message */
    message?: string;
    /** Optional icon override (FontAwesome class) */
    icon?: string;
    /** Optional retry callback for error state */
    onretry?: () => void;
    /** Dense variant: smaller padding/icon/title for inline empty states */
    compact?: boolean;
  }

  let { type, title, message, icon, onretry, compact = false }: Props = $props();

  const defaultIcons: Record<StateType, string> = {
    loading: "",
    error: "fa-exclamation-triangle",
    empty: "fa-inbox",
    info: "fa-info-circle",
  };

  const defaultTitles: Record<StateType, string> = {
    loading: "",
    error: "Couldn't load this content",
    empty: "Nothing here yet",
    info: "Information",
  };

  const resolvedIcon = $derived(icon ?? defaultIcons[type]);
  const resolvedTitle = $derived(title ?? defaultTitles[type]);
</script>

<div
  class="panel-state"
  class:panel-state--error={type === "error"}
  class:panel-state--compact={compact}
  role={type === "error" ? "alert" : undefined}
>
  {#if type === "loading"}
    <PanelSpinner />
  {:else if resolvedIcon}
    <i class="fas {resolvedIcon} panel-state__icon" aria-hidden="true"></i>
  {/if}

  {#if resolvedTitle}
    <h3 class="panel-state__title">{resolvedTitle}</h3>
  {/if}

  {#if message}
    <p class="panel-state__message">{message}</p>
  {/if}

  {#if type === "error" && onretry}
    <button class="panel-state__retry" onclick={onretry}> Try Again </button>
  {/if}
</div>

<style>
  .panel-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 20px;
    text-align: center;
  }

  .panel-state--compact {
    padding: 20px 16px;
    gap: 8px;
  }

  .panel-state--compact .panel-state__icon {
    font-size: var(--font-size-xl);
  }

  .panel-state--compact .panel-state__title {
    font-size: var(--font-size-base);
  }

  .panel-state--compact .panel-state__message {
    font-size: var(--font-size-compact);
  }

  .panel-state__icon {
    font-size: var(--font-size-3xl);
    color: var(--theme-text-dim);
  }

  .panel-state--error .panel-state__icon {
    color: var(--semantic-error, var(--semantic-error));
  }

  .panel-state__title {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
  }

  .panel-state__message {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 0;
    max-width: 300px;
  }

  .panel-state__retry {
    margin-top: 8px;
    padding: 10px 20px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent-strong)) 15%,
      transparent
    );
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .panel-state__retry:hover {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: var(--theme-stroke-strong);
  }

  @media (prefers-reduced-motion: reduce) {
    .panel-state__retry {
      transition: none;
    }
  }
</style>
