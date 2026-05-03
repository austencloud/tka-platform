/**
 * Share Service Types
 *
 * Co-exported types for the share system.
 */

/**
 * Progress callback for image generation
 */
export type ImageGenerationProgressCallback = (progress: {
  current: number;
  total: number;
  stage: "preparing" | "rendering" | "finalizing";
}) => void;
