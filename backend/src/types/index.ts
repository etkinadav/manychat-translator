/**
 * Wire types shared between the extension and the backend.
 */

export interface TranslateRequest {
  texts: string[];
  /**
   * Incoming chat (default): `TRANSLATE_SOURCE_LANGUAGE` → `TRANSLATE_TARGET_LANGUAGE`.
   * Outgoing composer: the reverse (TARGET → SOURCE).
   */
  outgoing?: boolean;
  /** Override env defaults when set. */
  targetLanguage?: string;
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
