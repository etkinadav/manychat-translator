/** Persisted toggle for automatic incoming chat translation. */

export const AUTO_TRANSLATE_STORAGE_KEY = "mct-auto-translate-enabled";

export async function readAutoTranslateEnabled(): Promise<boolean> {
  const data = await chrome.storage.local.get([AUTO_TRANSLATE_STORAGE_KEY]);
  if (data[AUTO_TRANSLATE_STORAGE_KEY] === undefined) return true;
  return data[AUTO_TRANSLATE_STORAGE_KEY] === true;
}

export async function writeAutoTranslateEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [AUTO_TRANSLATE_STORAGE_KEY]: enabled });
}
