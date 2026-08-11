<!--
  PostShareSheet.svelte — viewer → Instagram/Facebook in as few steps as the
  platform allows.

  Owns the whole handoff: which artifact, what the caption says, and where it
  goes. Rendered ONLY from SequenceViewerShell so the drawer, /q/[code] and
  /sequence/[id] are identical by construction (.claude/rules/sequence-viewer-shell.md).

  Two behaviors are load-bearing and easy to regress:

  1. The sheet NEVER blocks on a render. The card is cached and lands
     immediately; picking Video kicks the export off and the destination
     buttons stay disabled-with-progress until the blob exists.
  2. Nothing here resizes when state changes. The preview stage is a fixed
     aspect box, the status line reserves its row, and the QR view swaps
     inside a min-height stage (.claude/rules/no-layout-shift.md).
-->
<script lang="ts">
  import ShareSheetFrame from "./ShareSheetFrame.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import InstagramIcon from "$lib/shared/auth/components/icons/InstagramIcon.svelte";
  import FacebookIcon from "$lib/shared/auth/components/icons/FacebookIcon.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { deriveWord } from "$lib/shared/foundation/services/word-deriver";
  import { getSharer } from "$lib/shared/share/get-sharer";
  import { getVideoUploader } from "$lib/shared/share/get-video-uploader";
  import { getQRCodeGenerator } from "$lib/shared/qr/get-qr-code-generator";
  import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getCaptionPresetManager } from "$lib/shared/share/state/caption-presets.svelte";
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
    /**
     * Canonical share link for this sequence. Used for the caption only when it
     * is already a post link (the visual harness passes one) — the viewer's own
     * URL carries the sequence inline and is far too long to post, so the sheet
     * mints a short code and builds the link itself.
     */
    shareUrl: string;
    /** Object URL of an already-rendered export, if the viewer has one. */
    videoBlobUrl: string | null;
    isExportingVideo: boolean;
    /**
     * A 3D scene video is a live camera performance the user drives and stops,
     * not a background render. While that take is running the viewer owns the
     * screen, so the sheet must neither ask for a second one nor call it
     * "rendering".
     */
    isRecordingScene?: boolean;
    /** 0–1 render progress, or null when idle. */
    exportProgress: number | null;
    /**
     * Asks the viewer to start a video export. Non-blocking. Resolving `false`
     * means the viewer refused the request outright — the export account gate,
     * a canvas that has not mounted, a take already running — and the sheet
     * stops waiting for a render that is never coming.
     */
    onRequestVideo: () => void | Promise<boolean>;
    /** Fires when the sheet dismisses itself (backdrop, escape, swipe). */
    onClose: () => void;
    /**
     * Testing seam. Connection state normally arrives over a Firestore
     * subscription, which a visual harness cannot produce — and the sheet
     * composes differently depending on which accounts are connected, so all
     * three states have to be checkable at every viewport. Only
     * `src/routes/test/post-share-sheet` passes this.
     */
    metaStatusOverride?: MetaPublishStatus;
    /**
     * Hands the sequence to another TKA user. App-internal, so it is not a
     * handoff destination — the host owns the send sheet and passes the opener.
     * Omitted on hosts with no inbox (the /q scan page, the visual harness),
     * where the tile simply does not appear.
     */
    onSendInTka?: () => void;
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
  }: Props = $props();

  const captions = getCaptionPresetManager();

  /** Title glyph height in px, measured off a CSS-sized element. */
  let glyphHeight = $state(0);

  let artifact = $state<ShareArtifact>("card");
  let caption = $state("");
  let captionTouched = $state(false);
  let statusMessage = $state("");
  let busyDestination = $state<HandoffDestinationId | null>(null);
  /** The viewer turned the render down. See {@link requestVideo}. */
  let videoRefused = $state(false);

  let cardBlob = $state<Blob | null>(null);
  let cardPreviewUrl = $state<string | null>(null);
  let videoBlob = $state<Blob | null>(null);

  /** Post link for this sequence, once the code lands. */
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

  /**
   * `deriveWord`, not `sequence.word`: a workspace sequence has not been saved,
   * so its `word` field is empty and only its steps carry the letters. Reading
   * the raw field left the Create surface with no title and a caption that was
   * a bare URL, while the card beside it rendered the word correctly.
   */
  const alphabetWord = $derived(sequence ? deriveWord(sequence) : "");

  const word = $derived(
    simplifyRepeatedWord(
      sequence?.displayName || alphabetWord || sequence?.intendedWord || ""
    )
  );

  /**
   * The header renders in the alphabet, so it takes the alphabet word rather
   * than {@link word} — a custom displayName is prose and has no glyphs. It is
   * simplified for the same reason every other surface is: a LOOP repeats its
   * word by construction, and FΨ is the word, not FΨFΨFΨFΨ
   * (.claude/rules/simplified-word-display.md).
   */
  const glyphWord = $derived(simplifyRepeatedWord(alphabetWord));

  /**
   * A caller-supplied link is used only if it is already the post-link form.
   * The visual harness passes one; the viewer passes its own inline-encoded
   * share URL, which is dropped in favour of the minted code below.
   */
  const seededShortUrl = $derived(
    isPostLink(shareUrl ?? "") ? shareUrl.trim() : ""
  );

  /** The only link that ever reaches a caption. */
  const postUrl = $derived(shortUrl ?? seededShortUrl);

  const presets = $derived(
    captions.buildPresets({
      word: alphabetWord || sequence?.displayName || "",
      url: postUrl,
    })
  );

  const activeBlob = $derived(artifact === "video" ? videoBlob : cardBlob);

  const filename = $derived(buildArtifactFilename(word, artifact));

  const destinations = $derived(
    resolveDestinations({ artifact, blob: activeBlob, filename })
  );

  /**
   * The device's own share affordance, when it has one — and the sheet's test
   * for being on a phone. `resolveDestinations` gates this on the DEVICE, not
   * the capability, so desktop Chrome never produces it even though it
   * implements `navigator.share`.
   */
  const nativeShare = $derived(
    destinations.find((destination) => destination.id === "native-share") ?? null
  );

  /**
   * The flag hides posting everywhere; the harness override is how the visual
   * pass still reaches all three connection states while it is off.
   */
  const postingAvailable = $derived(
    META_POSTING_ENABLED || metaStatusOverride !== undefined
  );

  const metaStatus = $derived(metaStatusOverride ?? liveMetaStatus);

  type NetworkKind = "post" | "connect" | "choose-page" | "handoff";

  interface NetworkPlan {
    key: "instagram" | "facebook";
    brand: "instagram" | "facebook";
    /** The network's own name, for labels the account name would otherwise own. */
    name: string;
    label: string;
    hint: string;
    kind: NetworkKind;
    /** Set for every kind that talks to Meta. */
    target?: MetaPublishTarget;
    /** Set for `handoff`: the mechanism that reaches this network without an API. */
    destination?: HandoffDestinationId;
  }

  /**
   * Instagram and Facebook, as the two things this sheet exists for.
   *
   * They used to be small chips under a generic accent button, which is how a
   * sheet whose entire purpose is those two networks ended up with no trace of
   * either on it (Austen, 2026-08-11: "there's no evidence of the Facebook or
   * Instagram logo"). Each network is now one button in its own colours at
   * every state, and the state changes only what the button DOES: post when
   * the account is connected, connect when it is not, and — when posting is
   * switched off — the handoff that genuinely reaches that network, which is
   * the QR for Instagram and the clipboard for Facebook.
   *
   * A phone is the exception: its OS share sheet reaches both networks in one
   * tap and is the honest primary there, so the fallbacks are desktop-only and
   * the row can legitimately come back empty.
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
        label: "Post to Instagram",
        hint: `@${instagram.username}`,
        kind: "post",
        target: "instagram",
      });
    } else if (postingAvailable) {
      plans.push({
        key: "instagram",
        brand: "instagram",
        name: "Instagram",
        label: "Connect Instagram",
        hint: "Post straight from here",
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

    // A connection with no Page chosen is not a post target yet: "Post to
    // Facebook" would have to name a Page, and the only name available would
    // be a guess. It asks for the Page instead.
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

  /** Every connected Meta target, for the disconnect chips in the setup row. */
  const autoPostTargets = $derived(
    networks
      .filter((plan) => plan.kind === "post")
      .map((plan) => ({
        id: plan.target as MetaPublishTarget,
        network: plan.name,
        account: plan.hint,
      }))
  );

  /**
   * Whatever the network buttons did not claim. A handoff promoted onto a
   * network button must not also sit in the tile row underneath it, or the
   * same action appears twice with two different names.
   */
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
        // A network with its own button owns that network. Leaving the
        // clipboard handoff in the tile row too puts Facebook on the sheet
        // twice, under two different names, doing two different things.
        !(destination.brand && branded.has(destination.brand))
    );
  });

  const facebookPages = $derived(metaStatus.facebookPage?.pages ?? []);

  /**
   * Connected, administers several Pages, and hasn't said which one. The chip
   * is the ask — it is the only thing standing between here and posting, so it
   * reads as an action rather than a settled setting.
   */
  const pageChoicePending = $derived(
    !!metaStatus.facebookPage && !metaStatus.facebookPage.selectedPageId
  );

  const metaBusy = $derived(postingTarget !== null || connectingTarget !== null);

  const previewReady = $derived(
    !qrDataUrl &&
      ((artifact === "card" && !!cardPreviewUrl) ||
        (artifact === "video" && !!videoBlobUrl))
  );

  const videoBusy = $derived(artifact === "video" && !videoBlob);

  const progressLabel = $derived.by(() => {
    if (!videoBusy) return "";
    // A scene take is the user recording, not the machine rendering. Saying
    // "Rendering video…" over it is what made the 3D path look hung.
    if (isRecordingScene) return "Recording the scene…";
    if (isExportingVideo && exportProgress !== null) {
      return `Rendering video… ${Math.round(exportProgress * 100)}%`;
    }
    return "Rendering video…";
  });

  // Card first: getCardImageBlob is cached, so the sheet is actionable the
  // moment it opens. Runs on open rather than at module scope so a viewer that
  // never shares never pays the render.
  $effect(() => {
    if (!isOpen || !sequence || cardBlob) return;

    const target = sequence;
    let stale = false;

    void (async () => {
      try {
        const blob = await getSharer().getCardImageBlob(target, {
          darkMode: getImageCompositionManager().darkMode,
        });
        if (stale) return;
        cardBlob = blob;
        cardPreviewUrl = URL.createObjectURL(blob);
      } catch (error) {
        console.error("[PostShareSheet] Card render failed:", error);
        if (!stale) statusMessage = "Couldn't render the card";
      }
    })();

    return () => {
      stale = true;
    };
  });

  // The viewer owns the export; this only adopts the resulting blob.
  $effect(() => {
    const url = videoBlobUrl;
    if (!url) return;

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

  // The caption's link. Minting writes a Firestore doc and dedups by content,
  // so it runs on open — the same "sheet opens instantly, the slow part fills
  // in" contract the card render follows. Until it lands the caption is just
  // the word; it never shows the long viewer URL on the way.
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
        // result.url is the QR form (HTTPS://TKA.RUN/CODE). A caption takes the
        // share route instead — see buildPostLink for why.
        if (!stale) shortUrl = buildPostLink(result.code);
      } catch (error) {
        // Short codes are signed-in-only, and a sequence that switches between
        // one-hand and two-hand choreography has none. Both are ordinary — the
        // caption carries the word alone and the share still works.
        console.warn("[PostShareSheet] No short link for the caption:", error);
      }
    })();

    return () => {
      stale = true;
    };
  });

  // Seed the caption once, and stop the moment the user types — the textarea
  // is the source of truth from then on. Re-runs when the short link lands,
  // which is what fills the URL in behind an untouched caption.
  $effect(() => {
    if (!isOpen || captionTouched) return;
    const first = presets[0];
    if (first) caption = first.text;
  });

  $effect(() => {
    return () => {
      if (cardPreviewUrl) URL.revokeObjectURL(cardPreviewUrl);
    };
  });

  // Which Meta accounts are connected, live. Only while the sheet is open —
  // a viewer that never shares should not hold a Firestore listener.
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
    // A "View post" that points at the card is wrong once the video is
    // selected, so the posted-state resets with the artifact.
    postedPermalinks = {};

    // isRecordingScene counts as in flight: a 3D take reads as idle to both
    // other flags, so without it re-picking Video starts a second recording.
    if (next === "video" && !videoBlob && !isExportingVideo && !isRecordingScene) {
      requestVideo();
    }
  }

  /**
   * The viewer refuses a render for reasons the sheet cannot see from its props
   * — the take-it-home account gate, an animation canvas that has not mounted,
   * an export already in flight. Until it reported that, the sheet sat on
   * "Rendering video…" forever with no error and no way back.
   */
  function requestVideo(): void {
    videoRefused = false;
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
    captions.saveCustomPreset(caption);
    statusMessage = "Saved as a preset";
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

  /**
   * The direct post. Meta fetches the media itself, so the artifact goes to R2
   * first and only its URL is handed over — the same upload the QR handoff
   * already uses, which is why an unsaved sequence has nowhere to put it.
   */
  async function postToTarget(target: MetaPublishTarget): Promise<void> {
    const blob = activeBlob;
    if (!blob) return;
    if (!sequence?.id) {
      statusMessage = "Save this sequence first so it has somewhere to upload to.";
      return;
    }

    postingTarget = target;
    statusMessage = "";
    postStage = "Uploading…";

    try {
      // Both viewer encoders emit H.264 MP4, which is what Meta ingests. If a
      // future export path ever hands back WebM, say so here rather than
      // uploading it and letting Meta reject the container minutes later.
      if (artifact === "video" && blob.type && !blob.type.includes("mp4")) {
        statusMessage = "This video isn't in a format Instagram or Facebook accepts.";
        return;
      }

      // Instagram's container endpoint accepts JPEG only; the card renders PNG.
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

  /**
   * What a network button does depends only on where that account currently
   * stands, so the button itself carries no branching — the plan does.
   */
  /**
   * Tiles the sheet owns rather than the handoff resolver: one is app-internal
   * (the TKA inbox), the other needs the short code the sheet just resolved.
   * They live here so the workspace and the viewer stop needing a context menu
   * to reach them.
   */
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
      case "post":
        void postToTarget(plan.target as MetaPublishTarget);
        return;
      case "connect":
        void connectTarget(plan.target as MetaPublishTarget);
        return;
      case "choose-page":
        // The list of Pages Meta shared lives in the setup row's dropdown,
        // directly under this button. Opening it there keeps one owner for
        // the Page choice instead of a second copy inside the button.
        pageMenuOpen = true;
        return;
      case "handoff":
        void runDestination(plan.destination as HandoffDestinationId);
    }
  }

  /**
   * Connecting and picking a Page are account setup and need no artifact.
   * Everything else moves the file, so it waits for the render.
   */
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

  /**
   * The dropdown can only offer Pages Meta actually shared. Reaching one that
   * was left out of the original grant means asking Meta again, which it will
   * only do once the current grant is released — so this drops it and reopens
   * the dialog in one action.
   */
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

  // The Page menu is fixed-positioned outside the chip, so a click anywhere
  // else has to close it explicitly.
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

<!-- One network, one button, in that network's own colours.

     The posted state reuses the SAME box rather than adding a "View post" row:
     a new element appearing after a successful post would shove the sheet
     (.claude/rules/no-layout-shift.md). -->
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
        <!-- The account name is the hint at rest and the stage while posting,
             so progress replaces it in place instead of adding a line. -->
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
  <!-- The QR is a focused step, not a sibling of the setup controls: with the
       picker, caption, tiles and connections all hidden, the two-column grid
       leaves the whole right column empty under the title. One column. -->
  <!-- `autofocus` on the container, not on a control. A native <dialog> that
       finds no autofocus target focuses its first focusable child, which here
       is Close — so the sheet opened with a focus ring around the one button
       that throws the sheet away, drawing the eye there instead of to the
       destinations. Taking the focus itself is also the standard dialog
       behaviour: the sheet is announced, and Tab starts at the first control. -->
  <!-- svelte-ignore a11y_autofocus -->
  <div
    class="sheet"
    data-surface={surface}
    class:qr-step={!!qrDataUrl}
    tabindex="-1"
    autofocus
  >
    <header class="panel-header">
      <!-- The word is a word in this alphabet, so it renders in the alphabet —
           the same glyph component the card, the gallery and compose use. A
           system font here spells FΨ as two unrelated symbols. -->
      <h2 class="panel-title">
        <!-- The glyph takes a px height, but the size belongs with the other
             tier rules in CSS, so a zero-width sizer carries it across. -->
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

    <!-- A compact glass pill, not a full-width bar: two short labels size to
         their labels (.claude/rules/visual-verification-mandatory.md). It sits
         above the artwork rather than on it, because the card preview IS the
         content and an overlay would cover a pictograph. -->
    {#if !qrDataUrl}
      <div class="artifact-picker">
        <SegmentedControl
          options={[
            { value: "card", label: "Card" },
            { value: "video", label: "Video" },
          ]}
          value={artifact}
          onchange={handleArtifactChange}
          ariaLabel="What to share"
          semantics="radiogroup"
          size="sm"
          color="accent"
        />
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
      {:else if artifact === "card" && cardPreviewUrl}
        <img class="preview" src={cardPreviewUrl} alt="Sequence card preview" />
      {:else if artifact === "video" && videoBlobUrl}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video class="preview" src={videoBlobUrl} autoplay loop muted playsinline
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
          <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
          <span>{progressLabel || "Preparing…"}</span>
        </div>
      {/if}

    </div>

    {#if !qrDataUrl}
      <div class="caption-block">
        <!-- One scrolling chip row instead of a label row plus a chip row: the
             presets and "save this one" are the same gesture family, and the
             placeholder already names the field. -->
        <label class="visually-hidden" for="post-share-caption">Caption</label>

        <div class="presets">
          {#each presets as preset (preset.id)}
            <!-- Toggle, not action: these are one-of-N choices where the Nth
                 option is "typed my own", so the row has a none-selected state
                 and no indicator to slide. Without `active` all the presets
                 rendered identically and nothing said which caption you were
                 looking at. -->
            <FilterChipBase
              label={preset.label}
              mode="toggle"
              active={caption === preset.text}
              size="sm"
              onclick={() => applyPreset(preset.text)}
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

      <!-- The destinations, in the order they matter: the phone's own share
           sheet when there is one (one tap, reaches everything), then a
           full-width button per network. -->
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
                  <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"
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
              disabled={(destination.id !== "copy-caption" && !activeBlob) ||
                busyDestination !== null ||
                qrPending}
              onclick={() => runDestination(destination.id)}
            >
              <span class="tile-icon">
                {#if busyDestination === destination.id}
                  <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"
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

      <!-- Setup for accounts that are ALREADY connected — which Page, and how
           to drop the connection. Connecting itself is not here any more: it
           is the network button above, in that network's own colours. -->
      {#if metaStatus.facebookPage || autoPostTargets.length}
        <div class="connections">
          {#if metaStatus.facebookPage}
            {@const selected = metaStatus.facebookPage}
            <!-- A dropdown, not a segmented control: Page names are long and
                 unbounded, and laying them all out side by side is what pushed
                 this row past the sheet's width. -->
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
                  <!-- Lives here because this is where you look when the Page
                       you want is not on the list. The setup row above is one
                       scrolling line by design and has no room for a fourth
                       chip. -->
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
                      <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"
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
            <!-- The network, not the account: the account is already named on
                 the post button above, and a variable-width label here is what
                 made this row overflow the sheet. -->
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

    <!-- Reserved row: status text appears and disappears without moving the
         sheet's contents. -->
    <p class="status" role="status" class:visible={!!(statusMessage || qrError)}>
      {qrError || statusMessage || " "}
    </p>
  </div>
  {/snippet}
</ShareSheetFrame>

<style>
  /* Phone portrait is the tight case, so it is the base: everything from the
     title to the tile row has to fit above the fold at 375x667. Taller
     viewports get the roomier version back in the min-height tier below.
     (The surface itself — drawer under 900px, dialog above — is
     ShareSheetFrame's; this file only lays out what sits on it.) */
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1rem;
    width: min(34rem, 100%);
    margin: 0 auto;
  }

  /* The app's sheet header, not a new one: title left, one action right, a
     hairline under it. Matches ScanCardSheet's .panel-header, which is what
     every other bottom sheet in this app already looks like. */
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
    /* The glyph carries the word; this element only positions it. */
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

  /* Brand marks size themselves off the surrounding text so they sit on the
     same optical line as FontAwesome glyphs in the same row. */
  .brand-mark {
    display: inline-flex;
    flex: 0 0 auto;
  }

  .brand-mark :global(svg) {
    width: 1.15em;
    height: 1.15em;
  }

  /* Fixed box: the preview, the pending spinner and the QR view all live here,
     so swapping between them never resizes the sheet. */
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

  /* The frame belongs to the spinner and the QR view, which need a surface to
     sit on. Real artwork does not: the card renders its own rounded edge and
     shadow, so keeping the box around it draws a bordered well with a portrait
     card floating in the middle of it — the artwork centres on empty space
     instead (.claude/rules/visual-verification-mandatory.md, dead space). */
  .stage.showing-media {
    padding: 0;
    border-color: transparent;
    background: none;
    box-shadow: none;
  }

  /* Capped in rem, not %: the stage row is content-sized, so a percentage here
     resolves against an indefinite height and stops capping anything. Each tier
     sets --preview-h to its stage height minus padding.

     The 24vh ceiling is the second half of the cap, and it is what keeps the
     sheet on screen: the artwork is the one element that can give height back,
     and without it the wide-screen tiers grow the card on a 1080-tall desktop
     until the setup row falls past the bottom of the drawer. */
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

  /* Stacked, because the retry is an action rather than a continuation of the
     sentence, and the stage is taller than it is wide at every width. */
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

  /* Centered above the artwork, and otherwise left alone: SegmentedControl
     already carries the app's look, and re-skinning it into a glass capsule is
     what made this control read as hand-rolled. Only the width override stays,
     so it sizes to its two labels rather than the sheet
     (.claude/rules/visual-verification-mandatory.md). */
  .artifact-picker {
    align-self: center;
    max-width: 100%;
  }

  .artifact-picker :global(.segmented-control) {
    width: auto;
  }

  .qr-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
  }

  /* The vh cap is what keeps the step's own Back button above the fold on a
     short window — the code is the only part of this view that can give. */
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

  /* Scrolls rather than wraps: a second chip line is 44px the phone doesn't
     have, and a row that grows by a line is layout shift. */
  .presets {
    display: flex;
    gap: 0.375rem;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 0.125rem;
    /* Bleed to the sheet edges so a scrolled row reads as scrollable. */
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
    /* The drawer is sized to its content and already fills the phone. A native
       grabber here lets a drag push the post buttons off the bottom of the
       screen, and it draws an OS widget into a designed surface. */
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

  /* One filled action. Buttons, never text links: every clickable here reads as
     clickable (.claude/rules/clickables-look-like-buttons.md). */
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

  /* Same box as the primary so a second connected account does not change the
     rhythm — only the fill tells you which one leads. */
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

  /* Account names and Page names are user data of unbounded length. They ride
     one line and truncate rather than wrapping the button taller than its
     sibling (.claude/rules/no-layout-shift.md). */
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

  /* A network destination, wearing that network's colours.

     The fills are the platforms' own: Instagram's is the mark's five-stop
     ramp, Facebook's is its single blue. Nothing else in this sheet is
     coloured, so these two read as the destinations and everything around
     them as the settings that feed them. */
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

  /* A disc behind the mark so the logo stays legible over the brightest stop
     of the Instagram ramp, where white-on-yellow otherwise disappears. */
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

  /* Account names and Page names are user data of unbounded length: they ride
     one line and truncate rather than growing the button taller than its
     sibling (.claude/rules/no-layout-shift.md). */
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

  /* Posted: the button stays put and stops shouting — the destination is no
     longer a thing to do, it is a thing to go look at. */
  .network.is-posted {
    filter: saturate(0.72);
  }

  /* Equal columns: the row must not reflow as the destination set changes with
     artifact or device (.claude/rules/no-layout-shift.md). */
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

  /* Account setup. Scrolls like the preset row for the same reason: a second
     line of chips is a row the phone layout has not budgeted. */
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

  /* Anchors the Page menu, which FilterChipBase positions against this chip. */
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

  /* Separated because it is an action, not one more Page to pick. */
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

  /* Always occupies its row: appearing text must not push the sheet. */
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

  /* The stage only claims its full height once the viewport can afford the
     whole sheet above the fold. 940, not 800: a connected account adds a second
     post button and the setup row, and at 900 the difference is exactly what
     pushed the setup row past the drawer's 85vh. */
  @media (min-height: 940px) {
    .sheet {
      /* Past 18rem the rem figure stops binding and the 30vh half of the cap
         takes over, which is the intent on a tablet: 288px of card in a
         1180px-tall viewport left the thing you came to look at smaller than
         the button under it, with 260px of viewport still unspent. */
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

  /* Two columns from 900px up — the artwork beside the controls, not above them.
     Stacked, the preview is capped by whatever vertical the controls leave over,
     which on a 1920x1080 desktop is a 165px-wide card marooned in a 624px-wide
     frame: the exact dead-space failure in visual-verification-mandatory.md.
     Beside them the stage is a tall column the card fills, so the thing you came
     here to look at is actually the biggest thing on screen.

     900 is the seam because it takes in every wide case at once: the folded
     Z Fold in landscape (960x412), where stacking pushes the actions off the
     bottom, and every laptop and desktop above it. Tablet portrait (820) stays
     stacked — one column is right when the viewport is taller than it is wide. */
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
        "stage status";
      /* The caption row takes the slack. The card is the tallest thing here,
         and the leftover beside it has to go somewhere: into the box you are
         actually typing in, rather than into a hole above the status line. */
      grid-template-rows: auto auto minmax(5rem, 1fr) auto auto auto auto;
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

    /* With no artwork the stage IS the frame, so it takes the column: a status
       line top-aligned beside a full-height controls column reads as a fragment
       floating in dead space. Artwork keeps `start` — a portrait card should
       hang from the title, not centre in a well. */
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

    /* vh, not the stage: the stage is content-sized here, so a percentage cap
       resolves against an indefinite height and stops capping. Without a real
       ceiling the card's natural size sets the sheet's height, and a laptop
       viewport gets a share sheet that scrolls. */
    .preview {
      max-width: 100%;
      max-height: 58vh;
    }

    /* Grows into the slack the card column leaves, but only so far: a caption
       is a few lines, and past that the box stops being an input you are
       filling and starts being a hole in the layout
       (.claude/rules/visual-verification-mandatory.md, dead space). */
    textarea {
      flex: 1 1 auto;
      height: auto;
      min-height: 5rem;
      max-height: 9rem;
    }

    /* The edge bleed exists so a scrolled row reads as scrollable against the
       sheet's own padding. In two columns these rows start mid-sheet, where
       bleeding would run them under the stage. */
    .presets,
    .connections {
      margin-inline: 0;
      padding-inline: 0;
    }
    .connections {
      grid-area: connections;
    }

    /* Scanning distance is arm's length across a desk, not phone-in-hand — but
       capped against the viewport, because the QR step also has to clear the
       fold on a wide-and-short window (960x412), where a fixed 13rem code
       pushes its own Back button off the bottom. */
    .qr-view img {
      width: min(13rem, 34vh);
      height: min(13rem, 34vh);
    }
  }

  /* Wide AND short (folded Z Fold landscape, a laptop with browser chrome
     eating the viewport): same two columns, every vertical measure tightened so
     the setup row still clears the fold. */
  @media (min-width: 900px) and (max-height: 620px) {
    /* The setup row moves under the artwork. The stage column here is ~170px
       wide against a 412px-tall viewport, so the left side has vertical to
       spare while the right side is the thing running out of it — keeping every
       row on the right is what pushed the setup chips off the bottom once
       connected accounts started adding a row. The tiles stay on the right:
       given the full width they stretch three short labels across 880px. */
    .sheet {
      width: min(52rem, 100%);
      grid-template-areas:
        "stage header"
        "stage picker"
        "stage caption"
        "stage cta"
        "stage tiles"
        "connections status";
      grid-template-rows: auto auto minmax(3.25rem, 1fr) auto auto auto;
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

    /* Side by side, not stacked. Stacked they cost two rows on the one viewport
       with no vertical to give — 56px more than the dialog has, which pushed the
       tiles under the fold — while each ran 490px wide across a column that had
       width to spare. One row spends the axis that is free to buy back the axis
       that is not, and lands the buttons at a proportion that reads like a pair
       of buttons rather than two progress bars. */
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

    /* Two per row leaves the text 129px and "Connect Instagram" needs 140. The
       chevron and its gap are 26 of those px, and it is the one part of the row
       carrying no information — a full-bleed brand-coloured button already reads
       as pressable. */
    .network-chevron {
      display: none;
    }

    .status {
      min-height: 0.875rem;
      font-size: 0.75rem;
      align-self: center;
      text-align: right;
    }

    /* Fixed basis rather than the three rows it asks for: on a 412px-tall
       viewport the caption has no slack to absorb, and `rows=3` is 38px the
       setup row needs more. */
    textarea {
      flex: 1 1 3.25rem;
      height: 3.25rem;
      min-height: 3.25rem;
    }
  }

  /* A bottom drawer on a 4K panel reads as a phone strip unless the sheet grows
     with the canvas (.claude/rules/4k-native-layout.md, 1680 seam). */
  @media (min-width: 1680px) {
    /* No --stage-h/--preview-h from here up: every viewport this wide is also
       past the 900px seam, so the stage is stretching and the preview's cap has
       already lifted. Width and type are what still have to step. */
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

  /* 2350, not 2600: 4K at 150% scaling lands here, and it is the tier a single
     big-screen seam always misses (.claude/rules/4k-native-layout.md). */
  @media (min-width: 2350px) {
    .sheet {
      width: min(100rem, 100%);
      /* A fixed stage track from here up, not a fraction. The card render is a
         960x1280 raster (sharer.ts stepSize 240, four columns), so the track is
         sized toward that instead of left to float: a fraction either starves
         the card or opens rail around it, and it changes width when the render
         lands, shoving the column (.claude/rules/no-layout-shift.md). */
      grid-template-columns: 44rem minmax(0, 1fr);
      column-gap: 2.5rem;
      row-gap: 1rem;
      padding: 2rem;
    }

    /* The vh ceiling exists to stop a laptop scrolling. A 1440-tall panel is
       not that panel, and holding 58vh here would cap the card below the track
       the tier just widened for it. */
    .preview {
      max-height: 66vh;
    }

    /* Beside a card this tall the controls no longer need the caption row to
       soak up slack — there is more slack than a caption can honestly use, and
       a 1fr row with a capped input inside it opens the hole ABOVE the post
       buttons rather than filling anything. Size the caption to its own content
       and let the trailing row hold what is left, so the column reads as a
       stack that ends rather than one with a gap punched through it. */
    .sheet {
      /* `align-content` cannot centre this: the stage spans every row, so there
         is no free space in the track list for it to distribute. Flexible rows
         above and below the control block do the same job against a spanning
         item — the stack sits opposite the middle of the card instead of
         hanging from its top edge with a column of black beneath it. */
      grid-template-areas:
        "stage ."
        "stage header"
        "stage picker"
        "stage caption"
        "stage cta"
        "stage tiles"
        "stage connections"
        "stage status"
        "stage .";
      grid-template-rows: 1fr auto auto auto auto auto auto auto 1fr;
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
    .status {
      font-size: 1.0625rem;
    }

    .tile-icon {
      width: 3rem;
      height: 3rem;
      font-size: 1.25rem;
    }

    .artifact-picker :global(.segment),
    .presets :global(.chip-label),
    .connections :global(.chip-label) {
      font-size: 1.125rem;
    }
  }

  /* 4K at 100%, or a TV across the room: nothing is scaling for you, so type
     and elements step again rather than the band alone. */
  @media (min-width: 3200px) {
    .sheet {
      /* 60rem is the card's own raster at 1:1 — 960px. Below it the artwork is
         downscaled on the one screen with the pixels to show it at full size,
         which is what made this sheet read as a small island in a black sea at
         3840. The rest of the band goes to the controls, at roughly the same
         8:1 button proportion the 1920 tier already ships. */
      width: min(118rem, 100%);
      grid-template-columns: 60rem minmax(0, 1fr);
      column-gap: 3rem;
      row-gap: 1.25rem;
      padding: 2.5rem;
    }

    /* 72vh of 2160 is 1555px — clear of the card's own 1280px height, so the
       raster finally renders 1:1 instead of being downscaled by its ceiling. */
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
  }

  /* The QR step, at every width. Higher specificity than the tier rules above,
     so it re-collapses the two-column grid they build: with everything but the
     title and the code hidden, those tiers otherwise leave a 90rem sheet whose
     right half is empty. Last in the file so it reads as the state it is. */
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

  /* Tracks the QR's own step (15rem, then 19rem) rather than the setup sheet's
     width. Any wider and the title and the close button drift to opposite ends
     of a column holding one code. */
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

  /* Last in the file so it beats every width tier above: inside the dialog the
     frame owns the sheet's width, and a rem cap here would centre a 34rem
     column in a 90rem dialog — the dead rail the modal exists to remove. */
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
