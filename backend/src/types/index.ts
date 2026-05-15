/**
 * Wire types shared between the extension and the backend.
 */

export interface TranslateRequest {
  texts: string[];
  /**
   * BCP-47 language code for the translation target.
   * Incoming chat: omit or "en" (Hebrew → English).
   * Outgoing composer: "he" (English → Hebrew).
   */
  targetLanguage?: string;
}

export interface TranslateResponse {
  translations: string[];
}

export interface ErrorResponse {
  error: string;
}
