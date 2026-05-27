import type { WebsiteDomProfile } from "../types/websiteDomProfile";

export const MANYCHAT_WEBSITE_SLUG = "manychat";

export const manychatDomProfile: WebsiteDomProfile = {
  incoming: {
    messageBlock: '[data-chat-message="block"]',
    textWithinBlock: [
      '[data-chat-message="text"]',
      '[class*="_text_"]',
    ],
    skipBlocks:
      '[class*="_meta_"], [data-chat-message="meta"], [data-chat-message="system"], [class*="_system_"]',
    translationInsert: "afterText",
    speaker: {
      agentPatterns: [
        "outgoing",
        "from-agent",
        "agent-message",
        "_out_",
        "sent-by-user",
        "message-out",
        "_typeout",
        "_botmessage",
      ],
      customerPatterns: [
        "incoming",
        "from-subscriber",
        "customer",
        "subscriber",
        "message-in",
        "received",
        "_typein",
      ],
    },
  },
  composer: {
    textarea:
      'textarea[name="whatsappMessageInput"][data-mc-editor="true"]',
    toolbar: { mode: "afterTextarea" },
    expiredWindow: {
      enabled: true,
      containerSelector: '[class*="_toolbarContainer_"]',
      wrapperSelector: '[class*="_wrapper_"]',
      detectTextPatterns: [
        "24\\s*hours?",
        "24\\s*שעות",
        "message templates",
        "תבניות",
      ],
    },
  },
  subscriber: {
    enabled: true,
    titleSelector: 'span[class*="_subscriberTitle_"]',
  },
  summary: {
    messageWrapper: '[class*="_wrapper_"]',
    messageBlock: '[data-chat-message="block"]',
    insertMode: "cloneWrapper",
  },
  features: {
    incomingAutoTranslate: true,
    outgoingTranslate: true,
    incomingGeminiButton: true,
    conversationSummary: true,
    subscriberGender: true,
    autoTranslateToggle: true,
  },
};

export const manychatWebsiteSeed = {
  slug: MANYCHAT_WEBSITE_SLUG,
  name: "Manychat",
  enabled: true,
  urlPatterns: ["https://app.manychat.com/*"],
  othersRole: "subscriber",
  profileVersion: 1,
  notes: "Initial seed from extension selectors",
  domProfile: manychatDomProfile,
};
