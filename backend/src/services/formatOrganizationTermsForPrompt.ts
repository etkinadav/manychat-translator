import type { OrganizationTermInterpretation } from "../types/organizationTerms";

function interpretationText(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object" && "text" in item) {
    return String((item as OrganizationTermInterpretation).text ?? "").trim();
  }
  return "";
}

function formatTermLine(term: Record<string, unknown>): string {
  const name = String(term.name ?? "").trim();
  if (!name) return "";

  const parts: string[] = [name];
  const description = String(term.description ?? "").trim();
  if (description) parts.push(description);

  if (Array.isArray(term.interpretations)) {
    for (const item of term.interpretations) {
      const text = interpretationText(item);
      if (text) parts.push(text);
    }
  }

  return parts.join(" = ");
}

/**
 * Compact glossary line for Gemini prompts.
 * Example: business terms: branches: Bezalel = desc = interp | ... Papers: Plain Paper = ...
 */
export function formatOrganizationTermsForPrompt(terms: unknown): string {
  if (!Array.isArray(terms) || terms.length === 0) return "";

  const categoryBlocks: string[] = [];
  for (const rawCat of terms) {
    if (!rawCat || typeof rawCat !== "object") continue;
    const cat = rawCat as Record<string, unknown>;
    const catName = String(cat.name ?? "").trim();
    if (!catName) continue;

    const rawTerms = cat.terms;
    if (!Array.isArray(rawTerms)) continue;

    const termLines: string[] = [];
    for (const rawTerm of rawTerms) {
      if (!rawTerm || typeof rawTerm !== "object") continue;
      const line = formatTermLine(rawTerm as Record<string, unknown>);
      if (line) termLines.push(line);
    }

    if (termLines.length > 0) {
      categoryBlocks.push(`${catName}: ${termLines.join(" | ")}`);
    }
  }

  if (categoryBlocks.length === 0) return "";
  return `business terms: ${categoryBlocks.join(" ")}`;
}
