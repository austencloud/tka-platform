/**
 * Grid Rendering Service
 *
 * Handles grid rendering with SVG assets and fallback rendering.
 * Extracted from PictographRenderer.
 */

import { GridMode } from "../../domain/enums/grid-enums";
import type { ISvgConfig } from "../../../shared/domain/models/svg-models";

export class GridRenderer {
  constructor(private config: ISvgConfig) {}

  /**
   * Render grid using real SVG assets
   */
  async renderGrid(
    svg: SVGElement,
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<void> {
    try {
      // Load the appropriate grid SVG
      const gridPath = `/images/grid/${gridMode}_grid.svg`;

      // Create image element for the grid
      const gridImage = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "image"
      );
      gridImage.setAttribute("href", gridPath);
      gridImage.setAttribute("x", "0");
      gridImage.setAttribute("y", "0");
      gridImage.setAttribute("width", this.config.SVG_SIZE.toString());
      gridImage.setAttribute("height", this.config.SVG_SIZE.toString());
      gridImage.setAttribute("preserveAspectRatio", "none");

      svg.appendChild(gridImage);
    } catch (error) {
      console.error(`❌ Error loading grid SVG for ${gridMode} mode:`, error);
      // Fallback: render a simple grid outline
      this.renderFallbackGrid(svg, gridMode);
    }
  }

  /**
   * Fallback grid rendering if SVG loading fails
   */
  private renderFallbackGrid(svg: SVGElement, gridMode: GridMode): void {
    const gridGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    gridGroup.setAttribute("class", `fallback-grid-${gridMode}`);

    if (gridMode === GridMode.DIAMOND) {
      // Create diamond outline
      const diamond = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon"
      );
      const size = 143; // Approximate size based on real coordinates
      const points = [
        `${this.config.CENTER_X},${this.config.CENTER_Y - size}`, // top
        `${this.config.CENTER_X + size},${this.config.CENTER_Y}`, // right
        `${this.config.CENTER_X},${this.config.CENTER_Y + size}`, // bottom
        `${this.config.CENTER_X - size},${this.config.CENTER_Y}`, // left
      ].join(" ");

      diamond.setAttribute("points", points);
      diamond.setAttribute("fill", "none");
      diamond.setAttribute("stroke", "#e5e7eb");
      diamond.setAttribute("stroke-width", "2");
      gridGroup.appendChild(diamond);
    } else {
      // Create box outline
      const box = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      const size = 202; // Approximate size based on real coordinates
      box.setAttribute("x", (this.config.CENTER_X - size / 2).toString());
      box.setAttribute("y", (this.config.CENTER_Y - size / 2).toString());
      box.setAttribute("width", size.toString());
      box.setAttribute("height", size.toString());
      box.setAttribute("fill", "none");
      box.setAttribute("stroke", "#e5e7eb");
      box.setAttribute("stroke-width", "2");
      gridGroup.appendChild(box);
    }

    svg.appendChild(gridGroup);
  }
}

// Direct singleton export for HMR-friendly imports
const SVG_CONFIG = {
  SVG_SIZE: 950,
  CENTER_X: 475,
  CENTER_Y: 475,
};

export const gridRenderer = new GridRenderer(SVG_CONFIG);
