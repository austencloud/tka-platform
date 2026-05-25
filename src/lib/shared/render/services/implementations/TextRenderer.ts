import type { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { getTextScalingFactors } from "../dimension-calculator";
import type {
  TextRenderOptions,
  UserExportInfo,
} from "../../domain/models/SequenceExportOptions";
import {
  renderHeader,
  renderFooter,
  loadFooterIcon,
  FOOTER_FONT_SCALE,
  type LOOPComponentId,
  type LoopRotationPeriod,
  type LoopInversionPeriod,
  type GlyphImageData,
  type CompressedSegment,
} from "@tka/render-composition";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
// getGlyphCache loaded dynamically to avoid pulling $app/environment into worker bundle
import { tokenizeWord } from "$lib/shared/pictograph/tka-glyph/utils/word-tokenizer";
import { compressWord } from "$lib/shared/foundation/utils/word-simplifier";
import { createRenderCanvas } from "./createRenderCanvas";
import type { RenderCanvas } from "../contracts/types";

export class TextRenderer {
  private readonly titleFontFamily = "Georgia, serif";
  private readonly titleFontWeight = "600";
  private readonly fallbackFontFamily =
    "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  constructor() {}

  private glyphImageCache = new Map<string, GlyphImageData>();

  async preloadGlyphImages(): Promise<void> {
    if (this.glyphImageCache.size > 0) return;
    const { getGlyphCache } = await import("$lib/shared/render/getGlyphCache");
    const cache = getGlyphCache();
    await cache.initialize();

    const letters = Object.values(Letter);
    await Promise.all(
      letters.map((letter) => {
        const dataUrl = cache.getGlyphDataUrl(letter);
        if (!dataUrl) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 3000);
          const img = new Image();
          img.onload = () => {
            clearTimeout(timer);
            this.glyphImageCache.set(letter, {
              image: img,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              isDash: letter.endsWith("-"),
            });
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timer);
            resolve();
          };
          img.src = dataUrl;
        });
      })
    );
  }

  buildGlyphMap(word: string): Map<string, GlyphImageData> {
    if (!word || this.glyphImageCache.size === 0) {
      return new Map();
    }
    const tokens = tokenizeWord(word);
    const result = new Map<string, GlyphImageData>();
    for (const token of tokens) {
      const data = this.glyphImageCache.get(token);
      if (data) result.set(token, data);
    }
    return result;
  }

  setGlyphBitmaps(
    entries: {
      letter: string;
      bitmap: ImageBitmap;
      naturalWidth: number;
      naturalHeight: number;
      isDash: boolean;
    }[]
  ): void {
    this.glyphImageCache.clear();
    for (const entry of entries) {
      this.glyphImageCache.set(entry.letter, {
        image: entry.bitmap,
        naturalWidth: entry.naturalWidth,
        naturalHeight: entry.naturalHeight,
        isDash: entry.isDash,
      });
    }
  }

  getGlyphCache(): Map<string, GlyphImageData> {
    return this.glyphImageCache;
  }

  renderWordText(
    canvas: RenderCanvas,
    word: string,
    options: TextRenderOptions,
    stepCount: number = 3
  ): void {
    if (!word || word.trim() === "") {
      return;
    }

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) {
      return;
    }

    const scalingFactors =
      getTextScalingFactors(stepCount);

    const titleHeight = this.calculateTitleHeight(
      stepCount,
      options.stepScale || 1
    );
    const finalFontSize = titleHeight * scalingFactors.fontScale * 0.7;

    ctx.font = `${this.titleFontWeight} ${finalFontSize}px ${this.titleFontFamily}`;
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = canvas.width / 2;
    const centerY = titleHeight / 2;

    this.drawTitleBackground(ctx, canvas.width, titleHeight);

    ctx.fillStyle = "black";

    ctx.fillText(word, centerX, centerY);
  }

  renderWordFooter(
    canvas: RenderCanvas,
    word: string,
    _options: TextRenderOptions,
    footerHeight: number,
    difficultyLevel: number = 1
  ): void {
    if (!word || word.trim() === "") {
      return;
    }

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) {
      return;
    }

    const levelStyle = this.getLevelStyle(difficultyLevel);

    const footerY = canvas.height - footerHeight;

    this.drawFooterGradient(
      ctx,
      0,
      footerY,
      canvas.width,
      footerHeight,
      levelStyle
    );

    const finalFontSize = footerHeight * FOOTER_FONT_SCALE;

    ctx.font = `700 ${finalFontSize}px ${this.titleFontFamily}`;
    ctx.fillStyle = levelStyle.textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = canvas.width / 2;
    const centerY = footerY + footerHeight / 2;

    ctx.fillText(word, centerX, centerY);
  }

  renderWordHeader(
    canvas: RenderCanvas,
    word: string,
    _options: TextRenderOptions,
    headerHeight: number,
    difficultyLevel: number = 1,
    showDifficultyBadge: boolean = true,
    darkMode: boolean = false,
    loopComponents?: Set<LOOPComponent>,
    backgroundColor?: string,
    borderColor?: string,
    rotationPeriod?: LoopRotationPeriod,
    inversionPeriod?: LoopInversionPeriod,
    period?: number
  ): void {
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) {
      return;
    }

    let packageComponents: Set<LOOPComponentId> | undefined;
    if (loopComponents && loopComponents.size > 0) {
      packageComponents = new Set<LOOPComponentId>();
      for (const c of loopComponents) {
        packageComponents.add(c as unknown as LOOPComponentId);
      }
    }

    const glyphImages = this.buildGlyphMap(word ?? "");
    const segments = word ? compressWord(word) : undefined;
    const hasCompression =
      segments?.some((s: CompressedSegment) => s.repeat > 1);

    renderHeader(ctx, {
      canvasWidth: canvas.width,
      headerHeight,
      word: word ?? "",
      difficultyLevel,
      showDifficultyBadge,
      loopComponents: packageComponents,
      rotationPeriod,
      inversionPeriod,
      period,
      darkMode,
      backgroundColor,
      borderColor,
      glyphImages: glyphImages.size > 0 ? glyphImages : undefined,
      compressedSegments: hasCompression ? segments : undefined,
    });
  }

  async renderUserInfo(
    canvas: RenderCanvas,
    userInfo: UserExportInfo,
    _options: TextRenderOptions,
    footerHeight: number = 60,
    _stepCount: number = 3,
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
    rightLabel?: string,
    iconPath?: string,
  ): Promise<void> {
    const showCreatorName = showFlags?.showCreatorName ?? true;
    const showNotes = showFlags?.showNotes ?? true;
    const showBirthday = showFlags?.showBirthday ?? true;

    if (!showCreatorName && !showNotes && !showBirthday && !iconPath) {
      return;
    }

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return;

    const notes =
      customNotesText && customNotesText.trim() !== ""
        ? customNotesText
        : userInfo.notes && userInfo.notes.trim() !== ""
          ? userInfo.notes
          : undefined;

    const birthday = userInfo.birthday
      ? userInfo.birthday
      : userInfo.exportDate
        ? new Date(userInfo.exportDate)
        : undefined;

    const iconImage = iconPath ? await loadFooterIcon(iconPath) : undefined;

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
      rightLabel,
      iconPath,
      iconImage,
    });
  }

  renderDifficultyBadge(
    canvas: RenderCanvas,
    level: number,
    position: [number, number],
    size: number
  ): void {
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return;

    const [x, y] = position;
    const radius = size / 2;
    const centerX = x + radius;
    const centerY = y + radius;

    const gradient = this.createDifficultyGradient(
      ctx,
      centerX,
      centerY,
      radius,
      level
    );

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#000000";
    ctx.font = `bold ${size * 0.6}px ${this.fallbackFontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(level.toString(), centerX, centerY);
  }

  measureText(
    text: string,
    fontFamily: string,
    fontSize: number,
    fontWeight?: string
  ): { width: number; height: number } {
    const canvas = createRenderCanvas(0, 0);
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return { width: 0, height: 0 };

    ctx.font = `${fontWeight || "normal"} ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);

    return {
      width: metrics.width,
      height: fontSize,
    };
  }

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
      if (!char) continue;
      ctx.fillText(char, currentX, y);

      const charWidth = ctx.measureText(char).width;
      currentX += charWidth + kerning;
    }
  }

  private drawTitleBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    ctx.fillStyle = "rgba(235, 235, 235, 0.98)";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 1);
    ctx.lineTo(width, height - 1);
    ctx.stroke();
  }

  private getLevelStyle(level: number): {
    background: string[];
    textColor: string;
  } {
    const levelStyles: Record<
      number,
      { background: string[]; textColor: string }
    > = {
      1: {
        background: [
          "rgba(255, 255, 255, 0.98)",
          "rgba(250, 250, 250, 0.95)",
          "rgba(245, 245, 245, 0.92)",
          "rgba(235, 235, 235, 0.9)",
        ],
        textColor: "#1f2937",
      },
      2: {
        background: [
          "rgba(220, 220, 225, 0.98)",
          "rgba(192, 192, 200, 0.95)",
          "rgba(169, 169, 180, 0.92)",
          "rgba(140, 140, 155, 0.9)",
        ],
        textColor: "#1f2937",
      },
      3: {
        background: [
          "rgba(255, 215, 0, 0.98)",
          "rgba(238, 201, 0, 0.95)",
          "rgba(218, 165, 32, 0.92)",
          "rgba(184, 134, 11, 0.9)",
        ],
        textColor: "#1f2937",
      },
      4: {
        background: [
          "rgba(255, 120, 120, 0.98)",
          "rgba(239, 68, 68, 0.95)",
          "rgba(220, 38, 38, 0.92)",
          "rgba(185, 28, 28, 0.9)",
        ],
        textColor: "#ffffff",
      },
      5: {
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

  private drawFooterGradient(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    levelStyle: { background: string[]; textColor: string }
  ): void {
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);

    gradient.addColorStop(0, levelStyle.background[0] ?? "#374151");
    gradient.addColorStop(0.3, levelStyle.background[1] ?? "#1f2937");
    gradient.addColorStop(0.6, levelStyle.background[2] ?? "#111827");
    gradient.addColorStop(1, levelStyle.background[3] ?? "#0f0f0f");

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  }

  private calculateTitleHeight(stepCount: number, stepScale: number): number {
    let baseHeight = 0;

    if (stepCount === 0) {
      baseHeight = 0;
    } else if (stepCount === 1) {
      baseHeight = 150;
    } else if (stepCount === 2) {
      baseHeight = 200;
    } else {
      baseHeight = 300;
    }

    return Math.floor(baseHeight * stepScale);
  }

  private createDifficultyGradient(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    level: number
  ): CanvasGradient {
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      radius
    );

    if (level <= 2) {
      gradient.addColorStop(0, "rgb(245, 245, 245)");
      gradient.addColorStop(1, "rgb(225, 225, 225)");
    } else if (level <= 4) {
      gradient.addColorStop(0, "rgb(180, 180, 180)");
      gradient.addColorStop(0.3, "rgb(170, 170, 170)");
      gradient.addColorStop(0.6, "rgb(120, 120, 120)");
      gradient.addColorStop(1, "rgb(110, 110, 110)");
    } else {
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

export const textRenderer = new TextRenderer();
