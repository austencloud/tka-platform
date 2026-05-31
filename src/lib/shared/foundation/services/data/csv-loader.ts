import type { CsvDataSet } from "$lib/shared/foundation/domain/models/csv-models";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
// Module-level cache shared across all instances (defense against non-singleton usage)
let sharedCsvCache: CsvDataSet | null = null;
let sharedIsLoaded = false;

const IDB_NAME = "tka-csv-cache";
const IDB_VERSION = 1;
const IDB_STORE = "csv-data";
const IDB_KEY = "pictograph-csv";

export class CsvLoader {
  async loadCSVFile(filename: string): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    source: "fetch" | "window" | "cache";
  }> {
    try {
      const csvData = await this.loadCsvData();

      if (filename.includes("Diamond") || filename.includes("diamond")) {
        return {
          success: true,
          data: csvData.diamondData,
          source: this.resolveSource(),
        };
      } else if (filename.includes("Box") || filename.includes("box")) {
        return {
          success: true,
          data: csvData.boxData,
          source: this.resolveSource(),
        };
      } else if (filename.includes("Skewed") || filename.includes("skewed")) {
        return {
          success: true,
          data: csvData.skewedData || "",
          source: this.resolveSource(),
        };
      } else if (filename.includes("Trigrid") || filename.includes("trigrid")) {
        return {
          success: true,
          data: csvData.trigridData || "",
          source: this.resolveSource(),
        };
      } else {
        return {
          success: false,
          error: `Unknown file: ${filename}`,
          source: "fetch",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        source: "fetch",
      };
    }
  }

  async loadCSVDataSet(): Promise<{
    success: boolean;
    data?: { diamondData: string; boxData: string; skewedData?: string; trigridData?: string };
    error?: string;
    sources: {
      diamond: "fetch" | "window" | "cache";
      box: "fetch" | "window" | "cache";
    };
  }> {
    try {
      const csvData = await this.loadCsvData();
      const source = this.resolveSource();
      return {
        success: true,
        data: csvData,
        sources: { diamond: source, box: source },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        sources: { diamond: "fetch", box: "fetch" },
      };
    }
  }

  async loadCSVForGridMode(gridMode: GridMode): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    source: "fetch" | "window" | "cache";
  }> {
    try {
      const csvData = await this.loadCsvData();

      let data: string;
      if (gridMode === GridMode.DIAMOND) {
        data = csvData.diamondData;
      } else if (gridMode === GridMode.BOX) {
        data = csvData.boxData;
      } else if (gridMode === GridMode.SKEWED) {
        data = csvData.skewedData || csvData.diamondData;
      } else if (gridMode === GridMode.TRIGRID) {
        data = csvData.trigridData || "";
      } else {
        return {
          success: false,
          error: `Unknown grid mode: ${gridMode}`,
          source: "fetch",
        };
      }

      return { success: true, data, source: this.resolveSource() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        source: "fetch",
      };
    }
  }

  isDataCached(): boolean {
    return (
      (sharedIsLoaded && sharedCsvCache !== null) ||
      (this.isLoaded && this.csvData !== null)
    );
  }

  private static readonly CSV_FILES = {
    DIAMOND: "/data/pictographs/DiamondPictographDataframe.csv",
    BOX: "/data/pictographs/BoxPictographDataframe.csv",
    SKEWED: "/data/pictographs/SkewedPictographDataframe.csv",
    TRIGRID: "/data/pictographs/TrigridPictographDataframe.csv",
  } as const;

  private csvData: CsvDataSet | null = null;
  private isLoaded = false;
  private lastSource: "fetch" | "window" | "cache" = "fetch";

  /**
   * Loads CSV data with layered caching:
   * 1. In-memory (module-level shared cache)
   * 2. window.csvData pre-injection
   * 3. fetch() from static files
   * 4. IndexedDB persistent cache (offline fallback)
   *
   * On successful fetch, persists to IndexedDB for future offline use.
   */
  async loadCsvData(): Promise<CsvDataSet> {
    // Check module-level cache first (shared across all instances)
    if (sharedIsLoaded && sharedCsvCache) {
      this.csvData = sharedCsvCache;
      this.isLoaded = true;
      return sharedCsvCache;
    }

    // Check instance cache (for singleton usage)
    if (this.isLoaded && this.csvData) {
      return this.csvData;
    }

    // Try window pre-injection
    if (this.isWindowDataAvailable()) {
      const data = window.csvData as CsvDataSet;
      this.lastSource = "window";
      this.setMemoryCache(data);
      // Persist to IndexedDB in background (don't await)
      this.saveToIndexedDB(data);
      return data;
    }

    // Try fetch from static files
    try {
      const data = await this.loadFromStaticFiles();
      this.lastSource = "fetch";
      this.setMemoryCache(data);
      // Persist to IndexedDB in background for offline use
      this.saveToIndexedDB(data);
      return data;
    } catch (fetchError) {
      // Fetch failed - try IndexedDB offline cache
      try {
        const cached = await this.loadFromIndexedDB();
        if (cached) {
          console.info(
            "📦 CSV data loaded from offline cache (server unavailable)"
          );
          this.lastSource = "cache";
          this.setMemoryCache(cached);
          return cached;
        }
      } catch (idbError) {
        // IndexedDB also failed - nothing we can do
        console.error("IndexedDB fallback failed:", idbError);
      }

      // No data available from any source
      const message =
        fetchError instanceof Error ? fetchError.message : "Unknown error";
      console.error("Failed to load CSV data from all sources:", message);
      throw new Error(
        `CSV loading failed (offline with no cache): ${message}`
      );
    }
  }

  getCsvData(): CsvDataSet | null {
    return sharedCsvCache || this.csvData;
  }

  clearCache(): void {
    this.csvData = null;
    this.isLoaded = false;
    sharedCsvCache = null;
    sharedIsLoaded = false;
  }

  private setMemoryCache(data: CsvDataSet): void {
    sharedCsvCache = data;
    sharedIsLoaded = true;
    this.csvData = data;
    this.isLoaded = true;
  }

  private resolveSource(): "fetch" | "window" | "cache" {
    return this.lastSource;
  }

  private isWindowDataAvailable(): boolean {
    return window.csvData !== undefined && window.csvData !== null;
  }

  private async loadFromStaticFiles(): Promise<CsvDataSet> {
    const [diamondResponse, boxResponse, skewedResponse, trigridResponse] =
      await Promise.all([
        fetch(CsvLoader.CSV_FILES.DIAMOND),
        fetch(CsvLoader.CSV_FILES.BOX),
        fetch(CsvLoader.CSV_FILES.SKEWED).catch(() => null),
        fetch(CsvLoader.CSV_FILES.TRIGRID).catch(() => null),
      ]);

    this.validateResponses(diamondResponse, boxResponse);

    const [diamondData, boxData] = await Promise.all([
      diamondResponse.text(),
      boxResponse.text(),
    ]);

    let skewedData: string | undefined;
    if (skewedResponse?.ok) {
      skewedData = await skewedResponse.text();
    }

    let trigridData: string | undefined;
    if (trigridResponse?.ok) {
      trigridData = await trigridResponse.text();
    }

    return { diamondData, boxData, skewedData, trigridData };
  }

  private validateResponses(
    diamondResponse: Response,
    boxResponse: Response
  ): void {
    if (!diamondResponse.ok || !boxResponse.ok) {
      throw new Error(
        `HTTP error - Diamond: ${diamondResponse.status}, Box: ${boxResponse.status}`
      );
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveToIndexedDB(data: CsvDataSet): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);

      store.put(
        {
          diamondData: data.diamondData,
          boxData: data.boxData,
          skewedData: data.skewedData ?? "",
          trigridData: data.trigridData ?? "",
          savedAt: Date.now(),
        },
        IDB_KEY
      );

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      db.close();
    } catch {
      // Non-critical - silent fail. Offline cache is a convenience, not a requirement.
    }
  }

  private async loadFromIndexedDB(): Promise<CsvDataSet | null> {
    const db = await this.openDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const request = store.get(IDB_KEY);

    const result = await new Promise<CsvDataSet | null>((resolve, reject) => {
      request.onsuccess = () => {
        const record = request.result;
        if (
          record &&
          typeof record.diamondData === "string" &&
          typeof record.boxData === "string"
        ) {
          resolve({
            diamondData: record.diamondData,
            boxData: record.boxData,
            skewedData: record.skewedData || undefined,
            trigridData: record.trigridData || undefined,
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });

    db.close();
    return result;
  }
}

// Direct singleton export for HMR-friendly imports
export const csvLoader = new CsvLoader();
