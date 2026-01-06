/**
 * COCO Dataset Export Utility
 *
 * Exports labeled training data to COCO format for use with
 * MediaPipe Model Maker or other training frameworks.
 */

import {
  getMLTrainingStorage,
  type MLTrainingStorageManager,
} from "./MLTrainingStorageManager";
import type {
  CaptureSession,
  CapturedFrame,
  COCODataset,
  COCOImage,
  COCOAnnotation,
  COCOCategory,
  PropType,
} from "../domain/models";
import JSZip from "jszip";

/**
 * Export configuration options.
 */
export interface ExportConfig {
  /** Only include verified frames */
  verifiedOnly: boolean;
  /** Include skipped frames */
  includeSkipped: boolean;
  /** Train/validation split ratio (0-1, e.g., 0.8 = 80% train) */
  trainSplit: number;
  /** Image quality for JPEG export (0-1) */
  imageQuality: number;
}

const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  verifiedOnly: false,
  includeSkipped: false,
  trainSplit: 0.8,
  imageQuality: 0.9,
};

/**
 * Generate COCO categories for prop types.
 */
function generateCategories(propTypes: PropType[]): COCOCategory[] {
  const categoryMap: Record<PropType, number> = {
    club: 1,
    staff: 2,
    fan: 3,
    hoop: 4,
    buugeng: 5,
  };

  return propTypes.map((propType) => ({
    id: categoryMap[propType],
    name: propType,
    supercategory: "prop",
  }));
}

/**
 * Convert normalized bounding box to COCO format (absolute pixels).
 */
function toCocoBox(
  box: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
): [number, number, number, number] {
  return [
    Math.round(box.x * imageWidth),
    Math.round(box.y * imageHeight),
    Math.round(box.width * imageWidth),
    Math.round(box.height * imageHeight),
  ];
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

/**
 * Export a session to COCO format as a downloadable ZIP.
 */
export async function exportSessionToCoco(
  session: CaptureSession,
  config: Partial<ExportConfig> = {}
): Promise<Blob> {
  const exportConfig = { ...DEFAULT_EXPORT_CONFIG, ...config };
  const storage = getMLTrainingStorage();
  await storage.initialize();

  // Get all frames for this session
  let frames = await storage.getFramesBySession(session.id);

  // Filter frames based on config
  frames = frames.filter((frame) => {
    if (exportConfig.verifiedOnly && frame.status !== "verified") return false;
    if (!exportConfig.includeSkipped && frame.status === "skipped")
      return false;
    if (frame.status === "unlabeled") return false;
    return true;
  });

  if (frames.length === 0) {
    throw new Error("No labeled frames to export");
  }

  // Shuffle and split
  const shuffled = shuffleArray(frames);
  const splitIndex = Math.floor(shuffled.length * exportConfig.trainSplit);
  const trainFrames = shuffled.slice(0, splitIndex);
  const valFrames = shuffled.slice(splitIndex);

  // Create ZIP
  const zip = new JSZip();

  // Export train set
  const trainDataset = await buildCocoDataset(
    trainFrames,
    session,
    storage,
    "train",
    zip
  );
  zip.file("train/labels.json", JSON.stringify(trainDataset, null, 2));

  // Export validation set
  const valDataset = await buildCocoDataset(
    valFrames,
    session,
    storage,
    "val",
    zip
  );
  zip.file("val/labels.json", JSON.stringify(valDataset, null, 2));

  // Add metadata
  const metadata = {
    exportDate: new Date().toISOString(),
    session: {
      id: session.id,
      name: session.name,
      propType: session.propType,
      resolution: session.resolution,
    },
    config: exportConfig,
    stats: {
      totalFrames: frames.length,
      trainFrames: trainFrames.length,
      valFrames: valFrames.length,
    },
  };
  zip.file("metadata.json", JSON.stringify(metadata, null, 2));

  // Generate ZIP blob
  return await zip.generateAsync({ type: "blob" });
}

/**
 * Build COCO dataset from frames.
 */
async function buildCocoDataset(
  frames: CapturedFrame[],
  session: CaptureSession,
  storage: MLTrainingStorageManager,
  split: string,
  zip: JSZip
): Promise<COCODataset> {
  const images: COCOImage[] = [];
  const annotations: COCOAnnotation[] = [];
  const propTypes = new Set<PropType>();

  let imageId = 1;
  let annotationId = 1;

  for (const frame of frames) {
    // Get image blob
    const imageBlob = await storage.getFrameImage(frame.imageKey);
    if (!imageBlob) continue;

    // Get annotations
    const frameAnnotations = await storage.getAnnotationsForFrame(frame.id);
    if (frameAnnotations.length === 0) continue;

    // Add image to ZIP
    const fileName = `${split}/images/${String(imageId).padStart(6, "0")}.jpg`;
    zip.file(fileName, imageBlob);

    // Add COCO image entry
    images.push({
      id: imageId,
      file_name: `images/${String(imageId).padStart(6, "0")}.jpg`,
      width: session.resolution.width,
      height: session.resolution.height,
    });

    // Add COCO annotations
    for (const ann of frameAnnotations) {
      propTypes.add(ann.propType);

      const bbox = toCocoBox(
        ann.boundingBox,
        session.resolution.width,
        session.resolution.height
      );

      annotations.push({
        id: annotationId++,
        image_id: imageId,
        category_id: getCategoryId(ann.propType),
        bbox,
        area: bbox[2] * bbox[3],
        iscrowd: 0,
        head_direction: ann.headDirection,
        hand: ann.hand,
      });
    }

    imageId++;
  }

  return {
    images,
    annotations,
    categories: generateCategories([...propTypes]),
  };
}

/**
 * Get category ID for prop type.
 */
function getCategoryId(propType: PropType): number {
  const map: Record<PropType, number> = {
    club: 1,
    staff: 2,
    fan: 3,
    hoop: 4,
    buugeng: 5,
  };
  return map[propType];
}

/**
 * Export multiple sessions to a single COCO dataset.
 */
export async function exportMultipleSessionsToCoco(
  sessions: CaptureSession[],
  config: Partial<ExportConfig> = {}
): Promise<Blob> {
  const exportConfig = { ...DEFAULT_EXPORT_CONFIG, ...config };
  const storage = getMLTrainingStorage();
  await storage.initialize();

  // Collect all frames from all sessions
  const allFrames: Array<{ frame: CapturedFrame; session: CaptureSession }> =
    [];

  for (const session of sessions) {
    let frames = await storage.getFramesBySession(session.id);

    frames = frames.filter((frame) => {
      if (exportConfig.verifiedOnly && frame.status !== "verified")
        return false;
      if (!exportConfig.includeSkipped && frame.status === "skipped")
        return false;
      if (frame.status === "unlabeled") return false;
      return true;
    });

    for (const frame of frames) {
      allFrames.push({ frame, session });
    }
  }

  if (allFrames.length === 0) {
    throw new Error("No labeled frames to export");
  }

  // Shuffle and split
  const shuffled = shuffleArray(allFrames);
  const splitIndex = Math.floor(shuffled.length * exportConfig.trainSplit);
  const trainFrames = shuffled.slice(0, splitIndex);
  const valFrames = shuffled.slice(splitIndex);

  // Create ZIP
  const zip = new JSZip();

  // Export train set
  const trainDataset = await buildMultiSessionCocoDataset(
    trainFrames,
    storage,
    "train",
    zip
  );
  zip.file("train/labels.json", JSON.stringify(trainDataset, null, 2));

  // Export validation set
  const valDataset = await buildMultiSessionCocoDataset(
    valFrames,
    storage,
    "val",
    zip
  );
  zip.file("val/labels.json", JSON.stringify(valDataset, null, 2));

  // Add metadata
  const metadata = {
    exportDate: new Date().toISOString(),
    sessions: sessions.map((s) => ({
      id: s.id,
      name: s.name,
      propType: s.propType,
    })),
    config: exportConfig,
    stats: {
      totalFrames: allFrames.length,
      trainFrames: trainFrames.length,
      valFrames: valFrames.length,
    },
  };
  zip.file("metadata.json", JSON.stringify(metadata, null, 2));

  return await zip.generateAsync({ type: "blob" });
}

/**
 * Build COCO dataset from frames across multiple sessions.
 */
async function buildMultiSessionCocoDataset(
  frames: Array<{ frame: CapturedFrame; session: CaptureSession }>,
  storage: MLTrainingStorageManager,
  split: string,
  zip: JSZip
): Promise<COCODataset> {
  const images: COCOImage[] = [];
  const annotations: COCOAnnotation[] = [];
  const propTypes = new Set<PropType>();

  let imageId = 1;
  let annotationId = 1;

  for (const { frame, session } of frames) {
    const imageBlob = await storage.getFrameImage(frame.imageKey);
    if (!imageBlob) continue;

    const frameAnnotations = await storage.getAnnotationsForFrame(frame.id);
    if (frameAnnotations.length === 0) continue;

    const fileName = `${split}/images/${String(imageId).padStart(6, "0")}.jpg`;
    zip.file(fileName, imageBlob);

    images.push({
      id: imageId,
      file_name: `images/${String(imageId).padStart(6, "0")}.jpg`,
      width: session.resolution.width,
      height: session.resolution.height,
    });

    for (const ann of frameAnnotations) {
      propTypes.add(ann.propType);

      const bbox = toCocoBox(
        ann.boundingBox,
        session.resolution.width,
        session.resolution.height
      );

      annotations.push({
        id: annotationId++,
        image_id: imageId,
        category_id: getCategoryId(ann.propType),
        bbox,
        area: bbox[2] * bbox[3],
        iscrowd: 0,
        head_direction: ann.headDirection,
        hand: ann.hand,
      });
    }

    imageId++;
  }

  return {
    images,
    annotations,
    categories: generateCategories([...propTypes]),
  };
}

/**
 * Trigger download of a blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
