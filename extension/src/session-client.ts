import type { ExtensionSession } from "./types";

interface SessionOk {
  ok: true;
  session: ExtensionSession;
}

interface SessionErr {
  ok: false;
  error: string;
}

export function fetchSession(forceRefresh = false): Promise<ExtensionSession> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "getSession", forceRefresh },
      (response: SessionOk | SessionErr | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.ok || !("session" in response)) {
          const errMsg =
            response && "error" in response ? response.error : "Not signed in";
          reject(new Error(errMsg));
          return;
        }
        resolve(response.session);
      },
    );
  });
}
