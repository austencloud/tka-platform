<!--
  RetroDesktopIcon - Single desktop icon with selection and double-click

  32x32 icon area with centered label below. Single-click selects
  (white text on navy, Win95 inverted selection style). Double-click
  opens the associated window via the parent's handler.

  Domain: Retro Desktop Shell
-->
<script lang="ts">
  import type { RetroDesktopIcon } from "../../domain/types/retro-types";
  import { RETRO_ICONS } from "../rendering/retro-icons";

  let {
    icon,
    isSelected = false,
    onselect,
    ondoubleclick,
    oncontextmenu,
  }: {
    icon: RetroDesktopIcon;
    isSelected?: boolean;
    onselect: () => void;
    ondoubleclick: () => void;
    oncontextmenu?: (event: MouseEvent) => void;
  } = $props();

  const iconSvg = $derived(RETRO_ICONS[icon.icon] ?? "");

  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    onselect();
  }

  function handleDblClick(event: MouseEvent) {
    event.stopPropagation();
    ondoubleclick();
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onselect();
    oncontextmenu?.(event);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      ondoubleclick();
    }
  }
</script>

<button
  class="desktop-icon"
  class:selected={isSelected}
  onclick={handleClick}
  ondblclick={handleDblClick}
  oncontextmenu={handleContextMenu}
  onkeydown={handleKeyDown}
  type="button"
  aria-label={icon.label}
>
  <span class="desktop-icon-image" aria-hidden="true">
    {@html iconSvg}
  </span>
  <span class="desktop-icon-label">
    {icon.label}
  </span>
</button>

<style>
  .desktop-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 72px;
    padding: 4px 2px;
    background: none;
    border: 1px solid transparent;
    cursor: default;
    user-select: none;
    font-family: var(
      --retro-font-family,
      "Microsoft Sans Serif",
      Arial,
      sans-serif
    );
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-white, #ffffff);
  }

  .desktop-icon:focus-visible {
    outline: 1px dotted var(--retro-white, #ffffff);
    outline-offset: -1px;
  }

  .desktop-icon-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
    position: relative;
  }

  .desktop-icon-image :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  /* Win95-style dithered blue selection overlay */
  .selected .desktop-icon-image::after {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--retro-navy, #000080);
    opacity: 0.5;
    mix-blend-mode: multiply;
    pointer-events: none;
  }

  .desktop-icon-label {
    text-align: center;
    overflow-wrap: break-word;
    word-break: normal;
    line-height: 1.2;
    padding: 1px 2px;
    max-width: 72px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
  }

  .selected .desktop-icon-label {
    background: var(--retro-navy, #000080);
    color: var(--retro-white, #ffffff);
  }
</style>
