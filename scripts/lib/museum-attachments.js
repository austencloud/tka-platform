/**
 * Museum Attachments Module
 *
 * Handles file attachments for museum development items.
 * Uses Firebase Storage for file hosting.
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createReadStream, statSync } from "fs";
import { basename, extname } from "path";
import { randomBytes } from "crypto";
import config from "../../config/museum-dev.config.js";

const { COLLECTIONS, ATTACHMENT_TYPES, JOURNAL_TYPES } = config;

/**
 * Infer attachment type from file extension
 */
function inferAttachmentType(filePath) {
  const ext = extname(filePath).toLowerCase();

  const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
  const audioExts = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];
  const docExts = [".pdf", ".md", ".txt", ".doc", ".docx"];

  if (imageExts.includes(ext)) return "image";
  if (audioExts.includes(ext)) return "audio";
  if (docExts.includes(ext)) return "document";
  return "document"; // Default
}

/**
 * Generate a unique attachment ID
 */
function generateAttachmentId() {
  return randomBytes(8).toString("hex");
}

/**
 * Add an attachment to a museum item
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} docId - Item ID to attach to
 * @param {string} filePath - Local file path to upload
 * @param {string} [description] - Optional description of the attachment
 * @param {string} [type] - Attachment type (image, audio, document, url) - auto-detected if not provided
 * @returns {Promise<{success: boolean, attachmentId?: string, url?: string, error?: string}>}
 */
async function addAttachment(db, docId, filePath, description = null, type = null) {
  const collection = db.collection(COLLECTIONS.ITEMS);
  const docRef = collection.doc(docId);

  try {
    const doc = await docRef.get();
    if (!doc.exists) {
      return { success: false, error: `Item not found: ${docId}` };
    }

    // Get file info
    let fileStats;
    try {
      fileStats = statSync(filePath);
    } catch (err) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    const fileName = basename(filePath);
    const attachmentType = type || inferAttachmentType(filePath);
    const attachmentId = generateAttachmentId();

    // Validate type
    if (!ATTACHMENT_TYPES.includes(attachmentType)) {
      return {
        success: false,
        error: `Invalid attachment type: ${attachmentType}. Valid types: ${ATTACHMENT_TYPES.join(", ")}`,
      };
    }

    // Upload to Firebase Storage
    const bucket = getStorage().bucket();
    const storagePath = `museum-dev/${docId}/${attachmentId}-${fileName}`;
    const file = bucket.file(storagePath);

    await new Promise((resolve, reject) => {
      const stream = file.createWriteStream({
        metadata: {
          contentType: getMimeType(filePath),
          metadata: {
            museumDocId: docId,
            attachmentId,
            originalName: fileName,
          },
        },
      });

      createReadStream(filePath)
        .pipe(stream)
        .on("error", reject)
        .on("finish", resolve);
    });

    // Generate a signed URL (7-day expiry, re-generate as needed)
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const now = Timestamp.now();
    const attachmentData = {
      id: attachmentId,
      type: attachmentType,
      name: fileName,
      url,
      size: fileStats.size,
      addedAt: now,
      ...(description && { description }),
    };

    // Update Firestore document
    await docRef.update({
      attachments: FieldValue.arrayUnion(attachmentData),
      updatedAt: now,
    });

    // Add journal entry
    await docRef.collection("journal").add({
      type: JOURNAL_TYPES.ATTACHMENT_ADDED,
      timestamp: now,
      data: { attachmentId, fileName, type: attachmentType, size: fileStats.size },
    });

    return { success: true, attachmentId, url };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Add a URL attachment (no file upload needed)
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} docId - Item ID to attach to
 * @param {string} url - URL to attach
 * @param {string} [description] - Optional description
 * @returns {Promise<{success: boolean, attachmentId?: string, error?: string}>}
 */
async function addUrlAttachment(db, docId, url, description = null) {
  const collection = db.collection(COLLECTIONS.ITEMS);
  const docRef = collection.doc(docId);

  try {
    const doc = await docRef.get();
    if (!doc.exists) {
      return { success: false, error: `Item not found: ${docId}` };
    }

    const now = Timestamp.now();
    const attachmentId = generateAttachmentId();

    // Try to extract a name from the URL
    let name;
    try {
      const urlObj = new URL(url);
      name = urlObj.hostname + urlObj.pathname.slice(0, 30);
    } catch {
      name = url.slice(0, 40);
    }

    const attachmentData = {
      id: attachmentId,
      type: "url",
      name,
      url,
      addedAt: now,
      ...(description && { description }),
    };

    await docRef.update({
      attachments: FieldValue.arrayUnion(attachmentData),
      updatedAt: now,
    });

    await docRef.collection("journal").add({
      type: JOURNAL_TYPES.ATTACHMENT_ADDED,
      timestamp: now,
      data: { attachmentId, type: "url", url },
    });

    return { success: true, attachmentId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * List all attachments for an item
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} docId - Item ID
 * @returns {Promise<{attachments: Array, error?: string}>}
 */
async function listAttachments(db, docId) {
  const collection = db.collection(COLLECTIONS.ITEMS);
  const docRef = collection.doc(docId);

  try {
    const doc = await docRef.get();
    if (!doc.exists) {
      return { attachments: [], error: `Item not found: ${docId}` };
    }

    const data = doc.data();
    const attachments = (data.attachments || []).map((att) => ({
      ...att,
      addedAt: att.addedAt?.toDate?.() || att.addedAt,
    }));

    return { attachments };
  } catch (error) {
    return { attachments: [], error: error.message };
  }
}

/**
 * Remove an attachment from an item
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} docId - Item ID
 * @param {string} attachmentId - Attachment ID to remove
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function removeAttachment(db, docId, attachmentId) {
  const collection = db.collection(COLLECTIONS.ITEMS);
  const docRef = collection.doc(docId);

  try {
    const doc = await docRef.get();
    if (!doc.exists) {
      return { success: false, error: `Item not found: ${docId}` };
    }

    const data = doc.data();
    const attachment = (data.attachments || []).find((a) => a.id === attachmentId);

    if (!attachment) {
      return { success: false, error: `Attachment not found: ${attachmentId}` };
    }

    // Remove from Firestore
    await docRef.update({
      attachments: FieldValue.arrayRemove(attachment),
      updatedAt: Timestamp.now(),
    });

    // Try to delete from Storage if it's not a URL attachment
    if (attachment.type !== "url" && attachment.url?.includes("storage.googleapis.com")) {
      try {
        const bucket = getStorage().bucket();
        const storagePath = attachment.url.split(`${bucket.name}/`)[1];
        if (storagePath) {
          await bucket.file(storagePath).delete();
        }
      } catch (storageErr) {
        // Log but don't fail - the Firestore update succeeded
        console.warn(`Could not delete storage file: ${storageErr.message}`);
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".pdf": "application/pdf",
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

export default {
  addAttachment,
  addUrlAttachment,
  listAttachments,
  removeAttachment,
};
