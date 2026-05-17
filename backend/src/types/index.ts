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
}

export interface TranslateResponse {
  translations: string[];
  /** True when outgoing Gemini path logged the prompt but did not translate yet. */
  dryRun?: boolean;
  dryRunNote?: string;
  /** Full Gemini prompt (dry-run only) — also logged on the server. */
  geminiPrompt?: string;
}

export interface ErrorResponse {
  error: string;
}
