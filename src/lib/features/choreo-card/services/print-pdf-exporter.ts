import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { CardPair } from "./types";
import { CARD_SIZES, getPageLayout, type CardSizeId, type PageLayout } from '../domain/card-sizes';

const LETTER_W = 612; // 8.5" × 72
const LETTER_H = 792; // 11" × 72
const GUIDE_COLOR = rgb(0.65, 0.65, 0.65);
const CROP_COLOR = rgb(0.4, 0.4, 0.4);
const CROP_LEN = 8;
const CROP_OFFSET = 2;

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

/** Grid layout on Letter pages for double-sided home printing.
 *
 *  Page 1-2: alignment test sheet (print, flip, hold to light)
 *  Then for each sheet of cards:
 *    Fronts page: cards left-to-right, top-to-bottom
 *    Backs page:  columns mirrored for long-edge duplex flip
 *
 *  Every page gets: margin instructions, crop marks, sheet labels.
 */
export async function exportHomePrintPDF(
	pairs: CardPair[],
	deckName: string,
	cardSize: CardSizeId = 'poker',
	onProgress?: (current: number, total: number) => void
): Promise<Blob> {
	const layout = getPageLayout(cardSize);
	const { cols, rows, cardsPerPage, cardWidthPt, cardHeightPt, marginXPt, marginYPt } = layout;

	const pdfDoc = await PDFDocument.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const totalSheets = Math.ceil(pairs.length / cardsPerPage);

	addAlignmentTestFront(pdfDoc, font, fontBold, layout);
	addAlignmentTestBack(pdfDoc, font, fontBold, layout);

	for (let sheet = 0; sheet < totalSheets; sheet++) {
		const start = sheet * cardsPerPage;
		const sheetPairs = pairs.slice(start, start + cardsPerPage);

		// ── Fronts page ──
		const frontsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

		for (let i = 0; i < sheetPairs.length; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const x = marginXPt + col * cardWidthPt;
			const y = LETTER_H - marginYPt - (row + 1) * cardHeightPt;

			const img = await pdfDoc.embedPng(canvasToPngBytes(sheetPairs[i]!.front));
			frontsPage.drawImage(img, { x, y, width: cardWidthPt, height: cardHeightPt });
		}

		drawCropMarks(frontsPage, layout);
		drawSheetLabel(frontsPage, font, fontBold, `FRONTS`, sheet + 1, totalSheets, deckName);
		drawFlipHint(frontsPage, font, "FRONT SIDE — print this page first");

		// ── Backs page ──
		const backsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

		for (let i = 0; i < sheetPairs.length; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const mirroredCol = cols - 1 - col;
			const x = marginXPt + mirroredCol * cardWidthPt;
			const y = LETTER_H - marginYPt - (row + 1) * cardHeightPt;

			const img = await pdfDoc.embedPng(canvasToPngBytes(sheetPairs[i]!.back));
			backsPage.drawImage(img, { x, y, width: cardWidthPt, height: cardHeightPt });
		}

		drawCropMarks(backsPage, layout);
		drawSheetLabel(backsPage, font, fontBold, `BACKS`, sheet + 1, totalSheets, deckName);
		drawFlipHint(backsPage, font, "BACK SIDE — reinsert paper, flip on long edge, top goes in first");

		onProgress?.(sheet + 1, totalSheets);
	}

	const pdfBytes = await pdfDoc.save();
	return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

function drawCropMarks(
	page: PDFPage,
	layout: PageLayout,
) {
	const { cols, rows, cardWidthPt, cardHeightPt, marginXPt, marginYPt } = layout;

	for (let col = 0; col <= cols; col++) {
		for (let row = 0; row <= rows; row++) {
			const x = marginXPt + col * cardWidthPt;
			const y = LETTER_H - marginYPt - row * cardHeightPt;

			// Top tick
			if (row === 0) {
				page.drawLine({ start: { x, y: y + CROP_OFFSET }, end: { x, y: y + CROP_OFFSET + CROP_LEN }, thickness: 0.5, color: CROP_COLOR });
			}
			// Bottom tick
			if (row === rows) {
				page.drawLine({ start: { x, y: y - CROP_OFFSET }, end: { x, y: y - CROP_OFFSET - CROP_LEN }, thickness: 0.5, color: CROP_COLOR });
			}
			// Left tick
			if (col === 0) {
				page.drawLine({ start: { x: x - CROP_OFFSET, y }, end: { x: x - CROP_OFFSET - CROP_LEN, y }, thickness: 0.5, color: CROP_COLOR });
			}
			// Right tick
			if (col === cols) {
				page.drawLine({ start: { x: x + CROP_OFFSET, y }, end: { x: x + CROP_OFFSET + CROP_LEN, y }, thickness: 0.5, color: CROP_COLOR });
			}
		}
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
) {
	const label = `${side}  ·  Sheet ${sheetNum} of ${totalSheets}`;
	const labelWidth = fontBold.widthOfTextAtSize(label, 7);
	page.drawText(label, {
		x: LETTER_W - labelWidth - 8,
		y: LETTER_H - 10,
		size: 7,
		font: fontBold,
		color: GUIDE_COLOR,
	});

	if (deckName) {
		page.drawText(deckName, {
			x: 8,
			y: LETTER_H - 10,
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
		x: 8,
		y: 6,
		size: 6,
		font,
		color: GUIDE_COLOR,
	});

	// Arrow in bottom-right indicating long-edge flip direction
	const arrowX = LETTER_W - 30;
	const arrowY = 10;
	// Curved arrow symbol via text
	page.drawText("↻ LONG EDGE", {
		x: arrowX - 30,
		y: arrowY - 4,
		size: 6,
		font,
		color: GUIDE_COLOR,
	});
}

function addAlignmentTestFront(
	pdfDoc: PDFDocument,
	font: PDFFont,
	fontBold: PDFFont,
	layout: PageLayout,
) {
	const page = pdfDoc.addPage([LETTER_W, LETTER_H]);
	const { cols, rows, cardWidthPt, cardHeightPt, marginXPt, marginYPt } = layout;

	// Title
	page.drawText("ALIGNMENT TEST — FRONT", {
		x: marginXPt,
		y: LETTER_H - marginYPt + 6,
		size: 10,
		font: fontBold,
		color: GUIDE_COLOR,
	});

	// Draw grid outline
	for (let col = 0; col <= cols; col++) {
		const x = marginXPt + col * cardWidthPt;
		page.drawLine({
			start: { x, y: LETTER_H - marginYPt },
			end: { x, y: LETTER_H - marginYPt - rows * cardHeightPt },
			thickness: 0.5,
			color: CROP_COLOR,
		});
	}
	for (let row = 0; row <= rows; row++) {
		const y = LETTER_H - marginYPt - row * cardHeightPt;
		page.drawLine({
			start: { x: marginXPt, y },
			end: { x: marginXPt + cols * cardWidthPt, y },
			thickness: 0.5,
			color: CROP_COLOR,
		});
	}

	// Label each cell with position number and "FRONT"
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const i = row * cols + col + 1;
			const cx = marginXPt + col * cardWidthPt + cardWidthPt / 2;
			const cy = LETTER_H - marginYPt - row * cardHeightPt - cardHeightPt / 2;

			const numText = String(i);
			const numWidth = fontBold.widthOfTextAtSize(numText, 24);
			page.drawText(numText, { x: cx - numWidth / 2, y: cy + 4, size: 24, font: fontBold, color: GUIDE_COLOR });

			const subText = "FRONT";
			const subWidth = font.widthOfTextAtSize(subText, 8);
			page.drawText(subText, { x: cx - subWidth / 2, y: cy - 12, size: 8, font, color: GUIDE_COLOR });
		}
	}

	// Corner registration marks (filled circles in corners of grid)
	const markR = 4;
	const corners = [
		{ x: marginXPt, y: LETTER_H - marginYPt },
		{ x: marginXPt + cols * cardWidthPt, y: LETTER_H - marginYPt },
		{ x: marginXPt, y: LETTER_H - marginYPt - rows * cardHeightPt },
		{ x: marginXPt + cols * cardWidthPt, y: LETTER_H - marginYPt - rows * cardHeightPt },
	];
	for (const c of corners) {
		page.drawCircle({ x: c.x, y: c.y, size: markR, color: CROP_COLOR });
	}

	// Instructions at bottom
	const instructions = [
		"1. Print this page",
		"2. Reinsert the paper: flip on the LONG EDGE, feed top edge first",
		"3. Print the next page (ALIGNMENT TEST — BACK)",
		"4. Hold to light — if numbers and circles align, your flip is correct",
		"5. If they don't align, try flipping the other way and reprint",
	];
	let iy = 52;
	for (const line of instructions) {
		page.drawText(line, { x: marginXPt, y: iy, size: 7, font, color: GUIDE_COLOR });
		iy -= 10;
	}
}

function addAlignmentTestBack(
	pdfDoc: PDFDocument,
	font: PDFFont,
	fontBold: PDFFont,
	layout: PageLayout,
) {
	const page = pdfDoc.addPage([LETTER_W, LETTER_H]);
	const { cols, rows, cardWidthPt, cardHeightPt, marginXPt, marginYPt } = layout;

	page.drawText("ALIGNMENT TEST — BACK", {
		x: marginXPt,
		y: LETTER_H - marginYPt + 6,
		size: 10,
		font: fontBold,
		color: GUIDE_COLOR,
	});

	// Same grid outline
	for (let col = 0; col <= cols; col++) {
		const x = marginXPt + col * cardWidthPt;
		page.drawLine({
			start: { x, y: LETTER_H - marginYPt },
			end: { x, y: LETTER_H - marginYPt - rows * cardHeightPt },
			thickness: 0.5,
			color: CROP_COLOR,
		});
	}
	for (let row = 0; row <= rows; row++) {
		const y = LETTER_H - marginYPt - row * cardHeightPt;
		page.drawLine({
			start: { x: marginXPt, y },
			end: { x: marginXPt + cols * cardWidthPt, y },
			thickness: 0.5,
			color: CROP_COLOR,
		});
	}

	// Same position numbers + "BACK" — but columns mirrored
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const i = row * cols + col + 1;
			const mirroredCol = cols - 1 - col;
			const cx = marginXPt + mirroredCol * cardWidthPt + cardWidthPt / 2;
			const cy = LETTER_H - marginYPt - row * cardHeightPt - cardHeightPt / 2;

			const numText = String(i);
			const numWidth = fontBold.widthOfTextAtSize(numText, 24);
			page.drawText(numText, { x: cx - numWidth / 2, y: cy + 4, size: 24, font: fontBold, color: GUIDE_COLOR });

			const subText = "BACK";
			const subWidth = font.widthOfTextAtSize(subText, 8);
			page.drawText(subText, { x: cx - subWidth / 2, y: cy - 12, size: 8, font, color: GUIDE_COLOR });
		}
	}

	// Same corner registration marks — mirrored columns
	const markR = 4;
	const corners = [
		{ x: marginXPt, y: LETTER_H - marginYPt },
		{ x: marginXPt + cols * cardWidthPt, y: LETTER_H - marginYPt },
		{ x: marginXPt, y: LETTER_H - marginYPt - rows * cardHeightPt },
		{ x: marginXPt + cols * cardWidthPt, y: LETTER_H - marginYPt - rows * cardHeightPt },
	];
	for (const c of corners) {
		page.drawCircle({ x: c.x, y: c.y, size: markR, color: CROP_COLOR });
	}

	page.drawText("Hold to light — numbers should overlap their front-side counterparts", {
		x: marginXPt, y: 42, size: 7, font, color: GUIDE_COLOR,
	});
	page.drawText("If misaligned: reinsert paper the other way and reprint this page", {
		x: marginXPt, y: 32, size: 7, font, color: GUIDE_COLOR,
	});
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Uint8Array {
	const dataUrl = canvas.toDataURL('image/png');
	const base64 = dataUrl.split(',')[1]!;
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
