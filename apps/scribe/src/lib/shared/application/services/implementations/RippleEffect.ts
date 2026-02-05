import type { IRippleEffect, RippleOptions } from "../contracts/IRippleEffect";

/**
 * Ripple Effect Service Implementation
 *
 * Creates Material Design-style ripple effects emanating from click/tap point.
 * Works on both desktop (mouse) and mobile (touch) devices.
 */
export class RippleEffect implements IRippleEffect {
  private readonly DEFAULT_OPTIONS: Required<RippleOptions> = {
    duration: 600,
    color: "rgba(255, 255, 255, 0.5)",
    opacity: 0.5,
  };

  /**
   * Create a ripple effect on an element
   */
  createRipple(
    element: HTMLElement,
    event: MouseEvent | TouchEvent,
    options: RippleOptions = {}
  ): void {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // Get click/tap position relative to element
    const rect = element.getBoundingClientRect();
    let x: number;
    let y: number;

    if (event instanceof MouseEvent) {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    } else {
      // TouchEvent
      const touch = event.touches[0] || event.changedTouches[0];
      if (!touch) return; // No touch data available
      x = touch.clientX - rect.left;
      y = touch.clientY - rect.top;
    }

    // Calculate ripple size (should cover entire element from click point)
    const size =
      Math.max(
        Math.sqrt(x * x + y * y),
        Math.sqrt((rect.width - x) ** 2 + y ** 2),
        Math.sqrt(x ** 2 + (rect.height - y) ** 2),
        Math.sqrt((rect.width - x) ** 2 + (rect.height - y) ** 2)
      ) * 2;

    // Create ripple element
    const ripple = document.createElement("span");
    ripple.style.position = "absolute";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.borderRadius = "50%";
    ripple.style.background = opts.color;
    ripple.style.opacity = "0";
    ripple.style.transform = "translate(-50%, -50%) scale(0)";
    ripple.style.pointerEvents = "none";
    ripple.style.zIndex = "10";
    ripple.style.transition = `
      transform ${opts.duration}ms cubic-bezier(0.4, 0, 0.2, 1),
      opacity ${opts.duration}ms cubic-bezier(0.4, 0, 0.2, 1)
    `;

    // Ensure element has position context
    const originalPosition = getComputedStyle(element).position;
    if (originalPosition === "static") {
      element.style.position = "relative";
    }

    // Add ripple to element
    element.appendChild(ripple);

    // Trigger animation on next frame
    requestAnimationFrame(() => {
      ripple.style.transform = "translate(-50%, -50%) scale(1)";
      ripple.style.opacity = opts.opacity.toString();

      // Fade out after reaching peak
      setTimeout(() => {
        ripple.style.opacity = "0";
      }, opts.duration / 2);
    });

    // Remove ripple after animation completes
    setTimeout(() => {
      ripple.remove();
    }, opts.duration);
  }

  /**
   * Attach ripple effect to an element
   *
   * Returns a cleanup function to remove the event listeners
   */
  attachRipple(element: HTMLElement, options: RippleOptions = {}): () => void {
    const handleInteraction = (event: MouseEvent | TouchEvent) => {
      this.createRipple(element, event, options);
    };

    // Add event listeners with passive option for better scroll performance
    // Passive listeners indicate we won't call preventDefault()
    element.addEventListener("mousedown", handleInteraction as EventListener);
    element.addEventListener("touchstart", handleInteraction as EventListener, {
      passive: true,
    });

    return () => {
      element.removeEventListener(
        "mousedown",
        handleInteraction as EventListener
      );
      element.removeEventListener(
        "touchstart",
        handleInteraction as EventListener
      );
    };
  }
}
