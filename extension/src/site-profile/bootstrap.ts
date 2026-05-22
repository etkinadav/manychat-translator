import { fetchSession } from "../session-client";
import { setActiveWebsite } from "./context";
import { resolveWebsiteForUrlWithFallback } from "./resolver";

const LOG_PREFIX = "[ManychatTranslator:site]";

/**
 * Returns true if this tab URL is allowed for the user's organization and
 * a site profile was activated.
 */
export async function bootstrapExtensionOnPage(): Promise<boolean> {
  try {
    const session = await fetchSession(false);
    const org = session.organization;
    if (!org) {
      console.log(LOG_PREFIX, "no organization — extension inactive on page");
      setActiveWebsite(null);
      return false;
    }

    const match = resolveWebsiteForUrlWithFallback(
      location.href,
      session.websites ?? [],
    );
    if (!match) {
      console.log(
        LOG_PREFIX,
        "URL not in organization websites — inactive",
        location.href,
      );
      setActiveWebsite(null);
      return false;
    }

    setActiveWebsite(match);
    console.log(LOG_PREFIX, "active site:", match.slug, match.name);
    return true;
  } catch (err) {
    console.warn(LOG_PREFIX, "bootstrap failed:", err);
    setActiveWebsite(null);
    return false;
  }
}
