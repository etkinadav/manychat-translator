import type { Response } from "express";
import { type IOrganization } from "../models/organization";
import { User } from "../models/user";
import type { AuthRequest } from "../middleware/check-auth";
import {
  ALLOWED_ORG_LANGUAGES,
  formatOrganization,
} from "./organization.helpers";

async function loadUser(userId: string) {
  return User.findById(userId).populate<{ organization: IOrganization | null }>(
    "organization",
  );
}

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await loadUser(req.userData!.userId);
    if (!user) {
      res.status(404).json({ message: "User_not_found" });
      return;
    }
    const org =
      user.organization && typeof user.organization === "object"
        ? user.organization
        : null;

    res.status(200).json({
      email: user.email,
      language: user.language || "en",
      gender: user.gender || "",
      organization: formatOrganization(org),
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
    const populated = await loadUser(String(user._id));
    const org =
      populated?.organization && typeof populated.organization === "object"
        ? populated.organization
        : null;

    res.status(200).json({
      email: user.email,
      language: user.language,
      gender: user.gender || "",
      organization: formatOrganization(org),
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
    user.organization = null;
    await user.save();

    res.status(200).json({
      email: user.email,
      language: user.language || "en",
      gender: user.gender || "",
      organization: null,
    });
  } catch (err) {
    console.error("[profile] disconnectOrganization error:", err);
    res.status(500).json({ message: "Disconnect_failed" });
  }
}
