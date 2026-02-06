/**
 * Info Domain Content
 *
 * Provides the static content and configuration used across the info experience.
 */

import type {
  InfoTextContent,
  Resource,
  SocialLink,
  SupportOption,
} from "./types";

export const CONTACT_EMAIL = "tkaflowarts@gmail.com";

export const INFO_TEXT: InfoTextContent = {
  hero: {
    title: "The Kinetic Alphabet",
    subtitle: "A choreography toolbox!",
    cta: "Enter Studio",
  },
  resources: {
    title: "Resources",
    subtitle: "Learning materials and guides",
  },
  support: {
    title: "Support",
    subtitle: "Connect with us and help keep TKA alive",
  },
  dev: {
    title: "For Developers",
    subtitle: "Open source & contributions",
    message:
      "TKA Scribe is open source. Check out the code, report bugs, or contribute features.",
  },
};

export const SOCIAL_LINKS: SocialLink[] = [
  {
    name: "Facebook",
    url: "https://facebook.com/thekineticalphabet",
    icon: "fab fa-facebook",
    color: "#1877F2",
  },
  {
    name: "Instagram",
    url: "https://instagram.com/thekineticalphabet",
    icon: "fab fa-instagram",
    color: "#E4405F",
  },
  {
    name: "Discord",
    url: "https://discord.gg/6mBu86Yr",
    icon: "fab fa-discord",
    color: "#5865F2",
  },
];

export const RESOURCES: Resource[] = [
  {
    title: "Level 1 PDF Book",
    description:
      "Comprehensive introduction to The Kinetic Alphabet methodology",
    url: "https://drive.google.com/file/d/1cgAWbrFiLgUSDEsCB0Mmu2d7Bu5PW45a/view?usp=drive_link",
    icon: "/branding/guide-cover.png",
    type: "download",
  },
];

export const SUPPORT_OPTIONS: SupportOption[] = [
  {
    name: "PayPal",
    url: "https://paypal.me/austencloud",
    icon: "fab fa-paypal",
    color: "#00457C",
  },
  {
    name: "Venmo",
    url: "venmo://paycharge?txn=pay&recipients=austencloud", // Deep link to Venmo app
    icon: "fas fa-wallet", // Using wallet icon (Venmo brand icon not in Font Awesome)
    color: "#008CFF",
  },
  {
    name: "Zelle",
    url: "austencloud@gmail.com", // Email only - will copy to clipboard
    icon: "fas fa-money-bill-wave",
    color: "#6D1ED4",
  },
];
