import type { IStripPatternEngine } from "../services/contracts/IStripPatternEngine";
import type { IPoiDeviceManager } from "../services/contracts/IPoiDeviceManager";
import type { StripPattern, PatternParams, RGBColor } from "../domain/StripPattern";
import type { PoiDeviceInfo } from "../domain/DeviceTypes";
import type { IPatternPreset } from "../domain/PatternPreset";

const STORAGE_KEY = "tka-poi-settings";
const IMAGE_STORAGE_KEY = "tka-poi-image";

interface PersistedSettings {
  activePresetId: string;
  ledCount: number;
  frameCount: number;
  persistenceDuration: number;
  rpm: number;
  showFullDisc: boolean;
  patternParams: PatternParams;
  /** Tracks whether the active pattern came from an image upload */
  hasUploadedImage: boolean;
  uploadedImageName?: string;
}

function loadSettings(): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSettings(settings: PersistedSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* quota exceeded — ignore */ }
}

function saveImageDataUrl(dataUrl: string): void {
  try {
    localStorage.setItem(IMAGE_STORAGE_KEY, dataUrl);
  } catch { /* quota exceeded — too large for localStorage, silently skip */ }
}

function loadImageDataUrl(): string | null {
  try {
    return localStorage.getItem(IMAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearImageDataUrl(): void {
  try {
    localStorage.removeItem(IMAGE_STORAGE_KEY);
  } catch { /* ignore */ }
}

/** Convert a File to a data URL for persistence */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Load an image from a data URL and return its ImageData */
async function dataUrlToImageData(dataUrl: string): Promise<ImageData> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

export function createPoiState(
  patternEngine: IStripPatternEngine,
  deviceManager: IPoiDeviceManager
) {
  const saved = loadSettings();

  // Pattern state
  let activePattern = $state<StripPattern | null>(null);
  let activePresetId = $state<string>(saved.activePresetId ?? "solid");
  let ledCount = $state(saved.ledCount ?? 200);
  let frameCount = $state(saved.frameCount ?? 180);

  // Device state
  let connectedDevices = $state<PoiDeviceInfo[]>([]);
  let uploadProgress = $state<number | null>(null);

  // 3D rendering state
  let persistenceDuration = $state(saved.persistenceDuration ?? 0.12);

  // Spin preview state (persisted here, consumed by PovSpinPreview)
  let rpm = $state(saved.rpm ?? 120);
  let showFullDisc = $state(saved.showFullDisc ?? false);

  // Default generation params
  let patternParams = $state<PatternParams>(saved.patternParams ?? {
    primaryColor: { r: 0, g: 255, b: 136 },
    secondaryColor: { r: 59, g: 130, b: 246 },
    speed: 1.0,
    brightness: 1.0,
  });

  // Track whether current pattern is from an uploaded image
  let hasUploadedImage = $state(saved.hasUploadedImage ?? false);
  let uploadedImageName = $state(saved.uploadedImageName ?? "");

  // Persist settings whenever they change
  $effect(() => {
    saveSettings({
      activePresetId,
      ledCount,
      frameCount,
      persistenceDuration,
      rpm,
      showFullDisc,
      patternParams,
      hasUploadedImage,
      uploadedImageName,
    });
  });

  // Restore uploaded image on load (runs once)
  if (saved.hasUploadedImage) {
    const storedDataUrl = loadImageDataUrl();
    if (storedDataUrl) {
      dataUrlToImageData(storedDataUrl).then((imgData) => {
        activePattern = patternEngine.fromImage(imgData, ledCount);
        if (activePattern) {
          activePattern.metadata.name = uploadedImageName || "Restored";
          activePattern.metadata.source = "image-upload";
        }
      }).catch(() => {
        // Image restore failed — fall back to preset
        hasUploadedImage = false;
        clearImageDataUrl();
        generateFromPreset();
      });
    } else {
      hasUploadedImage = false;
    }
  }

  function generateFromPreset(): void {
    try {
      activePattern = patternEngine.generate(
        activePresetId, ledCount, frameCount, patternParams
      );
      // Switching to a preset clears the persisted image
      hasUploadedImage = false;
      clearImageDataUrl();
    } catch (err) {
      console.error("Pattern generation failed:", err);
    }
  }

  function loadFromImage(imageData: ImageData): void {
    activePattern = patternEngine.fromImage(imageData, ledCount);
    hasUploadedImage = false;
    clearImageDataUrl();
  }

  async function loadFromFile(file: File): Promise<void> {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();
    activePattern = patternEngine.fromImage(imgData, ledCount);
    if (activePattern) {
      activePattern.metadata.sourceImagePath = file.name;
      activePattern.metadata.name = file.name.replace(/\.[^.]+$/, "");
    }

    // Persist the image for reload
    try {
      const dataUrl = await fileToDataUrl(file);
      saveImageDataUrl(dataUrl);
      hasUploadedImage = true;
      uploadedImageName = file.name.replace(/\.[^.]+$/, "");
    } catch {
      // If we can't persist the image (too large, etc), that's OK
      hasUploadedImage = false;
    }
  }

  function toImageData(): ImageData | null {
    if (!activePattern) return null;
    return patternEngine.toImageData(activePattern);
  }

  async function scanDevices(): Promise<void> {
    const devices = await deviceManager.scanAll();
    connectedDevices = devices;
  }

  async function connectDevice(device: PoiDeviceInfo): Promise<void> {
    await deviceManager.connect(device);
    // Refresh device list
    connectedDevices = deviceManager.connections.map((c) => c.deviceInfo);
  }

  async function uploadToDevice(deviceId: string, slot: number = 0): Promise<void> {
    if (!activePattern) return;
    uploadProgress = 0;
    try {
      await deviceManager.uploadPattern(deviceId, activePattern, slot, (pct) => {
        uploadProgress = pct;
      });
    } finally {
      uploadProgress = null;
    }
  }

  async function uploadToAll(slot: number = 0): Promise<void> {
    if (!activePattern) return;
    uploadProgress = 0;
    try {
      await deviceManager.uploadToAll(activePattern, slot, (pct) => {
        uploadProgress = pct;
      });
    } finally {
      uploadProgress = null;
    }
  }

  return {
    // Getters
    get activePattern() { return activePattern; },
    get activePresetId() { return activePresetId; },
    get ledCount() { return ledCount; },
    get frameCount() { return frameCount; },
    get connectedDevices() { return connectedDevices; },
    get uploadProgress() { return uploadProgress; },
    get persistenceDuration() { return persistenceDuration; },
    get rpm() { return rpm; },
    get showFullDisc() { return showFullDisc; },
    get patternParams() { return patternParams; },
    get hasUploadedImage() { return hasUploadedImage; },
    get presets(): IPatternPreset[] { return patternEngine.getPresets(); },

    // Setters
    setActivePresetId(id: string) { activePresetId = id; },
    setLedCount(n: number) { ledCount = n; },
    setFrameCount(n: number) { frameCount = n; },
    setPersistenceDuration(s: number) { persistenceDuration = Math.max(0.03, Math.min(1.0, s)); },
    setRpm(v: number) { rpm = v; },
    setShowFullDisc(v: boolean) { showFullDisc = v; },
    setPatternParams(p: PatternParams) { patternParams = p; },
    setPrimaryColor(c: RGBColor) { patternParams = { ...patternParams, primaryColor: c }; },
    setSecondaryColor(c: RGBColor) { patternParams = { ...patternParams, secondaryColor: c }; },

    // Actions
    generateFromPreset,
    loadFromImage,
    loadFromFile,
    toImageData,
    scanDevices,
    connectDevice,
    uploadToDevice,
    uploadToAll,
  };
}

export type PoiState = ReturnType<typeof createPoiState>;
