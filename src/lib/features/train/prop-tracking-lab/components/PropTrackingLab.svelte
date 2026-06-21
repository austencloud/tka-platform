<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type {
		TrackedFrame,
		BoundingBox,
		TrackingSession,
		NormalizedPoint
	} from '../domain/models';
	import { SimplePropTracker } from '../services/simple-prop-tracker';
	import VideoCanvas from './VideoCanvas.svelte';
	import TrajectoryOverlay from './TrajectoryOverlay.svelte';
	import ControlBar from './ControlBar.svelte';
	import { ArucoStaffTracker } from '../services/aruco-staff-tracker';
	import { GridFrameSolver } from '../services/grid-frame-solver';
	import { framesToNotation } from '../services/notation-pipeline';
	import { notationToPictographData } from '../services/notation-to-pictograph';
	import { DEFAULT_MARKER_ASSIGNMENT, type StaffPose3D } from '../domain/notation-3d';
	import PictographContainer from '$lib/shared/pictograph/shared/components/PictographContainer.svelte';
	import type { PictographData } from '$lib/shared/pictograph/shared/domain/models/pictograph-data';

	let videoFile = $state<File | null>(null);
	let videoUrl = $state<string | null>(null);
	let videoElement = $state<HTMLVideoElement | null>(null);
	let videoDuration = $state(0);
	let videoWidth = $state(0);
	let videoHeight = $state(0);
	let fps = $state(30);

	type LabPhase = 'upload' | 'draw-box' | 'tracking' | 'review';
	let phase = $state<LabPhase>('upload');
	let initialBox = $state<BoundingBox | null>(null);
	let trackedFrames = $state<TrackedFrame[]>([]);
	let currentFrameIndex = $state(0);
	let isTracking = $state(false);
	let trackingProgress = $state(0);

	let extractionCanvas: HTMLCanvasElement | null = null;
	let extractionCtx: CanvasRenderingContext2D | null = null;

	const tracker = new SimplePropTracker();

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];

			if (!file.type.startsWith('video/')) {
				alert('Please select a video file');
				return;
			}

			videoFile = file;
			videoUrl = URL.createObjectURL(file);
			phase = 'draw-box';
		}
	}

	function handleVideoLoaded(event: Event) {
		const video = event.target as HTMLVideoElement;
		videoElement = video;
		videoDuration = video.duration * 1000; 
		videoWidth = video.videoWidth;
		videoHeight = video.videoHeight;

		fps = 30;

		video.currentTime = 0;
		video.pause();
	}

	function handleBoxDrawn(box: BoundingBox) {
		initialBox = box;
	}

	async function startTracking() {
		if (!initialBox || !videoElement) return;

		phase = 'tracking';
		isTracking = true;
		trackedFrames = [];
		trackingProgress = 0;

		extractionCanvas = document.createElement('canvas');
		extractionCanvas.width = videoWidth;
		extractionCanvas.height = videoHeight;
		extractionCtx = extractionCanvas.getContext('2d', { willReadFrequently: true });

		if (!extractionCtx) {
			console.error('Could not get canvas context');
			return;
		}

		const totalFrames = Math.floor((videoDuration / 1000) * fps);
		const frameDuration = 1000 / fps;

		videoElement.currentTime = 0;
		await waitForSeek(videoElement);

		extractionCtx.drawImage(videoElement, 0, 0);
		const firstFrameData = extractionCtx.getImageData(0, 0, videoWidth, videoHeight);

		const firstTrackedFrame = await tracker.initialize(firstFrameData, initialBox);
		trackedFrames = [firstTrackedFrame];
		trackingProgress = 1 / totalFrames;

		for (let i = 1; i < totalFrames; i++) {
			const timestamp = i * frameDuration;
			videoElement.currentTime = timestamp / 1000;
			await waitForSeek(videoElement);

			extractionCtx.drawImage(videoElement, 0, 0);
			const frameData = extractionCtx.getImageData(0, 0, videoWidth, videoHeight);

			const trackedFrame = await tracker.trackFrame(frameData, i, timestamp);
			trackedFrames = [...trackedFrames, trackedFrame];
			trackingProgress = (i + 1) / totalFrames;

			if (i % 10 === 0) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}

		isTracking = false;
		phase = 'review';
		currentFrameIndex = 0;
	}

	function waitForSeek(video: HTMLVideoElement): Promise<void> {
		return new Promise(resolve => {
			const handler = () => {
				video.removeEventListener('seeked', handler);
				resolve();
			};
			video.addEventListener('seeked', handler);
		});
	}

	let notationPictographs = $state<PictographData[]>([]);
	let isNotating = $state(false);

	async function runNotation() {
		const video = videoElement;
		if (!video) return;
		isNotating = true;
		notationPictographs = [];
		const assignment = DEFAULT_MARKER_ASSIGNMENT;
		const tracker = new ArucoStaffTracker(assignment, videoWidth);

		const blueFrames: StaffPose3D[] = [];
		const redFrames: StaffPose3D[] = [];
		const blueConf: number[] = [];
		const redConf: number[] = [];

		const total = Math.floor((videoDuration / 1000) * fps);
		const dt = 1000 / fps;
		extractionCanvas ??= document.createElement('canvas');
		extractionCanvas.width = videoWidth;
		extractionCanvas.height = videoHeight;
		extractionCtx ??= extractionCanvas.getContext('2d', { willReadFrequently: true });
		if (!extractionCtx) {
			isNotating = false;
			return;
		}

		let lastBlue: StaffPose3D | null = null;
		let lastRed: StaffPose3D | null = null;

		for (let i = 0; i < total; i++) {
			video.currentTime = (i * dt) / 1000;
			await waitForSeek(video);
			extractionCtx.drawImage(video, 0, 0);
			const frame = extractionCtx.getImageData(0, 0, videoWidth, videoHeight);

			const markers = tracker.detect(frame);
			const center = markers.find((m) => m.id === assignment.centerRefId);
			const blue = markers.find((m) => m.id === assignment.blueId);
			const red = markers.find((m) => m.id === assignment.redId);

			if (center && blue) {
				lastBlue = GridFrameSolver.solve(blue, GridFrameSolver.gridFromCamera(center));
				blueConf.push(1);
			} else {
				blueConf.push(0);
			}
			if (center && red) {
				lastRed = GridFrameSolver.solve(red, GridFrameSolver.gridFromCamera(center));
				redConf.push(1);
			} else {
				redConf.push(0);
			}

			// Hold last good pose through short dropouts (segmenter interpolates).
			if (lastBlue) blueFrames.push(lastBlue);
			if (lastRed) redFrames.push(lastRed);
		}

		const beats = framesToNotation(blueFrames, redFrames, blueConf, redConf);
		notationPictographs = beats.map((b, i) => notationToPictographData(b.blue, b.red, `beat-${i}`));
		isNotating = false;
	}

	function toggleKeyframe(frameIndex: number) {
		trackedFrames = trackedFrames.map((frame, i) =>
			i === frameIndex
				? { ...frame, isKeyframe: !frame.isKeyframe }
				: frame
		);
	}

	function markCurrentAsKeyframe() {
		toggleKeyframe(currentFrameIndex);
	}

	function seekToFrame(index: number) {
		if (index >= 0 && index < trackedFrames.length) {
			currentFrameIndex = index;
			if (videoElement && trackedFrames[index]) {
				videoElement.currentTime = trackedFrames[index].timestamp / 1000;
			}
		}
	}

	function nextFrame() {
		seekToFrame(currentFrameIndex + 1);
	}

	function prevFrame() {
		seekToFrame(currentFrameIndex - 1);
	}

	function nextKeyframe() {
		for (let i = currentFrameIndex + 1; i < trackedFrames.length; i++) {
			if (trackedFrames[i]?.isKeyframe) {
				seekToFrame(i);
				return;
			}
		}
	}

	function prevKeyframe() {
		for (let i = currentFrameIndex - 1; i >= 0; i--) {
			if (trackedFrames[i]?.isKeyframe) {
				seekToFrame(i);
				return;
			}
		}
	}

	let currentFrame = $derived(trackedFrames[currentFrameIndex] ?? null);
	let keyframeCount = $derived(trackedFrames.filter(f => f.isKeyframe).length);
	let trajectory = $derived(trackedFrames.map(f => f.tip).filter((t): t is NormalizedPoint => t !== null));

	onDestroy(() => {
		if (videoUrl) {
			URL.revokeObjectURL(videoUrl);
		}
		tracker.reset();
	});
</script>

<div class="prop-tracking-lab">
	<header class="lab-header">
		<h1>Prop Tracking Lab</h1>
		<p class="subtitle">Proof of Concept: Video → TKA Notation</p>
	</header>

	{#if phase === 'upload'}
		<!-- PHASE 1: Upload Video -->
		<div class="upload-section">
			<div class="upload-card">
				<i class="fa fa-video-camera" aria-hidden="true"></i>
				<h2>Upload a Video</h2>
				<p>Select a video of prop spinning to analyze</p>
				<label class="upload-btn">
					<input
						type="file"
						accept="video/*"
						onchange={handleFileSelect}
						class="sr-only"
					/>
					<span>Choose Video</span>
				</label>
			</div>
		</div>

	{:else if phase === 'draw-box'}
		<!-- PHASE 2: Draw Bounding Box -->
		<div class="draw-section">
			<div class="instructions">
				<h2>Draw a box around the prop</h2>
				<p>Click and drag to draw a bounding box around the prop in the first frame</p>
			</div>

			<VideoCanvas
				{videoUrl}
				onVideoLoaded={handleVideoLoaded}
				onBoxDrawn={handleBoxDrawn}
				drawnBox={initialBox}
			/>

			{#if initialBox}
				<div class="action-bar">
					<button class="btn-primary" onclick={startTracking}>
						<i class="fa fa-play" aria-hidden="true"></i>
						Start Tracking
					</button>
				</div>
			{/if}
		</div>

	{:else if phase === 'tracking'}
		<!-- PHASE 3: Tracking in Progress -->
		<div class="tracking-section">
			<div class="progress-card">
				<h2>Tracking Prop...</h2>
				<div class="progress-bar">
					<div
						class="progress-fill"
						style="width: {trackingProgress * 100}%"
					></div>
				</div>
				<p>{Math.round(trackingProgress * 100)}% complete</p>
				<p class="frame-count">{trackedFrames.length} frames processed</p>
			</div>
		</div>

	{:else if phase === 'review'}
		<!-- PHASE 4: Review Results -->
		<div class="review-section">
			<div class="video-container">
				{#if videoUrl}
					<video
						src={videoUrl}
						bind:this={videoElement}
						class="review-video"
						muted
					></video>
					<TrajectoryOverlay
						{trajectory}
						currentTip={currentFrame?.tip ?? null}
						{videoWidth}
						{videoHeight}
					/>
					{#if currentFrame?.propBox}
						<div
							class="tracking-box"
							style="
								left: {currentFrame.propBox.x * 100}%;
								top: {currentFrame.propBox.y * 100}%;
								width: {currentFrame.propBox.width * 100}%;
								height: {currentFrame.propBox.height * 100}%;
							"
						></div>
					{/if}
				{/if}
			</div>

			<ControlBar
				{currentFrameIndex}
				totalFrames={trackedFrames.length}
				{keyframeCount}
				isKeyframe={currentFrame?.isKeyframe ?? false}
				confidence={currentFrame?.confidence ?? 0}
				onPrevFrame={prevFrame}
				onNextFrame={nextFrame}
				onPrevKeyframe={prevKeyframe}
				onNextKeyframe={nextKeyframe}
				onToggleKeyframe={markCurrentAsKeyframe}
				onSeek={seekToFrame}
			/>

			<div class="stats-panel">
				<div class="stat">
					<span class="stat-label">Frame</span>
					<span class="stat-value">{currentFrameIndex + 1} / {trackedFrames.length}</span>
				</div>
				<div class="stat">
					<span class="stat-label">Confidence</span>
					<span class="stat-value">{((currentFrame?.confidence ?? 0) * 100).toFixed(1)}%</span>
				</div>
				<div class="stat">
					<span class="stat-label">Angle</span>
					<span class="stat-value">
						{currentFrame?.angle !== null
							? `${((currentFrame?.angle ?? 0) * 180 / Math.PI).toFixed(1)}°`
							: 'N/A'}
					</span>
				</div>
				<div class="stat">
					<span class="stat-label">Keyframes</span>
					<span class="stat-value">{keyframeCount}</span>
				</div>
			</div>

			<div class="notation-actions">
				<button class="btn-primary" onclick={runNotation} disabled={isNotating}>
					<i class="fa fa-wand-magic-sparkles" aria-hidden="true"></i>
					{isNotating ? 'Notating…' : 'Notate Flow'}
				</button>
			</div>
			{#if notationPictographs.length > 0}
				<div class="notation-strip">
					{#each notationPictographs as pd (pd.id)}
						<div class="notation-cell">
							<PictographContainer pictographData={pd} disableTransitions />
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.prop-tracking-lab {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 1rem;
		gap: 1rem;
		overflow: auto;
		background: var(--theme-panel-bg);
		color: var(--theme-text);
	}

	.lab-header {
		text-align: center;
	}

	.lab-header h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.subtitle {
		margin: 0.25rem 0 0;
		font-size: var(--font-size-min);
		opacity: 0.7;
	}

	/* Upload Phase */
	.upload-section {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.upload-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem;
		background: var(--theme-card-bg);
		border: 2px dashed var(--theme-stroke);
		border-radius: 16px;
		text-align: center;
	}

	.upload-card i {
		font-size: 3rem;
		opacity: 0.5;
	}

	.upload-card h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.upload-card p {
		margin: 0;
		opacity: 0.7;
	}

	.upload-btn {
		display: inline-flex;
		padding: 0.875rem 1.5rem;
		background: var(--theme-accent);
		color: white;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 600;
		transition: transform 0.2s;
	}

	.upload-btn:hover {
		transform: translateY(-1px);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	/* Draw Phase */
	.draw-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.instructions {
		text-align: center;
	}

	.instructions h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.instructions p {
		margin: 0.25rem 0 0;
		opacity: 0.7;
		font-size: var(--font-size-min);
	}

	.action-bar {
		display: flex;
		justify-content: center;
		padding: 1rem;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 2rem;
		background: linear-gradient(135deg, var(--semantic-success), #059669);
		color: white;
		border: none;
		border-radius: 12px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s;
	}

	.btn-primary:hover {
		transform: translateY(-1px);
	}

	/* Tracking Phase */
	.tracking-section {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.progress-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem;
		background: var(--theme-card-bg);
		border-radius: 16px;
		min-width: 300px;
	}

	.progress-card h2 {
		margin: 0;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background: var(--theme-stroke);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--theme-accent);
		transition: width 0.1s;
	}

	.frame-count {
		opacity: 0.7;
		font-size: var(--font-size-compact);
	}

	/* Review Phase */
	.review-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.video-container {
		position: relative;
		flex: 1;
		min-height: 0;
		background: black;
		border-radius: 12px;
		overflow: hidden;
	}

	.review-video {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.tracking-box {
		position: absolute;
		border: 2px solid var(--semantic-success);
		box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
		pointer-events: none;
	}

	.stats-panel {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.75rem;
		background: var(--theme-card-bg);
		border-radius: 8px;
	}

	.stat-label {
		font-size: var(--font-size-compact);
		opacity: 0.6;
		text-transform: uppercase;
	}

	.stat-value {
		font-size: 1rem;
		font-weight: 600;
	}

	.notation-actions {
		display: flex;
		justify-content: center;
		padding: 0.5rem;
	}

	.notation-strip {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding: 0.5rem;
		background: var(--theme-card-bg);
		border-radius: 8px;
	}

	.notation-cell {
		flex: 0 0 auto;
		width: 120px;
		aspect-ratio: 1;
	}

	@media (max-width: 600px) {
		.stats-panel {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
