import type {
  OrganizationTerm,
  OrganizationTermCategory,
  OrganizationTermInterpretation,
} from "../types/organizationTerms";

const MAX_CATEGORIES = 50;
const MAX_TERMS_PER_CATEGORY = 200;
const MAX_INTERPRETATIONS_PER_TERM = 50;
const MAX_NAME_LEN = 120;
const MAX_DESCRIPTION_LEN = 2000;
const MAX_INTERPRETATION_LEN = 500;

function trimString(value: unknown, maxLen: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, maxLen);
}

function normalizeInterpretations(value: unknown): OrganizationTermInterpretation[] {
  if (!Array.isArray(value)) return [];
  const out: OrganizationTermInterpretation[] = [];
  for (const item of value.slice(0, MAX_INTERPRETATIONS_PER_TERM)) {
    const text =
      typeof item === "string"
        ? trimString(item, MAX_INTERPRETATION_LEN)
        : trimString(
            (item as { text?: unknown })?.text,
            MAX_INTERPRETATION_LEN,
          );
    if (text) out.push({ text });
  }
  return out;
}

function normalizeTermsList(value: unknown): OrganizationTerm[] {
  if (!Array.isArray(value)) return [];
  const out: OrganizationTerm[] = [];
  for (const raw of value.slice(0, MAX_TERMS_PER_CATEGORY)) {
    if (!raw || typeof raw !== "object") continue;
    const term = raw as Record<string, unknown>;
    const name = trimString(term.name, MAX_NAME_LEN);
    if (!name) continue;
    out.push({
      name,
      description: trimString(term.description, MAX_DESCRIPTION_LEN),
      interpretations: normalizeInterpretations(term.interpretations),
    });
  }
  return out;
}

/**
 * Sanitize terms payload from create/update requests.
 * Drops empty categories; keeps valid nested structure only.
 */
export function normalizeOrganizationTerms(
  value: unknown,
): OrganizationTermCategory[] {
  if (!Array.isArray(value)) return [];
  const categories: OrganizationTermCategory[] = [];
  for (const raw of value.slice(0, MAX_CATEGORIES)) {
    if (!raw || typeof raw !== "object") continue;
    const cat = raw as Record<string, unknown>;
    const name = trimString(cat.name, MAX_NAME_LEN);
    if (!name) continue;
    categories.push({
      name,
      terms: normalizeTermsList(cat.terms),
    });
  }
  return categories;
}
