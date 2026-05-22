import type { Response } from "express";
import { User } from "../models/user";
import type { AuthRequest } from "../middleware/check-auth";
import {
  ALLOWED_ORG_LANGUAGES,
  formatOrganization,
  formatOrganizationWebsitesForSession,
  resolveOrganizationField,
} from "./organization.helpers";

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.userData!.userId);
    if (!user) {
      res.status(404).json({ message: "User_not_found" });
      return;
    }
    const org = await resolveOrganizationField(user.organization);

    res.status(200).json({
      email: user.email,
      language: user.language || "en",
      gender: user.gender || "",
      organization: formatOrganization(org),
      websites: await formatOrganizationWebsitesForSession(org),
    });
  } catch (err) {
    console.error("[profile] getProfile error:", err);
    res.status(500).json({ message: "Profile_load_failed" });
  }
}

export async function updateProfile(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const user = await User.findById(req.userData!.userId);
    if (!user) {
      res.status(404).json({ message: "User_not_found" });
      return;
    }

    if (typeof req.body.language === "string") {
      const lang = req.body.language.trim().toLowerCase();
      if (!ALLOWED_ORG_LANGUAGES.has(lang)) {
        res.status(400).json({ message: "Invalid_language" });
        return;
      }
      user.language = lang;
    }

    if (typeof req.body.gender === "string") {
      const gender = req.body.gender.trim();
      if (gender !== "" && gender !== "male" && gender !== "female") {
        res.status(400).json({ message: "Invalid_gender" });
        return;
      }
      user.gender = gender as "" | "male" | "female";
    }

    await user.save();
    const org = await resolveOrganizationField(user.organization);

    res.status(200).json({
      email: user.email,
      language: user.language,
      gender: user.gender || "",
      organization: formatOrganization(org),
      websites: await formatOrganizationWebsitesForSession(org),
    });
  } catch (err) {
    console.error("[profile] updateProfile error:", err);
    res.status(500).json({ message: "Profile_update_failed" });
  }
}

export async function disconnectOrganization(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const user = await User.findById(req.userData!.userId);
    if (!user) {
      res.status(404).json({ message: "User_not_found" });
      return;
    }
    await User.updateOne({ _id: user._id }, { $set: { organization: null } });

    res.status(200).json({
      email: user.email,
      language: user.language || "en",
      gender: user.gender || "",
      organization: null,
      websites: [],
    });
  } catch (err) {
    console.error("[profile] disconnectOrganization error:", err);
    res.status(500).json({ message: "Disconnect_failed" });
  }
}
