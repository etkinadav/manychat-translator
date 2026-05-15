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
  /**
   * When true, each translation is passed through outgoing prompt cleanup
   * (strip translated "Translate to Hebrew / speaker is …" headers).
   * Used only by the outgoing composer flow — never for incoming chat.
   */
  stripInstructionPrefix?: boolean;
}

export interface TranslateResponse {
  translations: string[];
}

export interface ErrorResponse {
  error: string;
}
