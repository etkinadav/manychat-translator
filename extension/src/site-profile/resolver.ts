import { manychatWebsiteFallback } from "./defaults/manychat";
import type { ExtensionWebsite } from "./types";

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function urlMatchesPattern(url: string, pattern: string): boolean {
  try {
    return patternToRegExp(pattern).test(url);
  } catch {
    return false;
  }
}

export function resolveWebsiteForUrl(
  href: string,
  websites: ExtensionWebsite[],
): ExtensionWebsite | null {
  for (const site of websites) {
    for (const pattern of site.urlPatterns ?? []) {
      if (urlMatchesPattern(href, pattern)) {
        return site;
      }
    }
  }
  return null;
}

/** Fallback when session has org but empty websites (legacy). */
export function resolveWebsiteForUrlWithFallback(
  href: string,
  websites: ExtensionWebsite[] | undefined,
): ExtensionWebsite | null {
  const list = websites?.length ? websites : [manychatWebsiteFallback];
  return resolveWebsiteForUrl(href, list);
}

export function collectUrlPatterns(websites: ExtensionWebsite[]): string[] {
  const set = new Set<string>();
  for (const site of websites) {
    for (const p of site.urlPatterns ?? []) {
      if (p.trim()) set.add(p.trim());
    }
  }
  return [...set];
}
