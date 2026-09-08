/**
 * Universal Metadata Extractor
 *
 * Replaces the problematic WebP/PNG EXIF extraction with clean JSON sidecar files.
 * Falls back to legacy WebP/PNG formats for backwards compatibility.
 */

export interface ModernMetadataResult {
  success: boolean;
  data?: SequenceMetadata;
  source: "sidecar" | "fallback-webp" | "fallback-png";
  error?: string;
}

interface SequenceMetadata {
  sequence?: StepData[];
  word?: string;
  author?: string;
  level?: number;
  prop_type?: string;
  grid_mode?: string;
  date_added?: string;
  [key: string]: unknown;
}

interface StepData {
  beat?: number;
  letter?: string;
  letter_type?: string;
  duration?: number;
  start_pos?: string;
  end_pos?: string;
  timing?: string;
  direction?: string;
  left_attributes?: Record<string, unknown>;
  right_attributes?: Record<string, unknown>;
}

function buildSidecarPath(sequenceName: string): string {
  const baseName = sequenceName.replace(/_ver\d+$/, "");
  const directory = baseName;
  return `/gallery/${directory}/${sequenceName}.meta.json`;
}

function buildWebPPath(sequenceName: string): string {
  const baseName = sequenceName.replace(/_ver\d+$/, "");
  return `/gallery/${baseName}/${sequenceName}.webp`;
}

function buildPNGPath(sequenceName: string): string {
  const baseName = sequenceName.replace(/_ver\d+$/, "");
  return `/gallery/${baseName}/${sequenceName}.png`;
}

function readString(data: Uint8Array, offset: number, length: number): string {
  return new TextDecoder("ascii").decode(data.slice(offset, offset + length));
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    (data[offset]! << 24) |
    (data[offset + 1]! << 16) |
    (data[offset + 2]! << 8) |
    data[offset + 3]!
  );
}

function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset]! |
    (data[offset + 1]! << 8) |
    (data[offset + 2]! << 16) |
    (data[offset + 3]! << 24)
  );
}

function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8);
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (data[offset]! << 8) | data[offset + 1]!;
}

function extractExifFromWebP(data: Uint8Array): Uint8Array | null {
  let offset = 0;

  if (readString(data, offset, 4) !== "RIFF") return null;
  offset += 8;

  if (readString(data, offset, 4) !== "WEBP") return null;
  offset += 4;

  while (offset < data.length - 8) {
    const chunkType = readString(data, offset, 4);
    offset += 4;

    const chunkSize = readUint32LE(data, offset);
    offset += 4;

    if (chunkType === "EXIF") {
      return data.slice(offset, offset + chunkSize);
    }

    offset += chunkSize;
    if (chunkSize % 2 === 1) offset++;
  }

  return null;
}

function extractUserComment(exifData: Uint8Array): string | null {
  try {
    let offset = 0;

    const endian = readString(exifData, offset, 2);
    const isLittleEndian = endian === "II";
    offset += 4;

    const ifd0Offset = isLittleEndian
      ? readUint32LE(exifData, offset)
      : readUint32BE(exifData, offset);
    offset = ifd0Offset;

    const entryCount = isLittleEndian
      ? readUint16LE(exifData, offset)
      : readUint16BE(exifData, offset);
    offset += 2;

    for (let i = 0; i < entryCount; i++) {
      const tag = isLittleEndian
        ? readUint16LE(exifData, offset)
        : readUint16BE(exifData, offset);
      const type = isLittleEndian
        ? readUint16LE(exifData, offset + 2)
        : readUint16BE(exifData, offset + 2);
      const count = isLittleEndian
        ? readUint32LE(exifData, offset + 4)
        : readUint32BE(exifData, offset + 4);
      const valueOffset = isLittleEndian
        ? readUint32LE(exifData, offset + 8)
        : readUint32BE(exifData, offset + 8);

      if (tag === 0x9286 && type === 7) {
        const dataOffset = count <= 4 ? offset + 8 : valueOffset;
        const commentStart = Math.min(8, count);
        const commentData = exifData.slice(
          dataOffset + commentStart,
          dataOffset + count
        );
        return new TextDecoder("utf-8").decode(commentData);
      }

      offset += 12;
    }

    return null;
  } catch {
    return null;
  }
}

function findTextChunk(data: Uint8Array, keyword: string): string | null {
  let offset = 8; // Skip PNG signature

  while (offset < data.length - 8) {
    const length = readUint32BE(data, offset);
    const chunkType = readString(data, offset + 4, 4);

    if (chunkType === "tEXt") {
      const chunkData = data.slice(offset + 8, offset + 8 + length);
      const nullIndex = chunkData.indexOf(0);

      if (nullIndex > 0) {
        const chunkKeyword = readString(chunkData, 0, nullIndex);
        if (chunkKeyword === keyword) {
          return readString(
            chunkData,
            nullIndex + 1,
            chunkData.length - nullIndex - 1
          );
        }
      }
    }

    offset += 8 + length + 4;
  }

  return null;
}

async function extractFromSidecar(sequenceName: string): Promise<ModernMetadataResult> {
  const sidecarPath = buildSidecarPath(sequenceName);

  const response = await fetch(sidecarPath);
  if (!response.ok) {
    throw new Error(`Sidecar not found: ${sidecarPath}`);
  }

  const sidecarData = await response.json();

  return {
    success: true,
    data: sidecarData.metadata,
    source: "sidecar",
  };
}

async function extractFromWebP(sequenceName: string): Promise<ModernMetadataResult> {
  const webpPath = buildWebPPath(sequenceName);

  const response = await fetch(webpPath);
  if (!response.ok) {
    throw new Error(`WebP not found: ${webpPath}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const exifData = extractExifFromWebP(uint8Array);
  if (!exifData) {
    throw new Error("No EXIF data in WebP");
  }

  const userComment = extractUserComment(exifData);
  if (!userComment) {
    throw new Error("No UserComment in WebP EXIF");
  }

  const metadata = JSON.parse(userComment);

  return {
    success: true,
    data: metadata,
    source: "fallback-webp",
  };
}

async function extractFromPNG(sequenceName: string): Promise<ModernMetadataResult> {
  const pngPath = buildPNGPath(sequenceName);

  const response = await fetch(pngPath);
  if (!response.ok) {
    throw new Error(`PNG not found: ${pngPath}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const metadataJson = findTextChunk(uint8Array, "metadata");
  if (!metadataJson) {
    throw new Error("No metadata tEXt chunk in PNG");
  }

  const metadata = JSON.parse(metadataJson);

  return {
    success: true,
    data: metadata,
    source: "fallback-png",
  };
}

/**
 * Extract metadata with modern fallback chain
 * 1. Try JSON sidecar file (fast, reliable)
 * 2. Fallback to WebP EXIF (legacy)
 * 3. Fallback to PNG tEXt (legacy)
 */
export async function extractMetadata(
  sequenceName: string
): Promise<ModernMetadataResult> {
  try {
    const sidecarResult = await extractFromSidecar(sequenceName);
    if (sidecarResult.success) {
      return sidecarResult;
    }
  } catch {
    // Silent fallback to legacy formats
  }

  try {
    const webpResult = await extractFromWebP(sequenceName);
    if (webpResult.success) {
      console.warn(`⚠️ Using legacy WebP format for ${sequenceName}`);
      return webpResult;
    }
  } catch {
    // Continue to PNG fallback
  }

  try {
    const pngResult = await extractFromPNG(sequenceName);
    if (pngResult.success) {
      console.warn(`⚠️ Using legacy PNG format for ${sequenceName}`);
      return pngResult;
    }
  } catch {
    // All fallbacks exhausted
  }

  console.error(`❌ No metadata found for ${sequenceName} in any format`);
  return {
    success: false,
    source: "fallback-png",
    error: `No metadata found for ${sequenceName} in any format`,
  };
}
