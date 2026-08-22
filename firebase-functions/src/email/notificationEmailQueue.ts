import * as admin from "firebase-admin";
import * as crypto from "crypto";

const APP_URL = "https://tkaflowarts.com/app";
const SETTINGS_URL = `${APP_URL}?module=settings&tab=notifications`;

export type EmailPreferenceKey =
  | "emailMessages"
  | "emailFeedback"
  | "emailPlatformUpdates";

export interface NotificationEmail {
  subject: string;
  text: string;
  html: string;
}

interface AuthEmailUser {
  email?: string;
  emailVerified: boolean;
  disabled: boolean;
}

export interface NotificationEmailDependencies {
  getPreferences(userId: string): Promise<Record<string, boolean> | null>;
  getAuthUser(userId: string): Promise<AuthEmailUser | null>;
  createMailIfAbsent(
    mailId: string,
    mail: {
      to: string[];
      message: NotificationEmail;
      metadata: Record<string, string>;
    }
  ): Promise<boolean>;
}

export interface QueueUserEmailRequest {
  userId: string;
  preferenceKey: EmailPreferenceKey;
  sourceType: "message" | "feedback" | "platform-update";
  sourceId: string;
  email: NotificationEmail;
}

export type QueueUserEmailResult =
  | { state: "queued"; mailId: string }
  | {
      state: "skipped";
      reason: "preference-off" | "email-unavailable" | "already-queued";
    };

export function wantsNotificationEmail(
  preferences: Record<string, boolean> | null,
  preferenceKey: EmailPreferenceKey
): boolean {
  return (
    preferences?.emailEnabled === true && preferences[preferenceKey] === true
  );
}

export function getEmailPreferenceForNotificationType(
  type: string
): EmailPreferenceKey | null {
  return type.startsWith("feedback-") ? "emailFeedback" : null;
}

export function createNotificationMailId(
  sourceType: QueueUserEmailRequest["sourceType"],
  sourceId: string,
  userId: string
): string {
  return crypto
    .createHash("sha256")
    .update(`${sourceType}:${sourceId}:${userId}`)
    .digest("hex");
}

export async function queueUserNotificationEmail(
  request: QueueUserEmailRequest,
  dependencies: NotificationEmailDependencies = defaultDependencies
): Promise<QueueUserEmailResult> {
  const preferences = await dependencies.getPreferences(request.userId);
  if (!wantsNotificationEmail(preferences, request.preferenceKey)) {
    return { state: "skipped", reason: "preference-off" };
  }

  const user = await dependencies.getAuthUser(request.userId);
  if (!user?.email || !user.emailVerified || user.disabled) {
    return { state: "skipped", reason: "email-unavailable" };
  }

  const mailId = createNotificationMailId(
    request.sourceType,
    request.sourceId,
    request.userId
  );
  const created = await dependencies.createMailIfAbsent(mailId, {
    to: [user.email],
    message: request.email,
    metadata: {
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      recipientUserId: request.userId,
    },
  });

  return created
    ? { state: "queued", mailId }
    : { state: "skipped", reason: "already-queued" };
}

export function createMessageEmail(
  senderName: string,
  conversationId: string
): NotificationEmail {
  const conversationUrl = `${APP_URL}?conversation=${encodeURIComponent(conversationId)}`;
  const senderLabel = plainTextLabel(senderName, "Someone");
  const safeSenderName = escapeHtml(senderLabel);
  const safeConversationUrl = escapeHtml(conversationUrl);
  const safeSettingsUrl = escapeHtml(SETTINGS_URL);

  return {
    subject: `New message from ${senderLabel}`,
    text: [
      `${senderLabel} sent you a message in Flow Arts Composer.`,
      "",
      `Open the conversation: ${conversationUrl}`,
      "",
      `Manage notification settings: ${SETTINGS_URL}`,
    ].join("\n"),
    html: emailShell(
      "New message",
      `${safeSenderName} sent you a message in Flow Arts Composer.`,
      "Open conversation",
      safeConversationUrl,
      safeSettingsUrl
    ),
  };
}

export function createFeedbackEmail(input: {
  type: string;
  feedbackId: string;
  feedbackTitle?: string;
  message: string;
}): NotificationEmail {
  const status = feedbackStatusLabel(input.type);
  const title = plainTextLabel(input.feedbackTitle || "", "Your feedback");
  const feedbackUrl = `${APP_URL}?module=feedback&tab=my-feedback&feedback=${encodeURIComponent(input.feedbackId)}`;
  const body = input.message.trim() || `${title}: ${status}`;

  return {
    subject: `${status}: ${title}`,
    text: [
      title,
      body,
      "",
      `View your feedback: ${feedbackUrl}`,
      "",
      `Manage notification settings: ${SETTINGS_URL}`,
    ].join("\n"),
    html: emailShell(
      escapeHtml(title),
      escapeHtml(body),
      "View feedback",
      escapeHtml(feedbackUrl),
      escapeHtml(SETTINGS_URL)
    ),
  };
}

export function createPlatformUpdateEmail(input: {
  version: string;
  releaseNotes?: string;
  highlights?: string[];
}): NotificationEmail {
  const version = plainTextLabel(input.version, "New version");
  const releaseUrl = `${APP_URL}?module=settings&tab=release-notes`;
  const detail =
    input.highlights?.filter(Boolean).slice(0, 3).join("\n") ||
    input.releaseNotes?.trim() ||
    "Open the release notes to see what changed.";

  return {
    subject: `Flow Arts Composer ${version} is available`,
    text: [
      `Flow Arts Composer ${version} is available.`,
      "",
      detail,
      "",
      `Read the release notes: ${releaseUrl}`,
      "",
      `Manage notification settings: ${SETTINGS_URL}`,
    ].join("\n"),
    html: emailShell(
      `Version ${escapeHtml(version)}`,
      escapeHtml(detail).replace(/\n/g, "<br>"),
      "Read release notes",
      escapeHtml(releaseUrl),
      escapeHtml(SETTINGS_URL)
    ),
  };
}

function feedbackStatusLabel(type: string): string {
  const labels: Record<string, string> = {
    "feedback-resolved": "Feedback resolved",
    "feedback-in-progress": "Feedback in progress",
    "feedback-needs-info": "More information needed",
    "feedback-response": "New feedback response",
  };
  return labels[type] || "Feedback update";
}

function emailShell(
  heading: string,
  body: string,
  actionLabel: string,
  actionUrl: string,
  settingsUrl: string
): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#101018;color:#f7f7fb;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px">
      <p style="margin:0 0 8px;color:#a78bfa;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Flow Arts Composer</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">${heading}</h1>
      <p style="margin:0 0 24px;color:#d8d8e5;font-size:16px;line-height:1.55">${body}</p>
      <a href="${actionUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#8b5cf6;color:#fff;text-decoration:none;font-weight:700">${actionLabel}</a>
      <p style="margin:28px 0 0;color:#8f8fa3;font-size:13px;line-height:1.5">Email is optional. <a href="${settingsUrl}" style="color:#c4b5fd">Change notification settings</a>.</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] || character
  );
}

function plainTextLabel(value: string, fallback: string): string {
  return (
    value
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, 160) || fallback
  );
}

const defaultDependencies: NotificationEmailDependencies = {
  async getPreferences(userId) {
    const snapshot = await admin
      .firestore()
      .doc(`users/${userId}/settings/notificationPreferences`)
      .get();
    return (
      (snapshot.data()?.notificationPreferences as
        | Record<string, boolean>
        | undefined) ?? null
    );
  },

  async getAuthUser(userId) {
    try {
      const user = await admin.auth().getUser(userId);
      return {
        email: user.email,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
      };
    } catch (error) {
      if ((error as { code?: string }).code === "auth/user-not-found") {
        return null;
      }
      throw error;
    }
  },

  async createMailIfAbsent(mailId, mail) {
    const db = admin.firestore();
    const mailRef = db.collection("mail").doc(mailId);
    let created = false;

    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(mailRef);
      if (existing.exists) return;

      transaction.create(mailRef, {
        ...mail,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      created = true;
    });

    return created;
  },
};
