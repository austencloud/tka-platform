/**
 * SVG to Canvas Converter Service - SIMPLIFIED
 *
 * Uses fabric.js for clean, reliable SVG-to-Canvas conversion.
 * Replaces 300+ lines of over-engineered conversion logic with ~50 lines.
 */

import { Canvas, loadSVGFromString, Rect, util } from "fabric";
import type {
  RenderQualitySettings,
  SVGConversionOptions,
} from "../domain/models/svg-conversion";
export class SVGToCanvasConverter {
  private defaultQuality: RenderQualitySettings = {
    antialiasing: true,
    smoothScaling: true,
    imageSmoothingQuality: "high",
    scale: 1,
    dpi: 96,
  };

  /**
   * Convert SVG string to Canvas using fabric.js
   */
  async convertSVGStringToCanvas(
    svgString: string,
    options: SVGConversionOptions
  ): Promise<HTMLCanvasElement> {
    if (!svgString.trim()) {
      throw new Error("SVG string cannot be empty");
    }

    return new Promise((resolve, reject) => {
      // Create target canvas
      const targetCanvas = document.createElement("canvas");
      targetCanvas.width = options.width || 144;
      targetCanvas.height = options.height || 144;

      // Parse and load SVG
      loadSVGFromString(svgString)
        .then(({ objects, options: svgOptions }) => {
          try {
            // Create fabric canvas
            const fabricCanvas = new Canvas(targetCanvas, {
              width: targetCanvas.width,
              height: targetCanvas.height,
              backgroundColor: options.backgroundColor || "white",
            });

            // Add SVG objects to canvas
            const validObjects = objects.filter((obj) => obj !== null);

            if (validObjects.length > 0) {
              // Group all SVG elements
              const svgGroup = util.groupSVGElements(validObjects, svgOptions);

              if (svgGroup) {
                // CRITICAL: Don't scale! Use SVG at native size to prevent clipping
                // The canvas should be sized to accommodate the full SVG content
                const canvasWidth = fabricCanvas.width || targetCanvas.width;
                const canvasHeight = fabricCanvas.height || targetCanvas.height;

                // REMOVED SCALING - was causing pictograph content to be clipped
                // if (svgGroup.width && svgGroup.height) {
                //   const scaleX = canvasWidth / svgGroup.width;
                //   const scaleY = canvasHeight / svgGroup.height;
                //   const scale = Math.min(scaleX, scaleY);
                //   svgGroup.scale(scale);
                // }

                // Center the group at native size
                svgGroup.set({
                  left: canvasWidth / 2,
                  top: canvasHeight / 2,
                  originX: "center",
                  originY: "center",
                });

                fabricCanvas.add(svgGroup);
              }
            } else {
              // If no objects, add a placeholder
              const placeholder = new Rect({
                left: targetCanvas.width / 2,
                top: targetCanvas.height / 2,
                width: targetCanvas.width * 0.8,
                height: targetCanvas.height * 0.8,
                fill: "#f3f4f6",
                stroke: "#d1d5db",
                strokeWidth: 2,
                originX: "center",
                originY: "center",
              });
              fabricCanvas.add(placeholder);
            }

            // Render and return
            fabricCanvas.renderAll();
            resolve(fabricCanvas.getElement());
          } catch (error) {
            reject(
              new Error(
                `SVG conversion failed: ${error instanceof Error ? error.message : error}`
              )
            );
          }
        })
        .catch((error) => {
          reject(
            new Error(
              `SVG parsing failed: ${error instanceof Error ? error.message : error}`
            )
          );
        });
    });
  }

  /**
   * Convert SVG element to Canvas
   */
  async convertSVGElementToCanvas(
    svgElement: SVGElement,
    options: SVGConversionOptions
  ): Promise<HTMLCanvasElement> {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    return this.convertSVGStringToCanvas(svgString, options);
  }

  /**
   * Batch convert multiple SVG strings
   */
  async convertMultipleSVGsToCanvases(
    svgStrings: string[],
    options: SVGConversionOptions
  ): Promise<HTMLCanvasElement[]> {
    return Promise.all(
      svgStrings.map((svg) => this.convertSVGStringToCanvas(svg, options))
    );
  }

  // Simple implementations of required interface methods
  setDefaultQuality(settings: RenderQualitySettings): void {
    this.defaultQuality = { ...settings };
  }

  getQualitySettings(): RenderQualitySettings {
    return { ...this.defaultQuality };
  }

  validateSVG(svgContent: string | SVGElement): boolean {
    if (typeof svgContent === "string") {
      return (
        svgContent.trim().includes("<svg") && svgContent.includes("</svg>")
      );
    }
    return svgContent instanceof SVGElement;
  }

  getMemoryUsage() {
    return { activeConversions: 0, totalMemoryUsed: 0, peakMemoryUsed: 0 };
  }

  cleanup(): void {
    // No cleanup needed with fabric.js approach
  }
}
