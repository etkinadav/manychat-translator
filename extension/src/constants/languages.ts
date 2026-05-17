export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  he: "Hebrew",
  ar: "Arabic",
  es: "Spanish",
  fr: "French",
  de: "German",
  ru: "Russian",
  pt: "Portuguese",
  it: "Italian",
  uk: "Ukrainian",
};

export function languageLabel(code: string): string {
  const key = code.trim().toLowerCase();
  return LANGUAGE_LABELS[key] ?? key.toUpperCase();
}

export function translateToButtonLabel(targetLanguage: string): string {
  return `Translate to ${languageLabel(targetLanguage)}`;
}
