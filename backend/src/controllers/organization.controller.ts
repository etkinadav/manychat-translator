import type { Response } from "express";
import mongoose from "mongoose";
import { Organization } from "../models/organization";
import { User } from "../models/user";
import type { AuthRequest } from "../middleware/check-auth";
import { normalizeOrganizationTerms } from "../services/organizationTerms";
import { normalizeWebsiteIds } from "../services/website.service";
import { Website } from "../models/website";
import { MANYCHAT_WEBSITE_SLUG } from "../data/manychatWebsiteSeed";
import {
  formatOrganization,
  formatOrganizationPublic,
  formatOrganizationWebsitesForSession,
  normalizeLanguage,
  normalizeOrganizationName,
  organizationDisplayName,
  userCanManageOrganization,
  verifyOrganizationPassword,
} from "./organization.helpers";

export async function listOrganizations(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const orgs = await Organization.find({})
      .select("name language translationContext")
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      organizations: orgs.map((org) => ({
        id: String(org._id),
        name: organizationDisplayName(org),
        language: org.language,
        translationContextPreview: (org.translationContext ?? "").slice(0, 80),
      })),
    });
  } catch (err) {
    console.error("[organizations] list error:", err);
    res.status(500).json({ message: "Organizations_load_failed" });
  }
}

export async function getOrganization(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const id = String(req.params.id ?? "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid_organization_id" });
    return;
  }

  try {
    const user = await User.findById(req.userData!.userId);
    const org = await Organization.findById(id);
    if (!user) {
      res.status(404).json({ message: "User_not_found" });
      return;
    }
    if (!org) {
      res.status(404).json({ message: "Organization_not_found" });
      return;
    }
    if (!userCanManageOrganization(user, org)) {
      res.status(403).json({ message: "Organization_edit_forbidden" });
      return;
    }

    res.status(200).json({
      organization: formatOrganizationPublic(org),
      canEdit: true,
    });
  } catch (err) {
    console.error("[organizations] get error:", err);
    res.status(500).json({ message: "Organization_load_failed" });
  }
}

export async function createOrganization(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const name = normalizeOrganizationName(req.body.name);
  const language = normalizeLanguage(req.body.language);
  const translationContext = String(req.body.translationContext ?? "").trim();
  const terms = normalizeOrganizationTerms(req.body.terms);
  const password = String(req.body.password ?? "");

  if (!name) {
    res.status(400).json({ message: "Organization_name_required" });
    return;
  }
  if (!language) {
    res.status(400).json({ message: "Invalid_language" });
    return;
  }
  if (!password) {
    res.status(400).json({ message: "Organization_password_required" });
    return;
  }

  try {
    let websiteIds = await normalizeWebsiteIds(req.body.websites);
    if (websiteIds === null || websiteIds.length === 0) {
      const manychat = await Website.findOne({ slug: MANYCHAT_WEBSITE_SLUG });
      websiteIds = manychat ? [manychat._id] : [];
    }

    const org = new Organization({
      name,
      language,
      translationContext,
      terms,
      websites: websiteIds,
      password,
      createdBy: req.userData!.userId,
    });
    await org.save();

    res.status(201).json({
      organization: formatOrganizationPublic(org),
    });
  } catch (err) {
    console.error("[organizations] create error:", err);
    res.status(500).json({ message: "Organization_create_failed" });
  }
}

export async function updateOrganization(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const id = String(req.params.id ?? "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid_organization_id" });
    return;
  }

  try {
    const user = await User.findById(req.userData!.userId);
    const org = await Organization.findById(id);
    if (!user) {
      res.status(404).json({ message: "User_not_found" });
      return;
    }
    if (!org) {
      res.status(404).json({ message: "Organization_not_found" });
      return;
    }
    if (!userCanManageOrganization(user, org)) {
      res.status(403).json({ message: "Organization_edit_forbidden" });
      return;
    }

    if (req.body.name !== undefined) {
      const name = normalizeOrganizationName(req.body.name);
      if (!name) {
        res.status(400).json({ message: "Organization_name_required" });
        return;
      }
      org.name = name;
    }

    if (req.body.language !== undefined) {
      const language = normalizeLanguage(req.body.language);
      if (!language) {
        res.status(400).json({ message: "Invalid_language" });
        return;
      }
      org.language = language;
    }

    if (req.body.translationContext !== undefined) {
      org.translationContext = String(req.body.translationContext ?? "").trim();
    }

    if (req.body.terms !== undefined) {
      org.terms = normalizeOrganizationTerms(req.body.terms);
    }

    if (req.body.websites !== undefined) {
      const websiteIds = await normalizeWebsiteIds(req.body.websites);
      if (websiteIds !== null) {
        org.websites = websiteIds;
      }
    }

    const newPassword = String(req.body.password ?? "").trim();
    if (newPassword) {
      org.password = newPassword;
    }

    await org.save();

    res.status(200).json({
      organization: formatOrganizationPublic(org),
    });
  } catch (err) {
    console.error("[organizations] update error:", err);
    res.status(500).json({ message: "Organization_update_failed" });
  }
}

export async function connectOrganization(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const organizationId = String(req.body.organizationId ?? "").trim();
  const password = String(req.body.password ?? "");

  if (!organizationId || !password) {
    res.status(400).json({ message: "Missing_organization_or_password" });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    res.status(400).json({ message: "Invalid_organization_id" });
    return;
  }

  try {
    const user = await User.findById(req.userData!.userId);
    if (!user) {
      res.status(404).json({ message: "User_not_found" });
      return;
    }

    const org = await Organization.findById(organizationId);
    if (!org) {
      res.status(404).json({ message: "Organization_not_found" });
      return;
    }

    if (!verifyOrganizationPassword(org, password)) {
      res.status(401).json({ message: "Organization_password_incorrect" });
      return;
    }

    // updateOne avoids full-document validation (legacy beams users may have extra fields)
    const updateResult = await User.updateOne(
      { _id: user._id },
      { $set: { organization: org._id } },
    );
    if (updateResult.matchedCount === 0) {
      res.status(404).json({ message: "User_not_found" });
      return;
    }
    if (updateResult.modifiedCount === 0 && String(user.organization) !== String(org._id)) {
      console.warn(
        "[organizations] connect: update matched but did not modify organization",
        { userId: user._id, organizationId: org._id },
      );
    }

    console.log(
      `[organizations] user ${String(user._id)} connected to org ${String(org._id)} (${organizationDisplayName(org)})`,
    );

    res.status(200).json({
      email: user.email,
      language: user.language || "en",
      gender: user.gender || "",
      organization: formatOrganization(org),
      websites: await formatOrganizationWebsitesForSession(org),
    });
  } catch (err) {
    console.error("[organizations] connect error:", err);
    res.status(500).json({ message: "Organization_connect_failed" });
  }
}
