export interface MutableRgb {
  red: number;
  green: number;
  blue: number;
}

export function setRgbFromHex(target: MutableRgb, hex: string): void {
  const raw = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
  if (raw.length === 3) {
    target.red = parseInt(raw[0]! + raw[0]!, 16) / 255;
    target.green = parseInt(raw[1]! + raw[1]!, 16) / 255;
    target.blue = parseInt(raw[2]! + raw[2]!, 16) / 255;
    return;
  }
  const normalized = raw.length >= 6 ? raw : "ffffff";
  target.red = parseInt(normalized.slice(0, 2), 16) / 255;
  target.green = parseInt(normalized.slice(2, 4), 16) / 255;
  target.blue = parseInt(normalized.slice(4, 6), 16) / 255;
}

export function setRgbFromHsl(
  target: MutableRgb,
  hueDegrees: number,
  saturation: number,
  lightness: number
): void {
  const hue = (((hueDegrees % 360) + 360) % 360) / 360;
  if (saturation === 0) {
    target.red = lightness;
    target.green = lightness;
    target.blue = lightness;
    return;
  }
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  target.red = hueChannel(p, q, hue + 1 / 3);
  target.green = hueChannel(p, q, hue);
  target.blue = hueChannel(p, q, hue - 1 / 3);
}

function hueChannel(p: number, q: number, raw: number): number {
  let t = raw;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
