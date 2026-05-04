import { PDFDocument } from 'pdf-lib';
import type { CardPair } from "./contracts/types";
import { CARD_SIZES, getPageLayout, type CardSizeId } from '../domain/card-sizes';

// Home printing: US Letter (8.5" x 11")
const LETTER_W = 612; // 8.5 * 72
const LETTER_H = 792; // 11 * 72

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
 *  Each sheet pair:
 *    Page 1 (fronts): cards laid out left-to-right, top-to-bottom
 *    Page 2 (backs):  same cards but columns mirrored (3,2,1 instead of 1,2,3)
 *                     so flipping the paper along the long edge aligns each back
 *                     with its front.
 */
export async function exportHomePrintPDF(
	pairs: CardPair[],
	_deckName: string,
	cardSize: CardSizeId = 'poker',
	onProgress?: (current: number, total: number) => void
): Promise<Blob> {
	const layout = getPageLayout(cardSize);
	const { cols, cardsPerPage, cardWidthPt, cardHeightPt, marginXPt, marginYPt } = layout;

	const pdfDoc = await PDFDocument.create();
	const totalSheets = Math.ceil(pairs.length / cardsPerPage);

	for (let sheet = 0; sheet < totalSheets; sheet++) {
		const start = sheet * cardsPerPage;
		const sheetPairs = pairs.slice(start, start + cardsPerPage);

		// ── Fronts page ──
		const frontsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

		for (let i = 0; i < sheetPairs.length; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const x = marginXPt + col * cardWidthPt;
			// PDF y=0 is bottom, so flip vertically
			const y = LETTER_H - marginYPt - (row + 1) * cardHeightPt;

			const img = await pdfDoc.embedPng(canvasToPngBytes(sheetPairs[i]!.front));
			frontsPage.drawImage(img, { x, y, width: cardWidthPt, height: cardHeightPt });
		}

		// ── Backs page (columns mirrored for double-sided flip) ──
		const backsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

		for (let i = 0; i < sheetPairs.length; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			// Mirror columns so flipping along the long edge aligns each back with its front
			const mirroredCol = cols - 1 - col;
			const x = marginXPt + mirroredCol * cardWidthPt;
			const y = LETTER_H - marginYPt - (row + 1) * cardHeightPt;

			const img = await pdfDoc.embedPng(canvasToPngBytes(sheetPairs[i]!.back));
			backsPage.drawImage(img, { x, y, width: cardWidthPt, height: cardHeightPt });
		}

		onProgress?.(sheet + 1, totalSheets);
	}

	const pdfBytes = await pdfDoc.save();
	return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Uint8Array {
	const dataUrl = canvas.toDataURL('image/png');
	const base64 = dataUrl.split(',')[1]!;
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
