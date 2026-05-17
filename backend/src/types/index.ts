/**
 * Wire types shared between the extension and the backend.
 */

export interface TranslateRequest {
  texts: string[];
  /**
   * BCP-47 target language (default from server: `en`).
   * Incoming chat: `"en"`. Outgoing composer: `"he"`.
   */
  targetLanguage?: string;
  /**
   * Optional source language (e.g. `"he"`). Omit for Google auto-detect.
   * Server default may be set via `TRANSLATE_SOURCE_LANGUAGE` in `.env`.
   */
  sourceLanguage?: string;
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
