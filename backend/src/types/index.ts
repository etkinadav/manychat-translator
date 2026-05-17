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
