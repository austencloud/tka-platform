import { injectable } from "inversify";
import type { IColorCalculator } from "../contracts/IColorCalculator";

/**
 * Color manipulation utilities for fish rendering.
 * Extracted from FishRenderer to follow single-responsibility principle.
 */
@injectable()
export class ColorCalculator implements IColorCalculator {
  adjustAlpha(color: string, alpha: number): string {
    // Handle rgba
    if (color.startsWith("rgba")) {
      return color.replace(/[\d.]+\)$/, `${alpha})`);
    }

    // Handle hex
    const rgb = this.hexToRgb(color);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  adjustBrightness(color: string, amount: number): string {
    const rgb = this.hexToRgb(color);
    const r = Math.max(0, Math.min(255, rgb.r + amount));
    const g = Math.max(0, Math.min(255, rgb.g + amount));
    const b = Math.max(0, Math.min(255, rgb.b + amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  blendColors(color1: string, color2: string, ratio: number): string {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);

    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * ratio);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * ratio);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * ratio);

    return `rgb(${r}, ${g}, ${b})`;
  }

  shiftHue(color: string, degrees: number): string {
    const rgb = this.hexToRgb(color);

    // Convert RGB to HSL
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    let h = 0;
    let s = 0;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    // Shift hue
    h = (h + degrees / 360) % 1;
    if (h < 0) h += 1;

    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  }

  hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Handle rgba format
    if (hex.startsWith("rgba")) {
      const match = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        return {
          r: parseInt(match[1]!, 10),
          g: parseInt(match[2]!, 10),
          b: parseInt(match[3]!, 10),
        };
      }
    }

    // Handle rgb format
    if (hex.startsWith("rgb")) {
      const match = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        return {
          r: parseInt(match[1]!, 10),
          g: parseInt(match[2]!, 10),
          b: parseInt(match[3]!, 10),
        };
      }
    }

    // Handle hex format
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1]!, 16),
          g: parseInt(result[2]!, 16),
          b: parseInt(result[3]!, 16),
        }
      : { r: 100, g: 150, b: 200 };
  }
}
