/**
 * Image Quality Utilities
 *
 * 🚀 PERFORMANCE: Adapts image quality based on network conditions
 * to provide optimal loading experience.
 */

export type ConnectionQuality = "fast" | "medium" | "slow" | "offline";

export interface ConnectionInfo {
  quality: ConnectionQuality;
  saveData: boolean;
  effectiveType?: string;
  downlink?: number;
}

/**
 * Get current connection information
 * Uses Network Information API when available
 */
export function getConnectionInfo(): ConnectionInfo {
  if (typeof navigator === "undefined") {
    return { quality: "fast", saveData: false };
  }

  // Check for Network Information API
  const connection = (
    navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        saveData?: boolean;
        downlink?: number;
      };
    }
  ).connection;

  if (!connection) {
    return { quality: "fast", saveData: false };
  }

  const saveData = connection.saveData ?? false;
  const effectiveType = connection.effectiveType ?? "4g";
  const downlink = connection.downlink;

  // Determine quality based on connection type
  let quality: ConnectionQuality = "fast";

  if (saveData) {
    quality = "slow";
  } else if (effectiveType === "slow-2g" || effectiveType === "2g") {
    quality = "slow";
  } else if (effectiveType === "3g") {
    quality = "medium";
  } else if (downlink && downlink < 1) {
    quality = "slow";
  } else if (downlink && downlink < 5) {
    quality = "medium";
  }

  return {
    quality,
    saveData,
    effectiveType,
    downlink,
  };
}

/**
 * Get appropriate image variant based on connection quality
 */
export function getImageVariantForConnection(
  baseUrl: string | undefined,
  connectionQuality: ConnectionQuality = "fast"
): string | undefined {
  if (!baseUrl) return undefined;

  const extIndex = baseUrl.lastIndexOf(".");
  if (extIndex === -1) return baseUrl;

  const baseName = baseUrl.slice(0, extIndex);
  const extension = baseUrl.slice(extIndex);

  switch (connectionQuality) {
    case "slow":
    case "offline":
      return `${baseName}_small${extension}`;
    case "medium":
      return `${baseName}_medium${extension}`;
    case "fast":
    default:
      return baseUrl;
  }
}

/**
 * Get maximum image size to load based on connection
 */
export function getMaxImageWidth(connectionQuality: ConnectionQuality): number {
  switch (connectionQuality) {
    case "slow":
    case "offline":
      return 300;
    case "medium":
      return 600;
    case "fast":
    default:
      return 1200;
  }
}

/**
 * Check if reduced data usage is preferred
 */
export function prefersReducedData(): boolean {
  if (typeof navigator === "undefined") return false;

  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean };
    }
  ).connection;

  return connection?.saveData ?? false;
}

/**
 * Subscribe to connection changes
 * Returns cleanup function
 */
export function onConnectionChange(
  callback: (info: ConnectionInfo) => void
): () => void {
  if (typeof navigator === "undefined") return () => {};

  const connection = (
    navigator as Navigator & {
      connection?: EventTarget & {
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      };
    }
  ).connection;

  if (!connection) return () => {};

  const handler = () => callback(getConnectionInfo());
  connection.addEventListener("change", handler);

  return () => connection.removeEventListener("change", handler);
}
