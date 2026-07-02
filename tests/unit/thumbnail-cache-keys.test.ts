/**
 * Tests for thumbnail cache-key derivation and static-manifest key formats.
 *
 * These lock in the July 2026 gallery-cache fixes, each of which was a silent
 * failure in production (every card local-rendered while 4 cache tiers idled):
 *  - the deriver's canonical visibility must match the PRODUCT defaults
 *    (showMandala defaulted true in image-composition settings but false in
 *    the deriver, so every default-settings user keyed "non-default" and the
 *    static/cloud tiers + crowd uploads died for the whole population)
 *  - buildStaticKey must mirror the cloud storage path (variant + sequence id),
 *    not the pre-variant legacy format — the synced manifest keys are derived
 *    from storage paths verbatim
 *  - the legacy key stays available as a fallback for old bundled files
 */

import { describe, it, expect, vi } from "vitest";

// Prevent the orchestrator's cloud-cache import from pulling Firebase into
// the node test env — these tests only exercise pure key derivation.
vi.mock("$lib/shared/browse/services/cloud-thumbnail-cache", () => ({
  upload: vi.fn(),
  getCachedUrl: vi.fn(),
  getUrl: vi.fn(),
  clearMemoryCache: vi.fn(),
  invalidateUrl: vi.fn(),
}));

import { deriveKey } from "$lib/shared/browse/services/thumbnail-key-deriver";
import type { ThumbnailRenderInput } from "$lib/shared/browse/services/thumbnail-key-deriver";
import { ThumbnailRenderOrchestrator } from "$lib/shared/browse/services/thumbnail-render-orchestrator";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

function galleryInput(overrides: Partial<ThumbnailRenderInput> = {}): ThumbnailRenderInput {
  return {
    sequenceName: "AKE",
    sequenceId: "seq-1",
    bluePropType: PropType.STAFF,
    redPropType: PropType.STAFF,
    catDogModeEnabled: false,
    lightMode: false,
    variant: "gallery",
    ...overrides,
  };
}

const orchestrator = new ThumbnailRenderOrchestrator(
  null as never,
  null as never,
  null as never
);

describe("deriveKey usesDefaults — canonical class matches product defaults", () => {
  it("treats the product-default grid visibility (QR off, mandala ON) as the shared-cacheable class", () => {
    const key = deriveKey(
      galleryInput({ visibility: { showQRCode: false, showMandala: true } })
    );
    expect(key.usesDefaults).toBe(true);
  });

  it("keys mandala-OFF renders as non-default (separate class, no shared-cache collision)", () => {
    const key = deriveKey(
      galleryInput({ visibility: { showQRCode: false, showMandala: false } })
    );
    expect(key.usesDefaults).toBe(false);
  });

  it("keys QR-ON as a SHAREABLE class (deterministic short code), not local-only", () => {
    // Regression: showQRCode:true used to disqualify from the shared class,
    // forcing every signed-in default-settings card to local-render forever.
    const key = deriveKey(
      galleryInput({ visibility: { showQRCode: true, showMandala: true } })
    );
    expect(key.usesDefaults).toBe(true);
  });

  it("keys a genuinely custom composition (mandala off) as non-default", () => {
    const key = deriveKey(
      galleryInput({ visibility: { showQRCode: false, showMandala: false } })
    );
    expect(key.usesDefaults).toBe(false);
  });

  it("gives QR-on and QR-off renders distinct hashes (no shared-cache collision)", () => {
    const on = deriveKey(
      galleryInput({ visibility: { showQRCode: true, showMandala: true } })
    );
    const off = deriveKey(
      galleryInput({ visibility: { showQRCode: false, showMandala: true } })
    );
    expect(on.hash).not.toBe(off.hash);
  });

  it("gives mandala-on and mandala-off renders distinct hashes", () => {
    const on = deriveKey(
      galleryInput({ visibility: { showQRCode: false, showMandala: true } })
    );
    const off = deriveKey(
      galleryInput({ visibility: { showQRCode: false, showMandala: false } })
    );
    expect(on.hash).not.toBe(off.hash);
  });
});

describe("QR variant — distinct shareable cache paths", () => {
  it("buildStaticKey marks the QR variant with _qr", () => {
    const key = deriveKey(
      galleryInput({ visibility: { showQRCode: true, showMandala: true } })
    );
    expect(orchestrator.buildStaticKey(key)).toBe("gallery/staff/AKE_seq-1_qr_dark");
  });

  it("buildStaticKey omits _qr for the no-QR card", () => {
    const key = deriveKey(
      galleryInput({ visibility: { showQRCode: false, showMandala: true } })
    );
    expect(orchestrator.buildStaticKey(key)).toBe("gallery/staff/AKE_seq-1_dark");
  });

  it("buildCloudKey carries showQRCode so the storage path separates variants", () => {
    const qrKey = deriveKey(
      galleryInput({ visibility: { showQRCode: true, showMandala: true } })
    );
    const noQrKey = deriveKey(
      galleryInput({ visibility: { showQRCode: false, showMandala: true } })
    );
    expect(orchestrator.buildCloudKey(qrKey).showQRCode).toBe(true);
    expect(orchestrator.buildCloudKey(noQrKey).showQRCode).toBe(false);
  });

  it("legacy static key never matches a no-QR bundle for a QR request", () => {
    const qrKey = deriveKey(
      galleryInput({ visibility: { showQRCode: true, showMandala: true } })
    );
    expect(orchestrator.buildLegacyStaticKey(qrKey)).toBe("staff/AKE_qr_dark");
  });
});

describe("buildStaticKey — mirrors the cloud storage path", () => {
  it("includes variant, prop, sequence id, and mode", () => {
    const key = deriveKey(galleryInput());
    expect(orchestrator.buildStaticKey(key)).toBe("gallery/staff/AKE_seq-1_dark");
  });

  it("uses _light suffix in light mode and omits the id suffix when absent", () => {
    const key = deriveKey(
      galleryInput({ sequenceId: undefined, lightMode: true })
    );
    expect(orchestrator.buildStaticKey(key)).toBe("gallery/staff/AKE_light");
  });

  it("sanitizes Windows-illegal characters the same way sync-static-thumbnails.cjs does", () => {
    const key = deriveKey(
      galleryInput({ sequenceName: "Sequence 11:46:02 PM", sequenceId: undefined })
    );
    expect(orchestrator.buildStaticKey(key)).toBe(
      "gallery/staff/Sequence 11-46-02 PM_dark"
    );
  });

  it("stays in lockstep with the cloud path (manifest keys are path-derived)", () => {
    const key = deriveKey(galleryInput());
    const pathDerived = key.cloudPath
      .replace(/^thumbnails\//, "")
      .replace(/\.webp$/, "");
    expect(orchestrator.buildStaticKey(key)).toBe(pathDerived);
  });
});

describe("buildLegacyStaticKey — pre-variant bundle fallback", () => {
  it("uses the old prop/name_mode format with no variant or id", () => {
    const key = deriveKey(galleryInput());
    expect(orchestrator.buildLegacyStaticKey(key)).toBe("staff/AKE_dark");
  });
});
