<!--
PresetCard.svelte - Individual preset card display
Displays a single preset with icon, name, summary, and action buttons
-->
<script lang="ts">
  import {
    LOOP_TYPE_LABELS,
    type LOOPType,
  } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import type { GenerationPreset } from "../../state/preset.svelte";

  let { preset, onSelect, onEdit, onDelete } = $props<{
    preset: GenerationPreset;
    onSelect: (preset: GenerationPreset) => void;
    onEdit: (preset: GenerationPreset) => void;
    onDelete: (presetId: string) => void;
  }>();

  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  function handleSelect() {
    hapticService?.trigger("selection");
    onSelect(preset);
  }

  function handleEdit(event: MouseEvent) {
    event.stopPropagation();
    hapticService?.trigger("selection");
    onEdit(preset);
  }

  function handleDelete(event: MouseEvent) {
    event.stopPropagation();
    hapticService?.trigger("selection");
    onDelete(preset.id);
  }

  // Format config summary for display
  const configSummary = $derived(() => {
    const { config } = preset;
    const gridMode =
      config.gridMode.charAt(0).toUpperCase() + config.gridMode.slice(1);
    const mode = config.mode.charAt(0).toUpperCase() + config.mode.slice(1);

    const parts = [
      `${config.length} beats`,
      gridMode,
      mode,
      LOOP_TYPE_LABELS[config.loopType as LOOPType] || config.loopType,
    ];

    if (config.turnIntensity > 0) {
      parts.push(
        `${config.turnIntensity}x turn${config.turnIntensity !== 1 ? "s" : ""}`
      );
    }

    return parts.join(" • ");
  });

  // Abbreviated config summary for narrow screens
  const configSummaryShort = $derived(() => {
    const { config } = preset;
    const gridMode =
      config.gridMode.charAt(0).toUpperCase() + config.gridMode.slice(1);
    const mode = config.mode.charAt(0).toUpperCase() + config.mode.slice(1);

    const loopLabel =
      LOOP_TYPE_LABELS[config.loopType as LOOPType] || config.loopType;

    const parts = [`${config.length} beats`, gridMode, mode, loopLabel];

    if (config.turnIntensity > 0) {
      parts.push(
        `${config.turnIntensity}x turn${config.turnIntensity !== 1 ? "s" : ""}`
      );
    }

    return parts.join(" • ");
  });

  // Get level-based background color
  const backgroundColor = $derived.by(() => {
    switch (preset.config.level) {
      case 1:
        return "rgba(186, 230, 253, 0.15)"; // Beginner: Light blue
      case 2:
        return "rgba(148, 163, 184, 0.15)"; // Intermediate: Silver gray
      case 3:
        return "rgba(250, 204, 21, 0.15)"; // Advanced: Gold
      default:
        return "rgba(255, 255, 255, 0.05)";
    }
  });

  // Get level-based border color
  const borderColor = $derived.by(() => {
    switch (preset.config.level) {
      case 1:
        return "rgba(56, 189, 248, 0.3)"; // Beginner: Light blue
      case 2:
        return "rgba(100, 116, 139, 0.3)"; // Intermediate: Silver gray
      case 3:
        return "rgba(234, 179, 8, 0.3)"; // Advanced: Gold
      default:
        return "rgba(255, 255, 255, 0.1)";
    }
  });

  const icon = $derived(preset.icon || "⚙️");

  const levelLabel = $derived.by(() => {
    switch (preset.config.level) {
      case 1:
        return "Beginner";
      case 2:
        return "Intermediate";
      case 3:
        return "Advanced";
      default:
        return `Level ${preset.config.level}`;
    }
  });

  const levelBadgeColor = $derived.by(() => {
    switch (preset.config.level) {
      case 1:
        return {
          bg: "rgba(56, 189, 248, 0.2)",
          border: "rgba(56, 189, 248, 0.5)",
          text: "#7dd3fc",
        };
      case 2:
        return {
          bg: "rgba(148, 163, 184, 0.2)",
          border: "rgba(148, 163, 184, 0.5)",
          text: "#cbd5e1",
        };
      case 3:
        return {
          bg: "rgba(234, 179, 8, 0.2)",
          border: "rgba(234, 179, 8, 0.5)",
          text: "#fde047",
        };
      default:
        return {
          bg: "rgba(255, 255, 255, 0.1)",
          border: "rgba(255, 255, 255, 0.2)",
          text: "#ffffff",
        };
    }
  });
</script>

<div class="preset-item-container">
  <button
    class="preset-item"
    style="background: {backgroundColor}; border-color: {borderColor};"
    onclick={handleSelect}
    aria-label={`Load preset ${preset.name}: ${configSummary()}`}
  >
    <div class="preset-icon">{icon}</div>
    <div class="preset-info">
      <div class="preset-header">
        <div class="preset-name">{preset.name}</div>
        <div
          class="level-badge"
          style="background: {levelBadgeColor.bg}; border-color: {levelBadgeColor.border}; color: {levelBadgeColor.text};"
        >
          {levelLabel}
        </div>
      </div>
      <div class="preset-summary">
        <span class="summary-full">{configSummary()}</span>
        <span class="summary-short">{configSummaryShort()}</span>
      </div>
    </div>
  </button>
  <button
    class="edit-button"
    onclick={handleEdit}
    aria-label={`Edit preset ${preset.name}`}
    title="Edit preset"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
      ></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  </button>
  <button
    class="delete-button"
    onclick={handleDelete}
    aria-label={`Delete preset ${preset.name}`}
    title="Delete preset"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      ></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  </button>
</div>

<style>
  .preset-item-container {
    display: flex;
    gap: 10px;
    align-items: stretch;
  }

  .preset-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: left;
    color: var(--theme-text, white);
    font-family: inherit;
    min-height: 88px;
  }

  .preset-item:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--theme-shadow, var(--theme-shadow));
  }

  .preset-item:active {
    transform: translateY(0);
  }

  .preset-icon {
    font-size: var(--font-size-3xl);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preset-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .preset-header {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex-wrap: wrap;
  }

  .preset-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text, white);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1 1 auto;
    min-width: 120px;
  }

  .level-badge {
    padding: 3px 10px;
    border-radius: 12px;
    font-size: var(--font-size-compact);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    border: 1px solid;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .preset-summary {
    font-size: 12.5px;
    color: var(--theme-text-dim);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }

  /* Show full summary by default, hide short summary */
  .summary-short {
    display: none;
  }

  .summary-full {
    display: inline;
  }

  .edit-button {
    background: linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 15%,
        transparent
      ),
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 8%,
        transparent
      )
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 30%,
        transparent
      );
    color: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 90%,
      white
    );
    cursor: pointer;
    padding: 10px;
    border-radius: 8px;
    transition: all 0.2s ease;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .edit-button:hover {
    background: linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 25%,
        transparent
      ),
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 15%,
        transparent
      )
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 50%,
      transparent
    );
    color: var(--semantic-info, var(--semantic-info));
    transform: translateY(-1px);
    box-shadow: 0 2px 8px
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 20%,
        transparent
      );
  }

  .edit-button svg {
    width: 18px;
    height: 18px;
  }

  .delete-button {
    background: linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 15%,
        transparent
      ),
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 8%,
        transparent
      )
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 30%,
        transparent
      );
    color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 90%,
      white
    );
    cursor: pointer;
    padding: 10px;
    border-radius: 8px;
    transition: all 0.2s ease;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-button:hover {
    background: linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 25%,
        transparent
      ),
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 15%,
        transparent
      )
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 50%,
      transparent
    );
    color: var(--semantic-error, var(--semantic-error));
    transform: translateY(-1px);
    box-shadow: 0 2px 8px
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 20%,
        transparent
      );
  }

  .delete-button svg {
    width: 18px;
    height: 18px;
  }

  .edit-button:active,
  .delete-button:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    .preset-item-container {
      gap: 8px;
    }

    .preset-item {
      gap: 12px;
      padding: 12px 14px;
      min-height: 82px;
    }

    .preset-icon {
      font-size: var(--font-size-3xl);
    }

    .preset-name {
      font-size: var(--font-size-sm);
      min-width: 100px;
    }

    .level-badge {
      font-size: var(--font-size-compact);
      padding: 2px 8px;
      letter-spacing: 0.5px;
    }

    .preset-summary {
      font-size: var(--font-size-compact);
    }

    .edit-button,
    .delete-button {
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
      padding: 9px;
    }

    .edit-button svg,
    .delete-button svg {
      width: 18px;
      height: 18px;
    }
  }

  @media (max-width: 520px) {
    .preset-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
      padding: 12px;
      min-height: auto;
    }

    .preset-icon {
      font-size: var(--font-size-2xl);
    }

    .preset-info {
      width: 100%;
    }

    .preset-header {
      flex-wrap: nowrap;
      gap: 8px;
    }

    .preset-name {
      font-size: var(--font-size-compact);
      min-width: 0;
    }

    .preset-summary {
      font-size: 11.5px;
    }

    .edit-button,
    .delete-button {
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
      padding: 8px;
    }

    .edit-button svg,
    .delete-button svg {
      width: 16px;
      height: 16px;
    }
  }

  /* Optimize for very narrow devices (Z Fold, narrow foldables) */
  @media (max-width: 380px) {
    .preset-item-container {
      gap: 6px;
    }

    .preset-item {
      gap: 8px;
      padding: 10px;
      border-radius: 10px;
    }

    .preset-icon {
      font-size: var(--font-size-xl);
    }

    .preset-info {
      gap: 6px;
    }

    .preset-header {
      gap: 6px;
    }

    .preset-name {
      font-size: 12.5px;
    }

    .level-badge {
      font-size: var(--font-size-compact);
      padding: 2px 6px;
      letter-spacing: 0.4px;
    }

    .preset-summary {
      font-size: var(--font-size-compact);
      line-height: 1.5;
    }

    /* Switch to abbreviated summary on narrow devices */
    .summary-short {
      display: inline;
    }

    .summary-full {
      display: none;
    }

    .edit-button,
    .delete-button {
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
      padding: 7px;
      border-radius: 7px;
    }

    .edit-button svg,
    .delete-button svg {
      width: 15px;
      height: 15px;
    }
  }
</style>
