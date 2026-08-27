<!-- Owns the artifact, caption, and destination handoff for every sequence
     viewer. Rendering stays asynchronous, and fixed preview/status geometry
     prevents state changes from moving the sheet. -->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { slide } from "svelte/transition";
  import ShareSheetFrame from "./ShareSheetFrame.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import ExportImagePanel from "$lib/shared/sequence-viewer/components/ExportImagePanel.svelte";
  import ExportPopover from "$lib/shared/sequence-viewer/components/ExportPopover.svelte";
  import { getExportOptionsState } from "$lib/shared/animation-panel/state/export-options-state.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import InstagramIcon from "$lib/shared/auth/components/icons/InstagramIcon.svelte";
  import FacebookIcon from "$lib/shared/auth/components/icons/FacebookIcon.svelte";
  import InstagramPostReview from "$lib/shared/share/components/instagram/InstagramPostReview.svelte";
  import { createPostDeliveryState } from "$lib/shared/share/state/post-delivery-state.svelte";
  import { setPostDeliveryContext } from "$lib/shared/share/context/post-delivery-context";
  import { hasDecodableAudioTrack } from "$lib/shared/media-composition/services/media-audio-inspector";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ResolvedAutoLayout } from "$lib/shared/render/services/container-aware-layout";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { deriveWord } from "$lib/shared/foundation/services/word-deriver";
  import { getVideoUploader } from "$lib/shared/share/get-video-uploader";
  import { getQRCodeGenerator } from "$lib/shared/qr/get-qr-code-generator";
  import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { getCaptionPresetManager } from "$lib/shared/share/state/caption-presets.svelte";
  import { createCardPreviewState } from "$lib/shared/share/state/card-preview-state.svelte";
  import {
    buildArtifactFilename,
    buildPostLink,
    copyLink,
    copyCaption,
    copyImageAndOpenFacebook,
    downloadArtifact,
    isPostLink,
    resolveDestinations,
    shareArtifactNatively,
    type HandoffDestinationId,
    type HandoffResult,
    type ShareArtifact,
  } from "$lib/shared/share/services/post-handoff";
  import { getUser } from "$lib/shared/auth/state/auth-state.svelte";
  import {
    connectMetaAccount,
    disconnectMetaAccount,
    publishToMeta,
    selectFacebookPage,
    subscribeMetaPublishStatus,
    toInstagramJpeg,
    EMPTY_META_PUBLISH_STATUS,
    META_POSTING_ENABLED,
    MetaPublishClientError,
    type MetaPublishStatus,
    type MetaPublishTarget,
  } from "$lib/shared/share/services/meta-publish";

  interface Props {
    isOpen: boolean;
    sequence: SequenceData | null;
    /** Ignored for captions unless already in the canonical post-link form. */
    shareUrl: string;
    videoBlobUrl: string | null;
    isExportingVideo: boolean;
    /** Distinguishes a user-driven scene take from background export work. */
    isRecordingScene?: boolean;
    exportProgress: number | null;
    /** `false` means no render started, so the sheet must stop waiting. */
    onRequestVideo: () => void | Promise<boolean>;
    onClose: () => void;
    /** Visual-test seam for connection states normally supplied by Firestore. */
    metaStatusOverride?: MetaPublishStatus;
    /** Omitted by hosts without an inbox. */
    onSendInTka?: () => void;
    /** Labels view-specific renders such as Mandala or Tunnel. */
    videoLabel?: string;
    initialArtifact?: ShareArtifact;
    /** Reuses the live card's resolved auto-layout so the exported image matches. */
    resolvedCardAutoLayout?: ResolvedAutoLayout | null;
    /** Omitted when the host cannot switch its viewer body to Post Studio. */
    onOpenPostStudio?: () => void;
  }

  let {
    isOpen,
    sequence,
    shareUrl,
    videoBlobUrl,
    isExportingVideo,
    isRecordingScene = false,
    exportProgress,
    onRequestVideo,
    onClose,
    metaStatusOverride,
    onSendInTka,
    videoLabel = "Video",
    initialArtifact = "card",
    resolvedCardAutoLayout = null,
    onOpenPostStudio,
  }: Props = $props();

  const postDeliveryState = createPostDeliveryState({
    draft: {
      schemaVersion: 1,
      id: "local-instagram-draft",
      ownerId: "local-preview",
      sourceSequenceId: null,
      recipeId: null,
      format: "image",
      items: [
        {
          id: "local-media",
          artifactRevisionId: "local-artifact",
          order: 0,
          altText: null,
          cropPreviewRevision: "local-crop",
        },
      ],
      caption: "",
      instagram: {
        shareToFeed: null,
        cover: null,
        originalAudioName: null,
        attachedAudio: null,
        trial: null,
        collaborators: [],
        userTags: [],
        locationId: null,
        productTags: [],
        aiGenerated: null,
        paidPartnership: false,
        sponsorIds: [],
      },
      delivery: { mode: "handoff" },
      selectedAccountId: null,
      capabilitySnapshotId: null,
      createdAt: 0,
      updatedAt: 0,
    },
    capabilitySnapshot: null,
  });
  setPostDeliveryContext({ state: postDeliveryState });

  const captions = getCaptionPresetManager();
  const exportOptions = getExportOptionsState();

  let glyphHeight = $state(0);

  let artifact = $state<ShareArtifact>("card");
  /** Sharing starts actionable; customization unfolds only on request. */
  let customizeOpen = $state(false);

  /** Reveal after the slide finishes so short viewports reach the full panel. */
  function revealCustomize(event: Event): void {
    const el = event.currentTarget;
    if (!(el instanceof HTMLElement)) return;
    el.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  let caption = $state("");
  let captionTouched = $state(false);
  let statusMessage = $state("");
  let busyDestination = $state<HandoffDestinationId | null>(null);
  let videoRefused = $state(false);

  let videoBlob = $state<Blob | null>(null);
  let instagramReviewOpen = $state(false);
  let activeHasAudio = $state<boolean | null>(false);
  let audioInspectionVersion = 0;

  /** Shared with Post Studio and gated on open so unused viewers pay no render. */
  const cardPreview = createCardPreviewState({
    getSequence: () => sequence,
    getEnabled: () => isOpen,
    getDarkMode: () => exportOptions.imageDarkMode,
    getResolvedAutoLayout: () => resolvedCardAutoLayout,
    onError: () => {
      statusMessage = "Couldn't render the card";
    },
  });

  let shortUrl = $state<string | null>(null);

  let qrDataUrl = $state<string | null>(null);
  let qrPending = $state(false);
  let qrError = $state("");

  let liveMetaStatus = $state<MetaPublishStatus>(EMPTY_META_PUBLISH_STATUS);
  let postingTarget = $state<MetaPublishTarget | null>(null);
  let connectingTarget = $state<MetaPublishTarget | null>(null);
  let pageMenuOpen = $state(false);
  let postStage = $state("");
  let postedPermalinks = $state<Partial<Record<MetaPublishTarget, string>>>({});

  /** Derive unsaved workspace words instead of trusting their empty stored field. */
  const alphabetWord = $derived(sequence ? deriveWord(sequence) : "");

  const word = $derived(
    simplifyRepeatedWord(
      sequence?.displayName || alphabetWord || sequence?.intendedWord || ""
    )
  );

  /** The glyph header uses the simplified alphabet word, never display prose. */
  const glyphWord = $derived(simplifyRepeatedWord(alphabetWord));

  /** Drop inline viewer URLs in favor of a minted post link. */
  const seededShortUrl = $derived(
    isPostLink(shareUrl ?? "") ? shareUrl.trim() : ""
  );

  const postUrl = $derived(shortUrl ?? seededShortUrl);

  const presets = $derived(
    captions.buildPresets({
      word: alphabetWord || sequence?.displayName || "",
      url: postUrl,
    })
  );

  const activeBlob = $derived(
    artifact === "video" ? videoBlob : cardPreview.blob
  );

  const filename = $derived(buildArtifactFilename(word, artifact));
  // The host owns which view-specific render occupies the video slot.
  const activeVideoUrl = $derived(videoBlobUrl);
  const reviewPreviewUrl = $derived(
    artifact === "video" ? activeVideoUrl : cardPreview.url
  );

  $effect(() => {
    const mediaUrl = artifact === "video" ? activeVideoUrl : null;
    const version = ++audioInspectionVersion;
    if (!mediaUrl) {
      activeHasAudio = false;
      return;
    }
    activeHasAudio = null;
    void hasDecodableAudioTrack(mediaUrl).then((hasAudio) => {
      if (version === audioInspectionVersion) activeHasAudio = hasAudio;
    });
  });

  const destinations = $derived(
    resolveDestinations({ artifact, blob: activeBlob, filename })
  );

  /** Device-gated so desktop Chrome's API support does not imply a phone flow. */
  const nativeShare = $derived(
    destinations.find((destination) => destination.id === "native-share") ??
      null
  );

  /** The visual harness can exercise connection states while posting is disabled. */
  const postingAvailable = $derived(
    META_POSTING_ENABLED || metaStatusOverride !== undefined
  );

  const metaStatus = $derived(metaStatusOverride ?? liveMetaStatus);

  type NetworkKind = "post" | "review" | "connect" | "choose-page" | "handoff";

  interface NetworkPlan {
    key: "instagram" | "facebook";
    brand: "instagram" | "facebook";
    name: string;
    label: string;
    hint: string;
    kind: NetworkKind;
    target?: MetaPublishTarget;
    destination?: HandoffDestinationId;
  }

  /**
   * Each network keeps one branded button while its action changes with account
   * state. Native mobile sharing can replace both desktop fallbacks.
   */
  const networks = $derived.by(() => {
    const plans: NetworkPlan[] = [];
    const instagram = postingAvailable ? metaStatus.instagram : null;
    const page = postingAvailable ? metaStatus.facebookPage : null;

    if (instagram) {
      plans.push({
        key: "instagram",
        brand: "instagram",
        name: "Instagram",
        label: "Review for Instagram",
        hint: `@${instagram.username}`,
        kind: "review",
        target: "instagram",
      });
    } else if (postingAvailable) {
      plans.push({
        key: "instagram",
        brand: "instagram",
        name: "Instagram",
        label: "Connect professional Instagram",
        hint: "Creator or business account",
        kind: "connect",
        target: "instagram",
      });
    } else if (destinations.some((d) => d.id === "send-to-phone")) {
      plans.push({
        key: "instagram",
        brand: "instagram",
        name: "Instagram",
        label: "Send to Instagram",
        hint: "Scan the code, post from your phone",
        kind: "handoff",
        destination: "send-to-phone",
      });
    }

    // A connection is not a post target until the user chooses its Page.
    if (page?.selectedPageId) {
      plans.push({
        key: "facebook",
        brand: "facebook",
        name: "Facebook",
        label: "Post to Facebook",
        hint: page.selectedPageName || "Your Page",
        kind: "post",
        target: "facebook-page",
      });
    } else if (page) {
      plans.push({
        key: "facebook",
        brand: "facebook",
        name: "Facebook",
        label: "Choose a Page",
        hint: "Pick where your posts land",
        kind: "choose-page",
        target: "facebook-page",
      });
    } else if (postingAvailable) {
      plans.push({
        key: "facebook",
        brand: "facebook",
        name: "Facebook",
        label: "Connect Facebook",
        hint: "Post to your Page",
        kind: "connect",
        target: "facebook-page",
      });
    } else if (destinations.some((d) => d.id === "copy-image-facebook")) {
      plans.push({
        key: "facebook",
        brand: "facebook",
        name: "Facebook",
        label: "Open Facebook",
        hint: "Copies the image to paste in",
        kind: "handoff",
        destination: "copy-image-facebook",
      });
    }

    return plans;
  });

  const autoPostTargets = $derived(
    networks
      .filter((plan) => plan.kind === "post" || plan.kind === "review")
      .map((plan) => ({
        id: plan.target as MetaPublishTarget,
        network: plan.name,
        account: plan.hint,
      }))
  );

  /** Excludes actions already promoted to a branded network button. */
  const tileDestinations = $derived.by(() => {
    const claimed = new Set(
      networks
        .map((plan) => plan.destination)
        .filter((id): id is HandoffDestinationId => !!id)
    );
    const branded = new Set(networks.map((plan) => plan.brand));
    return destinations.filter(
      (destination) =>
        destination.id !== "native-share" &&
        !claimed.has(destination.id) &&
        !(destination.brand && branded.has(destination.brand))
    );
  });

  const facebookPages = $derived(metaStatus.facebookPage?.pages ?? []);

  /** A connected account still needs an explicit Page before it can post. */
  const pageChoicePending = $derived(
    !!metaStatus.facebookPage && !metaStatus.facebookPage.selectedPageId
  );

  const metaBusy = $derived(
    postingTarget !== null || connectingTarget !== null
  );

  const previewReady = $derived(
    !qrDataUrl &&
      ((artifact === "card" && !!cardPreview.url) ||
        (artifact === "video" && !!activeVideoUrl))
  );

  const videoBusy = $derived(artifact === "video" && !videoBlob);

  /** Detect setting changes without automatically replacing an expensive render. */
  const videoSettingsKey = $derived(
    [
      exportOptions.videoResolution,
      exportOptions.videoQuality,
      exportOptions.videoFps,
      exportOptions.videoLoopCount,
    ].join("|")
  );
  let renderedVideoKey = $state<string | null>(null);
  /**
   * Capture settings at request time so changes made during rendering correctly
   * mark the result stale.
   */
  let requestedVideoKey: string | null = null;

  /** The URL counts immediately, before its bytes finish loading into a blob. */
  const hasVideo = $derived(!!activeVideoUrl || !!videoBlob);

  const videoSettingsStale = $derived(
    artifact === "video" &&
      hasVideo &&
      !isExportingVideo &&
      !isRecordingScene &&
      renderedVideoKey !== null &&
      renderedVideoKey !== videoSettingsKey
  );

  const progressLabel = $derived.by(() => {
    if (!videoBusy) return "";
    // A user-driven scene take is recording, not background rendering.
    if (isRecordingScene) return "Recording the scene…";
    if (isExportingVideo && exportProgress !== null) {
      return `Rendering ${videoLabel.toLowerCase()}… ${Math.round(exportProgress * 100)}%`;
    }
    return `Rendering ${videoLabel.toLowerCase()}…`;
  });

  // Reset on the open edge only, preserving choices during an active session.
  let wasOpen = false;
  $effect(() => {
    if (isOpen === wasOpen) return;
    wasOpen = isOpen;
    if (!isOpen) return;
    artifact = initialArtifact;
    // Reuse current settings until the user asks to customize.
    customizeOpen = false;
    if (
      initialArtifact === "video" &&
      !hasVideo &&
      !isExportingVideo &&
      !isRecordingScene
    ) {
      requestVideo();
    }
  });

  $effect(() => {
    const url = videoBlobUrl;
    // Never relabel and reuse a previous view's render.
    if (!url) {
      videoBlob = null;
      return;
    }

    // `untrack` prevents the completed-render stamp from following later edits.
    // Preexisting renders are credited to the only settings currently available.
    renderedVideoKey = requestedVideoKey ?? untrack(() => videoSettingsKey);
    requestedVideoKey = null;

    let stale = false;
    void (async () => {
      try {
        const blob = await (await fetch(url)).blob();
        if (!stale) videoBlob = blob;
      } catch (error) {
        console.error("[PostShareSheet] Could not read exported video:", error);
      }
    })();

    return () => {
      stale = true;
    };
  });

  // Mint asynchronously on open; captions never expose the long viewer URL.
  $effect(() => {
    if (!isOpen || !sequence || seededShortUrl) return;

    const target = sequence;
    let stale = false;
    shortUrl = null;

    void (async () => {
      try {
        const result = await getShortCodeManager().createShortCode(target, {
          embedSequenceData: true,
        });
        if (!stale) shortUrl = buildPostLink(result.code);
      } catch (error) {
        // A missing short code leaves a still-usable word-only caption.
        console.warn("[PostShareSheet] No short link for the caption:", error);
      }
    })();

    return () => {
      stale = true;
    };
  });

  // Keep seeding until the user edits; an arriving short link can then fill in.
  $effect(() => {
    if (!isOpen || captionTouched) return;
    const first = presets[0];
    if (first) caption = first.text;
  });

  // Hold the connection listener only while the sheet is open.
  $effect(() => {
    if (!isOpen || metaStatusOverride || !META_POSTING_ENABLED) return;

    const uid = getUser()?.uid;
    if (!uid) {
      liveMetaStatus = EMPTY_META_PUBLISH_STATUS;
      return;
    }
    return subscribeMetaPublishStatus(uid, (next) => {
      liveMetaStatus = next;
    });
  });

  function handleArtifactChange(next: ShareArtifact): void {
    artifact = next;
    statusMessage = "";
    qrDataUrl = null;
    // Posted links belong to the selected artifact.
    postedPermalinks = {};

    // A live scene take also prevents duplicate export requests.
    if (
      next === "video" &&
      !hasVideo &&
      !isExportingVideo &&
      !isRecordingScene
    ) {
      requestVideo();
    }
  }

  /** Close before switching viewer surfaces so Back never returns to the modal. */
  function openPostStudio(): void {
    statusMessage = "";
    qrDataUrl = null;
    onOpenPostStudio?.();
    onClose();
  }

  function openInstagramReview(): void {
    const account = metaStatus.instagram;
    if (!account || !reviewPreviewUrl) return;

    const now = Date.now();
    const isReel = artifact === "video";
    const accountId = account.accountId || `instagram:${account.username}`;
    postDeliveryState.reset({
      draft: {
        schemaVersion: 1,
        id: `local:${sequence?.id ?? "unsaved"}:${artifact}`,
        ownerId: getUser()?.uid ?? "local-preview",
        sourceSequenceId: sequence?.id ?? null,
        recipeId: null,
        format: isReel ? "reel" : "image",
        items: [
          {
            id: `item:${artifact}`,
            artifactRevisionId: `local:${sequence?.id ?? "unsaved"}:${artifact}`,
            order: 0,
            altText: null,
            cropPreviewRevision:
              artifact === "card"
                ? cardPreview.revision || "current-card"
                : renderedVideoKey || "current-video",
          },
        ],
        caption,
        instagram: {
          shareToFeed: isReel ? true : null,
          cover: null,
          originalAudioName: null,
          attachedAudio: null,
          trial: null,
          collaborators: [],
          userTags: [],
          locationId: null,
          productTags: [],
          aiGenerated: null,
          paidPartnership: false,
          sponsorIds: [],
        },
        delivery: { mode: "publish-now" },
        selectedAccountId: accountId,
        capabilitySnapshotId: account.capabilities?.id ?? null,
        createdAt: now,
        updatedAt: now,
      },
      capabilitySnapshot: account.capabilities,
    });
    statusMessage = "";
    qrDataUrl = null;
    instagramReviewOpen = true;
  }

  function syncInstagramReviewCaption(): void {
    caption = postDeliveryState.draft.caption;
    captionTouched = true;
  }

  function closeInstagramReview(): void {
    syncInstagramReviewCaption();
    instagramReviewOpen = false;
  }

  function closeShareFromInstagramReview(): void {
    syncInstagramReviewCaption();
    onClose();
  }

  function editInstagramComposition(): void {
    closeInstagramReview();
    openPostStudio();
  }

  function postReviewedInstagram(): void {
    syncInstagramReviewCaption();
    void postToTarget("instagram");
  }

  function finishInstagramReview(): void {
    closeInstagramReview();
    const destination =
      nativeShare ??
      destinations.find((candidate) => candidate.id === "send-to-phone");
    if (destination) {
      void runDestination(destination.id);
      return;
    }
    statusMessage = "Download the post, then finish it in Instagram.";
  }

  /**
   * The viewer refuses a render for reasons the sheet cannot see from its props
   * — the take-it-home account gate, an animation canvas that has not mounted,
   * an export already in flight. Until it reported that, the sheet sat on
   * "Rendering video…" forever with no error and no way back.
   */
  function requestVideo(): void {
    videoRefused = false;
    requestedVideoKey = untrack(() => videoSettingsKey);
    const started = onRequestVideo();
    if (!(started instanceof Promise)) return;
    void started.then((ok) => {
      videoRefused = ok === false;
    });
  }

  function applyPreset(text: string): void {
    caption = text;
    captionTouched = true;
    postedPermalinks = {};
  }

  function saveCurrentAsPreset(): void {
    // The sequence in view becomes the template's tokens, so this caption is
    // reusable rather than a literal that follows you onto every other post.
    captions.saveCustomPreset(caption, {
      word: alphabetWord || sequence?.displayName || "",
      url: postUrl,
    });
    statusMessage = "Saved as a preset";
  }

  function removePreset(preset: (typeof presets)[number]): void {
    if (!preset.template) return;
    captions.removeCustomPreset(preset.template);
    statusMessage = "Preset removed";
  }

  async function sendToPhone(): Promise<void> {
    const blob = activeBlob;
    if (!blob || !sequence?.id) {
      qrError = "Save this sequence first so it has somewhere to upload to.";
      return;
    }

    qrPending = true;
    qrError = "";

    try {
      const { url } = await getVideoUploader().uploadShareArtifact(
        sequence.id,
        blob,
        artifact
      );
      const image = await getQRCodeGenerator().generateUrlAsImage(url, 512);
      qrDataUrl = image.src;
    } catch (error) {
      console.error("[PostShareSheet] Phone handoff failed:", error);
      qrError = "Couldn't prepare the handoff. Sign in and try again.";
    } finally {
      qrPending = false;
    }
  }

  async function runDestination(id: HandoffDestinationId): Promise<void> {
    const blob = activeBlob;
    statusMessage = "";
    busyDestination = id;

    try {
      let result: HandoffResult;

      switch (id) {
        case "native-share":
          if (!blob) return;
          result = await shareArtifactNatively(blob, filename, caption);
          break;
        case "download":
          if (!blob) return;
          result = await downloadArtifact(blob, filename);
          break;
        case "copy-image-facebook":
          if (!blob) return;
          result = await copyImageAndOpenFacebook(blob);
          break;
        case "copy-caption":
          result = await copyCaption(caption);
          break;
        case "send-to-phone":
          await sendToPhone();
          return;
      }

      if (result.status !== "canceled" && result.message) {
        statusMessage = result.message;
      }
    } finally {
      busyDestination = null;
    }
  }

  function closeQrView(): void {
    qrDataUrl = null;
    qrError = "";
  }

  /** Uploads first because Meta ingests the artifact from a public URL. */
  async function postToTarget(target: MetaPublishTarget): Promise<void> {
    const blob = activeBlob;
    if (!blob) return;
    if (!sequence?.id) {
      statusMessage =
        "Save this sequence first so it has somewhere to upload to.";
      return;
    }

    postingTarget = target;
    statusMessage = "";
    postStage = "Uploading…";

    try {
      // Reject unsupported containers before paying for upload and processing.
      if (artifact === "video" && blob.type && !blob.type.includes("mp4")) {
        statusMessage =
          "This video isn't in a format Instagram or Facebook accepts.";
        return;
      }

      const media =
        target === "instagram" && artifact === "card"
          ? await toInstagramJpeg(blob)
          : blob;

      const { url } = await getVideoUploader().uploadShareArtifact(
        sequence.id,
        media,
        artifact
      );

      postStage =
        artifact === "video" ? "Meta is processing the video…" : "Posting…";
      const result = await publishToMeta({
        target,
        mediaType: artifact === "video" ? "video" : "image",
        mediaUrl: url,
        caption,
        instagram:
          target === "instagram"
            ? {
                format:
                  postDeliveryState.draft.format === "reel" ? "reel" : "image",
                selectedAccountId:
                  postDeliveryState.draft.selectedAccountId ?? "",
                capabilitySnapshotId:
                  postDeliveryState.draft.capabilitySnapshotId,
                shareToFeed:
                  postDeliveryState.draft.instagram.shareToFeed ?? true,
                thumbOffsetMs:
                  postDeliveryState.draft.instagram.cover?.kind === "frame"
                    ? postDeliveryState.draft.instagram.cover.offsetMs
                    : null,
              }
            : undefined,
      });

      if (result.permalink) {
        postedPermalinks = { ...postedPermalinks, [target]: result.permalink };
      }
      statusMessage =
        target === "instagram" ? "Posted to Instagram" : "Posted to your Page";
    } catch (error) {
      console.error("[PostShareSheet] Direct post failed:", error);
      statusMessage =
        error instanceof MetaPublishClientError
          ? error.message
          : "Couldn't post that. Try again.";
    } finally {
      postingTarget = null;
      postStage = "";
    }
  }

  /** Local actions depend on sheet-owned inbox and short-link context. */
  interface LocalTile {
    id: string;
    label: string;
    short: string;
    icon: string;
    ready: boolean;
    run: () => void;
  }

  const localTiles = $derived.by((): LocalTile[] => {
    const tiles: LocalTile[] = [];
    if (onSendInTka) {
      tiles.push({
        id: "send-in-tka",
        label: "Send in TKA",
        short: "Send",
        icon: "fa-solid fa-paper-plane",
        ready: !!sequence,
        run: () => onSendInTka?.(),
      });
    }
    if (postUrl) {
      tiles.push({
        id: "copy-link",
        label: "Copy link",
        short: "Link",
        icon: "fa-solid fa-link",
        ready: true,
        run: () => void runLocalTile("copy-link", () => copyLink(postUrl)),
      });
    }
    return tiles;
  });

  let busyLocalTile = $state<string | null>(null);

  async function runLocalTile(
    id: string,
    action: () => Promise<HandoffResult>
  ): Promise<void> {
    statusMessage = "";
    busyLocalTile = id;
    try {
      const result = await action();
      if (result.status !== "canceled" && result.message) {
        statusMessage = result.message;
      }
    } finally {
      busyLocalTile = null;
    }
  }

  function runNetwork(plan: NetworkPlan): void {
    switch (plan.kind) {
      case "review":
        openInstagramReview();
        return;
      case "post":
        void postToTarget(plan.target as MetaPublishTarget);
        return;
      case "connect":
        void connectTarget(plan.target as MetaPublishTarget);
        return;
      case "choose-page":
        pageMenuOpen = true;
        return;
      case "handoff":
        void runDestination(plan.destination as HandoffDestinationId);
    }
  }

  /** Account setup can run before the artifact is ready; delivery cannot. */
  function networkDisabled(plan: NetworkPlan): boolean {
    if (plan.kind === "connect" || plan.kind === "choose-page") return metaBusy;
    return !activeBlob || metaBusy || busyDestination !== null || qrPending;
  }

  async function connectTarget(target: MetaPublishTarget): Promise<void> {
    connectingTarget = target;
    statusMessage = "";

    try {
      const account = await connectMetaAccount(target);
      statusMessage = account ? `Connected ${account}` : "Connected";
    } catch (error) {
      statusMessage =
        error instanceof MetaPublishClientError
          ? error.message
          : "Couldn't connect that account.";
    } finally {
      connectingTarget = null;
    }
  }

  async function forgetTarget(target: MetaPublishTarget): Promise<void> {
    connectingTarget = target;
    try {
      await disconnectMetaAccount(target);
      statusMessage = "Disconnected";
    } catch {
      statusMessage = "Couldn't disconnect that account.";
    } finally {
      connectingTarget = null;
    }
  }

  async function handlePageChange(pageId: string): Promise<void> {
    pageMenuOpen = false;
    try {
      await selectFacebookPage(pageId);
    } catch {
      statusMessage = "Couldn't switch Page.";
    }
  }

  /** Reopens Meta consent when the desired Page was absent from the grant. */
  async function changeSharedPages(): Promise<void> {
    pageMenuOpen = false;
    connectingTarget = "facebook-page";
    statusMessage = "";

    try {
      const account = await connectMetaAccount("facebook-page", {
        reselect: true,
      });
      statusMessage = account ? `Connected ${account}` : "Connected";
    } catch (error) {
      statusMessage =
        error instanceof MetaPublishClientError
          ? error.message
          : "Couldn't reopen the Page list.";
    } finally {
      connectingTarget = null;
    }
  }

  // The fixed-positioned menu cannot rely on the chip's outside-click boundary.
  $effect(() => {
    if (!pageMenuOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".page-chip")) {
        pageMenuOpen = false;
      }
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  });

  $effect(() => {
    if (!instagramReviewOpen) return;
    postDeliveryState.setCapabilitySnapshot(
      metaStatus.instagram?.capabilities ?? null
    );
  });
</script>

{#snippet brandMark(brand: "instagram" | "facebook")}
  <span class="brand-mark">
    {#if brand === "instagram"}
      <InstagramIcon />
    {:else}
      <FacebookIcon />
    {/if}
  </span>
{/snippet}

<!-- Posted state reuses the network button so success cannot shift layout. -->
{#snippet networkButton(plan: NetworkPlan)}
  {@const permalink = plan.target ? postedPermalinks[plan.target] : undefined}
  {@const busy =
    (!!plan.target &&
      (postingTarget === plan.target || connectingTarget === plan.target)) ||
    (!!plan.destination &&
      (busyDestination === plan.destination ||
        (plan.destination === "send-to-phone" && qrPending)))}
  {#if permalink}
    <a
      class="network network--{plan.brand} is-posted"
      href={permalink}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span class="network-mark">{@render brandMark(plan.brand)}</span>
      <span class="network-text">
        <span class="network-label">View on {plan.name}</span>
        <span class="network-hint">{plan.hint}</span>
      </span>
      <i
        class="network-chevron fa-solid fa-arrow-up-right-from-square"
        aria-hidden="true"
      ></i>
    </a>
  {:else}
    <button
      type="button"
      class="network network--{plan.brand}"
      disabled={networkDisabled(plan)}
      onclick={() => runNetwork(plan)}
    >
      <span class="network-mark">
        {#if busy}
          <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
        {:else}
          {@render brandMark(plan.brand)}
        {/if}
      </span>
      <span class="network-text">
        <span class="network-label">{plan.label}</span>
        <!-- Progress replaces the account hint in place. -->
        <span class="network-hint">
          {busy && postStage ? postStage : plan.hint}
        </span>
      </span>
      <i class="network-chevron fa-solid fa-chevron-right" aria-hidden="true"
      ></i>
    </button>
  {/if}
{/snippet}

<ShareSheetFrame
  {isOpen}
  ariaLabel="Share this sequence"
  {onClose}
  narrow={!!qrDataUrl}
>
  {#snippet children(surface)}
    {#if instagramReviewOpen && reviewPreviewUrl}
      <InstagramPostReview
        previewUrl={reviewPreviewUrl}
        mediaKind={artifact === "video" ? "video" : "image"}
        hasAudio={activeHasAudio === true}
        busy={postingTarget === "instagram"}
        stage={postStage}
        postedPermalink={postedPermalinks.instagram ?? null}
        onBack={closeInstagramReview}
        onClose={closeShareFromInstagramReview}
        onEditComposition={editInstagramComposition}
        onPost={postReviewedInstagram}
        onHandoff={finishInstagramReview}
        onReconnect={() => void connectTarget("instagram")}
      />
    {:else}
      <!-- Focus the surface so the dialog does not highlight Close on arrival. -->
      <!-- svelte-ignore a11y_autofocus -->
      <div
        class="sheet"
        data-surface={surface}
        class:qr-step={!!qrDataUrl}
        tabindex="-1"
        autofocus
      >
        <header class="panel-header">
          <h2 class="panel-title">
            <!-- A zero-width CSS sizer bridges the glyph's pixel API. -->
            <span class="glyph-sizer" bind:clientHeight={glyphHeight}></span>
            <TKAWordGlyph
              word={glyphWord}
              height={glyphHeight || 26}
              darkMode
            />
          </h2>
          <button
            type="button"
            class="header-close"
            onclick={onClose}
            aria-label="Close share sheet"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </header>

        {#if !qrDataUrl}
          <div class="artifact-picker">
            <SegmentedControl
              options={[
                { value: "card", label: "Card" },
                { value: "video", label: videoLabel },
              ]}
              value={artifact}
              onchange={handleArtifactChange}
              ariaLabel="What to share"
              semantics="radiogroup"
              size="sm"
              color="accent"
            />
            {#if onOpenPostStudio}
              <button
                type="button"
                class="studio-launch"
                onclick={openPostStudio}
              >
                <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"
                ></i>
                Post Studio
              </button>
            {/if}
          </div>
        {/if}

        <div class="stage" class:showing-media={!!previewReady}>
          {#if qrDataUrl}
            <div class="qr-view">
              <img src={qrDataUrl} alt="QR code linking to the uploaded file" />
              <p>Scan with your phone, save it, then post from Instagram.</p>
              <button type="button" class="secondary" onclick={closeQrView}>
                <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
                Back
              </button>
            </div>
          {:else if artifact === "card" && cardPreview.url}
            <img
              class="preview"
              src={cardPreview.url}
              alt="Sequence card preview"
            />
          {:else if artifact === "video" && activeVideoUrl}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
              class="preview"
              src={activeVideoUrl}
              autoplay
              loop
              muted
              playsinline
            ></video>
          {:else if artifact === "video" && videoRefused}
            <div class="stage-pending stage-refused" role="status">
              <span>The render didn't start.</span>
              <button class="retry" type="button" onclick={requestVideo}>
                Try again
              </button>
            </div>
          {:else}
            <div class="stage-pending" role="status">
              <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"
              ></i>
              <span>{progressLabel || "Preparing…"}</span>
            </div>
          {/if}
        </div>

        <!-- Customization sits next to the preview it changes. -->
        {#if !qrDataUrl && sequence}
          <div class="customize">
            <button
              type="button"
              class="customize-toggle"
              aria-expanded={customizeOpen}
              aria-controls="post-share-customize"
              onclick={() => (customizeOpen = !customizeOpen)}
            >
              <i class="fa-solid fa-sliders" aria-hidden="true"></i>
              <span class="customize-label">
                {artifact === "card"
                  ? "Card settings"
                  : `${videoLabel} settings`}
              </span>
              <i
                class="fa-solid fa-chevron-down chevron"
                class:open={customizeOpen}
                aria-hidden="true"
              ></i>
            </button>

            {#if customizeOpen}
              <div
                class="customize-body"
                id="post-share-customize"
                transition:slide={{ duration: 200 }}
                onintroend={revealCustomize}
              >
                {#if artifact === "card"}
                  <ExportImagePanel
                    {exportOptions}
                    layout="inline"
                    stepCount={sequence.steps?.length ?? 0}
                    resolvedAutoLayout={resolvedCardAutoLayout}
                  />
                {:else}
                  <ExportPopover />
                  {#if videoSettingsStale}
                    <button
                      type="button"
                      class="rerender"
                      onclick={requestVideo}
                      transition:slide={{ duration: 160 }}
                    >
                      <i class="fa-solid fa-rotate" aria-hidden="true"></i>
                      Re-render with these settings
                    </button>
                  {/if}
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        {#if !qrDataUrl}
          <div class="caption-block">
            <label class="visually-hidden" for="post-share-caption"
              >Caption</label
            >

            <div class="presets">
              {#each presets as preset (preset.id)}
                <!-- Custom text is the implicit none-selected state. -->
                <FilterChipBase
                  label={preset.label}
                  mode="toggle"
                  active={caption === preset.text}
                  size="sm"
                  onclick={() => applyPreset(preset.text)}
                  onremove={preset.template
                    ? () => removePreset(preset)
                    : undefined}
                  removeAriaLabel={`Delete the preset ${preset.label}`}
                />
              {/each}
              <FilterChipBase
                label="Save current"
                icon="fa-solid fa-plus"
                mode="action"
                size="sm"
                disabled={!caption.trim()}
                onclick={saveCurrentAsPreset}
              />
            </div>

            <textarea
              id="post-share-caption"
              bind:value={caption}
              oninput={() => (captionTouched = true)}
              rows="3"
              placeholder="Write a caption…"
            ></textarea>
          </div>

          <div class="actions">
            {#if nativeShare}
              <button
                type="button"
                class="cta"
                disabled={!activeBlob || busyDestination !== null || qrPending}
                onclick={() => runDestination(nativeShare.id)}
              >
                <i
                  class={busyDestination === nativeShare.id
                    ? "fa-solid fa-circle-notch fa-spin"
                    : nativeShare.icon}
                  aria-hidden="true"
                ></i>
                <span class="cta-text">
                  <span class="cta-label">{nativeShare.label}</span>
                  {#if nativeShare.hint}
                    <span class="cta-hint">{nativeShare.hint}</span>
                  {/if}
                </span>
              </button>
            {/if}

            {#each networks as plan (plan.key)}
              {@render networkButton(plan)}
            {/each}
          </div>

          {#if tileDestinations.length || localTiles.length}
            <div class="tiles">
              {#each localTiles as tile (tile.id)}
                <button
                  type="button"
                  class="tile"
                  aria-label={tile.label}
                  title={tile.label}
                  disabled={!tile.ready || busyLocalTile !== null}
                  onclick={tile.run}
                >
                  <span class="tile-icon">
                    {#if busyLocalTile === tile.id}
                      <i
                        class="fa-solid fa-circle-notch fa-spin"
                        aria-hidden="true"
                      ></i>
                    {:else}
                      <i class={tile.icon} aria-hidden="true"></i>
                    {/if}
                  </span>
                  <span class="tile-label">{tile.short}</span>
                </button>
              {/each}
              {#each tileDestinations as destination (destination.id)}
                <button
                  type="button"
                  class="tile"
                  aria-label={destination.label}
                  title={destination.hint
                    ? `${destination.label} · ${destination.hint}`
                    : destination.label}
                  disabled={(destination.id !== "copy-caption" &&
                    !activeBlob) ||
                    busyDestination !== null ||
                    qrPending}
                  onclick={() => runDestination(destination.id)}
                >
                  <span class="tile-icon">
                    {#if busyDestination === destination.id}
                      <i
                        class="fa-solid fa-circle-notch fa-spin"
                        aria-hidden="true"
                      ></i>
                    {:else if destination.brand}
                      {@render brandMark(destination.brand)}
                    {:else}
                      <i class={destination.icon} aria-hidden="true"></i>
                    {/if}
                  </span>
                  <span class="tile-label">{destination.short}</span>
                </button>
              {/each}
            </div>
          {/if}

          {#if metaStatus.facebookPage || autoPostTargets.length}
            <div class="connections">
              {#if metaStatus.facebookPage}
                {@const selected = metaStatus.facebookPage}
                <!-- Page names are unbounded, so they belong in a dropdown. -->
                <div class="page-chip">
                  <FilterChipBase
                    label={selected.selectedPageName || "Choose a Page"}
                    ariaLabel="Which Page to post to"
                    mode="dropdown"
                    size="sm"
                    active={pageChoicePending}
                    emphasis={pageChoicePending ? "solid" : "soft"}
                    expanded={pageMenuOpen}
                    disabled={metaBusy}
                    onclick={() => (pageMenuOpen = !pageMenuOpen)}
                  >
                    {#snippet iconSnippet()}
                      {@render brandMark("facebook")}
                    {/snippet}
                    {#snippet children()}
                      {#each facebookPages as page (page.id)}
                        <button
                          class="page-option"
                          class:selected={page.id === selected.selectedPageId}
                          type="button"
                          role="option"
                          aria-selected={page.id === selected.selectedPageId}
                          onclick={() => handlePageChange(page.id)}
                        >
                          <span>{page.name}</span>
                          {#if page.id === selected.selectedPageId}
                            <i class="fa-solid fa-check" aria-hidden="true"></i>
                          {/if}
                        </button>
                      {/each}
                      <button
                        class="page-option page-option--add"
                        type="button"
                        role="option"
                        aria-selected="false"
                        disabled={metaBusy}
                        onclick={changeSharedPages}
                      >
                        <span>Add a Page…</span>
                        {#if connectingTarget === "facebook-page"}
                          <i
                            class="fa-solid fa-circle-notch fa-spin"
                            aria-hidden="true"
                          ></i>
                        {:else}
                          <i class="fa-solid fa-plus" aria-hidden="true"></i>
                        {/if}
                      </button>
                    {/snippet}
                  </FilterChipBase>
                </div>
              {/if}

              {#each autoPostTargets as target (target.id)}
                <FilterChipBase
                  label={`Disconnect ${target.network}`}
                  ariaLabel={`Disconnect ${target.account} from ${target.network}`}
                  icon={connectingTarget === target.id
                    ? "fa-solid fa-circle-notch fa-spin"
                    : "fa-solid fa-link-slash"}
                  mode="action"
                  size="sm"
                  disabled={metaBusy}
                  onclick={() => forgetTarget(target.id)}
                />
              {/each}
            </div>
          {/if}
        {/if}

        <!-- Reserve status height so messages cannot move the sheet. -->
        <p
          class="status"
          role="status"
          class:visible={!!(statusMessage || qrError)}
        >
          {qrError || statusMessage || " "}
        </p>
      </div>
    {/if}
  {/snippet}
</ShareSheetFrame>

<style>
  /* Phone portrait is the base; `ShareSheetFrame` owns drawer/dialog behavior. */
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1rem;
    width: min(34rem, 100%);
    margin: 0 auto;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .panel-title {
    display: flex;
    align-items: center;
    margin: 0;
    min-width: 0;
    font-size: var(--font-size-lg, 18px);
    color: var(--theme-text, #fff);
  }

  .glyph-sizer {
    width: 0;
    height: 1.625rem;
  }

  .header-close {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    margin-right: -0.5rem;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: 1.0625rem;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease;
  }

  @media (hover: hover) {
    .header-close:hover {
      background: var(--theme-surface-2, rgba(255, 255, 255, 0.06));
      color: var(--theme-text, #fff);
    }
  }

  .brand-mark {
    display: inline-flex;
    flex: 0 0 auto;
  }

  .brand-mark :global(svg) {
    width: 1.15em;
    height: 1.15em;
  }

  /* All preview states share fixed geometry. */
  .stage {
    position: relative;
    display: grid;
    place-items: center;
    min-height: min(var(--stage-h, 12rem), 24vh);
    padding: 0.75rem;
    border-radius: 1.125rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background:
      radial-gradient(
        120% 100% at 50% 0%,
        rgba(255, 255, 255, 0.05) 0%,
        transparent 70%
      ),
      var(--theme-surface-2, rgba(255, 255, 255, 0.04));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }

  /* Rendered media supplies its own frame; pending and QR states use the stage. */
  .stage.showing-media {
    padding: 0;
    border-color: transparent;
    background: none;
    box-shadow: none;
  }

  /* A real rem/vh ceiling works inside the content-sized stage; percentages do not. */
  .preview {
    max-width: 100%;
    max-height: min(var(--preview-h, 10.5rem), 30vh);
    object-fit: contain;
    border-radius: 0.75rem;
    box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.45);
  }

  .stage-pending {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 0.9375rem;
  }

  .stage-refused {
    flex-direction: column;
    color: var(--theme-text, rgba(255, 255, 255, 0.92));
  }

  .retry {
    min-height: 2.75rem;
    padding: 0 1.125rem;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.16));
    border-radius: 999px;
    background: var(--theme-surface-raised, rgba(255, 255, 255, 0.08));
    color: inherit;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background var(--duration-fast, 120ms) ease;
  }

  .retry:hover {
    background: var(--theme-surface-hover, rgba(255, 255, 255, 0.14));
  }

  /* Keep the shared control content-sized above the artwork. */
  .artifact-picker {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    align-self: center;
    max-width: 100%;
  }

  .artifact-picker :global(.segmented-control) {
    width: auto;
  }

  .studio-launch {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.45rem 0.75rem;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b7cff) 42%, transparent);
    border-radius: 0.75rem;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b7cff) 10%,
      transparent
    );
    color: color-mix(in srgb, var(--theme-accent, #8b7cff) 70%, white);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
  }

  .studio-launch:hover {
    border-color: color-mix(in srgb, var(--theme-accent, #8b7cff) 74%, white);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b7cff) 17%,
      transparent
    );
  }

  .studio-launch:focus-visible {
    outline: 3px solid var(--theme-accent, #8b7cff);
    outline-offset: 2px;
  }

  .qr-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
  }

  /* Let the code shrink enough to keep Back above the fold. */
  .qr-view img {
    width: min(11rem, 26vh);
    height: min(11rem, 26vh);
    border-radius: 0.75rem;
    background: #fff;
    padding: 0.5rem;
    box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.45);
  }

  .qr-view p {
    margin: 0;
    max-width: 22rem;
    font-size: 0.875rem;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
  }

  .customize {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .customize-toggle {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 0.5rem 0.875rem;
    border-radius: 0.875rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.05));
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .customize-toggle:hover {
    background: var(--theme-surface-hover, rgba(255, 255, 255, 0.09));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.16));
    color: var(--theme-text, #fff);
  }

  .customize-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .customize-label {
    flex: 1;
    text-align: left;
  }

  .chevron {
    font-size: 0.75rem;
    transition: transform 0.2s ease;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .customize-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 0.875rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.04));
  }

  /* Keep the panel's short segmented control from stretching like a progress bar. */
  .customize-body :global(.seg-fill) {
    max-width: 24rem;
  }

  .rerender {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.5rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #6366f1) 55%, transparent);
    background: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 22%,
      transparent
    );
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .rerender:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 34%,
      transparent
    );
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }

  .caption-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Scroll instead of adding a layout-shifting chip row. */
  .presets {
    display: flex;
    gap: 0.375rem;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 0.125rem;
    margin-inline: -1rem;
    padding-inline: 1rem;
  }

  .presets::-webkit-scrollbar {
    display: none;
  }

  .presets > :global(*) {
    flex: 0 0 auto;
  }

  textarea {
    width: 100%;
    /* Prevent user resizing from pushing actions below the drawer. */
    resize: none;
    padding: 0.75rem 0.875rem;
    border-radius: 0.875rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: 0.9375rem;
    line-height: 1.45;
    height: 4rem;
    min-height: 4rem;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  textarea::placeholder {
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
  }

  textarea:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent, #6366f1) 28%, transparent);
  }

  .actions {
    display: contents;
  }

  .cta {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    width: 100%;
    min-height: 3rem;
    padding: 0.75rem 1.125rem;
    border: none;
    border-radius: 1rem;
    background: linear-gradient(
      135deg,
      var(--theme-accent, #6366f1) 0%,
      var(--theme-accent-strong, #8b5cf6) 100%
    );
    color: var(--theme-on-accent, #fff);
    font: inherit;
    text-align: left;
    cursor: pointer;
    box-shadow: 0 0.625rem 1.5rem
      color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent);
    transition:
      transform 0.12s ease,
      box-shadow 0.15s ease,
      filter 0.15s ease;
  }

  .cta i {
    font-size: 1.125rem;
    width: 1.5rem;
    text-align: center;
  }

  .cta.secondary-cta {
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.16));
    color: var(--theme-text, #fff);
    box-shadow: none;
  }

  .cta.secondary-cta:hover:not(:disabled) {
    background: var(--theme-surface-3, rgba(255, 255, 255, 0.12));
    box-shadow: none;
    filter: none;
  }

  a.cta {
    text-decoration: none;
  }

  .cta-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Unbounded account names truncate instead of changing button height. */
  .cta-label,
  .cta-hint {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cta-label {
    font-size: 1rem;
    font-weight: 600;
  }

  .cta-hint {
    font-size: 0.8125rem;
    opacity: 0.8;
  }

  .cta:hover:not(:disabled) {
    filter: brightness(1.06);
    box-shadow: 0 0.75rem 2rem
      color-mix(in srgb, var(--theme-accent, #6366f1) 45%, transparent);
  }

  .cta:active:not(:disabled) {
    transform: scale(0.985);
  }

  .cta:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }

  .network {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    width: 100%;
    min-height: 3.25rem;
    padding: 0.625rem 1rem;
    border: 1px solid var(--network-edge);
    border-radius: 1rem;
    background: var(--network-fill);
    color: #fff;
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 0.625rem 1.5rem var(--network-glow);
    transition:
      transform 0.12s ease,
      box-shadow 0.18s ease,
      filter 0.18s ease;
  }

  .network--instagram {
    --network-fill: linear-gradient(
      118deg,
      #f9ce34 0%,
      #ee2a7b 48%,
      #6228d7 100%
    );
    --network-edge: rgba(255, 255, 255, 0.2);
    --network-glow: color-mix(in srgb, #ee2a7b 34%, transparent);
  }

  .network--facebook {
    --network-fill: linear-gradient(135deg, #1877f2 0%, #0b53c0 100%);
    --network-edge: rgba(255, 255, 255, 0.18);
    --network-glow: color-mix(in srgb, #1877f2 34%, transparent);
  }

  /* Preserve white-mark contrast across the Instagram gradient. */
  .network-mark {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.22);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
    font-size: 1.0625rem;
  }

  .network-text {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
  }

  /* Unbounded account names truncate instead of changing button height. */
  .network-label,
  .network-hint {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .network-label {
    font-size: 1rem;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .network-hint {
    font-size: 0.8125rem;
    opacity: 0.85;
  }

  .network-chevron {
    flex: 0 0 auto;
    font-size: 0.8125rem;
    opacity: 0.7;
  }

  .network:hover:not(:disabled) {
    filter: brightness(1.08) saturate(1.05);
    box-shadow: 0 0.875rem 2rem var(--network-glow);
  }

  .network:active:not(:disabled) {
    transform: scale(0.985);
  }

  .network:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }

  .network.is-posted {
    filter: saturate(0.72);
  }

  /* Equal columns keep destination changes from reflowing the row. */
  .tiles {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 0.5rem;
  }

  .tile {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 0.4375rem;
    min-height: 2.75rem;
    padding: 0.5rem 0.375rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 1rem;
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font: inherit;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      transform 0.12s ease;
  }

  .tile-icon {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 999px;
    background: var(--theme-surface-3, rgba(255, 255, 255, 0.09));
    color: var(--theme-text, #fff);
    font-size: 0.9375rem;
  }

  .tile-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.72));
    white-space: nowrap;
  }

  .tile:hover:not(:disabled) {
    background: var(--theme-surface-3, rgba(255, 255, 255, 0.09));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
  }

  .tile:active:not(:disabled) {
    transform: scale(0.96);
  }

  .tile:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Account setup scrolls instead of adding an unbudgeted row. */
  .connections {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    overflow-x: auto;
    scrollbar-width: none;
    margin-inline: -1rem;
    padding-inline: 1rem;
  }

  .connections::-webkit-scrollbar {
    display: none;
  }

  .connections > :global(*) {
    flex: 0 0 auto;
  }

  .page-chip {
    position: relative;
  }

  .page-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 0.625rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
  }

  .page-option:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
  }

  .page-option.selected {
    color: var(--theme-text, #fff);
    font-weight: 600;
  }

  .page-option i {
    font-size: 0.625rem;
  }

  .page-option--add {
    margin-top: 0.25rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0 0 0.5rem 0.5rem;
  }

  .page-option--add:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding: 0.5rem 1.125rem;
    border-radius: 999px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    background: var(--theme-surface-2, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
    font: inherit;
    cursor: pointer;
  }

  .secondary:hover {
    background: var(--theme-surface-3, rgba(255, 255, 255, 0.12));
  }

  /* Reserve the row even when no message is visible. */
  .status {
    margin: 0;
    min-height: 1.25rem;
    text-align: center;
    font-size: 0.8125rem;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    visibility: hidden;
  }

  .status.visible {
    visibility: visible;
  }

  /* Expand only when connected-account controls still fit above the fold. */
  @media (min-height: 940px) {
    .sheet {
      --stage-h: 22rem;
      --preview-h: 24rem;
      gap: 1rem;
      padding: 1.25rem;
    }

    .glyph-sizer {
      height: 1.75rem;
    }

    textarea {
      height: 5.5rem;
      min-height: 5.5rem;
    }

    .cta,
    .network {
      min-height: 3.5rem;
    }

    .tile {
      flex-direction: column;
      gap: 0.4375rem;
      padding: 0.75rem 0.375rem;
    }

    .tile-icon {
      width: 2.75rem;
      height: 2.75rem;
      font-size: 1.0625rem;
    }
  }

  /* Three phone columns leave labels readable and avoid an orphaned fifth tile. */
  @media (max-width: 480px) {
    .tiles {
      grid-auto-flow: row;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .tile {
      flex-direction: column;
      gap: 0.375rem;
      padding: 0.625rem 0.375rem;
    }

    .tile-icon {
      width: 2.25rem;
      height: 2.25rem;
      font-size: 1rem;
    }
  }

  /* Wide layouts put artwork beside controls so the preview can use their height. */
  @media (min-width: 900px) {
    .sheet {
      display: grid;
      width: min(58rem, 100%);
      grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr);
      grid-template-areas:
        "stage header"
        "stage picker"
        "stage caption"
        "stage cta"
        "stage tiles"
        "stage connections"
        "stage status"
        "stage customize";
      /* Let the useful caption field absorb the card column's extra height. */
      grid-template-rows: auto auto minmax(5rem, 1fr) auto auto auto auto auto;
      align-content: start;
      column-gap: 1.5rem;
      row-gap: 0.625rem;
    }

    .panel-header {
      grid-area: header;
    }
    .stage {
      grid-area: stage;
      min-height: 0;
      align-self: start;
    }

    /* Pending states fill the stage column; media remains top-aligned. */
    .stage:not(.showing-media) {
      align-self: stretch;
    }
    .artifact-picker {
      grid-area: picker;
      justify-self: start;
    }
    .caption-block {
      grid-area: caption;
      min-height: 0;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
      grid-area: cta;
    }
    .tiles {
      grid-area: tiles;
      align-self: start;
    }
    .status {
      grid-area: status;
    }

    /* Explicit placement prevents later spacer rows from capturing customization. */
    .customize {
      grid-area: customize;
    }

    /* The content-sized stage requires a viewport-based media ceiling. */
    .preview {
      max-width: 100%;
      max-height: 58vh;
    }

    textarea {
      flex: 1 1 auto;
      height: auto;
      min-height: 5rem;
      max-height: 9rem;
    }

    /* Cancel phone edge bleed once these rows begin mid-sheet. */
    .presets,
    .connections {
      margin-inline: 0;
      padding-inline: 0;
    }
    .connections {
      grid-area: connections;
    }

    /* Desktop QR grows for arm's-length scanning but still clears short windows. */
    .qr-view img {
      width: min(13rem, 34vh);
      height: min(13rem, 34vh);
    }
  }

  /* Tighten wide, short viewports so account setup remains above the fold. */
  @media (min-width: 900px) and (max-height: 620px) {
    .sheet {
      width: min(52rem, 100%);
      /* Expanded customization needs both columns at this height. */
      grid-template-areas:
        "stage header"
        "stage picker"
        "stage caption"
        "stage cta"
        "stage tiles"
        "connections status"
        "customize customize";
      grid-template-rows: auto auto minmax(3.25rem, 1fr) auto auto auto auto;
      row-gap: 0.25rem;
      padding: 0.25rem 1rem 0.375rem;
    }

    .glyph-sizer {
      height: 1.375rem;
    }

    .panel-header {
      padding-bottom: 0.375rem;
    }

    .cta {
      min-height: 2.75rem;
      padding: 0.5rem 1rem;
    }

    /* Spend spare width to keep both network actions on one row. */
    .actions {
      flex-direction: row;
      flex-wrap: wrap;
    }

    .actions > :global(*) {
      flex: 1 1 12rem;
      min-width: 0;
    }

    .network {
      min-height: 2.75rem;
      padding: 0.375rem 0.875rem;
      gap: 0.625rem;
      border-radius: 0.75rem;
    }

    .network-mark {
      width: 1.75rem;
      height: 1.75rem;
      font-size: 0.875rem;
    }

    /* Brand-colored compact buttons do not need chevrons consuming label width. */
    .network-chevron {
      display: none;
    }

    .status {
      min-height: 0.875rem;
      font-size: 0.75rem;
      align-self: center;
      text-align: right;
    }

    /* Override textarea rows where vertical space is fixed. */
    textarea {
      flex: 1 1 3.25rem;
      height: 3.25rem;
      min-height: 3.25rem;
    }
  }

  /* Grow the sheet with large canvases instead of leaving a phone-width strip. */
  @media (min-width: 1680px) {
    .sheet {
      width: min(74rem, 100%);
      column-gap: 2rem;
      row-gap: 0.875rem;
      padding: 1.5rem;
    }

    .glyph-sizer {
      height: 2rem;
    }

    .cta-label,
    .network-label,
    textarea {
      font-size: 1.0625rem;
    }

    .cta-hint,
    .network-hint,
    .tile-label,
    .status {
      font-size: 0.9375rem;
    }

    .network {
      min-height: 4rem;
      padding-inline: 1.25rem;
    }

    .network-mark {
      width: 2.5rem;
      height: 2.5rem;
      font-size: 1.1875rem;
    }

    .artifact-picker :global(.segment),
    .presets :global(.chip-label),
    .connections :global(.chip-label) {
      font-size: 0.9375rem;
    }
  }

  /* Includes 4K at 150% display scaling. */
  @media (min-width: 2350px) {
    .sheet {
      width: min(100rem, 100%);
      /* A fixed track matches the card raster and cannot shift when media lands. */
      grid-template-columns: 44rem minmax(0, 1fr);
      column-gap: 2.5rem;
      row-gap: 1rem;
      padding: 2rem;
    }

    .preview {
      max-height: 66vh;
    }

    .sheet {
      /* Flexible bookend rows center controls beside the spanning stage. */
      grid-template-areas:
        "stage ."
        "stage header"
        "stage picker"
        "stage caption"
        "stage cta"
        "stage tiles"
        "stage connections"
        "stage status"
        "stage customize"
        "stage .";
      grid-template-rows: 1fr auto auto auto auto auto auto auto auto 1fr;
    }

    textarea {
      max-height: 13rem;
    }

    .glyph-sizer {
      height: 2.375rem;
    }

    .qr-view img {
      width: min(15rem, 34vh);
      height: min(15rem, 34vh);
    }

    .cta {
      min-height: 4.5rem;
      border-radius: 1.25rem;
    }

    .cta i {
      font-size: 1.5rem;
      width: 2rem;
    }

    .network {
      min-height: 5rem;
      padding-inline: 1.5rem;
      border-radius: 1.25rem;
      gap: 1.125rem;
    }

    .network-mark {
      width: 3.25rem;
      height: 3.25rem;
      font-size: 1.5rem;
    }

    .network-chevron {
      font-size: 1rem;
    }

    .cta-label,
    .network-label,
    textarea {
      font-size: 1.3125rem;
    }

    .cta-hint,
    .network-hint,
    .tile-label,
    .customize-label,
    .status {
      font-size: 1.0625rem;
    }

    .tile-icon {
      width: 3rem;
      height: 3rem;
      font-size: 1.25rem;
    }

    /* Scale the embedded panel locally without changing its other consumers. */
    .customize-body {
      --font-size-compact: 1rem;
      --font-size-min: 1.125rem;
    }

    .customize-body :global(.chip) {
      min-height: 3rem;
      border-radius: 0.875rem;
    }

    .artifact-picker :global(.segment),
    .presets :global(.chip-label),
    .connections :global(.chip-label) {
      font-size: 1.125rem;
    }
  }

  /* Native 4K needs another type and control step for viewing distance. */
  @media (min-width: 3200px) {
    .sheet {
      /* The 60rem track displays the 960px card raster at 1:1. */
      width: min(118rem, 100%);
      grid-template-columns: 60rem minmax(0, 1fr);
      column-gap: 3rem;
      row-gap: 1.25rem;
      padding: 2.5rem;
    }

    .preview {
      max-height: 72vh;
    }

    textarea {
      max-height: 17rem;
    }

    .glyph-sizer {
      height: 2.875rem;
    }

    .qr-view img {
      width: min(19rem, 34vh);
      height: min(19rem, 34vh);
    }

    .cta {
      min-height: 5.5rem;
      border-radius: 1.5rem;
    }

    .cta i {
      font-size: 1.875rem;
      width: 2.5rem;
    }

    .network {
      min-height: 6.25rem;
      padding-inline: 1.875rem;
      border-radius: 1.5rem;
      gap: 1.375rem;
    }

    .network-mark {
      width: 4rem;
      height: 4rem;
      font-size: 1.875rem;
    }

    .network-chevron {
      font-size: 1.25rem;
    }

    .cta-label,
    .network-label,
    textarea {
      font-size: 1.625rem;
    }

    .cta-hint,
    .network-hint,
    .tile-label,
    .customize-label,
    .status {
      font-size: 1.3125rem;
    }

    .tile-icon {
      width: 3.75rem;
      height: 3.75rem;
      font-size: 1.5rem;
    }

    .artifact-picker :global(.segment),
    .presets :global(.chip-label),
    .connections :global(.chip-label) {
      font-size: 1.375rem;
    }

    .customize-body {
      --font-size-compact: 1.125rem;
      --font-size-min: 1.3125rem;
    }

    .customize-body :global(.chip) {
      min-height: 3.5rem;
      padding-inline: 1.25rem;
    }
  }

  /* QR mode collapses every wide two-column tier back to one focused column. */
  .sheet.qr-step {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "header"
      "stage";
    grid-template-rows: auto auto;
    width: min(34rem, 100%);
    row-gap: 1.25rem;
  }

  .sheet.qr-step .stage {
    justify-self: center;
    align-self: center;
  }

  /* Track the QR size instead of inheriting the setup sheet's width. */
  @media (min-width: 2350px) {
    .sheet.qr-step {
      width: min(38rem, 100%);
    }
  }

  @media (min-width: 3200px) {
    .sheet.qr-step {
      width: min(44rem, 100%);
    }
  }

  /* The modal frame owns width; an inner rem cap would recreate dead rails. */
  .sheet[data-surface="modal"] {
    width: 100%;
    max-width: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .cta,
    .network,
    .tile,
    .header-close,
    textarea {
      transition: none;
    }

    .cta:active:not(:disabled),
    .network:active:not(:disabled),
    .tile:active:not(:disabled) {
      transform: none;
    }
  }
</style>
