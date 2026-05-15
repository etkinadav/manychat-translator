/**
 * Wire types shared between the extension and the backend.
 * Kept intentionally tiny so we can copy/paste them into the extension
 * later or publish them as a small shared package.
 */

export interface TranslateRequest {
  /** Source texts to translate (or, for now, to echo). */
  texts: string[];
  /**
   * Optional language hints — accepted but ignored at this stage. They
   * exist now so the extension can already send them and the wire format
   * stays stable when we wire up Google Translate / OpenAI.
   */
  sourceLang?: string;
  targetLang?: string;
}

export interface TranslateResponse {
  /** One translation per input, in the same order. */
  translations: string[];
}

export interface ErrorResponse {
  error: string;
}
