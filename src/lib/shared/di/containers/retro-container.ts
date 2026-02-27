import { createContainer } from "iti";
import { WindowManager } from "$lib/features/retro/services/implementations/WindowManager";
import { PixelRenderer } from "$lib/features/retro/services/implementations/PixelRenderer";
import { FakeLoadingManager } from "$lib/features/retro/services/implementations/FakeLoadingManager";
import { RetroSoundManager } from "$lib/features/retro/services/implementations/RetroSoundManager";
import { FileNameConverter } from "$lib/features/retro/services/implementations/FileNameConverter";

export function createRetroContainer() {
  return createContainer().add({
    windowManager: () => new WindowManager(),
    pixelRenderer: () => new PixelRenderer(),
    fakeLoadingManager: () => new FakeLoadingManager(),
    retroSoundManager: () => new RetroSoundManager(),
    fileNameConverter: () => new FileNameConverter(),
  });
}

export type RetroContainer = ReturnType<typeof createRetroContainer>;
