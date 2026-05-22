import type { ExtensionWebsite } from "./site-profile/types";

export interface CachedOrganization {
  id: string;
  name: string;
  language: string;
  translationContext: string;
  /** ObjectId strings only — full site data is in session.websites */
  websiteIds: string[];
}

export interface ExtensionSession {
  email: string;
  language: string;
  gender: "" | "male" | "female";
  organization: CachedOrganization | null;
  /** Populated from `websites` collection (not stored on organization). */
  websites: ExtensionWebsite[];
}

export interface StoredAuth {
  token: string;
  expiration: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  email: string;
  userName: string;
}
