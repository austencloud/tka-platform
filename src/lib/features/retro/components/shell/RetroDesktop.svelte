<!--
  RetroDesktop — Root shell component for TKA-OS v1.0

  Composes the full Win95-style desktop experience:
  - Teal #008080 background filling the viewport
  - Desktop icons in a left-column grid (75px vertical spacing)
  - Recycle Bin pinned to bottom-right
  - Open windows rendered via RetroWindow primitive
  - Taskbar fixed at bottom with Start button, window buttons, clock
  - Start menu popup with program launchers and Shut Down
  - Boot sequence animation (RetroBootSequence)

  Domain: Retro Desktop Shell
-->
<script lang="ts">
  import "98.css";
  import "../../styles/retro-tokens.css";
  import "../../styles/retro-overrides.css";

  import type { RetroDesktopIcon } from "../../domain/types/retro-types";
  import type { RetroStartMenuItem } from "../../domain/types/retro-types";
  import { desktopState } from "../../state/desktop-state.svelte";
  import { WindowManager } from "../../services/implementations/WindowManager";

  import RetroDesktopIconComponent from "./RetroDesktopIcon.svelte";
  import RetroTaskbar from "./RetroTaskbar.svelte";
  import RetroStartMenu from "./RetroStartMenu.svelte";
  import RetroWindow from "../primitives/RetroWindow.svelte";
  import RetroBootSequence from "./RetroBootSequence.svelte";

  /* ------------------------------------------------------------------ */
  /* Window manager instance                                             */
  /* ------------------------------------------------------------------ */

  const windowManager = new WindowManager();

  /* ------------------------------------------------------------------ */
  /* Desktop icons                                                       */
  /* ------------------------------------------------------------------ */

  const desktopIcons: RetroDesktopIcon[] = [
    { id: "mycomputer", label: "My Computer", icon: "\u{1F5A5}\uFE0F", executable: "mycomputer" },
    { id: "scribe", label: "SCRIBE.EXE", icon: "\u{1F4DD}", executable: "scribe" },
    { id: "filemgr", label: "FILEMGR.EXE", icon: "\u{1F4C1}", executable: "filemgr" },
    { id: "tutor", label: "TUTOR.EXE", icon: "\u{1F393}", executable: "tutor" },
    { id: "cards", label: "CARDS.EXE", icon: "\u{1F0CF}", executable: "cards" },
    { id: "control", label: "CONTROL.EXE", icon: "\u2699\uFE0F", executable: "control" },
    { id: "upgrade", label: "UPGRADE.EXE", icon: "\u{1F451}", executable: "upgrade" },
    { id: "readme", label: "README.TXT", icon: "\u{1F4C4}", executable: "readme" },
    { id: "help", label: "HELP.HLP", icon: "\u2753", executable: "help" },
    { id: "defrag", label: "DEFRAG.EXE", icon: "\u{1F4BE}", executable: "defrag" },
  ];

  const recycleBin: RetroDesktopIcon = {
    id: "recyclebin",
    label: "Recycle Bin",
    icon: "\u{1F5D1}\uFE0F",
    executable: "recyclebin",
  };

  /* ------------------------------------------------------------------ */
  /* Start menu items                                                    */
  /* ------------------------------------------------------------------ */

  const startMenuItems: RetroStartMenuItem[] = [
    {
      label: "Programs",
      icon: "\u{1F4C1}",
      children: [
        { label: "SCRIBE.EXE", icon: "\u{1F4DD}", action: () => openApp("scribe", "SCRIBE.EXE", "\u{1F4DD}") },
        { label: "FILEMGR.EXE", icon: "\u{1F4C1}", action: () => openApp("filemgr", "FILEMGR.EXE", "\u{1F4C1}") },
        { label: "TUTOR.EXE", icon: "\u{1F393}", action: () => openApp("tutor", "TUTOR.EXE", "\u{1F393}") },
        { label: "CARDS.EXE", icon: "\u{1F0CF}", action: () => openApp("cards", "CARDS.EXE", "\u{1F0CF}") },
        { label: "DEFRAG.EXE", icon: "\u{1F4BE}", action: () => openApp("defrag", "DEFRAG.EXE", "\u{1F4BE}") },
        { label: "UPGRADE.EXE", icon: "\u{1F451}", action: () => openApp("upgrade", "UPGRADE.EXE", "\u{1F451}") },
      ],
    },
    { label: "Documents", icon: "\u{1F4C1}", children: [] },
    {
      label: "Settings",
      icon: "\u2699\uFE0F",
      children: [
        { label: "Control Panel", icon: "\u2699\uFE0F", action: () => openApp("control", "Control Panel", "\u2699\uFE0F") },
      ],
    },
    { label: "Find", icon: "\u{1F50D}", children: [] },
    { label: "Help", icon: "\u2753", action: () => openApp("help", "Help", "\u2753") },
    { separator: true, label: "" },
    { label: "Shut Down...", icon: "\u{1F50C}", action: () => showShutdownDialog() },
  ];

  /* ------------------------------------------------------------------ */
  /* App launcher                                                        */
  /* ------------------------------------------------------------------ */

  let windowCounter = $state(0);

  function openApp(executable: string, title?: string, icon?: string) {
    const windowTitle = title ?? executable.toUpperCase();

    /* Cascade offset so multiple windows don't stack exactly */
    const offset = (windowCounter % 8) * 28;
    windowCounter++;

    windowManager.openWindow({
      id: executable,
      title: windowTitle,
      icon: icon,
      x: 80 + offset,
      y: 40 + offset,
      width: 480,
      height: 360,
      minWidth: 240,
      minHeight: 180,
      isMinimized: false,
      isMaximized: false,
    });
  }

  function openAppFromIcon(iconDef: RetroDesktopIcon) {
    openApp(iconDef.executable, iconDef.label, iconDef.icon);
  }

  /* ------------------------------------------------------------------ */
  /* Shut Down dialog                                                    */
  /* ------------------------------------------------------------------ */

  function showShutdownDialog() {
    desktopState.dialogQueue = [
      ...desktopState.dialogQueue,
      {
        title: "Shut Down TKA-OS",
        message: "What do you want the computer to do?",
        type: "question",
        buttons: ["Return to TKA Scribe", "Restart", "Cancel"],
      },
    ];
  }

  /* ------------------------------------------------------------------ */
  /* Desktop click handlers                                              */
  /* ------------------------------------------------------------------ */

  function handleDesktopClick() {
    desktopState.selectedDesktopIcon = null;
    desktopState.startMenuOpen = false;
  }

  function selectIcon(id: string) {
    desktopState.selectedDesktopIcon = id;
  }

  /* Boot completion is handled by RetroBootSequence via oncomplete */
</script>

<div class="retro-shell">
  {#if desktopState.isBooting}
    <RetroBootSequence oncomplete={() => {
      desktopState.isBooting = false;
      desktopState.bootComplete = true;
    }} />
  {:else}
    <!-- Desktop surface -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="desktop-surface" onclick={handleDesktopClick}>
      <!-- Desktop icons: left column -->
      <div class="desktop-icon-grid">
        {#each desktopIcons as iconDef (iconDef.id)}
          <RetroDesktopIconComponent
            icon={iconDef}
            isSelected={desktopState.selectedDesktopIcon === iconDef.id}
            onselect={() => selectIcon(iconDef.id)}
            ondoubleclick={() => openAppFromIcon(iconDef)}
          />
        {/each}
      </div>

      <!-- Recycle Bin: bottom-right corner -->
      <div class="recycle-bin-position">
        <RetroDesktopIconComponent
          icon={recycleBin}
          isSelected={desktopState.selectedDesktopIcon === recycleBin.id}
          onselect={() => selectIcon(recycleBin.id)}
          ondoubleclick={() => openAppFromIcon(recycleBin)}
        />
      </div>

      <!-- Open windows -->
      {#each desktopState.windows as win (win.id)}
        {#if !win.isMinimized}
          <RetroWindow
            id={win.id}
            title={win.title}
            icon={win.icon}
            bind:x={win.x}
            bind:y={win.y}
            bind:width={win.width}
            bind:height={win.height}
            bind:isMinimized={win.isMinimized}
            bind:isMaximized={win.isMaximized}
            isActive={desktopState.activeWindowId === win.id}
            onfocus={() => windowManager.focusWindow(win.id)}
            onclose={() => windowManager.closeWindow(win.id)}
            onminimize={() => windowManager.minimizeWindow(win.id)}
            onmaximize={() => windowManager.maximizeWindow(win.id)}
            onrestore={() => windowManager.restoreWindow(win.id)}
            onmove={(newX, newY) => windowManager.moveWindow(win.id, newX, newY)}
            onresize={(w, h) => windowManager.resizeWindow(win.id, w, h)}
          >
            {#snippet children()}
              <div class="placeholder-content">
                <p>{win.title}</p>
                <p class="placeholder-hint">Module adapter will be loaded here.</p>
              </div>
            {/snippet}
          </RetroWindow>
        {/if}
      {/each}
    </div>

    <!-- Start menu -->
    {#if desktopState.startMenuOpen}
      <RetroStartMenu
        items={startMenuItems}
        onclose={() => (desktopState.startMenuOpen = false)}
      />
    {/if}

    <!-- Taskbar -->
    <RetroTaskbar {windowManager} />
  {/if}
</div>

<style>
  /* ------------------------------------------------------------------ */
  /* Root shell wrapper                                                  */
  /* ------------------------------------------------------------------ */
  .retro-shell {
    position: fixed;
    inset: 0;
    overflow: hidden;
    font-family: var(
      --retro-font-family,
      "Microsoft Sans Serif",
      Arial,
      sans-serif
    );
    font-size: var(--retro-font-size, 11px);
  }

  /* ------------------------------------------------------------------ */
  /* Desktop surface                                                     */
  /* ------------------------------------------------------------------ */
  .desktop-surface {
    position: absolute;
    inset: 0;
    bottom: 28px; /* Leave room for taskbar */
    background: var(--retro-desktop-bg, #008080);
    z-index: var(--retro-z-desktop, 0);
  }

  /* ------------------------------------------------------------------ */
  /* Desktop icon grid — left column                                     */
  /* ------------------------------------------------------------------ */
  .desktop-icon-grid {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    flex-direction: column;
    gap: 11px;
    z-index: 1;
  }

  /* ------------------------------------------------------------------ */
  /* Recycle Bin — bottom-right                                          */
  /* ------------------------------------------------------------------ */
  .recycle-bin-position {
    position: absolute;
    bottom: 8px;
    right: 8px;
    z-index: 1;
  }

  /* ------------------------------------------------------------------ */
  /* Placeholder content for windows                                     */
  /* ------------------------------------------------------------------ */
  .placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 16px;
    text-align: center;
    color: var(--retro-black, #000);
  }

  .placeholder-hint {
    color: var(--retro-dark-gray, #808080);
    margin-top: 4px;
  }
</style>
