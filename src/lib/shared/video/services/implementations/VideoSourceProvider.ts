import type { VideoSourceInfo } from "../contracts/types";
export class VideoSourceProvider {
	private videoEl: HTMLVideoElement | null = null;
	private offscreenCanvas: HTMLCanvasElement | null = null;
	private offscreenCtx: CanvasRenderingContext2D | null = null;
	private currentInfo: VideoSourceInfo | null = null;

	async loadFromFile(file: File): Promise<VideoSourceInfo> {
		if (this.currentInfo?.url?.startsWith("blob:")) {
			URL.revokeObjectURL(this.currentInfo.url);
		}
		const url = URL.createObjectURL(file);
		return this.loadFromUrl(url, file.name);
	}

	async loadFromUrl(url: string, fileName?: string): Promise<VideoSourceInfo> {
		this.ensureVideoElement();

		return new Promise<VideoSourceInfo>((resolve, reject) => {
			const vel = this.videoEl!;

			const onLoaded = () => {
				vel.removeEventListener("loadedmetadata", onLoaded);
				vel.removeEventListener("error", onError);

				const info: VideoSourceInfo = {
					url,
					duration: vel.duration,
					width: vel.videoWidth,
					height: vel.videoHeight,
					fps: 30,
					frameCount: Math.ceil(vel.duration * 30),
					originalFileName: fileName,
				};
				this.currentInfo = info;

				this.offscreenCanvas = document.createElement("canvas");
				this.offscreenCanvas.width = vel.videoWidth;
				this.offscreenCanvas.height = vel.videoHeight;
				this.offscreenCtx = this.offscreenCanvas.getContext("2d", {
					willReadFrequently: true,
				});

				resolve(info);
			};

			const onError = () => {
				vel.removeEventListener("loadedmetadata", onLoaded);
				vel.removeEventListener("error", onError);
				reject(new Error(`Failed to load video from ${url}`));
			};

			vel.addEventListener("loadedmetadata", onLoaded);
			vel.addEventListener("error", onError);
			vel.src = url;
			vel.load();
		});
	}

	getVideoElement(): HTMLVideoElement | null {
		return this.videoEl;
	}

	async seekToFrame(frameIndex: number, fps: number): Promise<void> {
		if (!this.videoEl) return;

		const time = frameIndex / fps;

		// Already at the target time - no seek needed.
		if (Math.abs(this.videoEl.currentTime - time) < 0.001) return;

		return new Promise<void>((resolve) => {
			const onSeeked = () => {
				this.videoEl!.removeEventListener("seeked", onSeeked);
				resolve();
			};
			this.videoEl!.addEventListener("seeked", onSeeked);
			this.videoEl!.currentTime = time;
		});
	}

	async extractFrame(frameIndex: number, fps: number): Promise<ImageData> {
		await this.seekToFrame(frameIndex, fps);
		const data = this.getCurrentFrameData();
		if (!data) {
			throw new Error(
				`Cannot extract frame ${frameIndex}: video not ready (readyState=${this.videoEl?.readyState ?? "no element"})`,
			);
		}
		return data;
	}

	getCurrentFrameData(): ImageData | null {
		if (!this.videoEl || !this.offscreenCtx || !this.offscreenCanvas) return null;

		// readyState < 2 means HAVE_CURRENT_DATA hasn't been reached yet,
		// so there's no decoded frame to draw.
		if (this.videoEl.readyState < 2) return null;

		const w = this.offscreenCanvas.width;
		const h = this.offscreenCanvas.height;
		this.offscreenCtx.drawImage(this.videoEl, 0, 0, w, h);
		return this.offscreenCtx.getImageData(0, 0, w, h);
	}

	dispose(): void {
		if (this.currentInfo?.url?.startsWith("blob:")) {
			URL.revokeObjectURL(this.currentInfo.url);
		}
		if (this.videoEl) {
			this.videoEl.pause();
			this.videoEl.removeAttribute("src");
			this.videoEl.load();
			this.videoEl.remove();
			this.videoEl = null;
		}
		this.offscreenCanvas = null;
		this.offscreenCtx = null;
		this.currentInfo = null;
	}

	private ensureVideoElement(): void {
		if (this.videoEl) return;

		this.videoEl = document.createElement("video");
		this.videoEl.crossOrigin = "anonymous";
		this.videoEl.playsInline = true;
		this.videoEl.muted = true;
		this.videoEl.preload = "auto";

		// Appended to DOM hidden so the browser reliably decodes frames.
		this.videoEl.style.cssText =
			"position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1";
		document.body.appendChild(this.videoEl);
	}
}
