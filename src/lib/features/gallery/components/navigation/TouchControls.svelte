<script lang="ts">
  /**
   * TouchControls
   *
   * Mobile touch controls for 3D gallery navigation:
   * - Virtual joystick (bottom-left) for movement
   * - Drag anywhere else to look around
   * - 48px minimum touch targets
   */

  import { onMount, onDestroy } from "svelte";

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

  // Joystick state
  let joystickActive = $state(false);
  let joystickTouchId = $state<number | null>(null);
  let joystickCenter = { x: 0, y: 0 };
  let joystickOffset = $state({ x: 0, y: 0 });

  // Look state
  let lookTouchId = $state<number | null>(null);
  let lastLookPos = { x: 0, y: 0 };

  // Tap detection state
  let tapStartTime = 0;
  let tapStartPos = { x: 0, y: 0 };
  let tapMoved = false;
  const TAP_MAX_DURATION = 300; // ms
  const TAP_MAX_DISTANCE = 15; // pixels

  // Joystick config
  const JOYSTICK_SIZE = 120; // Outer ring diameter
  const JOYSTICK_KNOB_SIZE = 56; // Inner knob diameter (>48px touch target)
  const JOYSTICK_MAX_DISTANCE = 40; // Max offset from center
  const JOYSTICK_DEADZONE = 8; // Pixels before registering input

  // Joystick position (bottom-left corner)
  const JOYSTICK_MARGIN = 24;
  let joystickBaseX = $state(JOYSTICK_MARGIN + JOYSTICK_SIZE / 2);
  let joystickBaseY = $state(0); // Set on mount

  // Check if a touch is in the joystick zone
  function isInJoystickZone(x: number, y: number): boolean {
    const joystickZoneWidth = JOYSTICK_SIZE + JOYSTICK_MARGIN * 2;
    const joystickZoneHeight = JOYSTICK_SIZE + JOYSTICK_MARGIN * 2;
    return x < joystickZoneWidth && y > window.innerHeight - joystickZoneHeight;
  }

  // Calculate joystick input from offset
  function calculateJoystickInput(offsetX: number, offsetY: number): { x: number; z: number } {
    const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

    if (distance < JOYSTICK_DEADZONE) {
      return { x: 0, z: 0 };
    }

    // Normalize to -1 to 1 range
    const normalized = Math.min(distance, JOYSTICK_MAX_DISTANCE) / JOYSTICK_MAX_DISTANCE;
    const angle = Math.atan2(offsetY, offsetX);

    return {
      x: Math.cos(angle) * normalized, // Left/right (A/D)
      z: -Math.sin(angle) * normalized, // Forward/back (W/S) - negative because screen Y is inverted
    };
  }

  // Touch event handlers
  function handleTouchStart(e: TouchEvent) {
    if (!enabled) return;

    for (const touch of Array.from(e.changedTouches)) {
      const { clientX, clientY, identifier } = touch;

      // Check if this touch starts in joystick zone
      if (isInJoystickZone(clientX, clientY) && joystickTouchId === null) {
        joystickTouchId = identifier;
        joystickActive = true;
        joystickCenter = { x: joystickBaseX, y: joystickBaseY };
        joystickOffset = { x: 0, y: 0 };
        e.preventDefault();
      }
      // Otherwise, use for looking (and track for potential tap)
      else if (lookTouchId === null) {
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

      // Joystick movement
      if (identifier === joystickTouchId) {
        let offsetX = clientX - joystickCenter.x;
        let offsetY = clientY - joystickCenter.y;

        // Clamp to max distance
        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        if (distance > JOYSTICK_MAX_DISTANCE) {
          offsetX = (offsetX / distance) * JOYSTICK_MAX_DISTANCE;
          offsetY = (offsetY / distance) * JOYSTICK_MAX_DISTANCE;
        }

        joystickOffset = { x: offsetX, y: offsetY };

        const input = calculateJoystickInput(offsetX, offsetY);
        onMove(input.x, input.z);
        e.preventDefault();
      }
      // Look movement
      else if (identifier === lookTouchId) {
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
      const { identifier, clientX, clientY } = touch;

      if (identifier === joystickTouchId) {
        joystickTouchId = null;
        joystickActive = false;
        joystickOffset = { x: 0, y: 0 };
        onMove(0, 0);
      } else if (identifier === lookTouchId) {
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

  // Detect touch device
  let isTouchDevice = $state(false);

  onMount(() => {
    isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (!isTouchDevice) {
      return;
    }

    // Set joystick Y position (from bottom)
    joystickBaseY = window.innerHeight - JOYSTICK_MARGIN - JOYSTICK_SIZE / 2;

    // Add touch listeners
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    // Update position on resize
    const handleResize = () => {
      joystickBaseY = window.innerHeight - JOYSTICK_MARGIN - JOYSTICK_SIZE / 2;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  onDestroy(() => {
    if (isTouchDevice) {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    }
  });
</script>

{#if isTouchDevice && enabled}
  <!-- Joystick UI overlay -->
  <div class="touch-controls">
    <!-- Joystick base ring -->
    <div
      class="joystick-base"
      class:active={joystickActive}
      style="
        left: {joystickBaseX - JOYSTICK_SIZE / 2}px;
        bottom: {JOYSTICK_MARGIN}px;
        width: {JOYSTICK_SIZE}px;
        height: {JOYSTICK_SIZE}px;
      "
    >
      <!-- Joystick knob -->
      <div
        class="joystick-knob"
        style="
          width: {JOYSTICK_KNOB_SIZE}px;
          height: {JOYSTICK_KNOB_SIZE}px;
          transform: translate({joystickOffset.x}px, {joystickOffset.y}px);
        "
      ></div>
    </div>

    <!-- Look hint (shows when not using joystick) -->
    {#if !joystickActive && !lookTouchId}
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

  .joystick-base {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    border: 2px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s ease;
    opacity: 0.6;
    pointer-events: auto;
    touch-action: none;
  }

  .joystick-base.active {
    opacity: 1;
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .joystick-knob {
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: transform 0.05s ease-out;
  }

  .joystick-base.active .joystick-knob {
    background: white;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
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
</style>
