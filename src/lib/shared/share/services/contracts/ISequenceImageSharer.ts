/**
 * ISequenceImageSharer - Share sequence images via various methods
 *
 * Provides unified image sharing with configurable composition settings.
 * Supports clipboard copy, file download, and native Web Share API.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ShareResult {
  success: boolean;
  error?: Error;
}

export interface ISequenceImageSharer {
  /**
   * Copy sequence image to clipboard
   * @param sequence - The sequence to render and copy
   * @param userName - User name for footer
   * @returns Success/failure result
   */
  copyToClipboard(sequence: SequenceData, userName: string): Promise<ShareResult>;

  /**
   * Download sequence as PNG file
   * @param sequence - The sequence to render and download
   * @param userName - User name for footer
   */
  downloadImage(sequence: SequenceData, userName: string): Promise<ShareResult>;

  /**
   * Share via native Web Share API (mobile)
   * Falls back to clipboard copy if Web Share not available
   * @param sequence - The sequence to render and share
   * @param userName - User name for footer
   */
  nativeShare(sequence: SequenceData, userName: string): Promise<ShareResult>;

  /**
   * Check if native sharing is available
   */
  canNativeShare(): boolean;
}
