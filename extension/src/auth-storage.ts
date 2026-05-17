import type { ExtensionSession, StoredAuth } from "./types";

const AUTH_KEY = "mct-auth";
const SESSION_KEY = "mct-session";

export async function readAuth(): Promise<StoredAuth | null> {
  const data = await chrome.storage.local.get([AUTH_KEY]);
  const raw = data[AUTH_KEY] as StoredAuth | undefined;
  if (!raw?.token || !raw.expiration) return null;
  if (new Date(raw.expiration) <= new Date()) {
    await clearAuth();
    return null;
  }
  return raw;
}

export async function writeAuth(token: string, expiresInSeconds: number): Promise<void> {
  const expiration = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  await chrome.storage.local.set({
    [AUTH_KEY]: { token, expiration } satisfies StoredAuth,
  });
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([AUTH_KEY, SESSION_KEY]);
}

export async function readSession(): Promise<ExtensionSession | null> {
  const data = await chrome.storage.local.get([SESSION_KEY]);
  return (data[SESSION_KEY] as ExtensionSession | undefined) ?? null;
}

export async function writeSession(session: ExtensionSession): Promise<void> {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}
