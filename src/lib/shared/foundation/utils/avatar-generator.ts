/**
 * Generates an avatar SVG data URL from a display name
 * @param name - The user's display name
 * @param size - Size in pixels (default: 64)
 * @returns SVG data URL
 */
export function generateAvatarUrl(
  name: string | undefined | null,
  size: number = 64
): string {
  // Handle undefined/null names
  const displayName = name || "Anonymous";

  // Extract initials (first letter of first two words)
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");

  // Generate consistent color from name
  const backgroundColor = generateColorFromString(displayName);
  const textColor = "#ffffff";

  // Create SVG
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${backgroundColor}" />
      <text
        x="50%"
        y="50%"
        dominant-baseline="central"
        text-anchor="middle"
        fill="${textColor}"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${size * 0.4}"
        font-weight="500"
      >${initials}</text>
    </svg>
  `.trim();

  // Encode to data URL
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Generates a consistent hex color from a string
 */
function generateColorFromString(str: string): string {
  // Hash the string
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate vibrant color (avoid too dark/light)
  const h = Math.abs(hash % 360);
  const s = 65 + (Math.abs(hash) % 20); // 65-85% saturation
  const l = 45 + (Math.abs(hash >> 8) % 15); // 45-60% lightness

  return hslToHex(h, s, l);
}

/**
 * Converts HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  const sDecimal = s / 100;
  const lDecimal = l / 100;

  const c = (1 - Math.abs(2 * lDecimal - 1)) * sDecimal;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lDecimal - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
