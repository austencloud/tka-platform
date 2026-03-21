import { PDFDocument } from 'pdf-lib';
import type { CardPair, IPrintPDFExporter } from '../contracts/IPrintPDFExporter';

// MPC single-card pages: 822x1122 pixels at 300 DPI
const PAGE_WIDTH_PT = (822 / 300) * 72; // 197.28
const PAGE_HEIGHT_PT = (1122 / 300) * 72; // 269.28

// Home printing: US Letter (8.5" x 11")
const LETTER_W = 612; // 8.5 * 72
const LETTER_H = 792; // 11 * 72

// Card size in points: 2.5" x 3.5"
const CARD_W = 180; // 2.5 * 72
const CARD_H = 252; // 3.5 * 72

// Grid: 3 columns x 3 rows = 9 cards per sheet
const COLS = 3;
const ROWS = 3;
const CARDS_PER_SHEET = COLS * ROWS;

// Center the grid on the page
const GRID_W = COLS * CARD_W; // 540
const GRID_H = ROWS * CARD_H; // 756
const MARGIN_X = (LETTER_W - GRID_W) / 2; // 36
const MARGIN_Y = (LETTER_H - GRID_H) / 2; // 18

export class PrintPDFExporter implements IPrintPDFExporter {
	/** One card per page, alternating front/back. For MPC/print service upload. */
	async exportDeckPDF(
		pairs: CardPair[],
		_deckName: string,
		onProgress?: (current: number, total: number) => void
	): Promise<Blob> {
		const pdfDoc = await PDFDocument.create();
		const total = pairs.length;

		for (let i = 0; i < pairs.length; i++) {
			const pair = pairs[i]!;

			const frontImage = await pdfDoc.embedPng(canvasToPngBytes(pair.front));
			const frontPage = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
			frontPage.drawImage(frontImage, {
				x: 0, y: 0,
				width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT
			});

			const backImage = await pdfDoc.embedPng(canvasToPngBytes(pair.back));
			const backPage = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
			backPage.drawImage(backImage, {
				x: 0, y: 0,
				width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT
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
	async exportHomePrintPDF(
		pairs: CardPair[],
		_deckName: string,
		onProgress?: (current: number, total: number) => void
	): Promise<Blob> {
		const pdfDoc = await PDFDocument.create();
		const totalSheets = Math.ceil(pairs.length / CARDS_PER_SHEET);

		for (let sheet = 0; sheet < totalSheets; sheet++) {
			const start = sheet * CARDS_PER_SHEET;
			const sheetPairs = pairs.slice(start, start + CARDS_PER_SHEET);

			// ── Fronts page ──
			const frontsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

			for (let i = 0; i < sheetPairs.length; i++) {
				const col = i % COLS;
				const row = Math.floor(i / COLS);
				const x = MARGIN_X + col * CARD_W;
				// PDF y=0 is bottom, so flip vertically
				const y = LETTER_H - MARGIN_Y - (row + 1) * CARD_H;

				const img = await pdfDoc.embedPng(canvasToPngBytes(sheetPairs[i]!.front));
				frontsPage.drawImage(img, { x, y, width: CARD_W, height: CARD_H });
			}

			// ── Backs page (columns mirrored for double-sided flip) ──
			const backsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

			for (let i = 0; i < sheetPairs.length; i++) {
				const col = i % COLS;
				const row = Math.floor(i / COLS);
				// Mirror columns: 0->2, 1->1, 2->0
				const mirroredCol = COLS - 1 - col;
				const x = MARGIN_X + mirroredCol * CARD_W;
				const y = LETTER_H - MARGIN_Y - (row + 1) * CARD_H;

				const img = await pdfDoc.embedPng(canvasToPngBytes(sheetPairs[i]!.back));
				backsPage.drawImage(img, { x, y, width: CARD_W, height: CARD_H });
			}

			onProgress?.(sheet + 1, totalSheets);
		}

		const pdfBytes = await pdfDoc.save();
		return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
	}
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Uint8Array {
	const dataUrl = canvas.toDataURL('image/png');
	const base64 = dataUrl.split(',')[1]!;
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
