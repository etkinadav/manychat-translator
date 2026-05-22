/** DOM profile embedded in each Website document — mirrors extension site-profile types. */

export type ToolbarInsertMode = "afterTextarea" | "insideContainer";
export type SummaryInsertMode = "cloneWrapper" | "afterLastBlock";

export interface WebsiteSpeakerPatterns {
  agentPatterns: string[];
  customerPatterns: string[];
}

export interface WebsiteIncomingDom {
  messageBlock: string;
  textWithinBlock: string[];
  skipBlocks: string;
  translationInsert: "afterText";
  speaker: WebsiteSpeakerPatterns;
}

export interface WebsiteComposerToolbarDom {
  mode: ToolbarInsertMode;
  container?: string;
}

export interface WebsiteExpiredWindowDom {
  enabled: boolean;
  containerSelector: string;
  wrapperSelector: string;
  detectTextPatterns: string[];
}

export interface WebsiteComposerDom {
  textarea: string;
  toolbar: WebsiteComposerToolbarDom;
  expiredWindow?: WebsiteExpiredWindowDom;
}

export interface WebsiteSubscriberDom {
  enabled: boolean;
  titleSelector: string;
}

export interface WebsiteSummaryDom {
  messageWrapper: string;
  messageBlock: string;
  insertMode: SummaryInsertMode;
}

export interface WebsiteFeaturesDom {
  incomingAutoTranslate: boolean;
  outgoingTranslate: boolean;
  incomingGeminiButton: boolean;
  conversationSummary: boolean;
  subscriberGender: boolean;
  autoTranslateToggle: boolean;
}

export interface WebsiteDomProfile {
  incoming: WebsiteIncomingDom;
  composer: WebsiteComposerDom;
  subscriber?: WebsiteSubscriberDom;
  summary?: WebsiteSummaryDom;
  features: WebsiteFeaturesDom;
}
