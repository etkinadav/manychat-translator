/** Mirrors backend Website.domProfile — loaded from API per organization. */

export interface WebsiteDomProfile {
  incoming: {
    messageBlock: string;
    textWithinBlock: string[];
    skipBlocks: string;
    translationInsert: "afterText";
    speaker: {
      agentPatterns: string[];
      customerPatterns: string[];
    };
  };
  composer: {
    textarea: string;
    toolbar: {
      mode: "afterTextarea" | "insideContainer";
      container?: string;
    };
    expiredWindow?: {
      enabled: boolean;
      containerSelector: string;
      wrapperSelector: string;
      detectTextPatterns: string[];
    };
  };
  subscriber?: {
    enabled: boolean;
    titleSelector: string;
  };
  summary?: {
    messageWrapper: string;
    messageBlock: string;
    insertMode: "cloneWrapper" | "afterLastBlock";
  };
  features: {
    incomingAutoTranslate: boolean;
    outgoingTranslate: boolean;
    incomingGeminiButton: boolean;
    conversationSummary: boolean;
    subscriberGender: boolean;
    autoTranslateToggle: boolean;
  };
}

export interface ExtensionWebsite {
  id: string;
  slug: string;
  name: string;
  urlPatterns: string[];
  /** Gemini prompt label for the other party (e.g. customer, subscriber). */
  othersRole?: string;
  domProfile: WebsiteDomProfile;
}
