# Video Trails Phase 3: Detection Studio Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan.

**Goal:** Build the Detection Studio view with frame-by-frame correction of detected endpoints, occlusion marking, interpolation, and training data export.

**Architecture:** Four focused components (TimelineScrubber, EndpointEditor, OcclusionMarker, TrainingDataPanel) consumed by a rewritten DetectionStudioView. All state methods already exist in the state factory — this is pure UI work.

**Tech Stack:** Svelte 5 runes, Canvas2D (endpoint editor), SVG (timeline markers)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `components/TimelineScrubber.svelte` | Create | Frame-level scrubber with color-coded markers, skip-to buttons, keyboard nav |
| `components/EndpointEditor.svelte` | Create | Zoomed canvas with draggable endpoint markers, nudge, snap-to-brightest |
| `components/OcclusionMarker.svelte` | Create | UI to mark/view occlusion ranges per endpoint |
| `components/TrainingDataPanel.svelte` | Create | Correction stats, export training pairs as JSON |
| `views/DetectionStudioView.svelte` | Rewrite | Orchestrates all 4 components with video frame rendering |

---

### Task 1: TimelineScrubber

Frame-level timeline with color-coded markers showing correction status per frame. Arrows step 1 frame, shift+arrows step 10. Skip buttons jump to next low-confidence, corrected, or gap frame.

### Task 2: EndpointEditor

Zoomed canvas rendering the current video frame at full resolution with draggable circles for each detected endpoint. Pointer drag moves endpoints (creates corrections). Keyboard nudge (arrows 1px, shift+arrows 5px). Tab cycles endpoints. O marks occluded. Enter accepts + advances.

### Task 3: OcclusionMarker

Small panel showing occlusion ranges. Button to mark current frame's selected endpoint as occluded. Button to interpolate a gap between two known positions.

### Task 4: TrainingDataPanel

Stats display: total frames with detections, corrected frames count, correction magnitude (average pixel drift). Export button downloads corrections as JSON.

### Task 5: DetectionStudioView rewrite

Layout: full-width EndpointEditor canvas on top, TimelineScrubber below it, side panel with OcclusionMarker + TrainingDataPanel. Creates its own video element from state.source.url for frame rendering.
