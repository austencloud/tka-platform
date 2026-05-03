/**
 * ProfilePictureManager
 *
 * Handles OAuth provider profile picture management for Firebase Auth users.
 * Manages Facebook and Google profile pictures with proper fallback logic.
 * Also generates custom avatars with gradient backgrounds and prop silhouettes.
 */

import { updateProfile, type User } from "firebase/auth";
import type { GeneratedAvatarData } from "../contracts/types";
import { getStorageInstance } from "$lib/shared/auth/firebase";
import { PROP_TYPE_DISPLAY_REGISTRY } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

export class ProfilePictureManager {
  /**
   * Update Facebook profile picture to high resolution if needed.
   *
   * Facebook Graph API provides higher resolution pictures than the default Firebase photoURL.
   *
   * IMPORTANT: We SKIP this if user has a Google account linked, because:
   * 1. Google photos are more reliable (don't require access tokens)
   * 2. Facebook Graph API often returns default silhouettes without proper auth
   */
  async updateFacebookProfilePictureIfNeeded(user: User): Promise<void> {
    try {
      // Check if user has Facebook provider
      const facebookData = user.providerData.find(
        (data) => data.providerId === "facebook.com"
      );

      if (!facebookData?.uid) {
        return; // Not a Facebook user
      }

      // Check if user has a custom avatar (uploaded to our Firebase Storage)
      // These should NOT be overwritten by OAuth provider photos
      if (user.photoURL?.includes("firebasestorage.googleapis.com")) {
        return; // Preserve custom avatar
      }

      // IMPORTANT: If user also has Google linked, prefer Google's photo
      // Google photos are more reliable and don't require access tokens
      const hasGoogle = user.providerData.some(
        (data) => data.providerId === "google.com"
      );
      if (hasGoogle) {
        return; // Let Google handle the photo
      }

      // Check if we need to update the profile picture
      // If photoURL already contains graph.facebook.com, skip
      if (user.photoURL?.includes("graph.facebook.com")) {
        return; // Already using Facebook picture
      }

      // If user already has a Google photo URL, don't overwrite it
      if (user.photoURL?.includes("googleusercontent.com")) {
        return; // Keep the Google photo
      }

      // Facebook Graph API URL for high-resolution profile picture
      const photoURL = `https://graph.facebook.com/${facebookData.uid}/picture?type=large`;

      // Update the user's profile with the high-res photo URL
      await updateProfile(user, {
        photoURL: photoURL,
      });
    } catch (err) {
      console.error(
        `❌ [ProfilePictureManager] Failed to update Facebook profile picture:`,
        err
      );
      // Don't throw - this is a non-critical enhancement
    }
  }

  /**
   * Update Google profile picture if needed.
   *
   * Google profile pictures from Firebase Auth contain signed tokens that can expire.
   * Instead of modifying the URL (which can break the signature), we use the
   * provider's photoURL directly which is refreshed on each authentication.
   *
   * IMPORTANT: Google photos are preferred over Facebook because:
   * 1. They don't require access tokens
   * 2. Facebook Graph API often returns default silhouettes
   *
   * Note: We no longer modify the URL size parameter (s96-c -> s400-c) because
   * this was causing stale/broken image URLs. The default 96px image is used
   * and CSS handles scaling.
   */
  async updateGoogleProfilePictureIfNeeded(user: User): Promise<void> {
    try {
      // Check if user has Google provider
      const googleData = user.providerData.find(
        (data) => data.providerId === "google.com"
      );

      if (!googleData?.uid) {
        return; // Not a Google user
      }

      // Check if user has a custom avatar (uploaded to our Firebase Storage)
      // These should NOT be overwritten by OAuth provider photos
      const isCustomAvatar = user.photoURL?.includes("firebasestorage.googleapis.com");
      if (isCustomAvatar) {
        return; // Preserve custom avatar
      }

      // If user has a Google photo, prefer it over Facebook's broken silhouettes
      if (googleData.photoURL) {
        // Check if current photoURL is already a Google URL
        const isCurrentlyGoogle = user.photoURL?.includes(
          "googleusercontent.com"
        );
        const isSameAsProvider = user.photoURL === googleData.photoURL;

        // Update if: no photo, not Google, or different from fresh Google URL
        if (!user.photoURL || !isCurrentlyGoogle || !isSameAsProvider) {
          await updateProfile(user, {
            photoURL: googleData.photoURL,
          });
        }
      }
    } catch (err) {
      console.error(
        `❌ [ProfilePictureManager] Failed to update Google profile picture:`,
        err
      );
      // Don't throw - this is a non-critical enhancement
    }
  }

  /**
   * Get provider-specific IDs for storing in user document.
   * These can be used to construct reliable profile picture URLs.
   */
  getProviderIds(user: User): { googleId?: string; facebookId?: string } {
    const result: { googleId?: string; facebookId?: string } = {};

    for (const provider of user.providerData) {
      if (provider.providerId === "google.com" && provider.uid) {
        result.googleId = provider.uid;
      } else if (provider.providerId === "facebook.com" && provider.uid) {
        result.facebookId = provider.uid;
      }
    }

    return result;
  }

  /**
   * Generate a custom avatar image and upload to Firebase Storage.
   * Creates a circular avatar with gradient background and prop silhouette.
   */
  async generateAndUploadAvatar(
    user: User,
    avatarData: GeneratedAvatarData
  ): Promise<string> {
    const { gradient, propType, gradientId } = avatarData;

    // Create canvas for rendering
    const size = 256; // High-res for quality
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to create canvas context");
    }

    // Draw circular gradient background
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Parse gradient and draw
    await this.drawGradient(ctx, gradient, size);

    // Draw prop silhouette
    const propInfo = PROP_TYPE_DISPLAY_REGISTRY[propType];
    if (propInfo?.image) {
      await this.drawPropSilhouette(ctx, propInfo.image, size);
    }

    // Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to create blob"));
        },
        "image/png",
        0.95
      );
    });

    // Upload to Firebase Storage
    const { ref, uploadBytes, getDownloadURL } = await import(
      "firebase/storage"
    );
    const storage = await getStorageInstance();

    const storagePath = `avatars/${user.uid}/${gradientId}_${propType}.png`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob, {
      contentType: "image/png",
      customMetadata: {
        userId: user.uid,
        gradientId,
        propType,
        generatedAt: new Date().toISOString(),
      },
    });

    const downloadUrl = await getDownloadURL(storageRef);

    // Update user profile with new avatar URL
    await updateProfile(user, { photoURL: downloadUrl });

    return downloadUrl;
  }

  /**
   * Draw CSS gradient onto canvas context
   */
  private async drawGradient(
    ctx: CanvasRenderingContext2D,
    cssGradient: string,
    size: number
  ): Promise<void> {
    // Parse the CSS gradient
    // Format: linear-gradient(135deg, #color1 0%, #color2 50%, #color3 100%)
    const match = cssGradient.match(/linear-gradient\((\d+)deg,\s*(.+)\)/);

    if (!match) {
      // Fallback: solid color
      ctx.fillStyle = "#6366f1";
      ctx.fillRect(0, 0, size, size);
      return;
    }

    const angle = parseInt(match[1] ?? "135", 10);
    const colorStops = match[2] ?? "";

    // Convert angle to gradient coordinates
    const angleRad = ((angle - 90) * Math.PI) / 180;
    const x1 = size / 2 - (Math.cos(angleRad) * size) / 2;
    const y1 = size / 2 - (Math.sin(angleRad) * size) / 2;
    const x2 = size / 2 + (Math.cos(angleRad) * size) / 2;
    const y2 = size / 2 + (Math.sin(angleRad) * size) / 2;

    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);

    // Parse color stops: "#color 50%" or "#color"
    const stopRegex = /(#[a-fA-F0-9]{3,8}|rgba?\([^)]+\))\s*(\d+)?%?/g;
    let stopMatch;
    const stops: Array<{ color: string; position: number }> = [];

    while ((stopMatch = stopRegex.exec(colorStops)) !== null) {
      const color = stopMatch[1] ?? "#ffffff";
      const position = stopMatch[2] ? parseInt(stopMatch[2], 10) / 100 : null;
      stops.push({ color, position: position ?? 0 });
    }

    // Assign positions to stops without explicit positions
    stops.forEach((stop, i) => {
      if (stop.position === 0 && i > 0) {
        stop.position = i / (stops.length - 1);
      }
    });

    // Add color stops to gradient
    stops.forEach((stop) => {
      try {
        gradient.addColorStop(stop.position, stop.color);
      } catch {
        // Invalid color, skip
      }
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  /**
   * Draw prop silhouette (white, semi-transparent)
   */
  private async drawPropSilhouette(
    ctx: CanvasRenderingContext2D,
    imageSrc: string,
    size: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        // Calculate max size for prop (55% of avatar)
        const maxPropSize = size * 0.55;

        // Maintain aspect ratio
        const imgAspect = img.naturalWidth / img.naturalHeight;
        let propWidth: number;
        let propHeight: number;

        if (imgAspect > 1) {
          // Wider than tall - fit to width
          propWidth = maxPropSize;
          propHeight = maxPropSize / imgAspect;
        } else {
          // Taller than wide - fit to height
          propHeight = maxPropSize;
          propWidth = maxPropSize * imgAspect;
        }

        // Center the prop
        const x = (size - propWidth) / 2;
        const y = (size - propHeight) / 2;

        // Create an offscreen canvas to make the prop white
        const offscreen = document.createElement("canvas");
        offscreen.width = propWidth;
        offscreen.height = propHeight;
        const offCtx = offscreen.getContext("2d");

        if (offCtx) {
          // Draw the original image maintaining aspect ratio
          offCtx.drawImage(img, 0, 0, propWidth, propHeight);

          // Make it white by using composite operations
          offCtx.globalCompositeOperation = "source-in";
          offCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
          offCtx.fillRect(0, 0, propWidth, propHeight);

          // Draw the white prop onto the main canvas
          ctx.drawImage(offscreen, x, y);
        }

        resolve();
      };

      img.onerror = (e) => {
        console.error("Failed to load prop image:", imageSrc, e);
        // Skip prop drawing if image fails to load
        resolve();
      };

      img.src = imageSrc;
    });
  }
}
