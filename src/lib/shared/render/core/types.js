/**
 * Shared types for pictograph rendering calculations
 *
 * Uses string literal unions for cross-environment compatibility.
 * Both the browser app and Node.js MCP server can import these.
 */
/** Cardinal locations (diamond mode hand points) */
export const CARDINAL_LOCATIONS = new Set([
    "n",
    "e",
    "s",
    "w",
]);
/** Intercardinal locations (box mode hand points) */
export const INTERCARDINAL_LOCATIONS = new Set([
    "ne",
    "se",
    "sw",
    "nw",
]);
/**
 * Check if a location is cardinal (N/E/S/W)
 */
export function isCardinal(location) {
    return CARDINAL_LOCATIONS.has(location.toLowerCase());
}
