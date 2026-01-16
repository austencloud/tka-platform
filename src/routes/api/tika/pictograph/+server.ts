/**
 * Tika Pictograph Generation API
 *
 * Generates pictograph images for the Tika learning assistant.
 * Uses the same StandaloneRenderer as the MCP server.
 */

import { json, type RequestHandler } from '@sveltejs/kit'
import fs from 'fs'
import path from 'path'

// Types for pictograph data (matches MCP server)
interface MotionData {
	color: string
	startLocation: string
	endLocation: string
	motionType: string
	rotationDirection: string
}

interface PictographData {
	letter: string
	startPosition: string
	endPosition: string
	timing: string
	direction: string
	blueMotion: MotionData
	redMotion: MotionData
}

// Cache for loaded pictograph data
let allPictographs: PictographData[] = []

function loadDataframe(): PictographData[] {
	try {
		const csvPath = path.join(process.cwd(), 'static', 'data', 'pictographs', 'DiamondPictographDataframe.csv')
		const csvContent = fs.readFileSync(csvPath, 'utf-8')
		const lines = csvContent.trim().split('\n')
		if (lines.length < 2) return []

		const headerLine = lines[0]
		if (!headerLine) return []
		const headers = headerLine.split(',').map((h) => h.trim())
		const pictographs: PictographData[] = []

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i]
			if (!line) continue
			const values = line.split(',').map((v) => v.trim())
			const row: Record<string, string> = {}
			headers.forEach((header, index) => {
				row[header] = values[index] ?? ''
			})

			pictographs.push({
				letter: row['letter'] ?? '',
				startPosition: row['startPosition'] ?? '',
				endPosition: row['endPosition'] ?? '',
				timing: row['timing'] ?? '',
				direction: row['direction'] ?? '',
				blueMotion: {
					color: 'blue',
					startLocation: row['blueStartLocation'] ?? '',
					endLocation: row['blueEndLocation'] ?? '',
					motionType: row['blueMotionType'] ?? '',
					rotationDirection: row['blueRotationDirection'] ?? ''
				},
				redMotion: {
					color: 'red',
					startLocation: row['redStartLocation'] ?? '',
					endLocation: row['redEndLocation'] ?? '',
					motionType: row['redMotionType'] ?? '',
					rotationDirection: row['redRotationDirection'] ?? ''
				}
			})
		}

		return pictographs
	} catch (error) {
		console.error('[Tika API] Failed to load dataframe:', error)
		return []
	}
}

function ensureDataLoaded() {
	if (allPictographs.length === 0) {
		console.log('[Tika API] Loading pictograph dataframe...')
		allPictographs = loadDataframe()
		console.log(`[Tika API] Loaded ${allPictographs.length} pictographs`)
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { letter, variation = 0, options = {} } = await request.json()

		if (!letter) {
			return json({ error: 'Missing letter parameter' }, { status: 400 })
		}

		ensureDataLoaded()

		// Find variations for this letter
		const variations = allPictographs.filter((p) => p.letter === letter)

		if (variations.length === 0) {
			return json({ error: `No pictograph found for letter: ${letter}` }, { status: 404 })
		}

		if (variation >= variations.length) {
			return json(
				{
					error: `Variation ${variation} not found. Letter ${letter} has ${variations.length} variations (0-${variations.length - 1})`
				},
				{ status: 400 }
			)
		}

		const csvRow = variations[variation]
		if (!csvRow) {
			return json({ error: 'Variation not found' }, { status: 404 })
		}

		// Dynamic import of MCP server's standalone renderer
		// This runs server-side so Node.js modules work
		const { getStandaloneRenderer } = await import('../../../../../mcp-server/src/core/standalone-renderer.js')

		// Convert CSV row to renderer input format
		const pictographInput = {
			letter: csvRow.letter,
			startPosition: csvRow.startPosition,
			endPosition: csvRow.endPosition,
			blueMotion: {
				motionType: csvRow.blueMotion.motionType,
				rotationDirection: csvRow.blueMotion.rotationDirection || 'no_rotation',
				startLocation: csvRow.blueMotion.startLocation,
				endLocation: csvRow.blueMotion.endLocation,
				color: 'blue',
				turns: 0,
				startOrientation: 'in'
			},
			redMotion: {
				motionType: csvRow.redMotion.motionType,
				rotationDirection: csvRow.redMotion.rotationDirection || 'no_rotation',
				startLocation: csvRow.redMotion.startLocation,
				endLocation: csvRow.redMotion.endLocation,
				color: 'red',
				turns: 0,
				startOrientation: 'in'
			}
		}

		// Merge default options with provided options
		const visibilityOptions = {
			darkMode: options.darkMode ?? true,
			size: options.size ?? 400,
			showTKA: options.showTKA ?? true,
			showVTG: options.showVTG ?? false,
			showElemental: options.showElemental ?? false,
			showPositions: options.showPositions ?? false,
			showReversals: options.showReversals ?? false,
			showGrid: options.showGrid ?? true,
			showNonRadialPoints: options.showNonRadialPoints ?? false,
			showBlueMotion: options.showBlueMotion ?? true,
			showRedMotion: options.showRedMotion ?? true
		}

		// Render to base64
		const renderer = getStandaloneRenderer()
		const base64 = await renderer.renderToBase64(pictographInput, visibilityOptions)

		// Return image and motion data
		return json({
			imageBase64: base64,
			motionData: {
				letter: csvRow.letter,
				startPosition: csvRow.startPosition,
				endPosition: csvRow.endPosition,
				blueMotion: {
					motionType: csvRow.blueMotion.motionType,
					startLocation: csvRow.blueMotion.startLocation,
					endLocation: csvRow.blueMotion.endLocation,
					rotationDirection: csvRow.blueMotion.rotationDirection
				},
				redMotion: {
					motionType: csvRow.redMotion.motionType,
					startLocation: csvRow.redMotion.startLocation,
					endLocation: csvRow.redMotion.endLocation,
					rotationDirection: csvRow.redMotion.rotationDirection
				}
			},
			variationCount: variations.length,
			variationIndex: variation
		})
	} catch (error) {
		console.error('[Tika API] Pictograph generation error:', error)
		return json(
			{
				error: `Failed to generate pictograph: ${error instanceof Error ? error.message : String(error)}`
			},
			{ status: 500 }
		)
	}
}

// GET endpoint for simple letter lookups - returns PNG directly
export const GET: RequestHandler = async ({ url }) => {
	const letter = url.searchParams.get('letter')
	const variation = parseInt(url.searchParams.get('variation') || '0', 10)
	const darkMode = url.searchParams.get('darkMode') !== 'false'

	if (!letter) {
		return json({ error: 'Missing letter parameter' }, { status: 400 })
	}

	ensureDataLoaded()

	const variations = allPictographs.filter((p) => p.letter === letter)

	if (variations.length === 0) {
		return json({ error: `No pictograph found for letter: ${letter}` }, { status: 404 })
	}

	if (variation >= variations.length) {
		return json(
			{
				error: `Variation ${variation} not found. Letter ${letter} has ${variations.length} variations (0-${variations.length - 1})`
			},
			{ status: 400 }
		)
	}

	const csvRow = variations[variation]
	if (!csvRow) {
		return json({ error: 'Variation not found' }, { status: 404 })
	}

	try {
		const { getStandaloneRenderer } = await import('../../../../../mcp-server/src/core/standalone-renderer.js')

		const pictographInput = {
			letter: csvRow.letter,
			startPosition: csvRow.startPosition,
			endPosition: csvRow.endPosition,
			blueMotion: {
				motionType: csvRow.blueMotion.motionType,
				rotationDirection: csvRow.blueMotion.rotationDirection || 'no_rotation',
				startLocation: csvRow.blueMotion.startLocation,
				endLocation: csvRow.blueMotion.endLocation,
				color: 'blue',
				turns: 0,
				startOrientation: 'in'
			},
			redMotion: {
				motionType: csvRow.redMotion.motionType,
				rotationDirection: csvRow.redMotion.rotationDirection || 'no_rotation',
				startLocation: csvRow.redMotion.startLocation,
				endLocation: csvRow.redMotion.endLocation,
				color: 'red',
				turns: 0,
				startOrientation: 'in'
			}
		}

		const renderer = getStandaloneRenderer()
		const pngBuffer = await renderer.renderToPng(pictographInput, {
			darkMode,
			size: 400,
			showTKA: true,
			showGrid: true
		})

		// Convert Buffer to Uint8Array for Response
		return new Response(new Uint8Array(pngBuffer), {
			headers: {
				'Content-Type': 'image/png',
				'Cache-Control': 'public, max-age=3600'
			}
		})
	} catch (error) {
		console.error('[Tika API] Pictograph render error:', error)
		return json(
			{
				error: `Failed to render pictograph: ${error instanceof Error ? error.message : String(error)}`
			},
			{ status: 500 }
		)
	}
}
