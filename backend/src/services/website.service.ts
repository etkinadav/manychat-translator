import mongoose, { type Types } from "mongoose";
import type { IOrganization } from "../models/organization";
import { Website, type IWebsite } from "../models/website";
import { MANYCHAT_WEBSITE_SLUG } from "../data/manychatWebsiteSeed";
import { normalizeOthersRole } from "./othersRole";

export function formatWebsitePublic(website: IWebsite) {
  return {
    id: String(website._id),
    slug: website.slug,
    name: website.name,
    enabled: website.enabled,
    urlPatterns: website.urlPatterns ?? [],
    othersRole: normalizeOthersRole(website.othersRole),
    domProfile: website.domProfile,
    profileVersion: website.profileVersion ?? 1,
  };
}

export function formatWebsiteListItem(website: IWebsite) {
  return {
    id: String(website._id),
    slug: website.slug,
    name: website.name,
    enabled: website.enabled,
    urlPatterns: website.urlPatterns ?? [],
    othersRole: normalizeOthersRole(website.othersRole),
  };
}

/** Role label for Gemini from org websites + active site slug from the extension. */
export async function resolveOthersRoleForOrganization(
  org: IOrganization,
  websiteSlug?: string,
): Promise<string> {
  const sites = await resolveOrganizationWebsites(org);
  const slug = String(websiteSlug ?? "")
    .trim()
    .toLowerCase();
  if (slug) {
    const match = sites.find((s) => s.slug === slug);
    if (match) return normalizeOthersRole(match.othersRole);
  }
  if (sites.length === 1) {
    return normalizeOthersRole(sites[0]!.othersRole);
  }
  return normalizeOthersRole(undefined);
}

export async function resolveOrganizationWebsites(
  org: IOrganization,
): Promise<IWebsite[]> {
  const ids = org.websites ?? [];
  if (ids.length > 0) {
    const sites = await Website.find({
      _id: { $in: ids },
      enabled: true,
    }).sort({ name: 1 });
    return sites;
  }

  const manychat = await Website.findOne({
    slug: MANYCHAT_WEBSITE_SLUG,
    enabled: true,
  });
  return manychat ? [manychat] : [];
}

export async function normalizeWebsiteIds(
  value: unknown,
): Promise<Types.ObjectId[] | null> {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return [];

  const ids: Types.ObjectId[] = [];
  for (const item of value) {
    const id = String(item ?? "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) continue;
    const exists = await Website.exists({ _id: id, enabled: true });
    if (exists) {
      ids.push(new mongoose.Types.ObjectId(id));
    }
  }
  return ids;
}
