<!--
  PanelHeader.svelte
  
  Unified header component for all Create module panels (Edit, Animation, etc.)
  Ensures consistent height and styling across panel implementations.
  
  Features:
  - Title with optional beat number
  - Tab/mode buttons (optional)
  - Action buttons (optional, e.g., Export GIF)
  - Close button (always present)
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    subtitle,
    isMobile = false,
    onClose,
    tabButtons,
    actionButtons,
  }: {
    title: string;
    subtitle?: string;
    isMobile?: boolean;
    onClose: () => void;
    tabButtons?: Snippet; // Optional snippet for tab/mode buttons (e.g., Remove/Adjust in Edit)
    actionButtons?: Snippet; // Optional snippet for action buttons (e.g., Export GIF)
  } = $props();
</script>

<div class="panel-header" class:mobile={isMobile}>
  <!-- Left section: Tab/mode buttons and action buttons (if provided) -->
  <div class="header-tabs">
    {#if tabButtons}
      {@render tabButtons()}
    {/if}
    {#if actionButtons}
      {@render actionButtons()}
    {/if}
  </div>

  <!-- Center section: Title and subtitle (always centered) -->
  <div class="header-title">
    <h2>{title}</h2>
    {#if subtitle}
      <span class="subtitle">{subtitle}</span>
    {/if}
  </div>

  <!-- Right section: Close button only -->
  <div class="header-actions">
    <button class="close-button" onclick={onClose} aria-label="Close panel">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>
</div>

<style>
  .panel-header {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    width: 100%;
    min-height: 60px; /* Consistent height across all panels */
    padding: 12px 16px;
    background: rgba(15, 20, 30, 0.95);
    border-bottom: 1px solid var(--theme-stroke);
    gap: 12px;
    flex-shrink: 0; /* Prevent header from shrinking */
  }

  /* Left section: Tab buttons */
  .header-tabs {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-start;
  }

  /* Center section: Title - perfectly centered regardless of side content */
  .header-title {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 0; /* Allow text truncation */
    grid-column: 2; /* Explicitly place in center column */
  }

  .header-title h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .header-title .subtitle {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    font-weight: 400;
  }

  /* Right section: Close button only - aligned to the right */
  .header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    grid-column: 3; /* Explicitly place in right column */
  }

  /*
   * ============================================================================
   * UNIFIED BUTTON STYLING - Circular buttons with gradient backgrounds
   * Matches ButtonPanel style for consistency
   * ============================================================================
   */

  /* Base styling for all header buttons - circular with 48px touch targets */
  :global(.panel-header .action-button),
  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0;
    border: none;
    border-radius: 50%; /* Circular buttons */
    color: #ffffff; /* White icons */
    font-size: var(--font-size-lg);
    cursor: pointer;
    transition: all var(--transition-normal, var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1));
    flex-shrink: 0;
    box-shadow: 0 2px 8px var(--theme-shadow);
  }

  :global(.panel-header .action-button:hover),
  .close-button:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  :global(.panel-header .action-button:active),
  .close-button:active {
    transform: scale(0.95);
    transition: all var(--duration-instant) ease;
  }

  :global(.panel-header .action-button:focus-visible),
  .close-button:focus-visible {
    outline: 2px solid var(--primary-light, #818cf8);
    outline-offset: 2px;
  }

  :global(.panel-header .action-button i),
  .close-button i {
    font-size: var(--font-size-lg);
  }

  /* Close button - neutral gray gradient */
  .close-button {
    background: linear-gradient(
      135deg,
      rgba(100, 100, 120, 0.85),
      rgba(70, 70, 90, 0.85)
    );
    border: 1px solid var(--theme-stroke-strong);
  }

  .close-button:hover {
    background: linear-gradient(
      135deg,
      rgba(120, 120, 140, 0.95),
      rgba(90, 90, 110, 0.95)
    );
  }

  /* Remove button (destructive action) - red gradient */
  :global(.panel-header .remove-button) {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.9),
      rgba(220, 38, 38, 0.9)
    );
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow:
      0 2px 8px rgba(239, 68, 68, 0.35),
      0 6px 18px rgba(220, 38, 38, 0.25);
  }

  :global(.panel-header .remove-button:hover) {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 1),
      rgba(220, 38, 38, 1)
    );
    box-shadow:
      0 4px 12px rgba(239, 68, 68, 0.45),
      0 8px 22px rgba(220, 38, 38, 0.35);
  }

  /* Adjust button (primary action) - blue gradient */
  :global(.panel-header .adjust-button) {
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.9),
      rgba(37, 99, 235, 0.9)
    );
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow:
      0 2px 8px rgba(59, 130, 246, 0.35),
      0 6px 18px rgba(37, 99, 235, 0.25);
  }

  :global(.panel-header .adjust-button:hover) {
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 1),
      rgba(37, 99, 235, 1)
    );
    box-shadow:
      0 4px 12px rgba(59, 130, 246, 0.45),
      0 8px 22px rgba(37, 99, 235, 0.35);
  }

  /* Export button (primary action) - purple-pink gradient like share button */
  :global(.panel-header .export-button) {
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 0.9),
      rgba(236, 72, 153, 0.9)
    );
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow:
      0 2px 8px rgba(79, 70, 229, 0.35),
      0 6px 18px rgba(236, 72, 153, 0.25);
  }

  :global(.panel-header .export-button:hover) {
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 1),
      rgba(236, 72, 153, 1)
    );
    box-shadow:
      0 4px 14px rgba(79, 70, 229, 0.55),
      0 10px 26px rgba(236, 72, 153, 0.4);
  }

  /* Mobile adjustments - maintain accessible touch targets (48px minimum) */
  .panel-header.mobile {
    min-height: var(--min-touch-target);
    padding: 10px 12px;
  }

  .panel-header.mobile .header-title h2 {
    font-size: var(--font-size-base);
  }

  .panel-header.mobile .header-title .subtitle {
    font-size: var(--font-size-compact);
  }

  /* Mobile buttons: 48px per iOS/Android accessibility guidelines */
  @media (max-width: 768px) {
    :global(.panel-header .action-button),
    .panel-header .close-button {
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }

    :global(.panel-header .action-button i),
    .panel-header .close-button i {
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 480px) {
    :global(.panel-header .action-button),
    .panel-header .close-button {
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }

    :global(.panel-header .action-button i),
    .panel-header .close-button i {
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 320px) {
    :global(.panel-header .action-button),
    .panel-header .close-button {
      min-width: var(
        --min-touch-target
      ); /* NEVER below 48px for accessibility */
      min-height: var(--min-touch-target);
      width: var(--min-touch-target);
      height: var(--min-touch-target);
    }

    :global(.panel-header .action-button i),
    .panel-header .close-button i {
      font-size: var(
        --font-size-sm
      ); /* Slightly smaller icon, but same touch target */
    }
  }

  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    :global(.panel-header .action-button),
    .panel-header .close-button {
      transition: none;
    }

    :global(.panel-header .action-button:hover),
    .panel-header .close-button:hover {
      transform: none;
    }

    :global(.panel-header .action-button:active),
    .panel-header .close-button:active {
      transform: none;
    }
  }

  /* Responsive: Stack on very narrow viewports */
  @media (max-width: 400px) {
    .panel-header {
      grid-template-columns: 1fr auto;
      min-height: auto;
    }

    .header-tabs {
      grid-column: 1 / -1; /* Span full width */
      grid-row: 2;
      justify-content: center;
      margin-top: 8px;
    }

    .header-title {
      grid-column: 1;
      grid-row: 1;
      justify-self: start;
      align-items: flex-start;
    }

    .header-actions {
      grid-column: 2;
      grid-row: 1;
      justify-self: end;
    }
  }
</style>
