import {
  FOOTER_FONT_SCALE, FOOTER_MARGIN_SCALE, FOOTER_TEXT_Y_SCALE,
} from "./dimensions.js";

export interface FooterOptions {
  canvasWidth: number;
  canvasHeight: number;
  footerHeight: number;
  userName?: string;
  notes?: string;
  birthday?: Date;
  darkMode?: boolean;
  showCreatorName?: boolean;
  showNotes?: boolean;
  showBirthday?: boolean;
  /** Override footer background color */
  backgroundColor?: string;
  /** Override footer border color */
  borderColor?: string;
}

export function renderFooter(ctx: CanvasRenderingContext2D, options: FooterOptions): void {
  const {
    canvasWidth, canvasHeight, footerHeight,
    userName, notes, birthday,
    darkMode = true,
    showCreatorName = true, showNotes = true, showBirthday = true,
    backgroundColor, borderColor,
  } = options;

  const footerTop = canvasHeight - footerHeight;

  // Background
  ctx.fillStyle = backgroundColor ?? (darkMode ? "rgba(10, 10, 15, 0.98)" : "rgba(245, 245, 245, 0.98)");
  ctx.fillRect(0, footerTop, canvasWidth, footerHeight);

  // Top border
  ctx.strokeStyle = borderColor ?? (darkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)");
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerTop + 0.5);
  ctx.lineTo(canvasWidth, footerTop + 0.5);
  ctx.stroke();

  const fontSize = Math.max(10, Math.floor(footerHeight * FOOTER_FONT_SCALE));
  const margin = Math.max(8, Math.floor(footerHeight * FOOTER_MARGIN_SCALE));
  const yPosition = footerTop + footerHeight * FOOTER_TEXT_Y_SCALE;
  ctx.fillStyle = darkMode ? "#ffffff" : "black";
  ctx.textBaseline = "middle";

  // Left: username (bold)
  if (showCreatorName && userName?.trim()) {
    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.textAlign = "left";
    ctx.fillText(userName, margin, yPosition);
  }

  // Right: date (manual formatting — no Intl.DateTimeFormat for cross-env consistency)
  if (showBirthday) {
    const dateToUse = birthday || new Date();
    const month = dateToUse.getMonth() + 1;
    const day = dateToUse.getDate();
    const year = dateToUse.getFullYear();
    const formatted = `${month}-${day}-${year}`;
    const rightText = birthday ? `🎂 ${formatted}` : formatted;

    ctx.font = `${fontSize}px Georgia, serif`;
    ctx.textAlign = "right";
    ctx.fillText(rightText, canvasWidth - margin, yPosition);
  }

  // Center: notes
  if (showNotes) {
    const centerText = notes?.trim() || "Created using TKA Composer";
    ctx.font = `${fontSize}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(centerText, canvasWidth / 2, yPosition);
  }
}
