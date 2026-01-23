/**
 * Connection Quality Detection Utility
 *
 * Detects network connection quality and provides optimized loading strategies
 * for different connection types (2G, 3G, 4G, WiFi, etc.)
 */

export type ConnectionQuality = "slow" | "medium" | "fast";
export type EffectiveType = "slow-2g" | "2g" | "3g" | "4g";

export interface ConnectionInfo {
  quality: ConnectionQuality;
  effectiveType?: EffectiveType;
  saveData: boolean;
  downlink?: number; // Mbps
  rtt?: number; // Round-trip time in ms
}

export interface LoadingStrategy {
  initialPageSize: number;
  scrollPageSize: number;
  preloadCount: number;
  enablePreload: boolean;
  imageQuality: "low" | "medium" | "high";
}

// Extended navigator type for Network Information API
interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: EffectiveType;
    saveData?: boolean;
    downlink?: number;
    rtt?: number;
    addEventListener: (event: string, handler: () => void) => void;
    removeEventListener: (event: string, handler: () => void) => void;
  };
  mozConnection?: NavigatorWithConnection["connection"];
  webkitConnection?: NavigatorWithConnection["connection"];
}

/**
 * Get current connection information
 */
export function getConnectionInfo(): ConnectionInfo {
  // Check if Network Information API is available
  const nav = navigator as NavigatorWithConnection;
  const connection =
    nav.connection || nav.mozConnection || nav.webkitConnection;

  const saveData = connection?.saveData || false;
  const effectiveType = connection?.effectiveType as EffectiveType | undefined;
  const downlink = connection?.downlink; // Mbps
  const rtt = connection?.rtt; // ms

  // Determine quality based on effective type and save data preference
  let quality: ConnectionQuality = "fast";

  if (saveData) {
    quality = "slow";
  } else if (effectiveType) {
    if (effectiveType === "slow-2g" || effectiveType === "2g") {
      quality = "slow";
    } else if (effectiveType === "3g") {
      quality = "medium";
    } else {
      quality = "fast";
    }
  } else if (downlink !== undefined) {
    // Fallback to downlink speed
    if (downlink < 1) {
      quality = "slow";
    } else if (downlink < 5) {
      quality = "medium";
    } else {
      quality = "fast";
    }
  }

  return {
    quality,
    ...(effectiveType && { effectiveType }),
    saveData,
    ...(downlink !== undefined && { downlink }),
    ...(rtt !== undefined && { rtt }),
  };
}

/**
 * Get optimized loading strategy based on connection quality
 */
export function getLoadingStrategy(
  connectionInfo?: ConnectionInfo
): LoadingStrategy {
  const info = connectionInfo || getConnectionInfo();

  switch (info.quality) {
    case "slow":
      return {
        initialPageSize: 8,
        scrollPageSize: 12,
        preloadCount: 2,
        enablePreload: false,
        imageQuality: "low",
      };
    case "medium":
      return {
        initialPageSize: 12,
        scrollPageSize: 16,
        preloadCount: 4,
        enablePreload: true,
        imageQuality: "medium",
      };
    case "fast":
    default:
      return {
        initialPageSize: 20,
        scrollPageSize: 20,
        preloadCount: 8,
        enablePreload: true,
        imageQuality: "high",
      };
  }
}

/**
 * Listen for connection changes
 */
export function onConnectionChange(
  callback: (info: ConnectionInfo) => void
): () => void {
  const nav = navigator as NavigatorWithConnection;
  const connection =
    nav.connection || nav.mozConnection || nav.webkitConnection;

  if (!connection) {
    // No support for Network Information API
    return () => {};
  }

  const handler = () => {
    callback(getConnectionInfo());
  };

  connection.addEventListener("change", handler);

  return () => {
    connection.removeEventListener("change", handler);
  };
}

/**
 * Log connection info for debugging
 */
export function logConnectionInfo(): void {
  // Connection info logging disabled for production
}
