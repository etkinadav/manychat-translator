/**
 * Wire types shared between the extension and the backend.
 */

export interface TranslateRequest {
  texts: string[];
  /**
   * Incoming chat: organization language → user language.
   * Outgoing composer: user language → organization language.
   * Languages are resolved on the server from the authenticated profile.
   */
  outgoing?: boolean;
  /** Per-message incoming customer text → Gemini (extension AI button). */
  incomingGemini?: boolean;
  /** Customer gender for Gemini prompts (extension UI). Default: male. */
  customerGender?: "male" | "female";
  /** Detect subscriber name gender via Gemini (Manychat header). */
  nameGender?: boolean;
  subscriberName?: string;
  /** Summarize translated conversation via Gemini. */
  conversationSummary?: boolean;
  conversationTranscript?: string;
}

export type NameGenderCategory =
  | "male"
  | "female"
  | "male or female"
  | "unknown";

export interface TranslateResponse {
  translations: string[];
  nameGender?: NameGenderCategory;
  conversationSummary?: string;
  /** True when outgoing Gemini path logged the prompt but did not translate yet. */
  dryRun?: boolean;
  dryRunNote?: string;
  /** Full Gemini prompt (dry-run only) — also logged on the server. */
  geminiPrompt?: string;
}

export interface ErrorResponse {
  error: string;
}
