import { describe, it, expect, beforeEach, vi } from "vitest";
import { LocalStickerSheetRepository } from "$lib/features/sticker-lab/services/implementations/LocalStickerSheetRepository";
import {
  createDefaultStickerSheet,
  createDefaultStickerUnit,
} from "$lib/features/sticker-lab/domain/sticker-types";
import { STORAGE_KEY_ACTIVE_SHEET } from "$lib/features/sticker-lab/domain/sticker-constants";

function mockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("LocalStickerSheetRepository", () => {
  let storage: Storage;
  let repo: LocalStickerSheetRepository;

  beforeEach(() => {
    storage = mockLocalStorage();
    repo = new LocalStickerSheetRepository(storage);
  });

  it("load returns null when no sheet is saved", () => {
    expect(repo.load()).toBeNull();
  });

  it("save then load returns the same sheet", () => {
    const sheet = createDefaultStickerSheet();
    const sheetWithOne = {
      ...sheet,
      stickers: [createDefaultStickerUnit({ sourceLoop: { sequenceId: "s1", word: "W", loopType: "t" } })],
    };
    repo.save(sheetWithOne);
    const loaded = repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(sheetWithOne.id);
    expect(loaded!.stickers).toHaveLength(1);
  });

  it("clear removes the stored sheet", () => {
    repo.save(createDefaultStickerSheet());
    repo.clear();
    expect(repo.load()).toBeNull();
  });

  it("load returns null when stored payload is malformed JSON", () => {
    storage.setItem(STORAGE_KEY_ACTIVE_SHEET, "not-valid-json{");
    expect(repo.load()).toBeNull();
  });

  it("load returns null when stored payload has wrong schema version", () => {
    storage.setItem(
      STORAGE_KEY_ACTIVE_SHEET,
      JSON.stringify({ version: 999, sheet: createDefaultStickerSheet() })
    );
    expect(repo.load()).toBeNull();
  });
});
