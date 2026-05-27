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
import { syncContentScriptsForWebsites } from "./site-profile/register-content-scripts";
import type { ExtensionSession, LoginResponse } from "./types";

const API_BASE = "http://localhost:3000";
const TRANSLATE_URL = `${API_BASE}/api/translate`;
const PROFILE_URL = `${API_BASE}/api/user/profile`;
const LOGIN_URL = `${API_BASE}/api/user/login`;
const REQUEST_TIMEOUT_MS = 20000;
const SESSION_MAX_AGE_MS = 5 * 60 * 1000;

let sessionLoadedAt = 0;

interface BgTranslateMessage {
  type: "translate";
  texts: string[];
  websiteSlug?: string;
  outgoing?: boolean;
  outgoingGoogle?: boolean;
  agentGender?: "male" | "female";
  incomingGemini?: boolean;
  customerGender?: "male" | "female";
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

interface BgDetectNameGenderMessage {
  type: "detectNameGender";
  subscriberName: string;
  agentLanguage?: string;
}

interface BgConversationSummaryMessage {
  type: "conversationSummary";
  conversationTranscript: string;
}

type BgMessage =
  | BgTranslateMessage
  | BgLoginMessage
  | BgGetSessionMessage
  | BgLogoutMessage
  | BgDetectNameGenderMessage
  | BgConversationSummaryMessage;

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
  const raw = (await res.json()) as ExtensionSession;
  const profile: ExtensionSession = {
    ...raw,
    websites: Array.isArray(raw.websites) ? raw.websites : [],
    organization: raw.organization
      ? {
          ...raw.organization,
          websiteIds: raw.organization.websiteIds ?? [],
        }
      : null,
  };
  await writeSession(profile);
  sessionLoadedAt = Date.now();
  await syncContentScriptsForWebsites(profile.websites);
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

const NO_ORG_ERROR =
  "No organization connected. Open Configuration in the web app and connect to an organization.";

async function handleTranslate(
  message: BgTranslateMessage,
): Promise<
  | { ok: true; translations: string[]; dryRun?: boolean; dryRunNote?: string; geminiPrompt?: string }
  | { ok: false; error: string }
> {
  let headers: HeadersInit;
  try {
    headers = await authHeaders();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not signed in",
    };
  }

  const session = await getSession(false);
  if (!session.organization) {
    console.warn("[ManychatTranslator:bg] translate blocked — no organization");
    return { ok: false, error: NO_ORG_ERROR };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(TRANSLATE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        texts: message.texts,
        ...(message.websiteSlug ? { websiteSlug: message.websiteSlug } : {}),
        ...(message.outgoingGoogle
          ? {
              outgoingGoogle: true,
              customerGender: message.customerGender ?? "male",
              ...(message.agentGender === "female" ||
              message.agentGender === "male"
                ? { agentGender: message.agentGender }
                : {}),
            }
          : message.outgoing
            ? {
                outgoing: true,
                customerGender: message.customerGender ?? "male",
              }
            : message.incomingGemini
            ? {
                incomingGemini: true,
                customerGender: message.customerGender ?? "male",
              }
            : {}),
      }),
      signal: controller.signal,
    });

    const data = (await res.json()) as {
      translations?: string[];
      error?: string;
      message?: string;
      dryRun?: boolean;
      dryRunNote?: string;
      geminiPrompt?: string;
    };

    if (res.status === 401) {
      await clearAuth();
      return { ok: false, error: "Session expired. Sign in again." };
    }
    if (res.status === 403) {
      const errText = data.error ?? data.message ?? NO_ORG_ERROR;
      console.warn("[ManychatTranslator:bg] translate forbidden:", errText);
      return { ok: false, error: errText };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? data.message ?? `Backend HTTP ${res.status}`,
      };
    }
    if (data.dryRun) {
      console.log(
        "[ManychatTranslator:bg] Gemini dry-run — prompt also logged in backend terminal (npm run dev)",
      );
      if (data.geminiPrompt) {
        console.log(
          "[ManychatTranslator:bg] ========== GEMINI PROMPT ==========\n",
          data.geminiPrompt,
          "\n[ManychatTranslator:bg] ========== END PROMPT ==========",
        );
      }
      return {
        ok: true,
        translations: data.translations ?? message.texts,
        dryRun: true,
        dryRunNote:
          data.dryRunNote ??
          "Gemini dry-run: see prompt in this console and in the backend terminal.",
        geminiPrompt: data.geminiPrompt,
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

    if ((message.outgoing || message.incomingGemini) && data.geminiPrompt) {
      console.log(
        `[ManychatTranslator:bg] Gemini prompt sent (${message.incomingGemini ? "incoming" : "outgoing"}):`,
      );
      console.log(
        "[ManychatTranslator:bg] ========== GEMINI PROMPT ==========\n",
        data.geminiPrompt,
        "\n[ManychatTranslator:bg] ========== END PROMPT ==========",
      );
    } else {
      console.log(
        "[ManychatTranslator:bg] translate ok |",
        message.outgoing ? "outgoing" : "incoming",
        "|",
        session.organization.language,
        "<->",
        session.language,
      );
    }

    return {
      ok: true,
      translations: data.translations,
      geminiPrompt: data.geminiPrompt,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  } finally {
    clearTimeout(timeout);
  }
}

async function handleDetectNameGender(
  subscriberName: string,
  agentLanguage: string,
): Promise<
  | { ok: true; nameGender: string; translatedName: string }
  | { ok: false; error: string }
> {
  let headers: HeadersInit;
  try {
    headers = await authHeaders();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not signed in",
    };
  }

  const session = await getSession(false);
  if (!session.organization) {
    console.warn("[ManychatTranslator:bg] name-gender blocked — no organization");
    return { ok: false, error: NO_ORG_ERROR };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(TRANSLATE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        nameGender: true,
        subscriberName,
        agentLanguage: agentLanguage || session.language || "en",
        texts: [subscriberName],
      }),
      signal: controller.signal,
    });

    const data = (await res.json()) as {
      nameGender?: string;
      translatedName?: string;
      error?: string;
      message?: string;
    };

    if (res.status === 401) {
      await clearAuth();
      return { ok: false, error: "Session expired. Sign in again." };
    }
    if (res.status === 403) {
      return {
        ok: false,
        error: data.error ?? data.message ?? NO_ORG_ERROR,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? data.message ?? `Backend HTTP ${res.status}`,
      };
    }

    const nameGender = data.nameGender?.trim();
    const translatedName = data.translatedName?.trim() || subscriberName;
    if (!nameGender) {
      return { ok: false, error: "Invalid name-gender response" };
    }

    console.log("[ManychatTranslator:bg] name-gender ok:", {
      nameGender,
      translatedName,
    });
    return { ok: true, nameGender, translatedName };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

const SUMMARY_REQUEST_TIMEOUT_MS = 90000;

async function handleConversationSummary(
  conversationTranscript: string,
): Promise<
  | { ok: true; conversationSummary: string }
  | { ok: false; error: string }
> {
  let headers: HeadersInit;
  try {
    headers = await authHeaders();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not signed in",
    };
  }

  const session = await getSession(false);
  if (!session.organization) {
    console.warn(
      "[ManychatTranslator:bg] conversation-summary blocked — no organization",
    );
    return { ok: false, error: NO_ORG_ERROR };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SUMMARY_REQUEST_TIMEOUT_MS,
  );

  try {
    const res = await fetch(TRANSLATE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        conversationSummary: true,
        conversationTranscript,
        texts: [],
      }),
      signal: controller.signal,
    });

    const data = (await res.json()) as {
      conversationSummary?: string;
      error?: string;
      message?: string;
    };

    if (res.status === 401) {
      await clearAuth();
      return { ok: false, error: "Session expired. Sign in again." };
    }
    if (res.status === 403) {
      return {
        ok: false,
        error: data.error ?? data.message ?? NO_ORG_ERROR,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? data.message ?? `Backend HTTP ${res.status}`,
      };
    }

    const conversationSummary = data.conversationSummary?.trim();
    if (!conversationSummary) {
      return { ok: false, error: "Invalid conversation summary response" };
    }

    console.log("[ManychatTranslator:bg] conversation-summary ok");
    return { ok: true, conversationSummary };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
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
  if (message?.type === "detectNameGender" && message.subscriberName) {
    void handleDetectNameGender(
      message.subscriberName,
      message.agentLanguage ?? "",
    ).then(sendResponse);
    return true;
  }
  if (message?.type === "conversationSummary" && message.conversationTranscript) {
    void handleConversationSummary(message.conversationTranscript).then(
      sendResponse,
    );
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

chrome.runtime.onInstalled.addListener(() => {
  void syncContentScriptsForWebsites(undefined);
});

void syncContentScriptsForWebsites(undefined);

console.log("[ManychatTranslator:bg] service worker loaded");
