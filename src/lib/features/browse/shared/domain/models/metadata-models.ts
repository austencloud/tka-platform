/**
 * Browse Metadata Types
 *
 * Essential metadata types needed for Browse tab functionality.
 * These are the core types needed for sequence explorey and metadata extraction.
 */

// ============================================================================
// ESSENTIAL BROWSE METADATA TYPES
// ============================================================================

export interface ExploreThumbnailFile {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  metadata?: {
    word?: string;
    author?: string;
    difficulty?: number;
    tags?: string[];
  };
}

export interface MetadataAnalysisResult {
  fileName: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  extractedData: Record<string, unknown>;
  processingTime: number;
}
