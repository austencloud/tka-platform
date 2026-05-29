// src/lib/features/video/video-trails/services/color-endpoint-detector.ts

import type { IEndpointDetector } from "./contracts/IEndpointDetector";
import type { DetectedEndpoint, DetectionConfig, DetectorCapabilities } from "../domain/types";

interface ColorPixel {
	x: number;
	y: number;
	similarity: number;
}

interface Cluster {
	x: number;
	y: number;
	similarity: number;
	pixelCount: number;
}

interface HslColor {
	h: number;
	s: number;
	l: number;
}

// Finds endpoints by matching a user-selected target color in HSL space.
// Unlike LedThresholdDetector which looks for overall brightness, this detects
// colored props (tape-marked staves, colored fans) even in daylight or stage
// lighting where brightness alone is unreliable.
export class ColorEndpointDetector implements IEndpointDetector {
	readonly name = "Color Match";
	readonly capabilities: DetectorCapabilities = {
		supportsLive: true,
		supportsOcclusion: false,
		requiresGPU: false,
	};

	detect(frame: ImageData, config: DetectionConfig): DetectedEndpoint[] {
		const matchingPixels = this.findColorMatches(frame, config);
		if (matchingPixels.length === 0) return [];

		const clusters = this.clusterPixels(matchingPixels, config.minArea);
		if (clusters.length === 0) return [];

		// Keep only the most similar N clusters so we don't return noise.
		clusters.sort((a, b) => b.similarity - a.similarity);
		const topClusters = clusters.slice(0, config.maxEndpoints);

		const withPropIndex = this.assignPropIndices(topClusters);

		return withPropIndex.map((cluster) => ({
			x: Math.round(cluster.x),
			y: Math.round(cluster.y),
			brightness: cluster.similarity,
			// Confidence grows with cluster size relative to minArea, capped at 1.
			confidence: Math.min(1, (cluster.similarity * cluster.pixelCount) / config.minArea),
			propIndex: cluster.propIndex,
			tipIndex: cluster.tipIndex,
			frameIndex: 0,
		}));
	}

	// Scan every pixel, convert to HSL, and collect those whose color distance
	// to the target is within the acceptance radius.
	private findColorMatches(frame: ImageData, config: DetectionConfig): ColorPixel[] {
		const { data, width, height } = frame;
		const { threshold, sensitivity, colorWeights } = config;
		const pixels: ColorPixel[] = [];

		const targetHsl = this.rgbToHsl(colorWeights.r, colorWeights.g, colorWeights.b);

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const idx = (y * width + x) * 4;
				const r = data[idx]! / 255;
				const g = data[idx + 1]! / 255;
				const b = data[idx + 2]! / 255;

				const pixelHsl = this.rgbToHsl(r, g, b);

				// Hue is circular (0-1), so the max distance is 0.5.
				let hueDist = Math.abs(pixelHsl.h - targetHsl.h);
				if (hueDist > 0.5) hueDist = 1 - hueDist;

				const satDist = Math.abs(pixelHsl.s - targetHsl.s);
				const lightDist = Math.abs(pixelHsl.l - targetHsl.l);

				// Hue matters most for color identity, saturation and lightness less so.
				const distance = hueDist * 2 + satDist * 0.5 + lightDist * 0.5;

				// The acceptance radius is the user's threshold scaled by sensitivity.
				const acceptRadius = threshold * sensitivity;

				if (distance < acceptRadius) {
					const similarity = 1 - distance / acceptRadius;
					pixels.push({ x, y, similarity });
				}
			}
		}

		return pixels;
	}

	// Standard RGB-to-HSL conversion. Input values are 0-1.
	private rgbToHsl(r: number, g: number, b: number): HslColor {
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const l = (max + min) / 2;

		if (max === min) return { h: 0, s: 0, l };

		const d = max - min;
		const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		let h: number;
		if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
		else if (max === g) h = ((b - r) / d + 2) / 6;
		else h = ((r - g) / d + 4) / 6;

		return { h, s, l };
	}

	// Groups adjacent color-matched pixels into clusters via flood-fill (8-connectivity).
	// Each cluster's centroid is weighted by similarity so strong matches pull harder.
	private clusterPixels(pixels: ColorPixel[], minArea: number): Cluster[] {
		if (pixels.length === 0) return [];

		const pixelMap = new Map<string, ColorPixel>();
		for (const p of pixels) {
			pixelMap.set(`${p.x},${p.y}`, p);
		}

		const visited = new Set<string>();
		const clusters: Cluster[] = [];

		for (const pixel of pixels) {
			const key = `${pixel.x},${pixel.y}`;
			if (visited.has(key)) continue;

			// Iterative flood-fill to avoid stack overflows on large matched regions.
			const queue: ColorPixel[] = [pixel];
			const component: ColorPixel[] = [];
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
				let sumX = 0,
					sumY = 0,
					sumS = 0;
				for (const p of component) {
					sumX += p.x * p.similarity;
					sumY += p.y * p.similarity;
					sumS += p.similarity;
				}
				clusters.push({
					x: sumX / sumS,
					y: sumY / sumS,
					similarity: sumS / component.length,
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

		// Find the two clusters that are farthest apart to seed k-means.
		let maxDist = 0;
		let c1Idx = 0,
			c2Idx = 1;
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
			let sx0 = 0,
				sy0 = 0,
				n0 = 0,
				sx1 = 0,
				sy1 = 0,
				n1 = 0;
			for (let i = 0; i < clusters.length; i++) {
				if (assignments[i] === 0) {
					sx0 += clusters[i]!.x;
					sy0 += clusters[i]!.y;
					n0++;
				} else {
					sx1 += clusters[i]!.x;
					sy1 += clusters[i]!.y;
					n1++;
				}
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
