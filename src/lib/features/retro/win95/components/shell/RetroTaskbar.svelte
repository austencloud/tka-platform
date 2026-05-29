<!--
  RetroTaskbar - Win95-style taskbar fixed to the bottom of the screen

  Three sections:
  - Left: Start button that toggles the Start menu
  - Center: One button per open window (pressed/sunken for active window,
    clicking toggles focus/minimize like Win95)
  - Right: Clock frozen at 3:47 PM (the moment Protocol Lethe fired)

  Domain: Retro Desktop Shell
-->
<script lang="ts">
  
  import { desktopState } from "../../state/desktop-state.svelte";
  import { RETRO_ICONS } from "../rendering/retro-icons";
import type { WindowManager } from "../../services/window-manager";

  let {
    windowManager,
  }: {
    windowManager: WindowManager;
  } = $props();

  function toggleStartMenu() {
    desktopState.startMenuOpen = !desktopState.startMenuOpen;
  }

  let clockTooltipVisible = $state(false);
  let clockTooltipTimer: ReturnType<typeof setTimeout> | undefined;

  function handleClockClick() {
    clockTooltipVisible = true;
    clearTimeout(clockTooltipTimer);
    clockTooltipTimer = setTimeout(() => {
      clockTooltipVisible = false;
    }, 3000);
  }

  function handleTaskbarWindowClick(windowId: string) {
    /* Win95 behavior: clicking the active window's taskbar button
       minimizes it. Clicking an inactive one focuses it. */
    if (desktopState.activeWindowId === windowId) {
      const win = windowManager.getWindow(windowId);
      if (win && !win.isMinimized) {
        windowManager.minimizeWindow(windowId);
      } else {
        windowManager.focusWindow(windowId);
      }
    } else {
      windowManager.focusWindow(windowId);
    }
  }
</script>

<div class="taskbar" role="toolbar" aria-label="Taskbar">
  <!-- Start button -->
  <button
    class="start-button"
    class:pressed={desktopState.startMenuOpen}
    type="button"
    data-start-button
    onclick={toggleStartMenu}
    aria-label="Start"
    aria-haspopup="true"
    aria-expanded={desktopState.startMenuOpen}
  >
    <span class="start-icon" aria-hidden="true">{@html RETRO_ICONS.tkaLogo}</span>
    <span class="start-label">Start</span>
  </button>

  <!-- Taskbar separator -->
  <div class="taskbar-divider" aria-hidden="true"></div>

  <!-- Window buttons -->
  <div class="taskbar-windows" role="group" aria-label="Open windows">
    {#each desktopState.windows as win (win.id)}
      <button
        class="taskbar-window-button"
        class:active={desktopState.activeWindowId === win.id &&
          !win.isMinimized}
        type="button"
        onclick={() => handleTaskbarWindowClick(win.id)}
        aria-label={win.title}
        title={win.title}
      >
        {#if win.icon}
          <span class="taskbar-window-icon" aria-hidden="true">
            {@html RETRO_ICONS[win.icon] ?? ""}
          </span>
        {/if}
        <span class="taskbar-window-title">{win.title}</span>
      </button>
    {/each}
  </div>

  <!-- Clock tray -->
  <div class="taskbar-tray" aria-label="System tray" onclick={handleClockClick} onkeydown={(e) => e.key === "Enter" && handleClockClick()} role="button" tabindex="0">
    <span class="tray-clock" aria-label="Time: 3:47 PM" title="3:47 PM. Always.">3:47 PM</span>
    {#if clockTooltipVisible}
      <div class="clock-tooltip" role="tooltip">3:47 PM. Always.</div>
    {/if}
  </div>
</div>

<style>
  .taskbar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 28px;
    display: flex;
    align-items: center;
    gap: 0;
    background: var(--retro-button-face, #c0c0c0);
    border-top: 2px outset var(--retro-button-face, #c0c0c0);
    z-index: var(--retro-z-taskbar, 200);
    font-family: var(
      --retro-font-family,
      "Microsoft Sans Serif",
      Arial,
      sans-serif
    );
    font-size: var(--retro-font-size, 11px);
    padding: 2px;
  }

  /* ------------------------------------------------------------------ */
  /* Start button                                                        */
  /* ------------------------------------------------------------------ */
  .start-button {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 22px;
    padding: 1px 6px;
    border: 2px outset var(--retro-button-face, #c0c0c0);
    background: var(--retro-button-face, #c0c0c0);
    font-family: inherit;
    font-size: inherit;
    font-weight: bold;
    cursor: pointer;
    flex-shrink: 0;
    color: var(--retro-black, #000);
  }

  .start-button:active,
  .start-button.pressed {
    border-style: inset;
    padding: 2px 5px 0px 7px;
  }

  .start-icon {
    display: flex;
    align-items: center;
    width: 16px;
    height: 16px;
  }

  .start-icon :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .start-label {
    line-height: 1;
  }

  /* ------------------------------------------------------------------ */
  /* Divider                                                             */
  /* ------------------------------------------------------------------ */
  .taskbar-divider {
    width: 2px;
    height: 20px;
    margin: 0 2px;
    border-left: 1px solid var(--retro-button-shadow, #808080);
    border-right: 1px solid var(--retro-button-highlight, #ffffff);
  }

  /* ------------------------------------------------------------------ */
  /* Window buttons area                                                 */
  /* ------------------------------------------------------------------ */
  .taskbar-windows {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    overflow: hidden;
  }

  .taskbar-window-button {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 22px;
    min-width: 0;
    max-width: 160px;
    padding: 1px 6px;
    border: 2px outset var(--retro-button-face, #c0c0c0);
    background: var(--retro-button-face, #c0c0c0);
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    flex-shrink: 1;
    color: var(--retro-black, #000);
    overflow: hidden;
  }

  .taskbar-window-button.active {
    border-style: inset;
    background-color: var(--retro-button-face, #c0c0c0);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2'%3E%3Crect width='1' height='1' fill='%23c0c0c0'/%3E%3Crect x='1' width='1' height='1' fill='%23ffffff'/%3E%3Crect y='1' width='1' height='1' fill='%23ffffff'/%3E%3Crect x='1' y='1' width='1' height='1' fill='%23c0c0c0'/%3E%3C/svg%3E");
    background-size: 2px 2px;
    image-rendering: pixelated;
    font-weight: bold;
    padding: 2px 5px 0px 7px;
  }

  .taskbar-window-icon {
    display: flex;
    align-items: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    image-rendering: pixelated;
  }

  .taskbar-window-icon :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .taskbar-window-title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  /* ------------------------------------------------------------------ */
  /* System tray / clock                                                 */
  /* ------------------------------------------------------------------ */
  .taskbar-tray {
    position: relative;
    display: flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border: 1px inset var(--retro-button-face, #c0c0c0);
    margin-left: 2px;
    flex-shrink: 0;
    cursor: default;
  }

  .tray-clock {
    white-space: nowrap;
    color: var(--retro-black, #000);
    cursor: default;
  }

  /* ------------------------------------------------------------------ */
  /* Clock tooltip - appears above the tray on click                    */
  /* ------------------------------------------------------------------ */
  .clock-tooltip {
    position: absolute;
    bottom: 30px;
    right: 0;
    background: #ffffe1;
    border: 1px solid #000;
    padding: 2px 6px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: #000;
    white-space: nowrap;
    pointer-events: none;
    z-index: 9999;
    box-shadow: 1px 1px 0 rgba(0, 0, 0, 0.3);
  }
</style>
