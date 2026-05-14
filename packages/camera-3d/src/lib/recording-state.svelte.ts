let recording = $state(false);
let canvasEl: HTMLCanvasElement | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];

function getSupportedMimeType(): string {
	const types = [
		'video/webm;codecs=vp9',
		'video/webm;codecs=vp8',
		'video/webm',
		'video/mp4',
	];
	return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
}

function start() {
	if (!canvasEl || recording) return;
	const stream = canvasEl.captureStream(30);
	const mimeType = getSupportedMimeType();
	recorder = new MediaRecorder(stream, { mimeType });
	chunks = [];
	recorder.ondataavailable = (e) => {
		if (e.data.size > 0) chunks.push(e.data);
	};
	recorder.onstop = () => {
		const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
		const blob = new Blob(chunks, { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${ext}`;
		a.click();
		URL.revokeObjectURL(url);
		chunks = [];
		recording = false;
	};
	recorder.start(100);
	recording = true;
}

function stop() {
	if (recorder && recorder.state !== 'inactive') {
		recorder.stop();
		recorder = null;
	}
}

export function getRecordingState() {
	return {
		get recording() { return recording; },
		setCanvas(c: HTMLCanvasElement) { canvasEl = c; },
		toggle() {
			if (recording) stop();
			else start();
		},
	};
}
