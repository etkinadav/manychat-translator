export interface OrganizationTermInterpretation {
  text: string;
}

export interface OrganizationTerm {
  name: string;
  description: string;
  interpretations: OrganizationTermInterpretation[];
}

export interface OrganizationTermCategory {
  name: string;
  terms: OrganizationTerm[];
}

export interface OrganizationSummary {
  id: string;
  name: string;
  language: string;
  translationContextPreview: string;
}

export interface OrganizationDetails {
  id: string;
  name: string;
  language: string;
  translationContext: string;
  terms: OrganizationTermCategory[];
  websiteIds: string[];
}
