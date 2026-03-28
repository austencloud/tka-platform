/**
 * IPixelRenderer — Contract for the 1995 pixel pictograph renderer.
 *
 * Renders TKA pictographs as chunky 16-color dithered bitmaps on
 * an HTML canvas, using real SVG arrow/prop assets rendered at low
 * resolution with Bayer dithering for period-appropriate crunch.
 *
 * Internal resolution is 128×128. The caller scales the canvas to
 * display size with `image-rendering: pixelated`.
 *
 * Extends IEraRenderer — method signatures are inherited.
 *
 * Domain: 1995 TKA Notation System
 */

import type { IEraRenderer } from "../../../shared/services/contracts/IEraRenderer";

export interface IPixelRenderer extends IEraRenderer {}
