import type { IStripPatternEngine } from "../services/contracts/IStripPatternEngine";
import type { IPoiDeviceManager } from "../services/contracts/IPoiDeviceManager";
import type { StripPattern, PatternParams, RGBColor } from "../domain/StripPattern";
import type { PoiDeviceInfo } from "../domain/DeviceTypes";
import type { IPatternPreset } from "../domain/PatternPreset";

export function createPoiState(
  patternEngine: IStripPatternEngine,
  deviceManager: IPoiDeviceManager
) {
  // Pattern state
  let activePattern = $state<StripPattern | null>(null);
  let activePresetId = $state<string>("solid");
  let ledCount = $state(200); // iPixel 200 HD default
  let frameCount = $state(180); // 180 columns = good POV resolution

  // Device state
  let connectedDevices = $state<PoiDeviceInfo[]>([]);
  let uploadProgress = $state<number | null>(null);

  // 3D rendering state
  let persistenceDuration = $state(0.12); // 120ms default

  // Default generation params
  let patternParams = $state<PatternParams>({
    primaryColor: { r: 0, g: 255, b: 136 }, // Green
    secondaryColor: { r: 59, g: 130, b: 246 }, // Blue
    speed: 1.0,
    brightness: 1.0,
  });

  function generateFromPreset(): void {
    try {
      activePattern = patternEngine.generate(
        activePresetId, ledCount, frameCount, patternParams
      );
    } catch (err) {
      console.error("Pattern generation failed:", err);
    }
  }

  function loadFromImage(imageData: ImageData): void {
    activePattern = patternEngine.fromImage(imageData, ledCount);
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
    get patternParams() { return patternParams; },
    get presets(): IPatternPreset[] { return patternEngine.getPresets(); },

    // Setters
    setActivePresetId(id: string) { activePresetId = id; },
    setLedCount(n: number) { ledCount = n; },
    setFrameCount(n: number) { frameCount = n; },
    setPersistenceDuration(s: number) { persistenceDuration = Math.max(0.03, Math.min(1.0, s)); },
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
