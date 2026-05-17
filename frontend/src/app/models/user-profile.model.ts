import type { OrganizationDetails } from "./organization.model";

export interface UserProfile {
  email: string;
  language: string;
  gender: "" | "male" | "female";
  organization: OrganizationDetails | null;
}
