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
	const { cols, rows, cardsPerPage, cardWidthPt, cardHeightPt, gutterPt, marginXPt, marginYPt } = layout;

	const pdfDoc = await PDFDocument.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const totalSheets = Math.ceil(pairs.length / cardsPerPage);

	// ── Phase 1: All fronts ──
	for (let sheet = 0; sheet < totalSheets; sheet++) {
		const start = sheet * cardsPerPage;
		const sheetPairs = pairs.slice(start, start + cardsPerPage);

		const frontsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

		for (let i = 0; i < sheetPairs.length; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const x = marginXPt + col * (cardWidthPt + gutterPt);
			const y = LETTER_H - marginYPt - (row + 1) * cardHeightPt - row * gutterPt;

			const img = await pdfDoc.embedPng(canvasToPngBytes(sheetPairs[i]!.front));
			frontsPage.drawImage(img, { x, y, width: cardWidthPt, height: cardHeightPt });
		}

		drawCropMarks(frontsPage, layout);
		drawSheetLabel(frontsPage, font, fontBold, `FRONTS`, sheet + 1, totalSheets, deckName);
		drawFlipHint(frontsPage, font, "FRONT SIDE");

		onProgress?.(sheet + 1, totalSheets * 2);
	}

	// ── Separator: flip instruction page ──
	addFlipInstructionPage(pdfDoc, font, fontBold);

	// ── Phase 2: All backs ──
	for (let sheet = 0; sheet < totalSheets; sheet++) {
		const start = sheet * cardsPerPage;
		const sheetPairs = pairs.slice(start, start + cardsPerPage);

		const backsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

		for (let i = 0; i < sheetPairs.length; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const mirroredCol = cols - 1 - col;
			const x = marginXPt + mirroredCol * (cardWidthPt + gutterPt);
			const y = LETTER_H - marginYPt - (row + 1) * cardHeightPt - row * gutterPt;

			const img = await pdfDoc.embedPng(canvasToPngBytes(sheetPairs[i]!.back));
			backsPage.drawImage(img, { x, y, width: cardWidthPt, height: cardHeightPt });
		}

		drawCropMarks(backsPage, layout);
		drawSheetLabel(backsPage, font, fontBold, `BACKS`, sheet + 1, totalSheets, deckName);
		drawFlipHint(backsPage, font, "BACK SIDE — columns mirrored for long-edge flip");

		onProgress?.(totalSheets + sheet + 1, totalSheets * 2);
	}

	// ── Finishing tips page ──
	addFinishingTipsPage(pdfDoc, font, fontBold);

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
	page.drawText(">> LONG EDGE", {
		x: arrowX - 30,
		y: arrowY - 4,
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

	const title = "STOP — FLIP YOUR PAPER";
	const titleW = fontBold.widthOfTextAtSize(title, 16);
	page.drawText(title, { x: cx - titleW / 2, y, size: 16, font: fontBold, color: GUIDE_COLOR });

	y -= 36;
	const steps = [
		"1.  Remove all printed fronts from the output tray",
		"2.  Flip the stack on the LONG EDGE",
		"3.  Reinsert into the paper tray — top edge goes in first",
		"4.  Print the remaining pages (all backs)",
	];
	for (const step of steps) {
		const w = font.widthOfTextAtSize(step, 10);
		page.drawText(step, { x: cx - w / 2, y, size: 10, font, color: GUIDE_COLOR });
		y -= 18;
	}

	y -= 12;
	const note = "This page does not print on card stock — it is an instruction separator.";
	const noteW = font.widthOfTextAtSize(note, 7);
	page.drawText(note, { x: cx - noteW / 2, y, size: 7, font, color: GUIDE_COLOR });
}

function addFinishingTipsPage(
	pdfDoc: PDFDocument,
	font: PDFFont,
	fontBold: PDFFont,
) {
	const page = pdfDoc.addPage([LETTER_W, LETTER_H]);
	const cx = LETTER_W / 2;
	let y = LETTER_H - 72;

	const title = "FINISHING YOUR DECK";
	const titleW = fontBold.widthOfTextAtSize(title, 14);
	page.drawText(title, { x: cx - titleW / 2, y, size: 14, font: fontBold, color: GUIDE_COLOR });

	y -= 28;
	const sections: { heading: string; lines: string[] }[] = [
		{
			heading: "CUTTING",
			lines: [
				"Use a paper trimmer or metal ruler + craft knife for clean edges.",
				"Cut along the crop marks. A self-healing cutting mat protects your surface.",
				"Cut all sheets before assembling — batch work is faster than per-sheet.",
			],
		},
		{
			heading: "PROTECTION",
			lines: [
				"Sleeve cards in standard poker sleeves (66 x 91 mm) for durability and shuffle feel.",
				"For unsleeved decks: clear spray sealant (matte or gloss) on both sides after cutting.",
				"Self-adhesive laminate sheets also work — apply before cutting for cleaner edges.",
			],
		},
		{
			heading: "STORAGE",
			lines: [
				"A standard tuck box fits 52-60 sleeved poker cards.",
				"Rubber band + card divider works for playtesting and gifting.",
			],
		},
	];

	for (const section of sections) {
		const headW = fontBold.widthOfTextAtSize(section.heading, 9);
		page.drawText(section.heading, { x: cx - headW / 2, y, size: 9, font: fontBold, color: GUIDE_COLOR });
		y -= 14;
		for (const line of section.lines) {
			const lineW = font.widthOfTextAtSize(line, 8);
			page.drawText(line, { x: cx - lineW / 2, y, size: 8, font, color: GUIDE_COLOR });
			y -= 12;
		}
		y -= 8;
	}

	y -= 8;
	const footer = "tkaflowarts.com";
	const footerW = font.widthOfTextAtSize(footer, 7);
	page.drawText(footer, { x: cx - footerW / 2, y, size: 7, font, color: GUIDE_COLOR });
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Uint8Array {
	const dataUrl = canvas.toDataURL('image/png');
	const base64 = dataUrl.split(',')[1]!;
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
