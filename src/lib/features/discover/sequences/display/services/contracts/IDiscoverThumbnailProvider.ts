import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

/**
 * Thumbnail management service
 */
export interface IDiscoverThumbnailProvider {
  getThumbnailUrl(sequenceId: string, thumbnailPath: string): string;

  /**
   * Get prop-specific thumbnail URL
   * For pre-rendered gallery images organized by prop type
   */
  getPropSpecificThumbnailUrl(
    sequenceName: string,
    propType: PropType,
    lightMode?: boolean
  ): string;

  preloadThumbnail(sequenceId: string, thumbnailPath: string): Promise<void>;
  getThumbnailMetadata(
    sequenceId: string
  ): Promise<{ width: number; height: number } | null>;
  clearThumbnailCache(): void;
}
