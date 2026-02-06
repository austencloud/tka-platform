import type { MandalaConfig } from "./mandala-config";
import type { SerializedMandalaElement } from "./mandala-element";

/**
 * A preset style configuration for quick mandala creation.
 */
export interface MandalaPreset {
  /** Unique preset identifier */
  id: string;

  /** Display name */
  name: string;

  /** Short description */
  description: string;

  /** Thumbnail image URL or data URI */
  thumbnail?: string;

  /** Configuration overrides to apply */
  config: Partial<MandalaConfig>;

  /** Whether this is a built-in preset (vs user-created) */
  isBuiltIn: boolean;
}

/**
 * A saved mandala composition.
 */
export interface SavedMandala {
  /** Firebase document ID */
  id: string;

  /** Owner user ID */
  userId: string;

  /** User-provided name */
  name: string;

  /** Full configuration snapshot */
  config: MandalaConfig;

  /** Serialized source elements */
  elements: SerializedMandalaElement[];

  /** Thumbnail data URI */
  thumbnailDataUri?: string;

  /** Tags for organization */
  tags: string[];

  /** Whether marked as duplicate of another mandala */
  isDuplicate: boolean;

  /** ID of mandala this is a duplicate of */
  duplicateOf?: string;

  /** Creation timestamp (ISO string) */
  createdAt: string;

  /** Last update timestamp (ISO string) */
  updatedAt: string;
}

/**
 * Create a new saved mandala record.
 */
export function createSavedMandala(
  userId: string,
  name: string,
  config: MandalaConfig,
  elements: SerializedMandalaElement[]
): Omit<SavedMandala, "id"> {
  const now = new Date().toISOString();
  return {
    userId,
    name,
    config,
    elements,
    tags: [],
    isDuplicate: false,
    createdAt: now,
    updatedAt: now,
  };
}
