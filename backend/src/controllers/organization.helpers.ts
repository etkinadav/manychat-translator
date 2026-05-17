import type { IOrganization } from "../models/organization";
import type { IUser } from "../models/user";

export const ALLOWED_ORG_LANGUAGES = new Set([
  "en",
  "he",
  "ar",
  "es",
  "fr",
  "de",
  "ru",
  "pt",
  "it",
  "uk",
]);

export function organizationDisplayName(org: {
  name?: string;
  language: string;
}): string {
  const name = String(org.name ?? "").trim();
  if (name) return name;
  return org.language.toUpperCase();
}

export function formatOrganization(org: IOrganization | null) {
  if (!org) return null;
  return {
    id: String(org._id),
    name: organizationDisplayName(org),
    language: org.language,
    translationContext: org.translationContext ?? "",
  };
}

export function formatOrganizationPublic(org: IOrganization) {
  return {
    id: String(org._id),
    name: organizationDisplayName(org),
    language: org.language,
    translationContext: org.translationContext ?? "",
  };
}

export function normalizeOrganizationName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > 120) return null;
  return name;
}

export function userCanManageOrganization(
  user: IUser,
  org: IOrganization,
): boolean {
  const orgId = String(org._id);
  const connectedId = user.organization ? String(user.organization) : "";
  if (connectedId === orgId) return true;
  if (org.createdBy && String(org.createdBy) === String(user._id)) return true;
  return false;
}

export function normalizeLanguage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const lang = value.trim().toLowerCase();
  return ALLOWED_ORG_LANGUAGES.has(lang) ? lang : null;
}
