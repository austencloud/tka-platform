<!--
  RetroWindow - Draggable, resizable 98.css window primitive

  Full Win95-style window chrome with:
  - Draggable title bar (mousedown starts, document-level tracking)
  - 8-direction resize handles via invisible 4px edge zones
  - System menu (top-left button) with Restore/Move/Size/Minimize/Maximize/Close
  - Min/max/close title bar buttons (top-right)
  - Active vs inactive title bar coloring
  - Double-click title bar toggles maximize/restore
  - Snippet slots for content, menu bar, and status bar
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { RetroIconName } from "../rendering/retro-icons";
  import { RETRO_ICONS } from "../rendering/retro-icons";

  let {
    id,
    title,
    icon = undefined,
    x = $bindable(100),
    y = $bindable(100),
    width = $bindable(400),
    height = $bindable(300),
    minWidth = 200,
    minHeight = 150,
    isMinimized = $bindable(false),
    isMaximized = $bindable(false),
    isActive = false,
    children,
    menuBar,
    statusBar,
    onclose,
    onminimize,
    onmaximize,
    onrestore,
    onfocus,
    onmove,
    onresize,
  }: {
    id: string;
    title: string;
    icon?: RetroIconName;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    isMinimized?: boolean;
    isMaximized?: boolean;
    isActive?: boolean;
    children?: Snippet;
    menuBar?: Snippet;
    statusBar?: Snippet;
    onclose?: () => void;
    onminimize?: () => void;
    onmaximize?: () => void;
    onrestore?: () => void;
    onfocus?: () => void;
    onmove?: (x: number, y: number) => void;
    onresize?: (width: number, height: number) => void;
  } = $props();

  /* Drag state                                                         */

  let isDragging = $state(false);
  let dragStartX = $state(0);
  let dragStartY = $state(0);
  let dragOriginX = $state(0);
  let dragOriginY = $state(0);

  /* Resize state                                                       */

  type ResizeDirection =
    | "n"
    | "ne"
    | "e"
    | "se"
    | "s"
    | "sw"
    | "w"
    | "nw"
    | null;

  let isResizing = $state(false);
  let resizeDir = $state<ResizeDirection>(null);
  let resizeStartX = $state(0);
  let resizeStartY = $state(0);
  let resizeOriginX = $state(0);
  let resizeOriginY = $state(0);
  let resizeOriginW = $state(0);
  let resizeOriginH = $state(0);

  /* System menu state                                                  */

  let showSystemMenu = $state(false);

  /* Pre-maximize geometry (for restore)                                */

  let preMaxX = $state(0);
  let preMaxY = $state(0);
  let preMaxW = $state(0);
  let preMaxH = $state(0);

  /* Cursor map for resize directions                                   */

  const CURSOR_MAP: Record<string, string> = {
    n: "n-resize",
    ne: "ne-resize",
    e: "e-resize",
    se: "se-resize",
    s: "s-resize",
    sw: "sw-resize",
    w: "w-resize",
    nw: "nw-resize",
  };

  /* Window position/size style                                         */

  const windowStyle = $derived(
    isMaximized
      ? "left:0;top:0;width:100%;height:100%;"
      : `left:${x}px;top:${y}px;width:${width}px;height:${height}px;`,
  );

  /* ------------------------------------------------------------------ */
  /* Drag handlers                                                      */
  /* ------------------------------------------------------------------ */

  function handleTitleBarMouseDown(event: MouseEvent) {
    if (isMaximized) return;
    if ((event.target as HTMLElement).closest("button")) return;

    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOriginX = x;
    dragOriginY = y;

    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
    event.preventDefault();
  }

  function handleDragMove(event: MouseEvent) {
    if (!isDragging) return;

    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    x = dragOriginX + dx;
    y = dragOriginY + dy;
    onmove?.(x, y);
  }

  function handleDragEnd() {
    isDragging = false;
    document.removeEventListener("mousemove", handleDragMove);
    document.removeEventListener("mouseup", handleDragEnd);
  }

  /* ------------------------------------------------------------------ */
  /* Resize handlers                                                    */
  /* ------------------------------------------------------------------ */

  function handleResizeMouseDown(dir: ResizeDirection, event: MouseEvent) {
    if (isMaximized || !dir) return;

    isResizing = true;
    resizeDir = dir;
    resizeStartX = event.clientX;
    resizeStartY = event.clientY;
    resizeOriginX = x;
    resizeOriginY = y;
    resizeOriginW = width;
    resizeOriginH = height;

    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleResizeMove(event: MouseEvent) {
    if (!isResizing || !resizeDir) return;

    const dx = event.clientX - resizeStartX;
    const dy = event.clientY - resizeStartY;

    let newX = resizeOriginX;
    let newY = resizeOriginY;
    let newW = resizeOriginW;
    let newH = resizeOriginH;

    // East edge
    if (resizeDir.includes("e")) {
      newW = Math.max(minWidth, resizeOriginW + dx);
    }
    // West edge
    if (resizeDir.includes("w")) {
      const proposedW = resizeOriginW - dx;
      if (proposedW >= minWidth) {
        newW = proposedW;
        newX = resizeOriginX + dx;
      } else {
        newW = minWidth;
        newX = resizeOriginX + (resizeOriginW - minWidth);
      }
    }
    // South edge
    if (resizeDir.includes("s")) {
      newH = Math.max(minHeight, resizeOriginH + dy);
    }
    // North edge
    if (resizeDir === "n" || resizeDir === "ne" || resizeDir === "nw") {
      const proposedH = resizeOriginH - dy;
      if (proposedH >= minHeight) {
        newH = proposedH;
        newY = resizeOriginY + dy;
      } else {
        newH = minHeight;
        newY = resizeOriginY + (resizeOriginH - minHeight);
      }
    }

    x = newX;
    y = newY;
    width = newW;
    height = newH;
    onmove?.(x, y);
    onresize?.(width, height);
  }

  function handleResizeEnd() {
    isResizing = false;
    resizeDir = null;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  }

  /* ------------------------------------------------------------------ */
  /* Title bar double-click: toggle maximize                            */
  /* ------------------------------------------------------------------ */

  function handleTitleBarDblClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest("button")) return;
    toggleMaximize();
  }

  /* ------------------------------------------------------------------ */
  /* Window actions                                                     */
  /* ------------------------------------------------------------------ */

  function handleMinimize() {
    isMinimized = true;
    onminimize?.();
  }

  function handleMaximize() {
    preMaxX = x;
    preMaxY = y;
    preMaxW = width;
    preMaxH = height;
    isMaximized = true;
    onmaximize?.();
  }

  function handleRestore() {
    if (isMaximized) {
      isMaximized = false;
      x = preMaxX;
      y = preMaxY;
      width = preMaxW;
      height = preMaxH;
    }
    if (isMinimized) {
      isMinimized = false;
    }
    onrestore?.();
  }

  function toggleMaximize() {
    if (isMaximized) {
      handleRestore();
    } else {
      handleMaximize();
    }
  }

  function handleClose() {
    onclose?.();
  }

  function handleFocus() {
    onfocus?.();
  }

  /* ------------------------------------------------------------------ */
  /* System menu                                                        */
  /* ------------------------------------------------------------------ */

  function toggleSystemMenu() {
    showSystemMenu = !showSystemMenu;
  }

  function systemMenuAction(action: string) {
    showSystemMenu = false;
    switch (action) {
      case "restore":
        handleRestore();
        break;
      case "minimize":
        handleMinimize();
        break;
      case "maximize":
        handleMaximize();
        break;
      case "close":
        handleClose();
        break;
    }
  }

  /** Close system menu when clicking anywhere outside */
  function handleWindowMouseDown() {
    if (showSystemMenu) {
      showSystemMenu = false;
    }
    handleFocus();
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard resize for resize handles                                 */
  /* ------------------------------------------------------------------ */

  const RESIZE_STEP = 8;

  function handleResizeKeydown(dir: string, event: KeyboardEvent) {
    if (isMaximized) return;

    let dx = 0;
    let dy = 0;

    if (event.key === "ArrowLeft") dx = -RESIZE_STEP;
    else if (event.key === "ArrowRight") dx = RESIZE_STEP;
    else if (event.key === "ArrowUp") dy = -RESIZE_STEP;
    else if (event.key === "ArrowDown") dy = RESIZE_STEP;
    else return;

    event.preventDefault();

    if (dir.includes("e")) width = Math.max(minWidth, width + dx);
    if (dir.includes("w")) {
      const newW = width - dx;
      if (newW >= minWidth) { width = newW; x += dx; }
    }
    if (dir.includes("s")) height = Math.max(minHeight, height + dy);
    if (dir === "n" || dir === "ne" || dir === "nw") {
      const newH = height - dy;
      if (newH >= minHeight) { height = newH; y += dy; }
    }

    onmove?.(x, y);
    onresize?.(width, height);
  }

  /* ------------------------------------------------------------------ */
  /* Cleanup on destroy                                                 */
  /* ------------------------------------------------------------------ */

  $effect(() => {
    return () => {
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
    };
  });
</script>

{#if !isMinimized}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions - role="application" IS interactive per WAI-ARIA -->
  <div
    class="retro-window window"
    class:active={isActive}
    class:maximized={isMaximized}
    style={windowStyle}
    data-window-id={id}
    onmousedown={handleWindowMouseDown}
    role="application"
    tabindex="-1"
    aria-label="{title} window"
  >
    <!-- Resize handles (invisible 4px edge zones, keyboard accessible) -->
    {#if !isMaximized}
      {#each ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as dir (dir)}
        <div
          class="resize-handle resize-{dir}"
          onmousedown={(e) => handleResizeMouseDown(dir as ResizeDirection, e)}
          onkeydown={(e) => handleResizeKeydown(dir, e)}
          role="slider"
          tabindex="-1"
          aria-label="Resize {dir}"
          aria-valuenow={dir.includes("e") || dir.includes("w") ? width : height}
        ></div>
      {/each}
    {/if}

    <!-- Title bar -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="title-bar"
      class:inactive={!isActive}
      onmousedown={handleTitleBarMouseDown}
      ondblclick={handleTitleBarDblClick}
    >
      <!-- System menu button (top-left) -->
      <div class="system-menu-wrapper">
        <button
          class="system-menu-button"
          onclick={toggleSystemMenu}
          type="button"
          aria-label="System menu"
          aria-haspopup="true"
          aria-expanded={showSystemMenu}
        >
          {#if icon && RETRO_ICONS[icon]}
            <span class="system-menu-icon" aria-hidden="true">
              {@html RETRO_ICONS[icon]}
            </span>
          {:else}
            <span class="system-menu-dash" aria-hidden="true">-</span>
          {/if}
        </button>

        {#if showSystemMenu}
          <div class="system-menu" role="menu">
            <button
              class="system-menu-item"
              role="menuitem"
              onclick={() => systemMenuAction("restore")}
              disabled={!isMaximized && !isMinimized}
            >
              Restore
            </button>
            <button
              class="system-menu-item"
              role="menuitem"
              onclick={() => systemMenuAction("minimize")}
            >
              Minimize
            </button>
            <button
              class="system-menu-item"
              role="menuitem"
              onclick={() => systemMenuAction("maximize")}
              disabled={isMaximized}
            >
              Maximize
            </button>
            <hr class="system-menu-separator" />
            <button
              class="system-menu-item"
              role="menuitem"
              onclick={() => systemMenuAction("close")}
            >
              Close
            </button>
          </div>
        {/if}
      </div>

      <div class="title-bar-text">{title}</div>

      <!-- Title bar controls (top-right) -->
      <div class="title-bar-controls">
        <button
          aria-label="Minimize"
          onclick={handleMinimize}
          type="button"
        ></button>
        <button
          aria-label={isMaximized ? "Restore" : "Maximize"}
          onclick={toggleMaximize}
          type="button"
        ></button>
        <button
          aria-label="Close"
          onclick={handleClose}
          type="button"
        ></button>
      </div>
    </div>

    <!-- Optional menu bar -->
    {#if menuBar}
      <div class="retro-window-menu-bar">
        {@render menuBar()}
      </div>
    {/if}

    <!-- Window body / content area -->
    <div class="window-body retro-window-body">
      {#if children}
        {@render children()}
      {/if}
    </div>

    <!-- Optional status bar -->
    {#if statusBar}
      <div class="retro-window-status-bar">
        {@render statusBar()}
      </div>
    {/if}
  </div>
{/if}

<style>
  .retro-window {
    position: absolute;
    display: flex;
    flex-direction: column;
    z-index: var(--retro-z-window, 10);
    font-family: var(
      --retro-font-family,
      "Microsoft Sans Serif",
      Arial,
      sans-serif
    );
    font-size: var(--retro-font-size, 11px);
  }

  .retro-window.active {
    z-index: var(--retro-z-active-window, 20);
  }

  .retro-window.maximized {
    border: none;
  }

  .title-bar {
    display: flex;
    align-items: center;
    gap: 0;
    user-select: none;
    flex-shrink: 0;
  }

  .title-bar-text {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    padding: 0 2px;
    pointer-events: none;
  }

  /* ==================================================================
     System menu (top-left button + dropdown)
     ================================================================== */
  .system-menu-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .system-menu-button {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    padding: 0;
    margin: 0 2px;
    cursor: default;
    color: inherit;
  }

  .system-menu-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
  }

  .system-menu-icon :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .system-menu-dash {
    font-size: 14px;
    font-weight: bold;
    line-height: 1;
  }

  .system-menu {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: var(--retro-z-dropdown, 500);
    background: var(--retro-button-face, #c0c0c0);
    border: 2px outset var(--retro-button-face, #c0c0c0);
    padding: 2px;
    min-width: 120px;
    box-shadow: 2px 2px 0 var(--retro-black, #000);
  }

  .system-menu-item {
    display: block;
    width: 100%;
    padding: 2px 16px 2px 8px;
    background: none;
    border: none;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
    color: var(--retro-black, #000);
    cursor: default;
    white-space: nowrap;
  }

  .system-menu-item:hover:not(:disabled) {
    background: var(--retro-selection-bg, #000080);
    color: var(--retro-selection-text, #fff);
  }

  .system-menu-item:disabled {
    color: var(--retro-disabled-text, #808080);
  }

  .system-menu-separator {
    border: none;
    border-top: 1px solid var(--retro-button-shadow, #808080);
    border-bottom: 1px solid var(--retro-button-highlight, #fff);
    margin: 2px 0;
  }

  .retro-window-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .retro-window-menu-bar {
    flex-shrink: 0;
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
  }

  .retro-window-status-bar {
    flex-shrink: 0;
    border-top: 1px solid var(--retro-button-shadow, #808080);
    padding: var(--retro-padding-sm, 2px) var(--retro-padding-md, 4px);
    background: var(--retro-button-face, #c0c0c0);
    font-size: var(--retro-font-size, 11px);
  }

  /* ==================================================================
     Resize handles - invisible 4px zones along window edges
     ================================================================== */
  .resize-handle {
    position: absolute;
    z-index: 1;
  }

  /* Cardinal edges */
  .resize-n {
    top: -2px;
    left: 4px;
    right: 4px;
    height: 4px;
    cursor: n-resize;
  }

  .resize-s {
    bottom: -2px;
    left: 4px;
    right: 4px;
    height: 4px;
    cursor: s-resize;
  }

  .resize-e {
    top: 4px;
    right: -2px;
    bottom: 4px;
    width: 4px;
    cursor: e-resize;
  }

  .resize-w {
    top: 4px;
    left: -2px;
    bottom: 4px;
    width: 4px;
    cursor: w-resize;
  }

  /* Corner handles */
  .resize-ne {
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    cursor: ne-resize;
  }

  .resize-se {
    bottom: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    cursor: se-resize;
  }

  .resize-sw {
    bottom: -2px;
    left: -2px;
    width: 8px;
    height: 8px;
    cursor: sw-resize;
  }

  .resize-nw {
    top: -2px;
    left: -2px;
    width: 8px;
    height: 8px;
    cursor: nw-resize;
  }
</style>
