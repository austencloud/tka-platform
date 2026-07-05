<!--
ScanCardSheet.svelte

File physical cards into this collection. A Drawer (bottom sheet on mobile,
right panel on desktop) holds a rear-camera viewfinder; every TKA card QR
that enters the frame is resolved and added to the collection — haptic +
toast per card, running count in the header. Continuous: hold the sheet
open and work through the whole stack.

Cards resolve identity-first (resolveForImport): a card backed by a real
sequence doc is added as a reference; a card whose data lives only in its
shortcode record (printed deck cards) is silently saved as a private copy
to My Library first, then filed. Either way the user sees one behavior:
scan → added. There is no rejection state — every printed card exists in
the system by construction.

Filing scans deliberately write NO scan analytics (scanCount/scanEvents
mean "card discovered in the wild"; filing your own deck would pollute
the geo dashboard).
-->
<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
	import { CameraManager } from "$lib/shared/train/services/camera-manager";
	import { createTkaQrDetector, type TkaQrDetector } from "$lib/shared/qr/services/tka-qr-detector";
	import { extractScanCode } from "$lib/shared/qr/services/extract-scan-code";
	import { getQRCodeGenerator } from "$lib/shared/qr/get-qr-code-generator";
	import { getAppCanonicalURL } from "../../../../../config/domains";
	import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
	import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
	import { addSequenceToCollection } from "$lib/shared/library/services/collection-manager";
	import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
	import { LIBRARY_LIMITS } from "$lib/shared/library/data/firestore-paths";
	import { LibraryError } from "$lib/shared/library/domain/library-error";
	import { authState } from "$lib/shared/auth/state/auth-state.svelte";
	import { toast } from "$lib/shared/toast/state/toast-state.svelte";
	import { browseScrollState } from "$lib/shared/browse/state/browse-scroll-state.svelte";
	import { responsiveLayoutManager } from "$lib/shared/create/services/responsive-layout-manager";
	import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";

	let {
		collectionId,
		onClose,
	}: {
		collectionId: string;
		onClose: () => void;
	} = $props();

	$effect(() => {
		collectionsState.ensureStarted();
	});

	const target = $derived(
		collectionsState.collections.find((c) => c.id === collectionId) ?? null,
	);

	// Drawer plumbing — AddSequencesSheet's exact pattern.
	let drawerOpen = $state(false);
	let isSideBySide = $state(false);
	let layoutUnsubscribe: (() => void) | null = null;
	const placement = $derived(isSideBySide ? "right" : "bottom");

	const CLOSE_ANIMATION_MS = 300;
	function requestClose() {
		if (!drawerOpen) return;
		drawerOpen = false;
		setTimeout(onClose, CLOSE_ANIMATION_MS);
	}

	// Camera + detection.
	const camera = new CameraManager();
	let detector: TkaQrDetector | null = null;
	let videoHost = $state<HTMLDivElement | null>(null);
	let cameraError = $state<string | null>(null);
	let cameraReady = $state(false);

	// Desktop handoff: a desktop usually has no camera worth pointing at a
	// printed card, so the right-side placement leads with a QR that hands the
	// scan job to the user's phone. The phone opens this same collection with
	// the scanner running; cards it files appear in the desktop grid live
	// (the detail view's collection subscription — nothing extra needed here).
	let cameraChosen = $state(false);
	const handoffMode = $derived(placement === "right" && !cameraChosen);
	const handoffUrl = getAppCanonicalURL(
		`browse/collections/${encodeURIComponent(collectionId)}?scan=1`,
	);
	let handoffQrDataUrl = $state<string | null>(null);
	let handoffQrFailed = $state(false);
	// Count cards the phone adds while the handoff panel is up: baseline the
	// collection size when we first see it, then show the live delta.
	let handoffBaseline = $state<number | null>(null);
	const phoneAddedCount = $derived(
		handoffBaseline === null
			? 0
			: Math.max(0, (target?.sequenceCount ?? handoffBaseline) - handoffBaseline),
	);

	// Session bookkeeping.
	let addedCount = $state(0);
	const seen = new Set<string>();
	let processing = false; // one hit at a time; also pauses detection ticks
	let scanTimer: ReturnType<typeof setInterval> | null = null;
	const SCAN_INTERVAL_MS = 200;
	// The camera starts on demand, not on mount: immediately on phones (bottom
	// placement), only after "use this computer's camera" on desktop.
	let cameraStartRequested = false;

	function requestCameraStart() {
		if (cameraStartRequested) return;
		cameraStartRequested = true;
		void startCamera();
	}

	async function startCamera() {
		cameraError = null;
		cameraReady = false;
		try {
			// 1280×720: dense QR modules need more pixels than the 640 default.
			await camera.initialize({ facingMode: "environment", width: 1280, height: 720 });
			await camera.start();
			const video = camera.getVideoElement();
			if (video && videoHost) {
				video.classList.add("viewfinder-video");
				videoHost.replaceChildren(video);
			}
			cameraReady = true;
		} catch (err) {
			// CameraManager maps NotAllowedError/NotFoundError/NotReadableError
			// to user-readable messages already.
			cameraError = err instanceof Error ? err.message : "Couldn't access your camera.";
		}
	}

	async function tick() {
		if (processing || cameraError || !camera.isActive || !detector) return;
		const frame = camera.captureFrame();
		if (!frame) return;
		processing = true;
		try {
			const rawValues = await detector.detect(frame);
			for (const raw of rawValues) {
				const code = extractScanCode(raw);
				if (code) {
					await handleHit(code);
					break; // one card per frame
				}
			}
		} catch {
			// Per-frame decode noise — keep scanning.
		} finally {
			processing = false;
		}
	}

	async function handleHit(code: string) {
		if (seen.has(code)) return;
		seen.add(code);

		try {
			const resolution = await getShortCodeManager().resolveForImport(
				code,
				authState.effectiveUserId ?? null,
			);
			if (!resolution) {
				seen.delete(code); // re-aiming retries
				toast.error("Couldn't read that card — try again.");
				return;
			}

			const word =
				resolution.sequence.word || resolution.sequence.name || "Sequence";
			let targetId = resolution.sequence.id;

			if (!resolution.docBacked) {
				// No referenceable doc behind this card (printed deck cards):
				// save a private copy to My Library, file that. Silent — the
				// user asked to keep the card, and now they do.
				try {
					const saved = await getLibraryRepository().saveSequence(
						resolution.sequence,
						{ visibility: "private" },
					);
					targetId = saved.id;
				} catch (err) {
					if (err instanceof LibraryError && err.code === "ALREADY_EXISTS") {
						// Identical content already lives in the library under another
						// id (e.g. two different printed cards of the same sequence).
						// We can't cheaply recover that id — tell the user instead of
						// importing a duplicate.
						toast.info(`"${word}" is already in your library.`);
						return;
					}
					throw err;
				}
			}

			if (collectionsState.isIn(targetId, collectionId)) {
				toast.info(`"${word}" is already in ${target?.name ?? "this collection"}.`);
				return;
			}

			if (
				target &&
				target.sequenceCount >= LIBRARY_LIMITS.MAX_SEQUENCES_PER_COLLECTION
			) {
				toast.error(
					`"${target.name}" is full (${LIBRARY_LIMITS.MAX_SEQUENCES_PER_COLLECTION} max).`,
				);
				return;
			}

			await addSequenceToCollection(collectionId, targetId);
			addedCount += 1;
			getHapticFeedback()?.trigger("selection");
			toast.success(`"${word}" added ✓`);
		} catch (err) {
			seen.delete(code);
			console.error("[ScanCard] add failed:", err);
			toast.error("Couldn't add that card — try again.");
		}
	}

	onMount(() => {
		isSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
		layoutUnsubscribe = responsiveLayoutManager.onLayoutChange(() => {
			isSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
		});

		// Focus mode: picking through a physical stack, chrome is noise.
		browseScrollState.hideUI();

		detector = createTkaQrDetector();
		scanTimer = setInterval(() => void tick(), SCAN_INTERVAL_MS);

		requestAnimationFrame(() => {
			drawerOpen = true;
		});

		return () => {
			if (scanTimer) clearInterval(scanTimer);
			camera.stop(); // release the camera the moment the sheet goes
			browseScrollState.showUI();
		};
	});

	// Phones scan directly: bottom placement starts the camera immediately
	// (also covers a desktop window resized down to the mobile layout).
	$effect(() => {
		if (placement === "bottom") requestCameraStart();
	});

	// Desktop handoff panel: render the QR once. If generation fails we fall
	// back to showing the link itself, so the handoff still works.
	$effect(() => {
		if (!handoffMode || handoffQrDataUrl || handoffQrFailed) return;
		getQRCodeGenerator()
			.generateForUrl(handoffUrl, { size: 480, margin: 2 })
			.then((result) => {
				handoffQrDataUrl = result.dataUrl;
			})
			.catch((err) => {
				console.error("[ScanCard] handoff QR generation failed:", err);
				handoffQrFailed = true;
			});
	});

	// Baseline the collection size the first time we see it in handoff mode,
	// so the "added from your phone" counter starts at zero.
	$effect(() => {
		if (handoffMode && handoffBaseline === null && target) {
			handoffBaseline = target.sequenceCount;
		}
	});

	onDestroy(() => layoutUnsubscribe?.());

	function countLabel(n: number): string {
		return `${n} ${n === 1 ? "card" : "cards"} added`;
	}
</script>

<Drawer
	isOpen={drawerOpen}
	{placement}
	closeOnBackdrop={true}
	closeOnEscape={true}
	dismissible={true}
	showHandle={placement === "bottom"}
	ariaLabel="Scan cards"
	class="scan-card-drawer"
	onOpenChange={(open) => {
		if (!open) requestClose();
	}}
>
	<div class="sheet-content">
		<header class="panel-header">
			<div class="header-text">
				<h2 class="panel-title">Scan into {target?.name ?? "collection"}</h2>
				<span class="panel-count">{countLabel(addedCount)}</span>
			</div>
			<button type="button" class="done-btn" onclick={requestClose}>
				<i class="fas fa-check" aria-hidden="true"></i>
				<span>Done</span>
			</button>
		</header>

		{#if handoffMode}
			<div class="handoff-panel">
				<div class="qr-box">
					{#if handoffQrDataUrl}
						<img
							class="handoff-qr"
							src={handoffQrDataUrl}
							alt="QR code that opens this collection's card scanner on your phone"
						/>
					{:else if handoffQrFailed}
						<p class="handoff-link-fallback">
							Open this on your phone:
							<span class="handoff-url">{handoffUrl}</span>
						</p>
					{/if}
				</div>
				<p class="handoff-copy">
					Scan this with your phone to add cards. They'll appear here as you go.
				</p>
				<p class="phone-count" aria-live="polite">
					{phoneAddedCount}
					{phoneAddedCount === 1 ? "card" : "cards"} added from your phone
				</p>
				<button
					type="button"
					class="camera-fallback-btn"
					onclick={() => {
						cameraChosen = true;
						requestCameraStart();
					}}
				>
					<i class="fas fa-camera" aria-hidden="true"></i>
					<span>Use this computer's camera</span>
				</button>
			</div>
		{:else}
			<div class="viewfinder">
				{#if cameraError}
					<div class="camera-error" role="alert">
						<i class="fas fa-video-slash" aria-hidden="true"></i>
						<p>{cameraError}</p>
						<button type="button" class="retry-btn" onclick={() => void startCamera()}>
							<i class="fas fa-rotate-right" aria-hidden="true"></i>
							<span>Try again</span>
						</button>
					</div>
				{:else}
					<div class="video-host" bind:this={videoHost}></div>
					{#if !cameraReady}
						<div class="camera-starting" role="status">
							<i class="fas fa-camera" aria-hidden="true"></i>
							<p>Starting camera…</p>
						</div>
					{/if}
					<p class="scan-hint">Point at a card's QR code</p>
				{/if}
			</div>
		{/if}
	</div>
</Drawer>

<style>
	:global(.scan-card-drawer[data-placement="bottom"]) {
		height: 80dvh;
		--sheet-max-height: 80dvh;
	}

	:global(.scan-card-drawer[data-placement="right"]) {
		--sheet-width: min(480px, 94vw);
	}

	.sheet-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 16px 12px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.header-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.panel-title {
		margin: 0;
		font-size: var(--font-size-lg, 18px);
		font-weight: 700;
		color: var(--theme-text, white);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.panel-count {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
		font-variant-numeric: tabular-nums;
	}

	.done-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 18px;
		flex-shrink: 0;
		border: 1px solid color-mix(in srgb, var(--theme-accent) 45%, transparent);
		border-radius: 12px;
		background: color-mix(in srgb, var(--theme-accent) 22%, transparent);
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--duration-fast, 150ms) ease;
	}

	.done-btn:hover {
		background: color-mix(in srgb, var(--theme-accent) 34%, transparent);
	}

	.done-btn:focus-visible {
		outline: 2px solid var(--theme-accent);
		outline-offset: 2px;
	}

	.viewfinder {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: black;
		overflow: hidden;
	}

	.video-host {
		position: absolute;
		inset: 0;
	}

	.video-host :global(.viewfinder-video) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.scan-hint {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		margin: 0;
		padding: 8px 16px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.55);
		color: white;
		font-size: var(--font-size-sm, 14px);
		white-space: nowrap;
		pointer-events: none;
	}

	.camera-starting,
	.camera-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 24px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		text-align: center;
	}

	.camera-starting i,
	.camera-error i {
		font-size: 28px;
		opacity: 0.6;
	}

	.camera-starting p,
	.camera-error p {
		margin: 0;
		max-width: 320px;
		font-size: var(--font-size-sm, 14px);
		line-height: 1.5;
	}

	.retry-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 18px;
		margin-top: 4px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
		border-radius: 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		cursor: pointer;
	}

	.retry-btn:focus-visible {
		outline: 2px solid var(--theme-accent);
		outline-offset: 2px;
	}

	/* ── Desktop handoff panel ────────────────────────────────────── */

	.handoff-panel {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		padding: 24px;
		overflow-y: auto;
	}

	/* Fixed box: the QR decodes async, and the panel must not reflow when it
	   lands (no-layout-shift). White backing keeps the QR scannable on any
	   theme background. */
	.qr-box {
		width: 240px;
		height: 240px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 16px;
		background: white;
		padding: 12px;
	}

	.handoff-qr {
		width: 100%;
		height: 100%;
		display: block;
	}

	.handoff-link-fallback {
		margin: 0;
		color: #1a1a2e;
		font-size: var(--font-size-compact, 12px);
		text-align: center;
		overflow-wrap: anywhere;
	}

	.handoff-url {
		display: block;
		margin-top: 6px;
		font-weight: 600;
		user-select: all;
	}

	.handoff-copy {
		margin: 0;
		max-width: 320px;
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		line-height: 1.5;
		text-align: center;
	}

	.phone-count {
		margin: 0;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
		font-size: var(--font-size-compact, 12px);
		font-variant-numeric: tabular-nums;
	}

	.camera-fallback-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 18px;
		margin-top: 8px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
		border-radius: 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		cursor: pointer;
	}

	.camera-fallback-btn:focus-visible {
		outline: 2px solid var(--theme-accent);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.done-btn {
			transition: none;
		}
	}
</style>
