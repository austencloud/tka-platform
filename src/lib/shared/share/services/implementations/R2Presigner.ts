/**
 * R2Presigner
 *
 * Wraps Firebase Cloud Function calls for R2 presigned URL generation
 * and multipart upload orchestration. Uses httpsCallable from the
 * Firebase SDK, which handles auth token propagation automatically.
 *
 * Named "Presigner" per service naming convention: services are named
 * by what they do, not with a generic "Service" suffix.
 */

import { getFunctionsInstance } from "$lib/shared/auth/firebase";

export class R2Presigner {
  private async call<T>(functionName: string, data: unknown): Promise<T> {
    const { httpsCallable } = await import("firebase/functions");
    const functions = await getFunctionsInstance();
    const callable = httpsCallable<unknown, T>(functions, functionName);
    const result = await callable(data);
    return result.data;
  }

  async getUploadUrl(params: {
    fileName: string;
    contentType: string;
    contentLength: number;
    userId: string;
    category: string;
    sequenceId: string;
  }): Promise<{ presignedUrl: string; publicUrl: string; key: string }> {
    return this.call("r2PresignUrl", params);
  }

  async startMultipart(params: {
    fileName: string;
    contentType: string;
    userId: string;
    category: string;
    sequenceId: string;
  }): Promise<{ uploadId: string; key: string }> {
    return this.call("r2MultipartStart", params);
  }

  async getPartUrl(params: {
    key: string;
    uploadId: string;
    partNumber: number;
  }): Promise<{ presignedUrl: string }> {
    return this.call("r2MultipartPartUrl", params);
  }

  async completeMultipart(params: {
    key: string;
    uploadId: string;
    parts: Array<{ ETag: string; PartNumber: number }>;
  }): Promise<{ publicUrl: string }> {
    return this.call("r2MultipartComplete", params);
  }

  async abortMultipart(params: {
    key: string;
    uploadId: string;
  }): Promise<void> {
    await this.call("r2MultipartAbort", params);
  }

  async listParts(params: {
    key: string;
    uploadId: string;
  }): Promise<{
    parts: Array<{ ETag: string; PartNumber: number; Size: number }>;
    expired: boolean;
  }> {
    return this.call("r2MultipartListParts", params);
  }

  async deleteObject(key: string): Promise<void> {
    await this.call("r2DeleteObject", { key });
  }

  async deleteByPrefix(prefix: string): Promise<{ deletedCount: number }> {
    return this.call("r2DeleteByPrefix", { prefix });
  }
}
