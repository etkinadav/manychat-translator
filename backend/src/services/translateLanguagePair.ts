import { ALLOWED_ORG_LANGUAGES } from "../controllers/organization.helpers";

/**
 * Language pair resolution for translation.
 *
 * With a connected organization:
 *   Incoming chat:  org.language → user.language
 *   Outgoing composer: user.language → org.language
 *
 * Env defaults are only a dev fallback when no profile pair is supplied.
 */

export interface LanguagePair {
  source: string;
  target: string;
}

function normalizeLang(code: string | undefined): string | null {
  if (!code) return null;
  const lang = code.trim().toLowerCase();
  return ALLOWED_ORG_LANGUAGES.has(lang) ? lang : null;
}

export function envLanguagePair(): LanguagePair {
  return {
    source: process.env.TRANSLATE_SOURCE_LANGUAGE?.trim() || "he",
    target: process.env.TRANSLATE_TARGET_LANGUAGE?.trim() || "en",
  };
}

export function resolveLanguagePairFromProfile(options: {
  userLanguage: string;
  orgLanguage: string;
  outgoing?: boolean;
}): LanguagePair {
  const userLang = normalizeLang(options.userLanguage) ?? "en";
  const orgLang = normalizeLang(options.orgLanguage) ?? userLang;

  if (options.outgoing) {
    return { source: userLang, target: orgLang };
  }
  return { source: orgLang, target: userLang };
}

/** @deprecated Use resolveLanguagePairFromProfile when user is authenticated. */
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
