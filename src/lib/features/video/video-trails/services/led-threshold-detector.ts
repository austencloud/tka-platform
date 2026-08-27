
import type { IEndpointDetector } from "./IEndpointDetector";
import type { DetectedEndpoint, DetectionConfig, DetectorCapabilities } from "../domain/types";

interface BrightPixel {
  x: number;
  y: number;
  luminance: number;
}

interface Cluster {
  x: number;
  y: number;
  brightness: number;
  pixelCount: number;
}

// Finds bright LED endpoints in a video frame via luminance thresholding and
// connected-component clustering, then assigns each cluster to a prop using
// k-means so the caller knows which tip belongs to which prop.
export class LedThresholdDetector implements IEndpointDetector {
  readonly name = "LED Threshold";
  readonly capabilities: DetectorCapabilities = {
    supportsLive: true,
    supportsOcclusion: false,
    requiresGPU: false,
  };

  detect(frame: ImageData, config: DetectionConfig): DetectedEndpoint[] {
    const brightPixels = this.findBrightPixels(frame, config);
    if (brightPixels.length === 0) return [];

    const clusters = this.clusterPixels(brightPixels, config.minArea);
    if (clusters.length === 0) return [];

    // Keep only the brightest N clusters so we don't return noise.
    clusters.sort((a, b) => b.brightness - a.brightness);
    const topClusters = clusters.slice(0, config.maxEndpoints);

    const withPropIndex = this.assignPropIndices(topClusters);

    return withPropIndex.map((cluster) => ({
      x: Math.round(cluster.x),
      y: Math.round(cluster.y),
      brightness: cluster.brightness,
      // Confidence grows with cluster size relative to minArea, capped at 1.
      confidence: Math.min(1, cluster.brightness * cluster.pixelCount / config.minArea),
      propIndex: cluster.propIndex,
      tipIndex: cluster.tipIndex,
      frameIndex: 0,
    }));
  }

  // Scan every pixel and collect those whose weighted luminance exceeds the threshold.
  private findBrightPixels(frame: ImageData, config: DetectionConfig): BrightPixel[] {
    const { data, width, height } = frame;
    const { threshold, sensitivity, colorWeights } = config;
    const pixels: BrightPixel[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx]! / 255;
        const g = data[idx + 1]! / 255;
        const b = data[idx + 2]! / 255;
        // Standard Rec. 709 luminance, scaled by the user's sensitivity knob.
        const luminance = (colorWeights.r * r + colorWeights.g * g + colorWeights.b * b) * sensitivity;

        if (luminance >= threshold) {
          pixels.push({ x, y, luminance: Math.min(1, luminance) });
        }
      }
    }

    return pixels;
  }

  // Groups adjacent bright pixels into clusters via flood-fill (8-connectivity).
  // Each cluster's centroid is weighted by luminance so bright pixels pull harder.
  private clusterPixels(pixels: BrightPixel[], minArea: number): Cluster[] {
    if (pixels.length === 0) return [];

    const pixelMap = new Map<string, BrightPixel>();
    for (const p of pixels) {
      pixelMap.set(`${p.x},${p.y}`, p);
    }

    const visited = new Set<string>();
    const clusters: Cluster[] = [];

    for (const pixel of pixels) {
      const key = `${pixel.x},${pixel.y}`;
      if (visited.has(key)) continue;

      // Iterative flood-fill to avoid stack overflows on large bright regions.
      const queue: BrightPixel[] = [pixel];
      const component: BrightPixel[] = [];
      visited.add(key);

      while (queue.length > 0) {
        const current = queue.pop()!;
        component.push(current);

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nk = `${current.x + dx},${current.y + dy}`;
            if (!visited.has(nk) && pixelMap.has(nk)) {
              visited.add(nk);
              queue.push(pixelMap.get(nk)!);
            }
          }
        }
      }

      // Discard specks smaller than minArea - they're likely noise.
      if (component.length >= minArea) {
        let sumX = 0, sumY = 0, sumL = 0;
        for (const p of component) {
          sumX += p.x * p.luminance;
          sumY += p.y * p.luminance;
          sumL += p.luminance;
        }
        clusters.push({
          x: sumX / sumL,
          y: sumY / sumL,
          brightness: sumL / component.length,
          pixelCount: component.length,
        });
      }
    }

    return clusters;
  }

  // Assigns each cluster to prop 0 or prop 1 using 2-means clustering so the
  // caller can colour-code trails per prop. Seeds the centroids with the two
  // most spatially separated clusters rather than random points.
  private assignPropIndices(clusters: Cluster[]): (Cluster & { propIndex: 0 | 1; tipIndex: number })[] {
    if (clusters.length <= 1) {
      return clusters.map((c, i) => ({ ...c, propIndex: 0 as const, tipIndex: i }));
    }

    // Find the two clusters that are farthest apart to seed k-means - this
    // avoids the degenerate case where both centroids start at the same location.
    let maxDist = 0;
    let c1Idx = 0, c2Idx = 1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = Math.hypot(clusters[i]!.x - clusters[j]!.x, clusters[i]!.y - clusters[j]!.y);
        if (dist > maxDist) {
          maxDist = dist;
          c1Idx = i;
          c2Idx = j;
        }
      }
    }

    let centroid0 = { x: clusters[c1Idx]!.x, y: clusters[c1Idx]!.y };
    let centroid1 = { x: clusters[c2Idx]!.x, y: clusters[c2Idx]!.y };

    const assignments: number[] = new Array(clusters.length).fill(0);
    // 5 iterations is plenty for the small cluster counts we deal with here.
    for (let iter = 0; iter < 5; iter++) {
      for (let i = 0; i < clusters.length; i++) {
        const d0 = Math.hypot(clusters[i]!.x - centroid0.x, clusters[i]!.y - centroid0.y);
        const d1 = Math.hypot(clusters[i]!.x - centroid1.x, clusters[i]!.y - centroid1.y);
        assignments[i] = d0 <= d1 ? 0 : 1;
      }
      let sx0 = 0, sy0 = 0, n0 = 0, sx1 = 0, sy1 = 0, n1 = 0;
      for (let i = 0; i < clusters.length; i++) {
        if (assignments[i] === 0) { sx0 += clusters[i]!.x; sy0 += clusters[i]!.y; n0++; }
        else { sx1 += clusters[i]!.x; sy1 += clusters[i]!.y; n1++; }
      }
      if (n0 > 0) centroid0 = { x: sx0 / n0, y: sy0 / n0 };
      if (n1 > 0) centroid1 = { x: sx1 / n1, y: sy1 / n1 };
    }

    const tipCounters = [0, 0];
    return clusters.map((c, i) => {
      const propIndex = assignments[i]! as 0 | 1;
      const tipIndex = tipCounters[propIndex]!++;
      return { ...c, propIndex, tipIndex };
    });
  }
}
