/**
 * R2 Presigner Interface
 *
 * Wraps Cloud Function calls for R2 presigned URL generation,
 * multipart upload orchestration, and object deletion.
 * Named "Presigner" because that's what it does: signs URLs.
 */

export interface IR2Presigner {
  /** Get a presigned PUT URL for a single file upload */
  getUploadUrl(params: {
    fileName: string;
    contentType: string;
    contentLength: number;
    userId: string;
    category: string;
    sequenceId: string;
  }): Promise<{ presignedUrl: string; publicUrl: string; key: string }>;

  /** Start a multipart upload */
  startMultipart(params: {
    fileName: string;
    contentType: string;
    userId: string;
    category: string;
    sequenceId: string;
  }): Promise<{ uploadId: string; key: string }>;

  /** Get presigned URL for one part of a multipart upload */
  getPartUrl(params: {
    key: string;
    uploadId: string;
    partNumber: number;
  }): Promise<{ presignedUrl: string }>;

  /** Complete a multipart upload */
  completeMultipart(params: {
    key: string;
    uploadId: string;
    parts: Array<{ ETag: string; PartNumber: number }>;
  }): Promise<{ publicUrl: string }>;

  /** Abort a multipart upload */
  abortMultipart(params: {
    key: string;
    uploadId: string;
  }): Promise<void>;

  /** List parts already uploaded (for resume) */
  listParts(params: {
    key: string;
    uploadId: string;
  }): Promise<{
    parts: Array<{ ETag: string; PartNumber: number; Size: number }>;
    expired: boolean;
  }>;

  /** Delete a single object from R2 */
  deleteObject(key: string): Promise<void>;

  /** Delete all objects matching a prefix */
  deleteByPrefix(prefix: string): Promise<{ deletedCount: number }>;
}
