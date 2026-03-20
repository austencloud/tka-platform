import { PDFDocument } from 'pdf-lib';
import type { CardPair, IPrintPDFExporter } from '../contracts/IPrintPDFExporter';

// MPC cards: 822x1122 pixels at 300 DPI
// PDF points = pixels / 300 * 72
const PAGE_WIDTH_PT = (822 / 300) * 72; // 197.28
const PAGE_HEIGHT_PT = (1122 / 300) * 72; // 269.28

export class PrintPDFExporter implements IPrintPDFExporter {
	async exportDeckPDF(
		pairs: CardPair[],
		_deckName: string,
		onProgress?: (current: number, total: number) => void
	): Promise<Blob> {
		const pdfDoc = await PDFDocument.create();
		const total = pairs.length;

		for (let i = 0; i < pairs.length; i++) {
			const pair = pairs[i]!;

			const frontBytes = canvasToPngBytes(pair.front);
			const frontImage = await pdfDoc.embedPng(frontBytes);
			const frontPage = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
			frontPage.drawImage(frontImage, {
				x: 0,
				y: 0,
				width: PAGE_WIDTH_PT,
				height: PAGE_HEIGHT_PT
			});

			const backBytes = canvasToPngBytes(pair.back);
			const backImage = await pdfDoc.embedPng(backBytes);
			const backPage = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
			backPage.drawImage(backImage, {
				x: 0,
				y: 0,
				width: PAGE_WIDTH_PT,
				height: PAGE_HEIGHT_PT
			});

			onProgress?.(i + 1, total);
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
