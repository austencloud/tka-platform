/**
 * Forest Canvas Renderer
 *
 * Renders the procedural forest to a 2D canvas context.
 * Handles all visual elements:
 * - Tree silhouettes (deciduous, conifer, bare)
 * - Ground vegetation (bushes, grass, ferns)
 * - Atmospheric effects (fog, mist)
 * - Easter eggs (moon, bats, owls, shooting stars)
 * - Wind animation transforms
 */

import type {
  ProceduralForestSystem,
  ForestRenderData,
} from "../ProceduralForestSystem";
import type { MoonRenderer } from "../../../shared/services/MoonRenderer";
import type { ForestTreeInstance } from "../composition/ParallaxForestComposer";
import type { GroundElement, GrassTuft } from "../ground/GroundLayerSystem";
import type { FogPatch, GroundFogData, MistLayerData } from "../atmosphere/AtmosphericFogSystem";
import type { OwlSilhouette, Bat, ShootingStar } from "../ambient/EasterEggSystem";
import type { GeneratedTree } from "../trees/SpaceColonizationTree";
import type { GeneratedConifer } from "../trees/StochasticConiferTree";
import type { GeneratedBareTree } from "../trees/BareTree";

export interface ForestRendererConfig {
  // Colors
  treeSilhouetteColor: string;
  nearTreeColor: string;
  farTreeColor: string;
  groundColor: string;
  grassColor: string;

  // Effects
  renderShadows: boolean;
  renderGlow: boolean;
  glowIntensity: number;

  // Debug
  debugMode: boolean;
  showBounds: boolean;
}

const DEFAULT_CONFIG: ForestRendererConfig = {
  treeSilhouetteColor: "#0a1015",
  nearTreeColor: "#0d1520",
  farTreeColor: "#1a2535",
  groundColor: "#0a0f14",
  grassColor: "#0d1218",
  renderShadows: true,
  renderGlow: false,
  glowIntensity: 0.3,
  debugMode: false,
  showBounds: false,
};

export class ForestCanvasRenderer {
  private config: ForestRendererConfig;
  private cachedTreePaths: Map<string, Path2D> = new Map();

  constructor(config: Partial<ForestRendererConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Render the entire forest scene
   */
  render(
    ctx: CanvasRenderingContext2D,
    forest: ProceduralForestSystem,
    width: number,
    height: number
  ): void {
    const renderData = forest.getRenderData();

    // Clear with transparent (let background gradient show through)
    ctx.clearRect(0, 0, width, height);

    // Render in depth order
    this.renderMoon(ctx, renderData);
    this.renderShootingStars(ctx, renderData);
    this.renderTreesAndFog(ctx, forest, renderData, width, height);
    this.renderGroundElements(ctx, forest, renderData);
    this.renderGrass(ctx, forest, renderData);
    this.renderGroundFog(ctx, renderData, width, height);
    this.renderBats(ctx, forest, renderData);
    this.renderOwls(ctx, renderData);

    // Debug overlays
    if (this.config.debugMode) {
      this.renderDebugInfo(ctx, renderData, width, height);
    }
  }

  private renderMoon(ctx: CanvasRenderingContext2D, renderData: ForestRenderData): void {
    const { moonRenderer } = renderData;
    if (!moonRenderer) return;

    // Use the shared MoonRenderer for consistent rendering with real lunar phase
    moonRenderer.render(ctx);
  }

  private renderShootingStars(
    ctx: CanvasRenderingContext2D,
    renderData: ForestRenderData
  ): void {
    for (const star of renderData.shootingStars) {
      if (!star.active) continue;

      ctx.save();

      const currentX = star.startX + (star.endX - star.startX) * star.progress;
      const currentY = star.startY + (star.endY - star.startY) * star.progress;

      // Tail
      const tailX = currentX - (star.endX - star.startX) * 0.3 * (1 - star.progress);
      const tailY = currentY - (star.endY - star.startY) * 0.3 * (1 - star.progress);

      const gradient = ctx.createLinearGradient(tailX, tailY, currentX, currentY);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0.8)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();

      // Head glow
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(currentX, currentY, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderTreesAndFog(
    ctx: CanvasRenderingContext2D,
    forest: ProceduralForestSystem,
    renderData: ForestRenderData,
    width: number,
    height: number
  ): void {
    // Sort trees by depth for proper layering
    const trees = [...renderData.trees].sort((a, b) => a.depth - b.depth);

    for (const tree of trees) {
      // Calculate fog opacity for this depth
      const fogOpacity = forest.getDistanceFogOpacity(tree.depth);
      const treeColor = this.getTreeColor(tree.depth);

      ctx.save();

      // Apply wind displacement
      const wind = forest.getWindDisplacement(tree.x, tree.baseY, 0.5, tree.scale);
      ctx.translate(tree.x + tree.parallaxOffset + wind.x, tree.baseY);
      ctx.rotate(wind.rotation);
      ctx.scale(tree.scale, tree.scale);

      // Draw tree based on type
      ctx.fillStyle = treeColor;
      ctx.globalAlpha = tree.opacity * (1 - fogOpacity * 0.5);

      this.renderTreeSilhouette(ctx, tree);

      ctx.restore();
    }
  }

  private renderTreeSilhouette(ctx: CanvasRenderingContext2D, tree: ForestTreeInstance): void {
    const { generatedData, treeType } = tree;

    switch (treeType) {
      case "deciduous":
        this.renderDeciduousTree(ctx, generatedData as GeneratedTree);
        break;
      case "conifer":
        this.renderConiferTree(ctx, generatedData as GeneratedConifer);
        break;
      case "bare":
        this.renderBareTree(ctx, generatedData as GeneratedBareTree);
        break;
    }
  }

  private renderDeciduousTree(ctx: CanvasRenderingContext2D, tree: GeneratedTree): void {
    // Draw branches
    for (const branch of tree.branches) {
      ctx.beginPath();
      ctx.moveTo(branch.x, branch.y);

      // Find parent to draw line from
      if (branch.parentIndex !== null) {
        const parent = tree.branches[branch.parentIndex];
        if (parent) {
          ctx.lineTo(parent.x, parent.y);
        }
      }

      ctx.lineWidth = branch.thickness;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Draw canopy using canopyPoints (convex hull would be better, but simplified here)
    if (tree.canopyPoints.length > 2) {
      ctx.beginPath();

      // Simple circle around canopy center
      let sumX = 0,
        sumY = 0;
      for (const p of tree.canopyPoints) {
        sumX += p.x;
        sumY += p.y;
      }
      const centerX = sumX / tree.canopyPoints.length;
      const centerY = sumY / tree.canopyPoints.length;

      // Find max radius
      let maxRadius = 0;
      for (const p of tree.canopyPoints) {
        const dist = Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));
        maxRadius = Math.max(maxRadius, dist);
      }

      // Draw organic canopy shape
      ctx.beginPath();
      for (let i = 0; i <= 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        const variation = 0.8 + Math.random() * 0.4;
        const r = maxRadius * variation;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderConiferTree(ctx: CanvasRenderingContext2D, tree: GeneratedConifer): void {
    // Draw silhouette path
    const firstPoint = tree.silhouettePoints[0];
    if (tree.silhouettePoints.length > 2 && firstPoint) {
      ctx.beginPath();
      ctx.moveTo(firstPoint.x, firstPoint.y);
      for (let i = 1; i < tree.silhouettePoints.length; i++) {
        const point = tree.silhouettePoints[i];
        if (point) ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderBareTree(ctx: CanvasRenderingContext2D, tree: GeneratedBareTree): void {
    // Draw all branches
    ctx.strokeStyle = ctx.fillStyle as string;
    for (const branch of tree.branches) {
      ctx.beginPath();
      ctx.moveTo(branch.startX, branch.startY);
      ctx.lineTo(branch.endX, branch.endY);
      ctx.lineWidth = branch.thickness;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  private renderGroundElements(
    ctx: CanvasRenderingContext2D,
    forest: ProceduralForestSystem,
    renderData: ForestRenderData
  ): void {
    for (const element of renderData.groundElements) {
      ctx.save();

      const fogOpacity = forest.getDistanceFogOpacity(element.depth);
      ctx.fillStyle = this.config.groundColor;
      ctx.globalAlpha = element.opacity * (1 - fogOpacity * 0.3);

      // Apply wind for bushes
      const wind = forest.getWindDisplacement(element.x, element.y, 0.3, 1);
      ctx.translate(element.x + wind.x, element.y);
      ctx.rotate(wind.rotation * 0.5);

      // Draw silhouette
      const firstPoint = element.silhouettePoints[0];
      if (element.silhouettePoints.length > 2 && firstPoint) {
        ctx.beginPath();
        ctx.moveTo(firstPoint.x - element.x, firstPoint.y - element.y);
        for (let i = 1; i < element.silhouettePoints.length; i++) {
          const point = element.silhouettePoints[i];
          if (point) {
            ctx.lineTo(point.x - element.x, point.y - element.y);
          }
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderGrass(
    ctx: CanvasRenderingContext2D,
    forest: ProceduralForestSystem,
    renderData: ForestRenderData
  ): void {
    ctx.strokeStyle = this.config.grassColor;
    ctx.lineCap = "round";

    for (const tuft of renderData.grassTufts) {
      for (const blade of tuft.blades) {
        // Get wind displacement for this blade
        const heightRatio =
          Math.abs(blade.tipY - blade.baseY) /
          (Math.abs(blade.tipY - blade.baseY) + 1);
        const wind = forest.getGrassWindDisplacement(blade.baseX, heightRatio);

        ctx.beginPath();
        ctx.moveTo(blade.baseX, blade.baseY);

        // Quadratic bezier with wind offset
        ctx.quadraticCurveTo(
          blade.controlX + wind.x * 0.5,
          blade.controlY + wind.y * 0.5,
          blade.tipX + wind.x,
          blade.tipY + wind.y
        );

        ctx.lineWidth = blade.thickness;
        ctx.stroke();
      }
    }
  }

  private renderGroundFog(
    ctx: CanvasRenderingContext2D,
    renderData: ForestRenderData,
    width: number,
    height: number
  ): void {
    for (const fogLayer of renderData.fogLayers) {
      if (fogLayer.type === "ground" && fogLayer.data) {
        const groundFog = fogLayer.data as GroundFogData;

        ctx.save();
        ctx.globalAlpha = groundFog.opacity;
        ctx.fillStyle = groundFog.color;

        ctx.beginPath();
        const firstFogPoint = groundFog.points[0];
        if (groundFog.points.length > 0 && firstFogPoint) {
          ctx.moveTo(firstFogPoint.x, firstFogPoint.y);
          for (let i = 1; i < groundFog.points.length; i++) {
            const point = groundFog.points[i];
            if (point) ctx.lineTo(point.x, point.y);
          }
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      } else if (fogLayer.type === "wispy" && fogLayer.data) {
        const patch = fogLayer.data as FogPatch;

        ctx.save();
        ctx.globalAlpha = patch.opacity;

        const gradient = ctx.createRadialGradient(
          patch.x,
          patch.y,
          0,
          patch.x,
          patch.y,
          Math.max(patch.width, patch.height) / 2
        );
        gradient.addColorStop(0, "rgba(180, 200, 220, 0.3)");
        gradient.addColorStop(1, "rgba(180, 200, 220, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(patch.x, patch.y, patch.width / 2, patch.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }
  }

  private renderBats(
    ctx: CanvasRenderingContext2D,
    forest: ProceduralForestSystem,
    renderData: ForestRenderData
  ): void {
    ctx.fillStyle = "#0a0a0a";

    for (const flock of renderData.batFlocks) {
      for (const bat of flock.bats) {
        const wingPoints = forest.getEasterEggSystem().getBatWingPoints(bat);

        ctx.save();
        ctx.translate(bat.x, bat.y);
        ctx.scale(bat.scale, bat.scale);

        // Body
        const bodyFirst = wingPoints.body[0];
        if (bodyFirst) {
          ctx.beginPath();
          ctx.moveTo(bodyFirst.x, bodyFirst.y);
          for (let i = 1; i < wingPoints.body.length; i++) {
            const pt = wingPoints.body[i];
            if (pt) ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.fill();
        }

        // Wings
        const leftFirst = wingPoints.leftWing[0];
        if (leftFirst) {
          ctx.beginPath();
          ctx.moveTo(leftFirst.x, leftFirst.y);
          for (let i = 1; i < wingPoints.leftWing.length; i++) {
            const pt = wingPoints.leftWing[i];
            if (pt) ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.fill();
        }

        const rightFirst = wingPoints.rightWing[0];
        if (rightFirst) {
          ctx.beginPath();
          ctx.moveTo(rightFirst.x, rightFirst.y);
          for (let i = 1; i < wingPoints.rightWing.length; i++) {
            const pt = wingPoints.rightWing[i];
            if (pt) ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }
    }
  }

  private renderOwls(ctx: CanvasRenderingContext2D, renderData: ForestRenderData): void {
    for (const owl of renderData.owls) {
      ctx.save();

      ctx.translate(owl.x, owl.y);
      ctx.scale(owl.scale * (owl.facing === "left" ? -1 : 1), owl.scale);
      ctx.rotate(owl.headTilt * 0.2);

      // Body silhouette
      ctx.fillStyle = "#080808";
      const owlFirst = owl.silhouettePoints[0];
      if (owlFirst) {
        ctx.beginPath();
        ctx.moveTo(owlFirst.x, owlFirst.y);
        for (let i = 1; i < owl.silhouettePoints.length; i++) {
          const pt = owl.silhouettePoints[i];
          if (pt) ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
      }

      // Eyes (unless blinking)
      if (!owl.blinking) {
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.arc(-4, -3, 2.5, 0, Math.PI * 2);
        ctx.arc(4, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(-4, -3, 1, 0, Math.PI * 2);
        ctx.arc(4, -3, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private getTreeColor(depth: number): string {
    // Interpolate between far and near colors based on depth
    const { nearTreeColor, farTreeColor } = this.config;
    // Simple alpha blend - for production would parse and lerp RGB
    return depth > 0.5 ? nearTreeColor : farTreeColor;
  }

  private renderDebugInfo(
    ctx: CanvasRenderingContext2D,
    renderData: ForestRenderData,
    width: number,
    height: number
  ): void {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";

    const lines = [
      `Trees: ${renderData.trees.length}`,
      `Ground: ${renderData.groundElements.length}`,
      `Grass: ${renderData.grassTufts.length}`,
      `Wind: ${renderData.windStrength.toFixed(2)}`,
      `Gust: ${renderData.gustActive ? "YES" : "no"}`,
      `Owls: ${renderData.owls.length}`,
      `Bats: ${renderData.batFlocks.reduce((sum, f) => sum + f.bats.length, 0)}`,
    ];

    lines.forEach((line, i) => {
      ctx.fillText(line, 10, 20 + i * 16);
    });

    ctx.restore();
  }

  setConfig(config: Partial<ForestRendererConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ForestRendererConfig {
    return { ...this.config };
  }
}
