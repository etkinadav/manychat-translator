/** Organization glossary — categories → terms → interpretations. */

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
