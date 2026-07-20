import JSZip from "jszip";

import { downloadBlob } from "$lib/shared/foundation/services/file-downloader";
import { buildPronunciationRecordingManifest } from "../../domain/recording-manifest";
import type { PronunciationRecordingJob } from "../../domain/recording-jobs";
import type {
  ConnectedRecordingFolder,
  IPronunciationTakeStore,
} from "../contracts/IPronunciationTakeStore";

interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures";
}

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: (
      options?: DirectoryPickerOptions
    ) => Promise<FileSystemDirectoryHandle>;
  };

export class PronunciationTakeStore implements IPronunciationTakeStore {
  private directory: FileSystemDirectoryHandle | null = null;
  private existingJobIds = new Set<string>();

  supportsDirectSave(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof (window as DirectoryPickerWindow).showDirectoryPicker ===
        "function"
    );
  }

  async connectFolder(
    jobs: readonly PronunciationRecordingJob[]
  ): Promise<ConnectedRecordingFolder> {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) {
      throw new Error("Direct folder saving is not available in this browser.");
    }

    const directory = await picker({
      id: "tka-pronunciations-v1",
      mode: "readwrite",
      startIn: "music",
    });
    if (directory.name.toLowerCase() !== "v1") {
      throw new Error(
        'Choose the folder named "v1" inside static/audio/pronunciations.'
      );
    }

    this.directory = directory;
    this.existingJobIds = new Set(await this.scanExisting(directory, jobs));
    return {
      name: directory.name,
      existingJobIds: Array.from(this.existingJobIds),
    };
  }

  async saveTake(
    job: PronunciationRecordingJob,
    wav: Blob,
    jobs: readonly PronunciationRecordingJob[]
  ): Promise<void> {
    if (!this.directory) {
      throw new Error(
        "Choose the pronunciation v1 folder before direct saving."
      );
    }

    const letterDirectory = await this.directory.getDirectoryHandle(
      job.assetKey,
      { create: true }
    );
    await this.writeFile(letterDirectory, `${job.position}.wav`, wav);
    this.existingJobIds.add(job.id);

    const manifest = buildPronunciationRecordingManifest(
      this.existingJobIds,
      jobs
    );
    await this.writeFile(
      this.directory,
      "manifest.json",
      new Blob([`${JSON.stringify(manifest, null, 2)}\n`], {
        type: "application/json",
      })
    );
  }

  async exportSessionZip(
    takes: ReadonlyMap<string, Blob>,
    jobs: readonly PronunciationRecordingJob[]
  ): Promise<number> {
    if (takes.size === 0) return 0;

    const jobById = new Map(jobs.map((job) => [job.id, job]));
    const zip = new JSZip();
    const exportedIds = new Set<string>();
    for (const [jobId, wav] of takes) {
      const job = jobById.get(jobId);
      if (!job) continue;
      zip.file(`v1/${job.outputPath}`, wav);
      exportedIds.add(jobId);
    }

    const manifest = buildPronunciationRecordingManifest(exportedIds, jobs);
    zip.file("v1/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    const result = await downloadBlob(blob, "tka-pronunciations-v1.zip");
    if (!result.success) {
      throw (
        result.error ?? new Error("The pronunciation ZIP did not download.")
      );
    }
    return exportedIds.size;
  }

  disconnect(): void {
    this.directory = null;
    this.existingJobIds.clear();
  }

  private async scanExisting(
    root: FileSystemDirectoryHandle,
    jobs: readonly PronunciationRecordingJob[]
  ): Promise<string[]> {
    const existing: string[] = [];
    for (const job of jobs) {
      try {
        const letterDirectory = await root.getDirectoryHandle(job.assetKey);
        await letterDirectory.getFileHandle(`${job.position}.wav`);
        existing.push(job.id);
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError") {
          continue;
        }
        throw error;
      }
    }
    return existing;
  }

  private async writeFile(
    directory: FileSystemDirectoryHandle,
    name: string,
    contents: Blob
  ): Promise<void> {
    const handle = await directory.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(contents);
    } finally {
      await writable.close();
    }
  }
}
