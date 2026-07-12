import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { planPrintSlots, type PrintSlot } from './print-slot-planner';
import type { TnDElement } from '../domain/tnd-element';
import type { CardPair } from "./types";
import { CARD_SIZES, getPageLayout, type CardSizeId, type PageLayout } from '../domain/card-sizes';

const LETTER_W = 612; // 8.5" × 72
const LETTER_H = 792; // 11" × 72
const GUIDE_COLOR = rgb(0.65, 0.65, 0.65);
const CROP_COLOR = rgb(0.4, 0.4, 0.4);
const CROP_LEN = 8;
const CROP_OFFSET = 2;
// Inset for corner labels/hints so they clear the printer's non-printable
// margin (~0.25"). Horizontal has slack; vertical band is only marginYPt tall.
const LABEL_EDGE_X = 24;
const LABEL_EDGE_Y = 8;

/** One card per page, alternating front/back. For MPC/print service upload. */
export async function exportDeckPDF(
	pairs: CardPair[],
	_deckName: string,
	cardSize: CardSizeId = 'poker',
	onProgress?: (current: number, total: number) => void
): Promise<Blob> {
	const size = CARD_SIZES[cardSize];
	// MPC page dimensions: canvas pixel dimensions converted to points at 300 DPI
	const pageWidthPt = (size.canvasWidth / 300) * 72;
	const pageHeightPt = (size.canvasHeight / 300) * 72;

	const pdfDoc = await PDFDocument.create();
	const total = pairs.length;

	for (let i = 0; i < pairs.length; i++) {
		const pair = pairs[i]!;

		const frontImage = await pdfDoc.embedPng(canvasToPngBytes(pair.front));
		const frontPage = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
		frontPage.drawImage(frontImage, {
			x: 0, y: 0,
			width: pageWidthPt, height: pageHeightPt
		});

		const backImage = await pdfDoc.embedPng(canvasToPngBytes(pair.back));
		const backPage = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
		backPage.drawImage(backImage, {
			x: 0, y: 0,
			width: pageWidthPt, height: pageHeightPt
		});

		onProgress?.(i + 1, total);
	}

	const pdfBytes = await pdfDoc.save();
	return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

export type PrintPDFMode = 'combined' | 'fronts' | 'backs';

export interface HomePrintOptions {
	/** Whole-deck copies. Each element block repeats N times. Default 1, min 1. */
	copies?: number;
	/** Element tag per pair, parallel to `pairs`. Absent → no grouping (single
	 *  trailing bucket, tail-padded). */
	elements?: (TnDElement | undefined)[];
	/** When false, relax the one-color-per-sheet rule: cards fill sheets in order
	 *  with blanks only on the final sheet (no inter-color gaps). Default true. */
	groupByElement?: boolean;
	/** Document metadata embedded in the PDF (title / subject / keywords) so a
	 *  downloaded file is indexable by deck reference + contents without opening.
	 *  `deckSummary` also prints centered in each sheet's top margin (the recipe:
	 *  e.g. "Rotated · Quartered · 8-step · L1 · 1 turn · Diamond · Staff"). */
	meta?: { title?: string; subject?: string; keywords?: string[]; deckSummary?: string };
}

/** Capitalize an element key for sheet labels: "fire" → "Fire". */
function capitalize(s: string): string {
	return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** Grid layout on Letter pages for double-sided home printing.
 *
 *  Cards are grouped by element (fixed TND_ELEMENTS order), each color
 *  whole-block-repeated `copies` times and padded to whole sheets, so every
 *  printed sheet holds exactly one element — a cut never crosses two colors.
 *
 *  Combined mode: all fronts → flip instruction → all backs
 *  Fronts mode: all fronts
 *  Backs mode: all backs (columns mirrored for long-edge duplex)
 *
 *  Every page gets: crop marks, sheet labels (with element name), flip hints.
 */
export async function exportHomePrintPDF(
	pairs: CardPair[],
	deckName: string,
	cardSize: CardSizeId = 'poker',
	onProgress?: (current: number, total: number) => void,
	mode: PrintPDFMode = 'combined',
	options: HomePrintOptions = {},
): Promise<Blob> {
	const layout = getPageLayout(cardSize);
	const { cols, cardsPerPage, cardWidthPt, cardHeightPt, gutterPt, marginXPt, marginYPt } = layout;

	const copies = Math.max(1, Math.floor(options.copies ?? 1));
	const elements = options.elements ?? [];
	const groupByElement = options.groupByElement ?? true;
	// firstOnTop: reverse card order so the deck's FIRST card is drawn last and
	// lands on top of the printed/cut stack (was: last card on top).
	const slots = planPrintSlots(pairs, elements, copies, cardsPerPage, groupByElement, true);
	const totalSheets = slots.length / cardsPerPage; // integer by construction

	const pdfDoc = await PDFDocument.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const includeFronts = mode === 'combined' || mode === 'fronts';
	const includeBacks = mode === 'combined' || mode === 'backs';
	const progressTotal = (includeFronts ? totalSheets : 0) + (includeBacks ? totalSheets : 0);
	let progressCount = 0;

	// Embed each unique card PNG once; reuse the handle across all N copies.
	const frontImages = new Map<HTMLCanvasElement, PDFImage>();
	const backImages = new Map<HTMLCanvasElement, PDFImage>();
	const embedFront = async (c: HTMLCanvasElement): Promise<PDFImage> => {
		let img = frontImages.get(c);
		if (!img) { img = await pdfDoc.embedPng(canvasToPngBytes(c)); frontImages.set(c, img); }
		return img;
	};
	const embedBack = async (c: HTMLCanvasElement): Promise<PDFImage> => {
		let img = backImages.get(c);
		if (!img) { img = await pdfDoc.embedPng(canvasToPngBytes(c)); backImages.set(c, img); }
		return img;
	};

	const sheetSide = (base: string, sheetSlots: PrintSlot[]): string => {
		const el = sheetSlots[0]?.elementName ?? null;
		return el ? `${base}  ·  ${capitalize(el)}` : base;
	};

	if (includeFronts) {
		for (let sheet = 0; sheet < totalSheets; sheet++) {
			const start = sheet * cardsPerPage;
			const sheetSlots = slots.slice(start, start + cardsPerPage);
			const frontsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

			for (let i = 0; i < sheetSlots.length; i++) {
				const slot = sheetSlots[i]!;
				if (!slot.item) continue;
				const col = i % cols;
				const row = Math.floor(i / cols);
				const x = marginXPt + col * (cardWidthPt + gutterPt);
				const y = LETTER_H - marginYPt - (row + 1) * cardHeightPt - row * gutterPt;
				const img = await embedFront(slot.item.front);
				frontsPage.drawImage(img, { x, y, width: cardWidthPt, height: cardHeightPt });
			}

			drawCropMarks(frontsPage, layout);
			drawSheetLabel(frontsPage, font, fontBold, sheetSide('FRONTS', sheetSlots), sheet + 1, totalSheets, deckName, options.meta?.deckSummary);
			drawFlipHint(frontsPage, font, "FRONT SIDE");
			onProgress?.(++progressCount, progressTotal);
		}
	}

	if (mode === 'combined') {
		addFlipInstructionPage(pdfDoc, font, fontBold);
	}

	if (includeBacks) {
		for (let sheet = 0; sheet < totalSheets; sheet++) {
			const start = sheet * cardsPerPage;
			const sheetSlots = slots.slice(start, start + cardsPerPage);
			const backsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

			for (let i = 0; i < sheetSlots.length; i++) {
				const slot = sheetSlots[i]!;
				if (!slot.item) continue;
				const col = i % cols;
				const row = Math.floor(i / cols);
				const mirroredCol = cols - 1 - col;
				const x = marginXPt + mirroredCol * (cardWidthPt + gutterPt);
				const y = LETTER_H - marginYPt - (row + 1) * cardHeightPt - row * gutterPt;
				const img = await embedBack(slot.item.back);
				backsPage.drawImage(img, { x, y, width: cardWidthPt, height: cardHeightPt });
			}

			drawCropMarks(backsPage, layout);
			drawSheetLabel(backsPage, font, fontBold, sheetSide('BACKS', sheetSlots), sheet + 1, totalSheets, deckName, options.meta?.deckSummary);
			drawFlipHint(backsPage, font, "BACK SIDE: columns mirrored for long-edge flip");
			onProgress?.(++progressCount, progressTotal);
		}
	}

	// Embed deck metadata so the downloaded file is indexable by reference number
	// and word list. pdf-lib writes these into the PDF Info dictionary.
	const meta = options.meta;
	if (meta?.title) pdfDoc.setTitle(meta.title);
	if (meta?.subject) pdfDoc.setSubject(meta.subject);
	if (meta?.keywords?.length) pdfDoc.setKeywords(meta.keywords);
	pdfDoc.setCreator('Flow Arts Composer');
	pdfDoc.setProducer('Flow Arts Composer');

	const pdfBytes = await pdfDoc.save();
	return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

function cardX(col: number, layout: PageLayout): number {
	return layout.marginXPt + col * (layout.cardWidthPt + layout.gutterPt);
}
function cardY(row: number, layout: PageLayout): number {
	return LETTER_H - layout.marginYPt - (row + 1) * layout.cardHeightPt - row * layout.gutterPt;
}

function drawCropMarks(page: PDFPage, layout: PageLayout) {
	const { cols, rows } = layout;

	for (let col = 0; col < cols; col++) {
		const left = cardX(col, layout);
		const right = left + layout.cardWidthPt;

		// Vertical marks at top and bottom margins for each card edge
		const topEdge = LETTER_H - layout.marginYPt;
		const botEdge = cardY(rows - 1, layout);

		// Top margin marks
		page.drawLine({ start: { x: left, y: topEdge + CROP_OFFSET }, end: { x: left, y: topEdge + CROP_OFFSET + CROP_LEN }, thickness: 0.5, color: CROP_COLOR });
		page.drawLine({ start: { x: right, y: topEdge + CROP_OFFSET }, end: { x: right, y: topEdge + CROP_OFFSET + CROP_LEN }, thickness: 0.5, color: CROP_COLOR });

		// Bottom margin marks
		page.drawLine({ start: { x: left, y: botEdge - CROP_OFFSET }, end: { x: left, y: botEdge - CROP_OFFSET - CROP_LEN }, thickness: 0.5, color: CROP_COLOR });
		page.drawLine({ start: { x: right, y: botEdge - CROP_OFFSET }, end: { x: right, y: botEdge - CROP_OFFSET - CROP_LEN }, thickness: 0.5, color: CROP_COLOR });
	}

	for (let row = 0; row < rows; row++) {
		const top = cardY(row, layout) + layout.cardHeightPt;
		const bot = cardY(row, layout);

		const leftEdge = layout.marginXPt;
		const rightEdge = cardX(cols - 1, layout) + layout.cardWidthPt;

		// Left margin marks
		page.drawLine({ start: { x: leftEdge - CROP_OFFSET, y: top }, end: { x: leftEdge - CROP_OFFSET - CROP_LEN, y: top }, thickness: 0.5, color: CROP_COLOR });
		page.drawLine({ start: { x: leftEdge - CROP_OFFSET, y: bot }, end: { x: leftEdge - CROP_OFFSET - CROP_LEN, y: bot }, thickness: 0.5, color: CROP_COLOR });

		// Right margin marks
		page.drawLine({ start: { x: rightEdge + CROP_OFFSET, y: top }, end: { x: rightEdge + CROP_OFFSET + CROP_LEN, y: top }, thickness: 0.5, color: CROP_COLOR });
		page.drawLine({ start: { x: rightEdge + CROP_OFFSET, y: bot }, end: { x: rightEdge + CROP_OFFSET + CROP_LEN, y: bot }, thickness: 0.5, color: CROP_COLOR });
	}
}

function drawSheetLabel(
	page: PDFPage,
	font: PDFFont,
	fontBold: PDFFont,
	side: string,
	sheetNum: number,
	totalSheets: number,
	deckName: string,
	deckSummary = "",
) {
	const label = `${side}  ·  Sheet ${sheetNum} of ${totalSheets}`;
	const labelWidth = fontBold.widthOfTextAtSize(label, 7);
	page.drawText(label, {
		x: LETTER_W - labelWidth - LABEL_EDGE_X,
		y: LETTER_H - LABEL_EDGE_Y - 7,
		size: 7,
		font: fontBold,
		color: GUIDE_COLOR,
	});

	// Recipe params, centered in the top margin (may overlap the flip guide — fine).
	if (deckSummary) {
		const sumWidth = font.widthOfTextAtSize(deckSummary, 7);
		page.drawText(deckSummary, {
			x: (LETTER_W - sumWidth) / 2,
			y: LETTER_H - LABEL_EDGE_Y - 7,
			size: 7,
			font: fontBold,
			color: GUIDE_COLOR,
		});
	}

	if (deckName) {
		page.drawText(deckName, {
			x: LABEL_EDGE_X,
			y: LETTER_H - LABEL_EDGE_Y - 6,
			size: 6,
			font,
			color: GUIDE_COLOR,
		});
	}
}

function drawFlipHint(
	page: PDFPage,
	font: PDFFont,
	hint: string,
) {
	page.drawText(hint, {
		x: LABEL_EDGE_X,
		y: LABEL_EDGE_Y,
		size: 6,
		font,
		color: GUIDE_COLOR,
	});

	// Arrow in bottom-right indicating long-edge flip direction
	const flipText = ">> LONG EDGE";
	const flipWidth = font.widthOfTextAtSize(flipText, 6);
	page.drawText(flipText, {
		x: LETTER_W - LABEL_EDGE_X - flipWidth,
		y: LABEL_EDGE_Y,
		size: 6,
		font,
		color: GUIDE_COLOR,
	});
}

function addFlipInstructionPage(
	pdfDoc: PDFDocument,
	font: PDFFont,
	fontBold: PDFFont,
) {
	const page = pdfDoc.addPage([LETTER_W, LETTER_H]);
	const cx = LETTER_W / 2;
	let y = LETTER_H / 2 + 60;

	const title = "STOP: FLIP YOUR PAPER";
	const titleW = fontBold.widthOfTextAtSize(title, 16);
	page.drawText(title, { x: cx - titleW / 2, y, size: 16, font: fontBold, color: GUIDE_COLOR });

	y -= 36;
	const steps = [
		"1.  Remove all printed fronts from the output tray",
		"2.  Flip the stack on the LONG EDGE",
		"3.  Reinsert into the paper tray, top edge goes in first",
		"4.  Print the remaining pages (all backs)",
	];
	for (const step of steps) {
		const w = font.widthOfTextAtSize(step, 10);
		page.drawText(step, { x: cx - w / 2, y, size: 10, font, color: GUIDE_COLOR });
		y -= 18;
	}

	y -= 12;
	const note = "This page does not print on card stock. It is an instruction separator.";
	const noteW = font.widthOfTextAtSize(note, 7);
	page.drawText(note, { x: cx - noteW / 2, y, size: 7, font, color: GUIDE_COLOR });
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Uint8Array {
	const dataUrl = canvas.toDataURL('image/png');
	const base64 = dataUrl.split(',')[1]!;
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
