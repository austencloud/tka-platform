import type { Channel } from "@capacitor/push-notifications";

export const ANDROID_NOTIFICATION_CHANNELS = [
  {
    id: "messages",
    name: "Messages",
    description: "Direct messages and group conversations",
    importance: 4,
    visibility: 0,
    vibration: true,
  },
  {
    id: "feedback",
    name: "Feedback",
    description: "Replies and status changes for submitted feedback",
    importance: 3,
    visibility: 0,
  },
  {
    id: "social",
    name: "Social",
    description: "Likes, comments, and new followers",
    importance: 3,
    visibility: 0,
  },
  {
    id: "achievements",
    name: "Achievements",
    description: "New achievements",
    importance: 3,
    visibility: 0,
  },
  {
    id: "admin_activity",
    name: "Admin activity",
    description: "Signups, scans, submissions, and other Pulse activity",
    importance: 3,
    visibility: 0,
  },
  {
    id: "system_security",
    name: "System & security",
    description: "Account warnings and service announcements",
    importance: 4,
    visibility: 0,
    vibration: true,
  },
] satisfies Channel[];
