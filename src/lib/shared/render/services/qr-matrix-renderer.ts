/**
 * QR Matrix Renderer
 *
 * Draws a QR code onto a canvas context using the pure `qrcode-generator`
 * matrix algorithm. No DOM dependency, no $env access — safe to use inside
 * a Web Worker or an OffscreenCanvas render pipeline.
 *
 * Defaults mirror the app's QRCodeGenerator "modern" preset so worker-rendered
 * QR codes are visually consistent with main-thread ones:
 *   - ECC level:   "M"
 *   - Dark color:  "#1a1a2e"
 *   - Light color: "#ffffff"
 *   - Margin:      0 modules (qr-code-styling uses pixel margin, not modules)
 */

import qrcode from "qrcode-generator";

export interface QrMatrixOptions {
  /** Left edge of the target square in canvas px. */
  x: number;
  /** Top edge of the target square in canvas px. */
  y: number;
  /** Side length of the target square in device px. */
  size: number;
  /** CSS color string for dark modules. */
  darkColor: string;
  /** CSS color string for the light background. */
  lightColor: string;
  /** QR error-correction level. */
  eccLevel: "L" | "M" | "Q" | "H";
  /**
   * Quiet-zone width expressed in QR modules (default 0).
   * The `qr-code-styling` library uses pixel margin, so when matching its
   * output keep this at 0 and apply margin at the layout layer instead.
   */
  marginModules?: number;
}

/**
 * Draw a QR code for `text` into the `(x, y, size × size)` square on `ctx`.
 *
 * Worker-safe: uses only the `qrcode-generator` matrix + `ctx.fillRect`,
 * with no DOM access, no `$env`, and no async I/O.
 */
export function drawQrMatrix(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  opts: QrMatrixOptions,
): void {
  const qr = qrcode(0, opts.eccLevel);
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const margin = opts.marginModules ?? 0;
  const total = count + margin * 2;
  const cell = opts.size / total;

  ctx.save();

  // Light background
  ctx.fillStyle = opts.lightColor;
  ctx.fillRect(opts.x, opts.y, opts.size, opts.size);

  // Dark modules
  ctx.fillStyle = opts.darkColor;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(
          opts.x + (c + margin) * cell,
          opts.y + (r + margin) * cell,
          Math.ceil(cell),
          Math.ceil(cell),
        );
      }
    }
  }

  ctx.restore();
}
