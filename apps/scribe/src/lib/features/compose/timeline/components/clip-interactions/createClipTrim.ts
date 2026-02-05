/**
 * createClipTrim - Composable for clip trim (in/out point) drag behavior
 *
 * Returns event handlers for adjusting a clip's in and out points.
 */

import type { TimelineClip } from "../../domain/timeline-types";
import { getTimelineState } from "../../state/timeline-state.svelte";

export interface ClipTrimHandlers {
  handleTrimLeftStart: (e: MouseEvent) => void;
  handleTrimRightStart: (e: MouseEvent) => void;
}

export interface ClipTrimCallbacks {
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function createClipTrim(
  getClip: () => TimelineClip | null,
  getWidth: () => number,
  callbacks: ClipTrimCallbacks
): ClipTrimHandlers {
  let dragStartX = 0;
  let dragStartValue = 0;

  function getState() {
    return getTimelineState();
  }

  // Left trim (in-point) handlers
  function handleTrimLeftUpdate(e: MouseEvent) {
    const clip = getClip();
    if (!clip) return;

    const deltaX = e.clientX - dragStartX;
    const deltaRatio = deltaX / getWidth();
    const newInPoint = Math.max(
      0,
      Math.min(clip.outPoint - 0.1, dragStartValue + deltaRatio)
    );
    getState().setClipInOutPoints(clip.id, newInPoint, clip.outPoint);
  }

  function handleTrimLeftEnd() {
    callbacks.onDragEnd();
    window.removeEventListener("mousemove", handleTrimLeftUpdate);
    window.removeEventListener("mouseup", handleTrimLeftEnd);
  }

  function handleTrimLeftStart(e: MouseEvent) {
    const clip = getClip();
    if (!clip || clip.locked || e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    dragStartX = e.clientX;
    dragStartValue = clip.inPoint;

    callbacks.onDragStart();

    window.addEventListener("mousemove", handleTrimLeftUpdate);
    window.addEventListener("mouseup", handleTrimLeftEnd);
  }

  // Right trim (out-point) handlers
  function handleTrimRightUpdate(e: MouseEvent) {
    const clip = getClip();
    if (!clip) return;

    const deltaX = e.clientX - dragStartX;
    const deltaRatio = deltaX / getWidth();
    const newOutPoint = Math.max(
      clip.inPoint + 0.1,
      Math.min(1, dragStartValue + deltaRatio)
    );
    getState().setClipInOutPoints(clip.id, clip.inPoint, newOutPoint);
  }

  function handleTrimRightEnd() {
    callbacks.onDragEnd();
    window.removeEventListener("mousemove", handleTrimRightUpdate);
    window.removeEventListener("mouseup", handleTrimRightEnd);
  }

  function handleTrimRightStart(e: MouseEvent) {
    const clip = getClip();
    if (!clip || clip.locked || e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    dragStartX = e.clientX;
    dragStartValue = clip.outPoint;

    callbacks.onDragStart();

    window.addEventListener("mousemove", handleTrimRightUpdate);
    window.addEventListener("mouseup", handleTrimRightEnd);
  }

  return { handleTrimLeftStart, handleTrimRightStart };
}
