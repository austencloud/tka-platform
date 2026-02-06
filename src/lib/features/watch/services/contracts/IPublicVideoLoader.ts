/**
 * IPublicVideoLoader
 *
 * Loads public videos for the Feed tab with pagination support.
 */

import type { PublicVideoQuery, PublicVideoPage } from "../../types";

export interface IPublicVideoLoader {
  /**
   * Load public videos with pagination
   */
  loadPublicVideos(options?: PublicVideoQuery): Promise<PublicVideoPage>;
}
