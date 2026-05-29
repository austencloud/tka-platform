/**
 * UI animations and transitions including fold transitions,
 * fade effects, and animation settings management.
 */

import { cubicOut } from "svelte/easing";
import type {
  AnimationSettings,
  FadeTransitionParams,
  FoldTransitionParams,
  SlideTransitionParams,
  TransitionResult,
} from "./types";

export function shouldAnimate(_settings?: AnimationSettings): boolean {
  if (typeof window !== "undefined") {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return false;
  }
  return true;
}

export function createFoldTransition(params: FoldTransitionParams = {}): TransitionResult {
  const {
    duration = 600,
    direction = "fold-in",
    axis = "y",
    easing = cubicOut,
  } = params;

  const isFoldIn = direction === "fold-in";
  const isYAxis = axis === "y";

  return {
    duration,
    easing,
    css: (t: number) => {
      const progress = isFoldIn ? t : 1 - t;
      const angle = (1 - progress) * 90;
      const opacity = Math.max(0, progress - 0.1);
      const scale = 0.9 + progress * 0.1;

      const transform = isYAxis
        ? `rotateX(${angle}deg) scale(${scale})`
        : `rotateY(${angle}deg) scale(${scale})`;

      const transformOrigin = isYAxis ? "center top" : "left center";

      return `
        transform: ${transform};
        transform-origin: ${transformOrigin};
        opacity: ${opacity};
        backface-visibility: hidden;
        perspective: 1000px;
      `;
    },
  };
}

export function createSlideTransition(params: SlideTransitionParams = {}): TransitionResult {
  const { direction = "up", duration = 400, delay = 0 } = params;

  const getTransform = () => {
    switch (direction) {
      case "up":
        return "translateY(100%)";
      case "down":
        return "translateY(-100%)";
      case "left":
        return "translateX(100%)";
      case "right":
        return "translateX(-100%)";
      default:
        return "translateY(100%)";
    }
  };

  return {
    duration,
    delay,
    easing: cubicOut,
    css: (t: number) => {
      const opacity = t;
      const transform = `${getTransform()} scale(${0.9 + t * 0.1})`;
      return `
        transform: ${t === 1 ? "none" : transform};
        opacity: ${opacity};
      `;
    },
  };
}

export function createFadeTransition(params: FadeTransitionParams = {}): TransitionResult {
  const { duration = 300, delay = 0 } = params;
  return {
    duration,
    delay,
    easing: cubicOut,
    css: (t: number) => `opacity: ${t}`,
  };
}

export function createFadeOutTransition(
  params: FadeTransitionParams & { settings?: AnimationSettings } = {},
): TransitionResult {
  const { duration = 250, settings } = params;
  if (!shouldAnimate(settings)) return { duration: 0 };
  return createFadeTransition({ duration, delay: 0 });
}

export function createFadeInTransition(
  params: FadeTransitionParams & { outDuration?: number; settings?: AnimationSettings } = {},
): TransitionResult {
  const { duration = 250, outDuration = 250, settings } = params;
  if (!shouldAnimate(settings)) return { duration: 0 };
  return createFadeTransition({ duration, delay: outDuration });
}

export function createConditionalFade(
  params: FadeTransitionParams & { settings?: AnimationSettings } = {},
): TransitionResult {
  const { duration = 300, settings } = params;
  if (!shouldAnimate(settings)) return { duration: 0 };
  return createFadeTransition({ duration });
}
