/**
 * Text Rendering Service
 *
 * Handles rendering of sequence titles, user info, and other text overlays
 * on exported images. Delegates header and footer rendering to
 * @tka/render-composition for cross-environment consistency.
 */

import type { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { IDimensionCalculator } from "../contracts/IDimensionCalculator";
import type { ILOOPIconStripRenderer } from "../contracts/ILOOPIconStripRenderer";
import type {
  TextRenderOptions,
  UserExportInfo,
} from "../../domain/models/SequenceExportOptions";
import type { ITextRenderer } from "../contracts/ITextRenderer";
import {
  DIFFICULTY_LEVELS,
  DEFAULT_DIFFICULTY_STYLE,
  DIFFICULTY_FONT_FAMILY,
  applyGradientStops,
} from "$lib/shared/config/difficulty-styles";
import { renderHeader, renderFooter, FOOTER_FONT_SCALE, type LOOPComponentId, type LoopRotationSliceSize } from "@tka/render-composition";

export class TextRenderer implements ITextRenderer {
  // Font configuration matching WordLabel component exactly
  private readonly titleFontFamily = "Georgia, serif"; // Matches WordLabel
  private readonly titleFontWeight = "600"; // Matches WordLabel
  private readonly fallbackFontFamily =
    "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  constructor(
    private dimensionService: IDimensionCalculator,
    private loopIconStripRenderer?: ILOOPIconStripRenderer
  ) {}

  /**
   * Render sequence word/title text at the top center of the canvas
   * @deprecated Use renderWordFooter instead for Browser Gallery style
   */
  renderWordText(
    canvas: HTMLCanvasElement,
    word: string,
    options: TextRenderOptions,
    stepCount: number = 3 // Default to 3+ steps scaling
  ): void {
    if (!word || word.trim() === "") {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // Get desktop-compatible font scaling based on beat count
    const scalingFactors =
      this.dimensionService.getTextScalingFactors(stepCount);

    // Calculate title area height (matches ImageComposer logic)
    // titleHeight is already scaled by stepScale internally
    const titleHeight = this.calculateTitleHeight(
      stepCount,
      options.stepScale || 1
    );
    // Apply font scaling factor - but NOT stepScale again since titleHeight is already scaled
    // Additional 0.7 multiplier to reduce overall font size for better visual balance
    const finalFontSize = titleHeight * scalingFactors.fontScale * 0.7;

    // Set font properties using Georgia serif font (matches WordLabel)
    ctx.font = `${this.titleFontWeight} ${finalFontSize}px ${this.titleFontFamily}`;
    ctx.fillStyle = "black"; // Matches WordLabel color
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Calculate positioning
    const centerX = canvas.width / 2;
    const centerY = titleHeight / 2;

    this.drawTitleBackground(ctx, canvas.width, titleHeight);

    // Set text color to dark gray for visibility
    ctx.fillStyle = "black";

    // Render the text
    ctx.fillText(word, centerX, centerY);
  }

  /**
   * Render word in a footer at the bottom of the canvas
   * Uses Browser Gallery style: color-coded gradient background based on difficulty level
   */
  renderWordFooter(
    canvas: HTMLCanvasElement,
    word: string,
    _options: TextRenderOptions,
    footerHeight: number,
    difficultyLevel: number = 1
  ): void {
    if (!word || word.trim() === "") {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // Get level style (gradient colors and text color) matching Browser Gallery
    const levelStyle = this.getLevelStyle(difficultyLevel);

    // Calculate footer position (at the bottom of the canvas)
    const footerY = canvas.height - footerHeight;

    // Draw gradient background
    this.drawFooterGradient(
      ctx,
      0,
      footerY,
      canvas.width,
      footerHeight,
      levelStyle
    );

    // Calculate font size based on footer height (larger, bolder text)
    const finalFontSize = footerHeight * FOOTER_FONT_SCALE;

    // Set font properties - bold weight for emphasis
    ctx.font = `700 ${finalFontSize}px ${this.titleFontFamily}`;
    ctx.fillStyle = levelStyle.textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Calculate positioning (centered in footer)
    const centerX = canvas.width / 2;
    const centerY = footerY + footerHeight / 2;

    // Render the text
    ctx.fillText(word, centerX, centerY);
  }

  /**
   * Render word in a header at the top of the canvas.
   * Delegates to @tka/render-composition's renderHeader for cross-environment
   * consistency (same output as MCP server).
   */
  renderWordHeader(
    canvas: HTMLCanvasElement,
    word: string,
    _options: TextRenderOptions,
    headerHeight: number,
    difficultyLevel: number = 1,
    showDifficultyBadge: boolean = true,
    darkMode: boolean = false,
    loopComponents?: Set<LOOPComponent>,
    backgroundColor?: string,
    borderColor?: string,
    rotationSliceSize?: LoopRotationSliceSize
  ): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // Convert app enum Set to package string Set
    let packageComponents: Set<LOOPComponentId> | undefined;
    if (loopComponents && loopComponents.size > 0) {
      packageComponents = new Set<LOOPComponentId>();
      for (const c of loopComponents) {
        packageComponents.add(c as unknown as LOOPComponentId);
      }
    }

    renderHeader(ctx, {
      canvasWidth: canvas.width,
      headerHeight,
      word: word ?? "",
      difficultyLevel,
      showDifficultyBadge,
      loopComponents: packageComponents,
      rotationSliceSize,
      darkMode,
      backgroundColor,
      borderColor,
    });
  }

  /**
   * Render user information at the bottom of the canvas.
   * Delegates to @tka/render-composition's renderFooter for cross-environment
   * consistency (same output as MCP server).
   */
  renderUserInfo(
    canvas: HTMLCanvasElement,
    userInfo: UserExportInfo,
    _options: TextRenderOptions,
    footerHeight: number = 60,
    _beatCount: number = 3,
    darkMode: boolean = false,
    showFlags?: {
      showCreatorName?: boolean;
      showNotes?: boolean;
      showBirthday?: boolean;
    },
    customNotesText?: string,
    backgroundColor?: string,
    borderColor?: string,
    leftLabel?: string,
    elementIcon?: CanvasImageSource
  ): void {
    const showCreatorName = showFlags?.showCreatorName ?? true;
    const showNotes = showFlags?.showNotes ?? true;
    const showBirthday = showFlags?.showBirthday ?? true;

    if (!showCreatorName && !showNotes && !showBirthday) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resolve the notes text (custom > userInfo.notes > default)
    const notes =
      customNotesText && customNotesText.trim() !== ""
        ? customNotesText
        : userInfo.notes && userInfo.notes.trim() !== ""
          ? userInfo.notes
          : undefined; // package will default to "The Kinetic Alphabet"

    // Resolve the date to display
    const birthday = userInfo.birthday
      ? userInfo.birthday
      : userInfo.exportDate
        ? new Date(userInfo.exportDate)
        : undefined;

    renderFooter(ctx, {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      footerHeight,
      userName: userInfo.userName,
      notes,
      birthday,
      darkMode,
      showCreatorName,
      showNotes,
      showBirthday,
      backgroundColor,
      borderColor,
      leftLabel,
      elementIcon,
    });
  }

  /**
   * Render difficulty level badge with beautiful gradients
   */
  renderDifficultyBadge(
    canvas: HTMLCanvasElement,
    level: number,
    position: [number, number],
    size: number
  ): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const [x, y] = position;
    const radius = size / 2;
    const centerX = x + radius;
    const centerY = y + radius;

    // Create gradient based on difficulty level
    const gradient = this.createDifficultyGradient(
      ctx,
      centerX,
      centerY,
      radius,
      level
    );

    // Draw badge background with gradient
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw badge border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw level text
    ctx.fillStyle = "#000000"; // Black text for better contrast on gradients
    ctx.font = `bold ${size * 0.6}px ${this.fallbackFontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(level.toString(), centerX, centerY);
  }

  /**
   * Calculate text dimensions for layout planning
   */
  measureText(
    text: string,
    fontFamily: string,
    fontSize: number,
    fontWeight?: string
  ): { width: number; height: number } {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return { width: 0, height: 0 };

    ctx.font = `${fontWeight || "normal"} ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);

    return {
      width: metrics.width,
      height: fontSize, // Approximate height
    };
  }

  /**
   * Apply custom kerning to text
   */
  renderTextWithKerning(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    kerning: number
  ): void {
    if (kerning === 0) {
      ctx.fillText(text, x, y);
      return;
    }

    let currentX = x;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (!char) continue; // Skip if char is undefined
      ctx.fillText(char, currentX, y);

      const charWidth = ctx.measureText(char).width;
      currentX += charWidth + kerning;
    }
  }

  /**
   * Draw subtle background behind title text
   */
  private drawTitleBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    // Very subtle white background
    ctx.fillStyle = "rgba(235, 235, 235, 0.98)";
    ctx.fillRect(0, 0, width, height);

    // Very subtle bottom border
    ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 1);
    ctx.lineTo(width, height - 1);
    ctx.stroke();
  }

  /**
   * Get level style (colors) matching Browser Gallery SequenceCard
   * 1=white, 2=silver, 3=gold, 4=red, 5=purple
   */
  private getLevelStyle(level: number): {
    background: string[];
    textColor: string;
  } {
    const levelStyles: Record<
      number,
      { background: string[]; textColor: string }
    > = {
      1: {
        // White - Beginner
        background: [
          "rgba(255, 255, 255, 0.98)",
          "rgba(250, 250, 250, 0.95)",
          "rgba(245, 245, 245, 0.92)",
          "rgba(235, 235, 235, 0.9)",
        ],
        textColor: "#1f2937",
      },
      2: {
        // Silver - Intermediate
        background: [
          "rgba(220, 220, 225, 0.98)",
          "rgba(192, 192, 200, 0.95)",
          "rgba(169, 169, 180, 0.92)",
          "rgba(140, 140, 155, 0.9)",
        ],
        textColor: "#1f2937",
      },
      3: {
        // Gold - Advanced
        background: [
          "rgba(255, 215, 0, 0.98)",
          "rgba(238, 201, 0, 0.95)",
          "rgba(218, 165, 32, 0.92)",
          "rgba(184, 134, 11, 0.9)",
        ],
        textColor: "#1f2937",
      },
      4: {
        // Red - Expert
        background: [
          "rgba(255, 120, 120, 0.98)",
          "rgba(239, 68, 68, 0.95)",
          "rgba(220, 38, 38, 0.92)",
          "rgba(185, 28, 28, 0.9)",
        ],
        textColor: "#ffffff",
      },
      5: {
        // Purple - Legendary
        background: [
          "rgba(216, 180, 254, 0.98)",
          "rgba(168, 85, 247, 0.95)",
          "rgba(147, 51, 234, 0.92)",
          "rgba(126, 34, 206, 0.9)",
        ],
        textColor: "#ffffff",
      },
    };

    const defaultStyle = {
      background: ["#374151", "#1f2937", "#111827", "#0f0f0f"],
      textColor: "#f8fafc",
    };

    return levelStyles[level] ?? defaultStyle;
  }

  /**
   * Draw gradient background for footer
   */
  private drawFooterGradient(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    levelStyle: { background: string[]; textColor: string }
  ): void {
    // Create linear gradient at 135 degrees (matching CSS gradient)
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);

    // Add color stops matching the Browser Gallery CSS gradients
    gradient.addColorStop(0, levelStyle.background[0] ?? "#374151");
    gradient.addColorStop(0.3, levelStyle.background[1] ?? "#1f2937");
    gradient.addColorStop(0.6, levelStyle.background[2] ?? "#111827");
    gradient.addColorStop(1, levelStyle.background[3] ?? "#0f0f0f");

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  }

  /**
   * Calculate title height based on beat count (matches desktop logic)
   */
  private calculateTitleHeight(stepCount: number, stepScale: number): number {
    let baseHeight = 0;

    // Match desktop logic exactly based on beat count
    if (stepCount === 0) {
      baseHeight = 0;
    } else if (stepCount === 1) {
      baseHeight = 150;
    } else if (stepCount === 2) {
      baseHeight = 200;
    } else {
      // stepCount >= 3
      baseHeight = 300;
    }

    // Apply beat scale
    return Math.floor(baseHeight * stepScale);
  }

  /**
   * Create beautiful gradient for difficulty level badge
   * Based on legacy desktop gradient definitions
   */
  private createDifficultyGradient(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    level: number
  ): CanvasGradient {
    // Create radial gradient from center to edge
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      radius
    );

    if (level <= 2) {
      // Beginner - Light gray (solid color, matches desktop)
      gradient.addColorStop(0, "rgb(245, 245, 245)");
      gradient.addColorStop(1, "rgb(225, 225, 225)");
    } else if (level <= 4) {
      // Intermediate - Gray gradient (matches desktop)
      gradient.addColorStop(0, "rgb(180, 180, 180)");
      gradient.addColorStop(0.3, "rgb(170, 170, 170)");
      gradient.addColorStop(0.6, "rgb(120, 120, 120)");
      gradient.addColorStop(1, "rgb(110, 110, 110)");
    } else {
      // Advanced - Gold/brown gradient (matches desktop)
      gradient.addColorStop(0, "rgb(255, 215, 0)");
      gradient.addColorStop(0.2, "rgb(238, 201, 0)");
      gradient.addColorStop(0.4, "rgb(218, 165, 32)");
      gradient.addColorStop(0.6, "rgb(184, 134, 11)");
      gradient.addColorStop(0.8, "rgb(139, 69, 19)");
      gradient.addColorStop(1, "rgb(85, 107, 47)");
    }

    return gradient;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { dimensionCalculator } from "./DimensionCalculator";
import { loopIconStripRenderer } from "./LOOPIconStripRenderer";

export const textRenderer = new TextRenderer(
  dimensionCalculator,
  loopIconStripRenderer
);
