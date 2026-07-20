/**
 * Landing Page Analytics
 *
 * Typed event helpers for custom landing page events.
 * Imports captureEvent directly from the PostHog service (no DI needed).
 */

import { captureEvent } from "$lib/shared/analytics/services/posthog";

// --- Section scroll tracking (deduplicated) ---

const viewedSections = new Set<string>();

export function trackSectionView(section: string): void {
  if (viewedSections.has(section)) return;
  viewedSections.add(section);
  captureEvent("landing_scroll_section", { section });
}

// --- CTA clicks ---

export function trackCtaClick(
  location: "hero" | "viewer_3d" | "footer",
  props?: {
    platform?: string;
    cta_type?: string;
    page?: "home" | "composer";
    destination?: string;
  }
): void {
  captureEvent("landing_cta_click", { location, ...props });
}

// --- Demo interactions ---

export function trackDemoInteraction(
  action: "try_another" | "change_prop" | "toggle_dark_mode",
  props?: { prop_type?: string }
): void {
  captureEvent("landing_demo_interact", { action, ...props });
}

export function trackDemoVisible(): void {
  captureEvent("landing_demo_visible");
}

// --- Video ---

export function trackVideoPlay(videoIndex: number): void {
  captureEvent("landing_video_play", { video_index: videoIndex });
}

// --- Background picker ---

export function trackBackgroundChange(backgroundType: string): void {
  captureEvent("landing_background_change", {
    background_type: backgroundType,
  });
}

// --- Outbound links ---

export function trackOutboundClick(
  destination: string,
  location: string
): void {
  captureEvent("landing_outbound_click", { destination, location });
}
