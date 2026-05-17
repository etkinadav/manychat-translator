/**
 * MV3 service worker — auth, profile cache, and proxied API calls.
 */

import {
  clearAuth,
  readAuth,
  readSession,
  writeAuth,
  writeSession,
} from "./auth-storage";
import type { ExtensionSession, LoginResponse } from "./types";

const API_BASE = "http://localhost:3000";
const TRANSLATE_URL = `${API_BASE}/api/translate`;
const PROFILE_URL = `${API_BASE}/api/user/profile`;
const LOGIN_URL = `${API_BASE}/api/user/login`;
const REQUEST_TIMEOUT_MS = 8000;
const SESSION_MAX_AGE_MS = 5 * 60 * 1000;

let sessionLoadedAt = 0;

interface BgTranslateMessage {
  type: "translate";
  texts: string[];
  outgoing?: boolean;
  stripInstructionPrefix?: boolean;
}

interface BgLoginMessage {
  type: "login";
  username: string;
  password: string;
}

interface BgGetSessionMessage {
  type: "getSession";
  forceRefresh?: boolean;
}

interface BgLogoutMessage {
  type: "logout";
}

type BgMessage =
  | BgTranslateMessage
  | BgLoginMessage
  | BgGetSessionMessage
  | BgLogoutMessage;

interface ExternalSetAuthMessage {
  type: "SET_AUTH";
  token: string;
  expiresIn?: number;
}

function isSessionFresh(): boolean {
  return sessionLoadedAt > 0 && Date.now() - sessionLoadedAt < SESSION_MAX_AGE_MS;
}

async function authHeaders(): Promise<HeadersInit> {
  const auth = await readAuth();
  if (!auth) throw new Error("Not signed in. Open the extension popup to log in.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token}`,
  };
}

async function refreshSession(): Promise<ExtensionSession> {
  const headers = await authHeaders();
  const res = await fetch(PROFILE_URL, { headers });
  if (res.status === 401) {
    await clearAuth();
    throw new Error("Session expired. Sign in again via the extension popup.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Profile request failed (${res.status})`);
  }
  const profile = (await res.json()) as ExtensionSession;
  await writeSession(profile);
  sessionLoadedAt = Date.now();
  return profile;
}

async function getSession(forceRefresh = false): Promise<ExtensionSession> {
  if (!forceRefresh && isSessionFresh()) {
    const cached = await readSession();
    if (cached) return cached;
  }
  return refreshSession();
}

async function handleLogin(
  username: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = (await res.json()) as LoginResponse & { message?: string };
    if (!res.ok) {
      return { ok: false, error: body.message ?? "Login failed" };
    }
    await writeAuth(body.token, body.expiresIn ?? 86400);
    sessionLoadedAt = 0;
    await refreshSession();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Login failed",
    };
  }
}

async function handleTranslate(
  message: BgTranslateMessage,
): Promise<{ ok: true; translations: string[] } | { ok: false; error: string }> {
  const session = await getSession(false);
  if (!session.organization) {
    return {
      ok: false,
      error:
        "No organization connected. Open Configuration in the web app and connect to an organization.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = await authHeaders();
    const res = await fetch(TRANSLATE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        texts: message.texts,
        ...(message.outgoing ? { outgoing: true } : {}),
        stripInstructionPrefix: message.stripInstructionPrefix === true,
      }),
      signal: controller.signal,
    });

    const data = (await res.json()) as {
      translations?: string[];
      error?: string;
      message?: string;
    };

    if (res.status === 401) {
      await clearAuth();
      return { ok: false, error: "Session expired. Sign in again." };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? data.message ?? `Backend HTTP ${res.status}`,
      };
    }
    if (!Array.isArray(data.translations)) {
      return { ok: false, error: "Invalid translate response" };
    }
    if (data.translations.length !== message.texts.length) {
      return {
        ok: false,
        error: `Expected ${message.texts.length} translations, got ${data.translations.length}`,
      };
    }

    console.log(
      "[ManychatTranslator:bg] translate ok |",
      message.outgoing ? "outgoing" : "incoming",
      "|",
      session.organization.language,
      "<->",
      session.language,
    );

    return { ok: true, translations: data.translations };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onMessage.addListener((message: BgMessage, _sender, sendResponse) => {
  if (message?.type === "login") {
    void handleLogin(message.username, message.password).then(sendResponse);
    return true;
  }
  if (message?.type === "getSession") {
    void getSession(message.forceRefresh === true)
      .then((session) => sendResponse({ ok: true, session }))
      .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message?.type === "logout") {
    void clearAuth().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "translate" && Array.isArray(message.texts)) {
    void handleTranslate(message).then(sendResponse);
    return true;
  }
  sendResponse({ ok: false, error: "Invalid message" });
  return false;
});

chrome.runtime.onMessageExternal.addListener(
  (message: ExternalSetAuthMessage, _sender, sendResponse) => {
    if (message?.type !== "SET_AUTH" || !message.token) {
      sendResponse({ ok: false, error: "Invalid external message" });
      return;
    }
    void (async () => {
      await writeAuth(message.token, message.expiresIn ?? 86400);
      sessionLoadedAt = 0;
      try {
        const session = await refreshSession();
        sendResponse({ ok: true, session });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Failed to load profile",
        });
      }
    })();
    return true;
  },
);

console.log("[ManychatTranslator:bg] service worker loaded");
