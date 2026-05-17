/**
 * Resolves source/target languages from .env defaults.
 *
 * Incoming chat:  TRANSLATE_SOURCE_LANGUAGE → TRANSLATE_TARGET_LANGUAGE
 * Outgoing composer: reverse (TARGET → SOURCE)
 */

export interface LanguagePair {
  source: string;
  target: string;
}

export function envLanguagePair(): LanguagePair {
  return {
    source: process.env.TRANSLATE_SOURCE_LANGUAGE?.trim() || "he",
    target: process.env.TRANSLATE_TARGET_LANGUAGE?.trim() || "en",
  };
}

export function resolveLanguagePair(options: {
  outgoing?: boolean;
  sourceLanguage?: string;
  targetLanguage?: string;
}): LanguagePair {
  const env = envLanguagePair();
  const defaults: LanguagePair = options.outgoing
    ? { source: env.target, target: env.source }
    : { source: env.source, target: env.target };

  return {
    source: options.sourceLanguage?.trim() || defaults.source,
    target: options.targetLanguage?.trim() || defaults.target,
  };
}
