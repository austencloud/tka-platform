/**
 * SimplePropTracker - Basic prop tracking using color histogram matching
 *
 * This is a minimal implementation for the proof of concept.
 * It uses:
 * 1. Color histogram of the initial bounding box as a template
 * 2. Search in a neighborhood around the last known position
 * 3. Tip detection by finding the extremity of the tracked region
 *
 * Future upgrade path: Replace with SAM2 or MediaPipe Object Tracking
 *
 * Note: Not using @injectable() for PoC - will add DI once concept is proven.
 */

import type {
	BoundingBox,
	TrackedFrame,
	TrackingConfig,
	NormalizedPoint
} from '../domain/models';
import { DEFAULT_TRACKING_CONFIG } from '../domain/models';

export class SimplePropTracker {
	private config: TrackingConfig = { ...DEFAULT_TRACKING_CONFIG };
	private templateHistogram: number[] | null = null;
	private lastBox: BoundingBox | null = null;
	private imageWidth = 0;
	private imageHeight = 0;

	async initialize(
		imageData: ImageData,
		initialBox: BoundingBox,
		config?: Partial<TrackingConfig>
	): Promise<TrackedFrame> {
		if (config) {
			this.config = { ...this.config, ...config };
		}

		this.imageWidth = imageData.width;
		this.imageHeight = imageData.height;
		this.lastBox = initialBox;

		// Extract color histogram from initial box
		this.templateHistogram = this.extractHistogram(imageData, initialBox);

		// Detect tip in initial frame
		const { centroid, tip, angle } = this.detectEndpoints(imageData, initialBox);

		return {
			index: 0,
			timestamp: 0,
			propBox: initialBox,
			centroid,
			tip,
			angle,
			confidence: 1.0, // First frame has perfect confidence
			isKeyframe: true // First frame is always a keyframe
		};
	}

	async trackFrame(
		imageData: ImageData,
		frameIndex: number,
		timestamp: number
	): Promise<TrackedFrame> {
		if (!this.templateHistogram || !this.lastBox) {
			throw new Error('Tracker not initialized. Call initialize() first.');
		}

		// Search for best matching region around last known position
		const searchResult = this.searchForProp(imageData, this.lastBox);

		if (searchResult.confidence < this.config.confidenceThreshold) {
			// Lost tracking
			return {
				index: frameIndex,
				timestamp,
				propBox: null,
				centroid: null,
				tip: null,
				angle: null,
				confidence: searchResult.confidence,
				isKeyframe: false
			};
		}

		// Update last known position
		this.lastBox = searchResult.box;

		// Detect endpoints
		const { centroid, tip, angle } = this.detectEndpoints(imageData, searchResult.box);

		return {
			index: frameIndex,
			timestamp,
			propBox: searchResult.box,
			centroid,
			tip,
			angle,
			confidence: searchResult.confidence,
			isKeyframe: false
		};
	}

	reset(): void {
		this.templateHistogram = null;
		this.lastBox = null;
		this.imageWidth = 0;
		this.imageHeight = 0;
	}

	getConfig(): TrackingConfig {
		return { ...this.config };
	}

	updateConfig(config: Partial<TrackingConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Extract a color histogram from a region of the image.
	 * Uses 8x8x8 = 512 bins for RGB.
	 */
	private extractHistogram(imageData: ImageData, box: BoundingBox): number[] {
		const histogram = new Array(512).fill(0);
		const { data, width, height } = imageData;

		const startX = Math.floor(box.x * width);
		const startY = Math.floor(box.y * height);
		const endX = Math.floor((box.x + box.width) * width);
		const endY = Math.floor((box.y + box.height) * height);

		let pixelCount = 0;

		for (let y = startY; y < endY; y++) {
			for (let x = startX; x < endX; x++) {
				const idx = (y * width + x) * 4;
				const r = Math.floor(data[idx]! / 32); // 0-7
				const g = Math.floor(data[idx + 1]! / 32); // 0-7
				const b = Math.floor(data[idx + 2]! / 32); // 0-7
				const binIdx = r * 64 + g * 8 + b;
				histogram[binIdx]!++;
				pixelCount++;
			}
		}

		// Normalize
		if (pixelCount > 0) {
			for (let i = 0; i < histogram.length; i++) {
				histogram[i] /= pixelCount;
			}
		}

		return histogram;
	}

	/**
	 * Compare two histograms using Bhattacharyya coefficient.
	 * Returns similarity score 0-1 (1 = identical).
	 */
	private compareHistograms(h1: number[], h2: number[]): number {
		let sum = 0;
		for (let i = 0; i < h1.length; i++) {
			sum += Math.sqrt(h1[i]! * h2[i]!);
		}
		return sum;
	}

	/**
	 * Search for the prop in a neighborhood around the last known position.
	 * Returns the best matching box and confidence.
	 */
	private searchForProp(
		imageData: ImageData,
		lastBox: BoundingBox
	): { box: BoundingBox; confidence: number } {
		const searchRadius = 0.1; // Search within 10% of image dimension
		const stepSize = 0.02; // Step 2% at a time

		let bestBox = lastBox;
		let bestScore = 0;

		// Search grid around last position
		for (let dy = -searchRadius; dy <= searchRadius; dy += stepSize) {
			for (let dx = -searchRadius; dx <= searchRadius; dx += stepSize) {
				const candidateBox: BoundingBox = {
					x: Math.max(0, Math.min(1 - lastBox.width, lastBox.x + dx)),
					y: Math.max(0, Math.min(1 - lastBox.height, lastBox.y + dy)),
					width: lastBox.width,
					height: lastBox.height
				};

				const candidateHist = this.extractHistogram(imageData, candidateBox);
				const score = this.compareHistograms(this.templateHistogram!, candidateHist);

				if (score > bestScore) {
					bestScore = score;
					bestBox = candidateBox;
				}
			}
		}

		return { box: bestBox, confidence: bestScore };
	}

	/**
	 * Detect the centroid and tip (endpoint) of the prop within the bounding box.
	 * Uses edge detection to find the extremity.
	 */
	private detectEndpoints(
		imageData: ImageData,
		box: BoundingBox
	): { centroid: NormalizedPoint; tip: NormalizedPoint; angle: number } {
		const { data, width, height } = imageData;

		const startX = Math.floor(box.x * width);
		const startY = Math.floor(box.y * height);
		const endX = Math.floor((box.x + box.width) * width);
		const endY = Math.floor((box.y + box.height) * height);

		// Find centroid (center of bounding box for now)
		const centroid: NormalizedPoint = {
			x: box.x + box.width / 2,
			y: box.y + box.height / 2
		};

		// Find tip: the pixel furthest from centroid that's "part of the prop"
		// For now, use a simple brightness threshold
		let maxDist = 0;
		let tipPixel: PixelPoint = { x: startX, y: startY };

		const centroidPx = {
			x: (centroid.x * width),
			y: (centroid.y * height)
		};

		// Calculate average brightness in the box
		let totalBrightness = 0;
		let pixelCount = 0;

		for (let y = startY; y < endY; y++) {
			for (let x = startX; x < endX; x++) {
				const idx = (y * width + x) * 4;
				const brightness = (data[idx]! + data[idx + 1]! + data[idx + 2]!) / 3;
				totalBrightness += brightness;
				pixelCount++;
			}
		}

		const avgBrightness = totalBrightness / pixelCount;
		const _threshold = avgBrightness * 0.8; // Prop is likely darker/brighter than background

		// Find furthest point that differs from background
		for (let y = startY; y < endY; y++) {
			for (let x = startX; x < endX; x++) {
				const idx = (y * width + x) * 4;
				const brightness = (data[idx]! + data[idx + 1]! + data[idx + 2]!) / 3;

				// Check if this pixel is "prop" (significantly different from avg)
				if (Math.abs(brightness - avgBrightness) > 30) {
					const dist = Math.sqrt(
						Math.pow(x - centroidPx.x, 2) + Math.pow(y - centroidPx.y, 2)
					);

					if (dist > maxDist) {
						maxDist = dist;
						tipPixel = { x, y };
					}
				}
			}
		}

		const tip: NormalizedPoint = {
			x: tipPixel.x / width,
			y: tipPixel.y / height
		};

		const angle = Math.atan2(tip.y - centroid.y, tip.x - centroid.x);

		return { centroid, tip, angle };
	}
}

interface PixelPoint {
	x: number;
	y: number;
}
