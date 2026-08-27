/**
 * Recording Domain Model
 *
 * Represents a user's video recording of a sequence performance.
 * Stored in Firestore at: users/{userId}/recordings/{recordingId}
 */

export interface RecordingMetadata {
  /** Unique recording ID */
  readonly id: string;

  /** User who created this recording */
  readonly userId: string;

  /** Sequence this recording is associated with */
  readonly sequenceId: string;

  /** Firebase Storage URL for the video */
  readonly videoUrl: string;

  /** Storage path (for deletion) */
  readonly storagePath: string;

  /** Recording duration in seconds */
  readonly duration: number;

  /** Video file size in bytes */
  readonly fileSize: number;

  /** Video MIME type (e.g., "video/mp4", "video/webm") */
  readonly mimeType: string;

  /** When this recording was created */
  readonly recordedAt: Date;

  /** Device type where recording was made */
  readonly deviceType?: "mobile" | "tablet" | "desktop";

  /** Optional thumbnail URL */
  readonly thumbnailUrl?: string;

  /** Optional notes from the user */
  readonly notes?: string;

  /** Metadata for cross-referencing */
  readonly metadata: {
    /** Sequence name at time of recording */
    sequenceName?: string;
    /** Number of steps in sequence */
    stepCount?: number;
    /** Any additional metadata */
    [key: string]: unknown;
  };
}

export function createRecordingMetadata(
  data: Partial<RecordingMetadata> & {
    userId: string;
    sequenceId: string;
    videoUrl: string;
    storagePath: string;
    duration: number;
    fileSize: number;
    mimeType: string;
  }
): RecordingMetadata {
  return {
    id: data.id ?? crypto.randomUUID(),
    userId: data.userId,
    sequenceId: data.sequenceId,
    videoUrl: data.videoUrl,
    storagePath: data.storagePath,
    duration: data.duration,
    fileSize: data.fileSize,
    mimeType: data.mimeType,
    recordedAt: data.recordedAt ?? new Date(),
    deviceType: data.deviceType,
    thumbnailUrl: data.thumbnailUrl,
    notes: data.notes,
    metadata: data.metadata ?? {},
  };
}

/**
 * Helper to detect device type from user agent
 */
export function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";

  const ua = window.navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (
    /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
      ua
    )
  ) {
    return "mobile";
  }
  return "desktop";
}
