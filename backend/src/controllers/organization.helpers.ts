import mongoose, { type Types } from "mongoose";
import { Organization, type IOrganization } from "../models/organization";
import type { IUser } from "../models/user";
import {
  formatWebsitePublic,
  resolveOrganizationWebsites,
} from "../services/website.service";

export async function formatOrganizationWebsitesForSession(
  org: IOrganization | null,
) {
  if (!org) return [];
  const websites = await resolveOrganizationWebsites(org);
  return websites.map(formatWebsitePublic);
}

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

function formatTerms(org: IOrganization) {
  return Array.isArray(org.terms) ? org.terms : [];
}

export function formatOrganization(org: IOrganization | null) {
  if (!org) return null;
  return {
    id: String(org._id),
    name: organizationDisplayName(org),
    language: org.language,
    translationContext: org.translationContext ?? "",
    terms: formatTerms(org),
    websiteIds: (org.websites ?? []).map((id) => String(id)),
  };
}

export function formatOrganizationPublic(org: IOrganization) {
  return {
    id: String(org._id),
    name: organizationDisplayName(org),
    language: org.language,
    translationContext: org.translationContext ?? "",
    terms: formatTerms(org),
    websiteIds: (org.websites ?? []).map((id) => String(id)),
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

export function isPopulatedOrganization(
  value: IOrganization | Types.ObjectId | null | undefined,
): value is IOrganization {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === "object" &&
    "language" in value
  );
}

/** Load organization from a populated doc or a stored ObjectId ref. */
export async function resolveOrganizationField(
  organization: IOrganization | Types.ObjectId | null | undefined,
): Promise<IOrganization | null> {
  if (!organization) return null;
  if (isPopulatedOrganization(organization)) {
    return organization;
  }
  const id = String(organization);
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Organization.findById(id);
}

export function verifyOrganizationPassword(
  org: IOrganization,
  password: string,
): boolean {
  if (!org.salt) return false;
  const hashed = org.hashPassword(password);
  return hashed.toString() === org.password.toString();
}

export function normalizeLanguage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const lang = value.trim().toLowerCase();
  return ALLOWED_ORG_LANGUAGES.has(lang) ? lang : null;
}
