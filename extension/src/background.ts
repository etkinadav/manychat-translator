/**
 * MV3 service worker — proxies translate requests to the local backend.
 *
 * Content scripts run in an isolated world but cross-origin `fetch()` from
 * a content script still uses the *page* origin for CORS preflight
 * (`https://app.manychat.com`). The service worker runs in the extension
 * context instead, so `fetch(localhost)` only needs host_permissions and
 * is not blocked by the page's CORS policy.
 */

const BACKEND_URL = "http://localhost:3000/api/translate";
const BG_REQUEST_TIMEOUT_MS = 8000;

interface BgTranslateMessage {
  type: "translate";
  texts: string[];
  /** "en" incoming chat (default), "he" outgoing composer */
  targetLanguage?: string;
  /** Strip gender-prompt headers from Google response (outgoing only) */
  stripInstructionPrefix?: boolean;
}

interface BgTranslateOk {
  ok: true;
  translations: string[];
}

interface BgTranslateErr {
  ok: false;
  error: string;
}

chrome.runtime.onMessage.addListener(
  (message: BgTranslateMessage, _sender, sendResponse): boolean => {
    if (message?.type !== "translate" || !Array.isArray(message.texts)) {
      sendResponse({ ok: false, error: "Invalid message" } satisfies BgTranslateErr);
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BG_REQUEST_TIMEOUT_MS);

    void (async () => {
      try {
        const targetLanguage = message.targetLanguage?.trim() || "en";
        console.log(
          "[ManychatTranslator:bg] backend request started | count=",
          message.texts.length,
          "| targetLanguage=",
          targetLanguage,
        );
        const res = await fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texts: message.texts,
            targetLanguage,
            stripInstructionPrefix: message.stripInstructionPrefix === true,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`backend returned HTTP ${res.status}`);
        }
        const data = (await res.json()) as { translations?: string[] };
        if (!Array.isArray(data.translations)) {
          throw new Error("backend response missing `translations` array");
        }
        if (data.translations.length !== message.texts.length) {
          throw new Error(
            `expected ${message.texts.length} translations, got ${data.translations.length}`,
          );
        }
        console.log(
          "[ManychatTranslator:bg] backend response received | count=",
          data.translations.length,
        );
        sendResponse({
          ok: true,
          translations: data.translations,
        } satisfies BgTranslateOk);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.warn("[ManychatTranslator:bg] request failed:", error);
        sendResponse({ ok: false, error } satisfies BgTranslateErr);
      } finally {
        clearTimeout(timeout);
      }
    })();

    return true;
  },
);

console.log("[ManychatTranslator:bg] service worker loaded");
