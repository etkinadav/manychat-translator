import type { Response } from "express";
import type { AuthRequest } from "../middleware/check-auth";
import { Website } from "../models/website";
import { formatWebsiteListItem } from "../services/website.service";

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
