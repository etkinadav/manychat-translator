export interface WebsiteListItem {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  urlPatterns: string[];
  /** Gemini prompt label for the other party (e.g. customer, subscriber). */
  othersRole: string;
}
