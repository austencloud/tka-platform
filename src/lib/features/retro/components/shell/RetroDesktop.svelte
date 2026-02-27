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
  import "../../styles/98-scoped.css";
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
  import RetroScribe from "../apps/scribe/RetroScribe.svelte";
  import RetroFileManager from "../apps/filemgr/RetroFileManager.svelte";
  import RetroTutor from "../apps/tutor/RetroTutor.svelte";
  import RetroCards from "../apps/cards/RetroCards.svelte";
  import RetroControlPanel from "../apps/control/RetroControlPanel.svelte";
  import RetroUpgrade from "../apps/upgrade/RetroUpgrade.svelte";
  import RetroReadme from "./RetroReadme.svelte";
  import RetroHelp from "./RetroHelp.svelte";
  import RetroRecycleBin from "./RetroRecycleBin.svelte";
  import RetroBSOD from "../easter-eggs/RetroBSOD.svelte";
  import RetroDefrag from "../easter-eggs/RetroDefrag.svelte";
  import RetroScreensaver from "../easter-eggs/RetroScreensaver.svelte";
  import RetroClippy from "../easter-eggs/RetroClippy.svelte";
  import CRTOverlay from "../effects/CRTOverlay.svelte";
  import RetroMobileWarning from "./RetroMobileWarning.svelte";

  /* ------------------------------------------------------------------ */
  /* Props                                                               */
  /* ------------------------------------------------------------------ */

  let {
    initialApp = undefined,
  }: {
    initialApp?: string;
  } = $props();

  /* ------------------------------------------------------------------ */
  /* Window manager instance                                             */
  /* ------------------------------------------------------------------ */

  const windowManager = new WindowManager();

  /* ------------------------------------------------------------------ */
  /* Desktop icons                                                       */
  /* ------------------------------------------------------------------ */

  const desktopIcons: RetroDesktopIcon[] = [
    { id: "mycomputer", label: "My Computer", icon: "mycomputer", executable: "mycomputer" },
    { id: "scribe", label: "SCRIBE.EXE", icon: "scribe", executable: "scribe" },
    { id: "filemgr", label: "FILEMGR.EXE", icon: "filemgr", executable: "filemgr" },
    { id: "tutor", label: "TUTOR.EXE", icon: "tutor", executable: "tutor" },
    { id: "cards", label: "CARDS.EXE", icon: "cards", executable: "cards" },
    { id: "control", label: "CONTROL.EXE", icon: "control", executable: "control" },
    { id: "upgrade", label: "UPGRADE.EXE", icon: "upgrade", executable: "upgrade" },
    { id: "readme", label: "README.TXT", icon: "readme", executable: "readme" },
    { id: "help", label: "HELP.HLP", icon: "help", executable: "help" },
    { id: "defrag", label: "DEFRAG.EXE", icon: "defrag", executable: "defrag" },
  ];

  const recycleBin: RetroDesktopIcon = {
    id: "recyclebin",
    label: "Recycle Bin",
    icon: "recyclebin",
    executable: "recyclebin",
  };

  /* ------------------------------------------------------------------ */
  /* Start menu items                                                    */
  /* ------------------------------------------------------------------ */

  const startMenuItems: RetroStartMenuItem[] = [
    {
      label: "Programs",
      icon: "programs",
      children: [
        { label: "SCRIBE.EXE", icon: "scribe", action: () => openApp("scribe", "SCRIBE.EXE", "scribe") },
        { label: "FILEMGR.EXE", icon: "filemgr", action: () => openApp("filemgr", "FILEMGR.EXE", "filemgr") },
        { label: "TUTOR.EXE", icon: "tutor", action: () => openApp("tutor", "TUTOR.EXE", "tutor") },
        { label: "CARDS.EXE", icon: "cards", action: () => openApp("cards", "CARDS.EXE", "cards") },
        { label: "DEFRAG.EXE", icon: "defrag", action: () => openApp("defrag", "DEFRAG.EXE", "defrag") },
        { label: "UPGRADE.EXE", icon: "upgrade", action: () => openApp("upgrade", "UPGRADE.EXE", "upgrade") },
      ],
    },
    { label: "Documents", icon: "documents", children: [] },
    {
      label: "Settings",
      icon: "control",
      children: [
        { label: "Control Panel", icon: "control", action: () => openApp("control", "Control Panel", "control") },
      ],
    },
    { label: "Find", icon: "find", children: [] },
    { label: "Help", icon: "help", action: () => openApp("help", "Help", "help") },
    { separator: true, label: "" },
    { label: "Shut Down...", icon: "shutdown", action: () => showShutdownDialog() },
  ];

  /* ------------------------------------------------------------------ */
  /* App launcher                                                        */
  /* ------------------------------------------------------------------ */

  let windowCounter = $state(0);
  let showBSOD = $state(false);
  let showScreensaver = $state(false);
  let showClippy = $state(false);
  let mobileWarningDismissed = $state(false);
  let windowWidth = $state(typeof window !== "undefined" ? window.innerWidth : 1024);

  const isMobile = $derived(windowWidth < 768);

  /* ------------------------------------------------------------------ */
  /* Window resize tracking                                              */
  /* ------------------------------------------------------------------ */

  $effect(() => {
    function handleResize() {
      windowWidth = window.innerWidth;
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  /* ------------------------------------------------------------------ */
  /* Idle detection → screensaver (60s inactivity)                       */
  /* ------------------------------------------------------------------ */

  $effect(() => {
    if (!desktopState.bootComplete) return;

    const IDLE_TIMEOUT_MS = 60_000;
    let idleTimer: ReturnType<typeof setTimeout>;

    function resetIdleTimer() {
      clearTimeout(idleTimer);
      if (showScreensaver) return; /* don't restart while screensaver is active */
      idleTimer = setTimeout(() => {
        showScreensaver = true;
      }, IDLE_TIMEOUT_MS);
    }

    resetIdleTimer();

    window.addEventListener("mousemove", resetIdleTimer);
    window.addEventListener("keydown", resetIdleTimer);
    window.addEventListener("click", resetIdleTimer);

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener("mousemove", resetIdleTimer);
      window.removeEventListener("keydown", resetIdleTimer);
      window.removeEventListener("click", resetIdleTimer);
    };
  });

  /* ------------------------------------------------------------------ */
  /* Random Clippy appearances                                           */
  /* ------------------------------------------------------------------ */

  function randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  let clippyTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleClippy(minMs: number, maxMs: number) {
    clearTimeout(clippyTimer);
    const delay = randomBetween(minMs, maxMs);
    clippyTimer = setTimeout(() => {
      showClippy = true;
    }, delay);
  }

  function dismissClippy() {
    showClippy = false;
    scheduleClippy(60_000, 180_000);
  }

  $effect(() => {
    if (!desktopState.bootComplete) return;

    /* First appearance: 45-120 seconds after boot */
    scheduleClippy(45_000, 120_000);

    return () => clearTimeout(clippyTimer);
  });

  function openApp(executable: string, title?: string, icon?: string) {
    /* My Computer triggers BSOD easter egg */
    if (executable === "mycomputer") {
      showBSOD = true;
      return;
    }

    const windowTitle = title ?? executable.toUpperCase();

    /* Cascade offset so multiple windows don't stack exactly */
    const offset = (windowCounter % 8) * 28;
    windowCounter++;

    /* App-specific default sizes */
    const sizes: Record<string, { width: number; height: number }> = {
      scribe: { width: 640, height: 480 },
      filemgr: { width: 600, height: 420 },
      tutor: { width: 560, height: 440 },
      cards: { width: 520, height: 460 },
      control: { width: 480, height: 400 },
      upgrade: { width: 440, height: 380 },
      defrag: { width: 520, height: 400 },
      readme: { width: 480, height: 420 },
      help: { width: 560, height: 400 },
      recyclebin: { width: 520, height: 380 },
    };
    const size = sizes[executable] ?? { width: 480, height: 360 };

    windowManager.openWindow({
      id: executable,
      title: windowTitle,
      icon: icon,
      x: 80 + offset,
      y: 40 + offset,
      width: size.width,
      height: size.height,
      minWidth: 320,
      minHeight: 240,
      isMinimized: false,
      isMaximized: false,
    });
  }

  function openAppFromIcon(iconDef: RetroDesktopIcon) {
    openApp(iconDef.executable, iconDef.label, iconDef.icon);
  }

  /* ------------------------------------------------------------------ */
  /* Deep link handling                                                  */
  /* ------------------------------------------------------------------ */

  $effect(() => {
    if (initialApp && desktopState.isBooting) {
      // Deep links skip the boot sequence
      desktopState.isBooting = false;
      desktopState.bootComplete = true;
      // Open the requested app
      const iconDef = [...desktopIcons, recycleBin].find(
        (i) => i.executable === initialApp
      );
      if (iconDef) {
        openAppFromIcon(iconDef);
      }
    }
  });

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

{#if isMobile && !mobileWarningDismissed}
  <div class="retro-shell">
    <RetroMobileWarning onproceed={() => (mobileWarningDismissed = true)} />
  </div>
{:else}
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
              {#if win.id === "scribe"}
                <RetroScribe onclose={() => windowManager.closeWindow(win.id)} />
              {:else if win.id === "filemgr"}
                <RetroFileManager onclose={() => windowManager.closeWindow(win.id)} />
              {:else if win.id === "tutor"}
                <RetroTutor onclose={() => windowManager.closeWindow(win.id)} />
              {:else if win.id === "cards"}
                <RetroCards onclose={() => windowManager.closeWindow(win.id)} />
              {:else if win.id === "control"}
                <RetroControlPanel onclose={() => windowManager.closeWindow(win.id)} />
              {:else if win.id === "upgrade"}
                <RetroUpgrade onclose={() => windowManager.closeWindow(win.id)} />
              {:else if win.id === "readme"}
                <RetroReadme onclose={() => windowManager.closeWindow(win.id)} />
              {:else if win.id === "help"}
                <RetroHelp onclose={() => windowManager.closeWindow(win.id)} />
              {:else if win.id === "defrag"}
                <RetroDefrag onclose={() => windowManager.closeWindow(win.id)} />
              {:else if win.id === "recyclebin"}
                <RetroRecycleBin onclose={() => windowManager.closeWindow(win.id)} />
              {:else}
                <div class="placeholder-content">
                  <p>{win.title}</p>
                  <p class="placeholder-hint">Module adapter coming soon.</p>
                </div>
              {/if}
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

    <!-- Clippy assistant (z-index 9000) -->
    {#if showClippy}
      <RetroClippy ondismiss={() => dismissClippy()} />
    {/if}

    <!-- Screensaver (z-index 9500, above Clippy) -->
    {#if showScreensaver}
      <RetroScreensaver ondismiss={() => (showScreensaver = false)} />
    {/if}

    <!-- CRT monitor effect (z-index 9999) -->
    <CRTOverlay />

    <!-- BSOD easter egg (z-index 10000, above CRT overlay) -->
    {#if showBSOD}
      <RetroBSOD ondismiss={() => (showBSOD = false)} />
    {/if}
  {/if}
</div>
{/if}

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
