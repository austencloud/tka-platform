import { describe, expect, it } from "vitest";
import { getAndroidChannelId } from "../../firebase-functions/src/push/androidChannels";

describe("getAndroidChannelId", () => {
  it.each([
    ["message-received", "messages"],
    ["feedback-resolved", "feedback"],
    ["feedback-needs-info", "feedback"],
    ["sequence-liked", "social"],
    ["user-followed", "social"],
    ["achievement-unlocked", "achievements"],
    ["admin-qr-scan", "admin_activity"],
    ["admin-new-user-signup", "admin_activity"],
    ["system-announcement", "system_security"],
    ["moderation-warning", "system_security"],
  ])("maps %s to %s", (type, channel) => {
    expect(getAndroidChannelId(type)).toBe(channel);
  });
});
