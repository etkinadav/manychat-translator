import type { Response } from "express";
import type { AuthRequest } from "../middleware/check-auth";
import { Website } from "../models/website";
import {
  formatWebsiteListItem,
  formatWebsitePublic,
} from "../services/website.service";
import { normalizeOthersRole } from "../services/othersRole";

/** List enabled websites for organization form multi-select. */
export async function listWebsites(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const sites = await Website.find({ enabled: true }).sort({ name: 1 });
    res.status(200).json({
      websites: sites.map(formatWebsiteListItem),
    });
  } catch (err) {
    console.error("[websites] list error:", err);
    res.status(500).json({ message: "Websites_load_failed" });
  }
}

/** Update website settings (e.g. othersRole for Gemini prompts). */
export async function updateWebsite(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const id = String(req.params.id ?? "").trim();
  if (!id) {
    res.status(400).json({ message: "Website_id_required" });
    return;
  }

  try {
    const website = await Website.findById(id);
    if (!website) {
      res.status(404).json({ message: "Website_not_found" });
      return;
    }

    if (typeof req.body?.othersRole === "string") {
      website.othersRole = normalizeOthersRole(req.body.othersRole);
    }

    await website.save();
    res.status(200).json({ website: formatWebsitePublic(website) });
  } catch (err) {
    console.error("[websites] update error:", err);
    res.status(500).json({ message: "Website_update_failed" });
  }
}
