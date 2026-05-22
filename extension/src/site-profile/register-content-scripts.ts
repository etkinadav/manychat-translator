import { manychatWebsiteFallback } from "./defaults/manychat";
import { collectUrlPatterns } from "./resolver";
import type { ExtensionWebsite } from "./types";

const CONTENT_SCRIPT_ID = "mct-content";

export async function syncContentScriptsForWebsites(
  websites: ExtensionWebsite[] | undefined,
): Promise<void> {
  const list = websites?.length ? websites : [manychatWebsiteFallback];
  const matches = collectUrlPatterns(list);
  if (matches.length === 0) return;

  try {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    const ours = existing
      .map((s) => s.id)
      .filter((id): id is string => Boolean(id && id.startsWith("mct-")));

    if (ours.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: ours });
    }

    await chrome.scripting.registerContentScripts([
      {
        id: CONTENT_SCRIPT_ID,
        matches,
        js: ["content.js"],
        css: ["styles.css"],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);

    console.log(
      "[ManychatTranslator:bg] content scripts registered for",
      matches.length,
      "pattern(s)",
    );
  } catch (err) {
    console.warn("[ManychatTranslator:bg] registerContentScripts failed:", err);
  }
}
