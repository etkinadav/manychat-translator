import type { Response } from "express";
import { User } from "../models/user";
import type { IOrganization } from "../models/organization";
import type { IUser } from "../models/user";
import type { AuthRequest } from "../middleware/check-auth";
import { resolveOrganizationField } from "./organization.helpers";

const NO_ORG_ERROR =
  "No organization connected. Connect to an organization in Configuration first.";

export interface TranslateOrgContext {
  user: IUser;
  org: IOrganization;
}

export async function resolveTranslateOrganizationContext(
  req: AuthRequest,
  res: Response,
): Promise<TranslateOrgContext | null> {
  const user = await User.findById(req.userData!.userId);
  if (!user) {
    res.status(404).json({ error: "User_not_found" });
    return null;
  }

  if (!user.organization) {
    console.warn(
      `[translate] rejected: user=${String(user._id)} has no organization`,
    );
    res.status(403).json({ error: NO_ORG_ERROR });
    return null;
  }

  const org = await resolveOrganizationField(user.organization);
  if (!org) {
    console.warn(
      `[translate] rejected: user=${String(user._id)} organization ref invalid`,
    );
    res.status(403).json({ error: NO_ORG_ERROR });
    return null;
  }

  return { user, org };
}
