import type { ExtensionWebsite, WebsiteDomProfile } from "./types";

let activeWebsite: ExtensionWebsite | null = null;

export function setActiveWebsite(website: ExtensionWebsite | null): void {
  activeWebsite = website;
}

export function getActiveWebsite(): ExtensionWebsite | null {
  return activeWebsite;
}

export function getDomProfile(): WebsiteDomProfile {
  if (!activeWebsite) {
    throw new Error("[ManychatTranslator] no active website profile");
  }
  return activeWebsite.domProfile;
}

export function getSiteFeatures(): WebsiteDomProfile["features"] {
  return getDomProfile().features;
}

export function isFeatureEnabled(
  key: keyof WebsiteDomProfile["features"],
): boolean {
  return getDomProfile().features[key] !== false;
}
