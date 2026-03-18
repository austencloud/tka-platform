/**
 * MediaFormat.ts
 *
 * Defines the available media formats for Single Media mode.
 * Each format has its own preview component and settings panel.
 *
 * - animation: Animated sequence export (MP4 video with motion)
 * - static: Image export (PNG with full sequence grid)
 * - performance: Performance video export (user-recorded or uploaded video)
 *
 * Domain: Export Panel - Single Media Format Selection
 */

export type MediaFormat = "animation" | "static" | "performance";
