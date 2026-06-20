<script lang="ts">
  /**
   * SeamlessLoopVideo — gap-free looping on ONE decoder via MediaSource.
   *
   * A looping <video> (native or manual) seeks back to 0 at the seam, and a
   * single decoder can't produce frame 0 without a gap — blank (native) or a
   * frozen hold (canvas). Double-buffering removes the seam but doubles the
   * decoder count and overflows Chrome's limit on a 42-cell grid.
   *
   * MSE sidesteps the seek entirely: append the (fragmented-MP4) clip to a
   * SourceBuffer in `sequence` mode, which concatenates each copy at the current
   * end. The decoder plays a continuous stream of back-to-back copies — no seek,
   * no gap. We keep a few copies queued ahead of playback and trim played ranges
   * to bound memory. Falls back to a plain looping <video> if MSE or the
   * fragmented clip isn't usable.
   */
  interface Props {
    src: string;
    /** Extra class on the <video> (e.g. "clip"). */
    klass?: string;
  }
  let { src, klass = "" }: Props = $props();

  let video: HTMLVideoElement | null = $state(null);

  // Read the H.264 codec string from the clip's avcC box so the SourceBuffer
  // MIME matches the actual stream: avcC = [size:4][type:4='avcC'][version:1]
  // [profile:1][compat:1][level:1]… → avc1.<profile><compat><level>.
  function detectAvcCodec(b: Uint8Array): string | null {
    for (let i = 0; i + 8 < b.length; i++) {
      if (b[i] === 0x61 && b[i + 1] === 0x76 && b[i + 2] === 0x63 && b[i + 3] === 0x43) {
        const hex = (n: number) => n.toString(16).padStart(2, "0");
        return `avc1.${hex(b[i + 5]!)}${hex(b[i + 6]!)}${hex(b[i + 7]!)}`;
      }
    }
    return null;
  }

  $effect(() => {
    void src;
    const v = video;
    if (!v) return;

    let cancelled = false;
    let ms: MediaSource | null = null;
    let sb: SourceBuffer | null = null;
    let clip: ArrayBuffer | null = null;
    let clipDur = 0;

    const fallbackPlainLoop = () => {
      if (cancelled || !v) return;
      try { v.src = src; v.loop = true; v.muted = true; v.play().catch(() => {}); } catch { /* ignore */ }
    };

    const canAppend = () => !!sb && !sb.updating && !!ms && ms.readyState === "open";

    const append = () => {
      if (cancelled || !canAppend() || !clip) return;
      try { sb!.appendBuffer(clip); } catch { trim(); }
    };

    const trim = () => {
      if (cancelled || !sb || sb.updating || sb.buffered.length === 0) return;
      const start = sb.buffered.start(0);
      const keepFrom = Math.max(start, v.currentTime - (clipDur || 4));
      if (keepFrom > start + 0.1) {
        try { sb.remove(start, keepFrom); } catch { /* ignore */ }
      }
    };

    const topUp = () => {
      if (cancelled || !canAppend() || !clip) return;
      const end = sb!.buffered.length ? sb!.buffered.end(sb!.buffered.length - 1) : 0;
      const ahead = end - v.currentTime;
      if (ahead < (clipDur || 4) * 3) append(); // keep ~3 copies queued
      else trim();
    };

    const onUpdateEnd = () => {
      if (cancelled || !sb) return;
      if (!clipDur && sb.buffered.length) clipDur = sb.buffered.end(0);
      v.play().catch(() => {});
      topUp();
    };

    const onTime = () => topUp();

    const onOpen = () => {
      if (cancelled || !ms || !clip) return;
      const codec = detectAvcCodec(new Uint8Array(clip)) ?? "avc1.640028";
      const mime = `video/mp4; codecs="${codec}"`;
      if (!("isTypeSupported" in MediaSource) || !MediaSource.isTypeSupported(mime)) {
        fallbackPlainLoop();
        return;
      }
      try {
        sb = ms.addSourceBuffer(mime);
        sb.mode = "sequence"; // concatenate each append at the current end
        sb.addEventListener("updateend", onUpdateEnd);
        sb.addEventListener("error", fallbackPlainLoop);
        append();
      } catch {
        fallbackPlainLoop();
      }
    };

    (async () => {
      try {
        const res = await fetch(src);
        if (cancelled) return;
        if (!res.ok) { fallbackPlainLoop(); return; }
        clip = await res.arrayBuffer();
        if (cancelled) return;
        if (!("MediaSource" in window)) { fallbackPlainLoop(); return; }
        ms = new MediaSource();
        v.src = URL.createObjectURL(ms);
        v.addEventListener("timeupdate", onTime);
        ms.addEventListener("sourceopen", onOpen, { once: true });
        v.play().catch(() => {});
      } catch {
        fallbackPlainLoop();
      }
    })();

    return () => {
      cancelled = true;
      try { v.removeEventListener("timeupdate", onTime); } catch { /* ignore */ }
      try { sb?.removeEventListener("updateend", onUpdateEnd); } catch { /* ignore */ }
      try { if (ms && ms.readyState === "open") ms.endOfStream(); } catch { /* ignore */ }
      try {
        v.pause();
        if (v.src.startsWith("blob:")) URL.revokeObjectURL(v.src);
        v.removeAttribute("src");
        v.load();
      } catch { /* ignore */ }
    };
  });
</script>

<video bind:this={video} class={klass} muted playsinline preload="auto"></video>

<style>
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 10px;
    background: #0a1015;
    display: block;
  }
</style>
