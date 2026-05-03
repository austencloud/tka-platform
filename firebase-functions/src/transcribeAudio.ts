/**
 * Transcribe Audio Cloud Function
 *
 * Accepts base64-encoded audio from the client, sends it to OpenAI's
 * Whisper API for transcription, and returns the text. Requires Firebase
 * Auth and enforces a per-user rate limit via Firestore.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const OPENAI_WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB
const RATE_LIMIT_PER_HOUR = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface TranscribeRequest {
  audioBase64: string;
  mimeType: string;
}

interface TranscribeResponse {
  transcript: string;
}

function extensionFromMime(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  // Default fallback - Whisper can usually detect format
  return "webm";
}

async function checkRateLimit(uid: string): Promise<boolean> {
  const db = admin.firestore();
  const ref = db.collection("rateLimits").doc(`transcribe_${uid}`);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data();
    const timestamps: number[] = data?.timestamps ?? [];

    const recent = timestamps.filter((t) => t > windowStart);

    if (recent.length >= RATE_LIMIT_PER_HOUR) {
      return false;
    }

    recent.push(now);
    tx.set(ref, { timestamps: recent, uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}

export const transcribeAudio = functions.https.onCall(
  async (
    data: TranscribeRequest,
    context
  ): Promise<TranscribeResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign in required to use voice transcription"
      );
    }

    const { audioBase64, mimeType } = data;

    if (!audioBase64 || typeof audioBase64 !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Audio data is required"
      );
    }

    if (!mimeType || typeof mimeType !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "MIME type is required"
      );
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Audio exceeds ${MAX_AUDIO_BYTES / 1024 / 1024}MB limit`
      );
    }

    if (audioBuffer.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Audio data is empty"
      );
    }

    const withinLimit = await checkRateLimit(context.auth.uid);
    if (!withinLimit) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded: ${RATE_LIMIT_PER_HOUR} transcriptions per hour`
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.error("OPENAI_API_KEY not configured in functions/.env");
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Transcription service not configured"
      );
    }

    try {
      const ext = extensionFromMime(mimeType);
      const filename = `recording.${ext}`;

      // Construct multipart/form-data manually since Cloud Functions
      // Node.js runtime has native FormData support (Node 18+)
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: mimeType });
      formData.append("file", blob, filename);
      formData.append("model", "whisper-1");
      formData.append("language", "en");
      formData.append("response_format", "json");

      const response = await fetch(OPENAI_WHISPER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Whisper API error (${response.status}):`, errorBody);
        throw new functions.https.HttpsError(
          "internal",
          "Transcription failed"
        );
      }

      const result = (await response.json()) as { text: string };
      const transcript = (result.text ?? "").trim();

      console.log(
        `Transcribed ${audioBuffer.length} bytes for user ${context.auth.uid}: ${transcript.length} chars`
      );

      return { transcript };
    } catch (error: unknown) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      console.error("Transcription error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to transcribe audio"
      );
    }
  }
);
