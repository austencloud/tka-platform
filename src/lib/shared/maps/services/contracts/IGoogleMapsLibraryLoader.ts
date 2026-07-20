export interface IGoogleMapsLibraryLoader {
  load(apiKey: string): Promise<void>;
}
