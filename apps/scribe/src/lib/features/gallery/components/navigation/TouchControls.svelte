<script lang="ts">
  /**
   * TouchControls
   *
   * Mobile touch controls for 3D gallery navigation:
   * - Virtual joystick (bottom-left) for movement - uses shared component
   * - Drag anywhere else to look around
   * - Tap-to-walk detection
   * - Also supports mouse drag as fallback (for DevTools mobile simulation)
   *
   * Uses InputCapabilities for proper input-based detection that works with:
   * - Native touch on mobile
   * - DevTools touch emulation on desktop
   * - External mouse on touch devices
   */

  import { onMount, onDestroy } from "svelte";
  import VirtualJoystick from "$lib/shared/components/touch/VirtualJoystick.svelte";
  import { getInputCapabilities } from "$lib/shared/input/InputCapabilities.svelte";

  const inputCaps = getInputCapabilities();

  interface Props {
    /** Callback when movement input changes (x: -1 to 1, z: -1 to 1) */
    onMove: (x: number, z: number) => void;
    /** Callback when look input changes (deltaX, deltaY in pixels) */
    onLook: (deltaX: number, deltaY: number) => void;
    /** Callback when user taps to walk (screen coordinates) */
    onTap: (screenX: number, screenY: number) => void;
    /** Whether controls are enabled */
    enabled?: boolean;
  }

  let { onMove, onLook, onTap, enabled = true }: Props = $props();

  // Joystick zone dimensions (must match VirtualJoystick defaults)
  const JOYSTICK_SIZE = 120;
  const JOYSTICK_MARGIN = 24;

  // Look state (touch)
  let lookTouchId = $state<number | null>(null);
  let lastLookPos = { x: 0, y: 0 };

  // Mouse drag state (fallback for DevTools mobile simulation)
  let isMouseDragging = $state(false);
  let lastMousePos = { x: 0, y: 0 };

  // Tap detection state
  let tapStartTime = 0;
  let tapStartPos = { x: 0, y: 0 };
  let tapMoved = false;
  const TAP_MAX_DURATION = 300; // ms
  const TAP_MAX_DISTANCE = 15; // pixels

  // Check if touch UI should be shown based on ACTUAL input, not device detection
  // This works correctly for DevTools touch emulation and external mouse on touch devices
  function shouldShowTouchUI(): boolean {
    return inputCaps.shouldShowTouchUI();
  }

  // Check if a touch is in the joystick zone
  function isInJoystickZone(x: number, y: number): boolean {
    const joystickZoneWidth = JOYSTICK_SIZE + JOYSTICK_MARGIN * 2;
    const joystickZoneHeight = JOYSTICK_SIZE + JOYSTICK_MARGIN * 2;
    return x < joystickZoneWidth && y > window.innerHeight - joystickZoneHeight;
  }

  // Handle joystick input from shared component
  function handleJoystickInput(x: number, y: number) {
    // Convert y to z (joystick y is forward/back, which maps to z in 3D)
    onMove(x, y);
  }

  // Touch event handlers for look controls
  function handleTouchStart(e: TouchEvent) {
    if (!enabled) return;

    for (const touch of Array.from(e.changedTouches)) {
      const { clientX, clientY, identifier } = touch;

      // Skip if in joystick zone (handled by VirtualJoystick)
      if (isInJoystickZone(clientX, clientY)) continue;

      // Use for looking (and track for potential tap)
      if (lookTouchId === null) {
        lookTouchId = identifier;
        lastLookPos = { x: clientX, y: clientY };

        // Start tracking potential tap
        tapStartTime = performance.now();
        tapStartPos = { x: clientX, y: clientY };
        tapMoved = false;

        e.preventDefault();
      }
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!enabled) return;

    for (const touch of Array.from(e.changedTouches)) {
      const { clientX, clientY, identifier } = touch;

      // Look movement
      if (identifier === lookTouchId) {
        const deltaX = clientX - lastLookPos.x;
        const deltaY = clientY - lastLookPos.y;
        lastLookPos = { x: clientX, y: clientY };

        // Check if moved too far for a tap
        const distFromStart = Math.sqrt(
          Math.pow(clientX - tapStartPos.x, 2) + Math.pow(clientY - tapStartPos.y, 2)
        );
        if (distFromStart > TAP_MAX_DISTANCE) {
          tapMoved = true;
        }

        onLook(deltaX, deltaY);
        e.preventDefault();
      }
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    for (const touch of Array.from(e.changedTouches)) {
      const { identifier } = touch;

      if (identifier === lookTouchId) {
        // Check if this was a tap (quick, didn't move much)
        const tapDuration = performance.now() - tapStartTime;
        if (!tapMoved && tapDuration < TAP_MAX_DURATION) {
          // It's a tap! Use the start position for accuracy
          onTap(tapStartPos.x, tapStartPos.y);
        }

        lookTouchId = null;
      }
    }
  }

  // Mouse event handlers (fallback for DevTools mobile simulation)
  function handleMouseDown(e: MouseEvent) {
    if (!enabled) return;
    // Don't interfere with joystick clicks
    if (isInJoystickZone(e.clientX, e.clientY)) return;

    isMouseDragging = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!enabled || !isMouseDragging) return;

    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    lastMousePos = { x: e.clientX, y: e.clientY };

    onLook(deltaX, deltaY);
  }

  function handleMouseUp() {
    isMouseDragging = false;
  }

  onMount(() => {
    // Initialize input capabilities for proper touch/mouse detection
    inputCaps.init();

    // Always attach touch listeners - they work for:
    // - Native touch on mobile
    // - DevTools touch emulation on desktop
    // The handlers check context and won't interfere with mouse input.
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    // Add mouse listeners as fallback for DevTools mobile simulation
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  });

  onDestroy(() => {
    inputCaps.destroy();

    window.removeEventListener("touchstart", handleTouchStart);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
    window.removeEventListener("touchcancel", handleTouchEnd);
    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  });
</script>

{#if shouldShowTouchUI() && enabled}
  <!-- Shared virtual joystick for movement -->
  <VirtualJoystick
    onInput={handleJoystickInput}
    {enabled}
    left={JOYSTICK_MARGIN}
    bottom={JOYSTICK_MARGIN}
    size={JOYSTICK_SIZE}
  />

  <!-- Look hint overlay -->
  <div class="touch-controls">
    {#if lookTouchId === null}
      <div class="look-hint">
        Drag to look around
      </div>
    {/if}
  </div>
{/if}

<style>
  .touch-controls {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 100;
    touch-action: none;
  }

  .look-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 500;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    animation: fadeInOut 3s ease-in-out;
  }

  @keyframes fadeInOut {
    0%, 100% { opacity: 0; }
    20%, 80% { opacity: 1; }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .look-hint {
      animation: none;
    }
  }
</style>
