# /1995 Polish & Spectacle: DOOM, CRT Effects, Easter Eggs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the spectacle layer — playable DOOM, CRT barrel distortion and phosphor effects, keyboard shortcuts for authentic Win95 interaction, and new easter eggs that make people share the link.

**Architecture:** DOOM uses js-dos (Emscripten-based DOS emulator) running in a canvas inside a RetroWindow. CRT effects are CSS/SVG filters on the monitor shell. Easter eggs are self-contained components with no external dependencies.

**Tech Stack:** js-dos library, CSS filters, SVG filters, Svelte 5

**Depends on:** Plan 1 (core shell must be functional). Can run in parallel with Plan 2.

**Spec:** `docs/superpowers/specs/2026-03-27-1995-route-elevation-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/features/retro/win95/components/apps/doom/RetroDoom.svelte` | DOOM.EXE — js-dos canvas wrapper |
| Create | `src/lib/features/retro/win95/services/implementations/DoomLoader.ts` | Lazy-loads js-dos and DOOM1.WAD |
| Modify | `src/lib/features/retro/win95/components/shell/RetroDesktop.svelte` | DOOM trigger, keyboard shortcuts, new easter eggs |
| Modify | `src/lib/features/retro/win95/components/rendering/CRTOverlay.svelte` | Barrel distortion, phosphor glow, color fringing |
| Create | `src/lib/features/retro/win95/components/shell/RetroKeyboardHandler.svelte` | Centralized keyboard shortcut handling |
| Create | `src/lib/features/retro/win95/components/shell/RetroDesktopSelection.svelte` | Click-drag selection rectangle |
| Modify | `src/lib/features/retro/win95/components/shell/RetroDesktopIcon.svelte` | XOR invert on selection |
| Create | `src/lib/features/retro/win95/components/easter-eggs/RetroTaskManager.svelte` | Ctrl+Alt+Del task manager (every process is NOTATION.DLL) |
| Modify | `src/lib/features/retro/win95/components/easter-eggs/RetroClippy.svelte` | Polish messages |
| Modify | `src/lib/features/retro/win95/components/easter-eggs/RetroScreensaver.svelte` | Polish animation |

---

## Task 1: DOOM.EXE

The showstopper. Actual playable DOOM inside a Win95 window.

**Files:**
- Create: `src/lib/features/retro/win95/services/implementations/DoomLoader.ts`
- Create: `src/lib/features/retro/win95/components/apps/doom/RetroDoom.svelte`
- Modify: `src/lib/features/retro/win95/components/shell/RetroDesktop.svelte`

- [ ] **Step 1: Research js-dos API**

Before writing code, verify the current js-dos API (v8, formerly v7/emularity). The key integration points:

```bash
npm info js-dos version
```

Check https://js-dos.com/ for the current API. The core pattern:
1. Load js-dos bundle (~1MB)
2. Create a Dos instance targeting a canvas element
3. Load a .jsdos bundle (DOOM1.WAD wrapped for js-dos)
4. The bundle runs in the canvas, capturing keyboard/mouse input

js-dos.com hosts common bundles including DOOM shareware at their CDN.

- [ ] **Step 2: Create DoomLoader service**

```typescript
/**
 * Lazily loads js-dos and the DOOM shareware WAD.
 * Nothing is loaded until the user triggers DOOM.
 */
export class DoomLoader {
  private loaded = false;
  private loading = false;

  /**
   * Check if js-dos is available.
   */
  isAvailable(): boolean {
    return typeof window !== "undefined";
  }

  /**
   * Launch DOOM in the given canvas element.
   * First call downloads js-dos (~1MB) and DOOM1.WAD (~4MB) from CDN.
   * Subsequent calls reuse cached resources.
   */
  async launch(canvas: HTMLCanvasElement): Promise<{
    stop: () => void;
  }> {
    // Dynamically import js-dos
    // Load DOOM bundle from js-dos CDN
    // Initialize emulator targeting the canvas
    // Return stop function for cleanup on window close
  }
}
```

The exact implementation depends on the current js-dos API. The loader handles:
- Dynamic `<script>` injection for js-dos if needed (some versions are ESM, some aren't)
- Bundle URL for DOOM shareware
- Canvas sizing (match RetroWindow inner dimensions)
- Input focus management (DOOM captures keyboard; need to release on window blur)
- Cleanup on window close (stop emulator, release resources)

- [ ] **Step 3: Create RetroDoom component**

```svelte
<script lang="ts">
  import { DoomLoader } from "../../../services/implementations/DoomLoader";
  import RetroProgressBar from "../../primitives/RetroProgressBar.svelte";

  let canvas: HTMLCanvasElement;
  let isLoading = $state(true);
  let loadProgress = $state(0);
  let error = $state<string | null>(null);
  let stopFn: (() => void) | null = null;

  const loader = new DoomLoader();

  $effect(() => {
    if (!canvas) return;

    loader.launch(canvas)
      .then(({ stop }) => {
        stopFn = stop;
        isLoading = false;
      })
      .catch((err) => {
        error = `DOOM.EXE - General Protection Fault\n\n${err.message}`;
        isLoading = false;
      });

    return () => {
      stopFn?.();
    };
  });
</script>

<div class="doom-container">
  {#if isLoading}
    <div class="doom-loading">
      <p>Loading DOOM.EXE...</p>
      <p class="doom-hint">Downloading 4MB from id Software archives</p>
      <RetroProgressBar progress={loadProgress} />
    </div>
  {:else if error}
    <pre class="doom-error">{error}</pre>
  {:else}
    <canvas bind:this={canvas} class="doom-canvas"></canvas>
  {/if}
</div>

<style>
  .doom-container {
    width: 100%;
    height: 100%;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .doom-canvas {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .doom-loading, .doom-error {
    color: #c0c0c0;
    font-family: "Fixedsys", "Courier New", monospace;
    text-align: center;
    padding: 20px;
  }

  .doom-hint {
    font-size: 10px;
    color: #808080;
    margin-top: 8px;
  }

  .doom-error {
    color: #ff0000;
    white-space: pre-wrap;
  }
</style>
```

- [ ] **Step 4: Wire DOOM trigger into RetroDesktop**

In `RetroDesktop.svelte`, add a global keyboard listener that detects the word "DOOM" typed anywhere:

```typescript
let doomBuffer = "";

function handleGlobalKeydown(e: KeyboardEvent) {
  // Don't capture when typing in an input/textarea
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  doomBuffer += e.key.toUpperCase();
  if (doomBuffer.length > 10) doomBuffer = doomBuffer.slice(-10);

  if (doomBuffer.includes("DOOM")) {
    doomBuffer = "";
    openDoom();
  }
}

function openDoom() {
  windowManager.openWindow({
    id: "doom",
    title: "DOOM.EXE",
    icon: "doom", // Need a DOOM icon in retro-icons.ts
    width: 640,
    height: 480,
    minWidth: 320,
    minHeight: 240,
  });
}
```

Add DOOM to the window renderer switch:
```svelte
{:else if win.id === "doom"}
  <RetroDoom />
```

- [ ] **Step 5: Add DOOM icon**

In `retro-icons.ts`, add a simple pixel art DOOM icon (16x16, red/orange demon face or generic game icon).

- [ ] **Step 6: Input focus management**

When DOOM window is active, it captures keyboard input for the game. When the window loses focus (user clicks another window), keyboard input returns to the shell.

The canvas element needs `tabindex="0"` and focus/blur handlers. On focus: DOOM captures input. On blur: shell captures input.

When DOOM is focused, suppress the shell's keyboard shortcuts (Alt+F4, etc.) so they don't interfere with gameplay.

- [ ] **Step 7: Build and test**

Run: `npm run build`
Test: Navigate to `/1995`, type "DOOM" on the desktop, verify DOOM window opens and game loads.

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/retro/win95/services/implementations/DoomLoader.ts src/lib/features/retro/win95/components/apps/doom/RetroDoom.svelte src/lib/features/retro/win95/components/shell/RetroDesktop.svelte src/lib/features/retro/win95/components/rendering/retro-icons.ts
git commit -m "feat(retro): add playable DOOM.EXE via js-dos (shareware CDN, lazy-loaded)"
```

---

## Task 2: CRT Barrel Distortion & Phosphor Effects

Upgrade the CRT overlay from flat scanlines to convincing CRT simulation.

**Files:**
- Modify: `src/lib/features/retro/win95/components/rendering/CRTOverlay.svelte`

- [ ] **Step 1: Add barrel distortion**

CRT screens have a convex bulge — the center appears closer than the edges. This is the single biggest visual fidelity gap.

Implementation: An SVG filter with `<feDisplacementMap>` or a CSS `transform` approach. The simplest effective method is a CSS border-radius + overflow approach:

```css
.crt-screen {
  /* Slight barrel distortion via border-radius on a container */
  border-radius: 20px / 12px;
  overflow: hidden;
}
```

For more accurate distortion, use an SVG filter:

```svelte
<svg class="crt-filter-defs" width="0" height="0">
  <defs>
    <filter id="barrel-distortion">
      <feImage href="data:image/svg+xml,..." result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="8" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
</svg>
```

Apply to the monitor content area. The distortion should be subtle (2-5px at edges) — enough to feel round, not enough to distort text readability.

- [ ] **Step 2: Add phosphor glow**

Bright elements (white text on dark, active title bars, highlighted buttons) get a subtle bloom:

```css
.crt-phosphor {
  /* Applied to the content area */
  filter: contrast(1.05) brightness(1.02);
  /* The bloom comes from a duplicated layer with blur */
}

/* Pseudo-element for bloom */
.crt-phosphor::after {
  content: "";
  position: absolute;
  inset: 0;
  background: inherit;
  filter: blur(1px) brightness(1.3);
  opacity: 0.08;
  mix-blend-mode: screen;
  pointer-events: none;
}
```

- [ ] **Step 3: Add color fringing**

High-contrast edges on CRTs show slight red/blue separation (chromatic aberration):

```css
.crt-fringe {
  /* Offset red and blue channels by 0.5px */
  text-shadow:
    0.5px 0 rgba(255, 0, 0, 0.05),
    -0.5px 0 rgba(0, 0, 255, 0.05);
}
```

Apply only to text elements within the CRT shell. Keep it at 0.05 opacity — barely visible, but subconsciously convincing.

- [ ] **Step 4: Respect reduced-motion**

All CRT effects should respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .crt-phosphor::after { display: none; }
  .crt-fringe { text-shadow: none; }
  /* Keep barrel distortion — it's geometric, not motion */
}
```

The existing flicker effect already respects this preference.

- [ ] **Step 5: Make effects toggleable**

The Control Panel's Display panel already has CRT toggles (scanlines, vignette, flicker). Add toggles for:
- Barrel distortion (default: on)
- Phosphor glow (default: on)
- Color fringing (default: on)

These are purely CSS class toggles on the CRT overlay container.

- [ ] **Step 6: Build and test visually**

Run: `npm run build`
Test: Navigate to `/1995`, observe barrel distortion on edges, subtle glow on bright elements, slight color fringing on text.

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/retro/win95/components/rendering/CRTOverlay.svelte
git commit -m "feat(retro): add CRT barrel distortion, phosphor glow, and color fringing"
```

---

## Task 3: Keyboard Shortcuts

Authentic Win95 keyboard interaction.

**Files:**
- Create: `src/lib/features/retro/win95/components/shell/RetroKeyboardHandler.svelte`
- Modify: `src/lib/features/retro/win95/components/shell/RetroDesktop.svelte`
- Modify: `src/lib/features/retro/win95/components/primitives/RetroMenuBar.svelte`
- Modify: `src/lib/features/retro/win95/components/primitives/RetroWindow.svelte`

- [ ] **Step 1: Create centralized keyboard handler**

Create `RetroKeyboardHandler.svelte` — a renderless component that listens for global keyboard events and dispatches actions:

```typescript
const shortcuts: Record<string, () => void> = {
  // Window management
  "Alt+F4": () => closeActiveWindow(),
  "Ctrl+Escape": () => toggleStartMenu(),

  // Menu activation
  "Alt": () => activateMenuBar(),
  "F10": () => activateMenuBar(),

  // System
  "Ctrl+Alt+Delete": () => openTaskManager(),

  // Window cycling
  "Alt+Tab": () => cycleWindows(),
};
```

- [ ] **Step 2: Alt+F4 closes active window**

When pressed and a window is active, close it. If no windows are active, show "Shut Down Windows" dialog.

- [ ] **Step 3: Ctrl+Esc opens Start menu**

Toggle the Start menu state in desktopState.

- [ ] **Step 4: Menu bar keyboard navigation**

When Alt is pressed:
1. First menu item in the active window's menu bar gets focus (highlighted)
2. Left/Right arrows move between menu items
3. Down arrow opens the dropdown
4. Up/Down arrows navigate within dropdown
5. Enter selects the focused item
6. Escape closes menus

This requires the RetroMenuBar component to accept a `focused` state and handle arrow key navigation.

- [ ] **Step 5: Tab/Shift+Tab in dialogs**

Within RetroDialog components, Tab cycles through focusable elements (buttons, inputs). Shift+Tab goes backward. Enter activates the focused button.

- [ ] **Step 6: Build and test**

Run: `npm run build`
Test: Press Alt+F4 with window open (closes it), Ctrl+Esc (opens Start menu), Alt (highlights menu bar).

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/retro/win95/components/shell/RetroKeyboardHandler.svelte src/lib/features/retro/win95/components/shell/RetroDesktop.svelte src/lib/features/retro/win95/components/primitives/RetroMenuBar.svelte
git commit -m "feat(retro): add Win95 keyboard shortcuts (Alt+F4, Ctrl+Esc, menu navigation)"
```

---

## Task 4: Desktop Selection & Icon Polish

Click-drag selection rectangle and XOR-invert selected icons.

**Files:**
- Create: `src/lib/features/retro/win95/components/shell/RetroDesktopSelection.svelte`
- Modify: `src/lib/features/retro/win95/components/shell/RetroDesktopIcon.svelte`

- [ ] **Step 1: Create selection rectangle component**

Click-drag on the desktop (not on icons or windows) draws a blue dotted selection rectangle:

```svelte
<script lang="ts">
  let isSelecting = $state(false);
  let startX = $state(0);
  let startY = $state(0);
  let currentX = $state(0);
  let currentY = $state(0);

  // Expose selection rect for hit-testing against icons
  export function getSelectionRect() {
    return {
      left: Math.min(startX, currentX),
      top: Math.min(startY, currentY),
      right: Math.max(startX, currentX),
      bottom: Math.max(startY, currentY),
    };
  }
</script>

{#if isSelecting}
  <div
    class="selection-rect"
    style="left: {Math.min(startX, currentX)}px; top: {Math.min(startY, currentY)}px; width: {Math.abs(currentX - startX)}px; height: {Math.abs(currentY - startY)}px;"
  ></div>
{/if}

<style>
  .selection-rect {
    position: absolute;
    border: 1px dotted #000080;
    background: rgba(0, 0, 128, 0.1);
    pointer-events: none;
    z-index: 5;
  }
</style>
```

Icons whose bounding boxes intersect the selection rect become selected.

- [ ] **Step 2: XOR-invert selected icons**

Win95 selected icons use XOR color inversion (not highlight). CSS approach:

```css
.desktop-icon.selected .icon-image {
  filter: invert(1);
}

.desktop-icon.selected .icon-label {
  background: #000080;
  color: #ffffff;
}
```

The label gets a navy blue background with white text (Win95 selection color). The icon itself gets inverted.

- [ ] **Step 3: Wire into RetroDesktop**

The selection component mounts on the desktop surface. Mouse events on the desktop background (not on icons or windows) start selection. Icons report their bounding rects. Selection rect hit-tests against icon rects to determine selected icons.

- [ ] **Step 4: Build and test**

Run: `npm run build`
Test: Click-drag on desktop, verify blue selection rectangle appears and icons within it become selected (inverted).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/retro/win95/components/shell/RetroDesktopSelection.svelte src/lib/features/retro/win95/components/shell/RetroDesktopIcon.svelte
git commit -m "feat(retro): add desktop selection rectangle and XOR-inverted icon selection"
```

---

## Task 5: New Easter Eggs

Self-contained discoveries. Each is funny without context.

**Files:**
- Create: `src/lib/features/retro/win95/components/easter-eggs/RetroTaskManager.svelte`
- Modify: `src/lib/features/retro/win95/components/shell/RetroDesktop.svelte`
- Modify: `src/lib/features/retro/win95/components/shell/RetroDesktopIcon.svelte`
- Modify: `src/lib/features/retro/win95/components/apps/control/panels/DateTimePanel.svelte`

- [ ] **Step 1: Ctrl+Alt+Del Task Manager**

Create `RetroTaskManager.svelte` — opens as a window when Ctrl+Alt+Delete is pressed.

Shows a list of "running processes" in a RetroDataGrid:

| Image Name | PID | CPU | Mem Usage |
|-----------|-----|-----|-----------|
| NOTATION.DLL | 1024 | 12% | 4,096 K |
| NOTATION.DLL | 1156 | 8% | 2,048 K |
| NOTATION.DLL | 1288 | 3% | 1,024 K |
| NOTATION.DLL | 1420 | 22% | 8,192 K |
| NOTATION.DLL | 1552 | 1% | 512 K |
| NOTATION.DLL | 1684 | 45% | 16,384 K |
| NOTATION.DLL | 1816 | 0% | 256 K |

Every process is NOTATION.DLL. Random PIDs, random CPU/memory values that change every 2 seconds. "End Task" button shows error: "Cannot terminate NOTATION.DLL. This process is critical to system operation."

- [ ] **Step 2: Window wrapping (Asteroids-style)**

In `WindowManager.moveWindow()`, when a window is dragged past the right edge, it wraps to the left. Same for top/bottom. Subtle — the window doesn't teleport, it slides off one side and appears on the other.

Implementation: In the drag handler, when `x + width > desktopWidth`, set `x = x - desktopWidth`. Same for other edges.

- [ ] **Step 3: Recycle Bin tip-over**

Track right-clicks on the Recycle Bin icon. On the 5th right-click, rotate the icon 45 degrees:

```typescript
let recycleBinClicks = 0;
let recycleBinTipped = false;

function handleRecycleBinRightClick() {
  recycleBinClicks++;
  if (recycleBinClicks >= 5) {
    recycleBinTipped = true;
  }
}
```

CSS: `transform: rotate(45deg)` on the tipped icon. Resets on "reboot" (page refresh).

- [ ] **Step 4: Clock always 3:47**

In the taskbar clock display and the Control Panel Date/Time panel:

The clock shows "3:47 PM" always. Clicking the clock in the taskbar shows a tooltip: "3:47 PM. Always."

In the Date/Time panel, the time input fields exist and you can type new values, but clicking "Apply" snaps them back to 3:47 PM with a brief flash.

- [ ] **Step 5: 10+ windows dialog**

In `WindowManager.openWindow()`, after the 10th window opens, show a RetroDialog:

"Your system is running low on memory. Close some windows. Or don't. I'm a dialog, not a cop."

With OK button. Purely cosmetic — doesn't prevent opening more windows.

- [ ] **Step 6: Drag icon to Recycle Bin**

When a desktop icon is dragged onto the Recycle Bin icon:
1. Show confirmation: "Are you sure you want to send [icon label] to the Recycle Bin?"
2. On confirm: icon disappears from desktop (just hidden, no real deletion)
3. Icon reappears on next "reboot" (page refresh)

Not connected to real data deletion — this is a desktop icon management thing, purely visual.

- [ ] **Step 7: Build and test**

Run: `npm run build`
Test each easter egg manually.

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/retro/win95/components/easter-eggs/ src/lib/features/retro/win95/components/shell/ src/lib/features/retro/win95/components/apps/control/panels/DateTimePanel.svelte
git commit -m "feat(retro): add easter eggs (task manager, window wrap, tipped bin, stubborn clock)"
```

---

## Verification

After all tasks complete:

1. Type "DOOM" on desktop → actual playable DOOM launches in a window
2. CRT monitor shows barrel distortion (curved edges), phosphor glow, color fringing
3. Alt+F4 closes windows, Ctrl+Esc opens Start menu, Alt activates menus
4. Click-drag on desktop draws selection rectangle, selected icons XOR-invert
5. Ctrl+Alt+Del shows task manager where everything is NOTATION.DLL
6. Drag window off-screen → wraps to other side
7. Right-click Recycle Bin 5 times → tips over
8. Clock always reads 3:47 PM, even if you try to change it
9. Open 10+ windows → "I'm a dialog, not a cop"
10. All CRT effects toggleable in Control Panel
