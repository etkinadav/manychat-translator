import type { OrganizationDetails } from "./organization.model";
import type { WebsiteListItem } from "./website.model";

export interface UserProfile {
  email: string;
  language: string;
  gender: "" | "male" | "female";
  organization: OrganizationDetails | null;
  websites: WebsiteListItem[];
}
