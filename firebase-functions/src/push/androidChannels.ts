export function getAndroidChannelId(notificationType: string): string {
  if (notificationType === "message-received") return "messages";
  if (notificationType.startsWith("feedback-")) return "feedback";
  if (notificationType === "achievement-unlocked") return "achievements";
  if (notificationType.startsWith("admin-")) return "admin_activity";
  if (
    notificationType === "system-announcement" ||
    notificationType === "moderation-warning"
  ) {
    return "system_security";
  }
  return "social";
}
