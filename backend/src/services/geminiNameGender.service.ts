import { languageLabel } from "../constants/languages";
import { generateWithGemini } from "./gemini.service";

export const NAME_GENDER_VALUES = [
  "male",
  "female",
  "male or female",
  "unknown",
] as const;

export type NameGenderResult = (typeof NAME_GENDER_VALUES)[number];

export interface NameGenderDetection {
  translatedName: string;
  nameGender: NameGenderResult;
}

export function buildNameGenderPrompt(
  subscriberName: string,
  organizationLanguageCode: string,
  agentLanguageCode: string,
): string {
  const orgLangLabel = languageLabel(organizationLanguageCode);
  const agentLangLabel = languageLabel(agentLanguageCode);
  const name = subscriberName.trim();

  return `Contact name as shown in the chat/CRM: "${name}"

Return exactly TWO lines (no labels, no explanation, no markdown):
Line 1: The person's name written in ${agentLangLabel} (${agentLanguageCode}) — transliterate or translate only the personal name (no titles, no gender words).
Line 2: Exactly one of these four answers:
male
female
male or female
unknown

Use ${orgLangLabel} (${organizationLanguageCode}) cultural context to judge the name.
Rules for line 2:
- male — clearly a man's name
- female — clearly a woman's name
- male or female — the name can belong to both genders
- unknown — not a personal name, or gender cannot be determined`;
}

/** Parse line 2; "male or female" must be checked before "male" / "female". */
export function parseGenderCategoryLine(line: string): NameGenderResult | null {
  const normalized = line
    .trim()
    .toLowerCase()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();

  if (normalized.includes("male or female")) return "male or female";
  if (normalized === "female") return "female";
  if (normalized === "male") return "male";
  if (normalized === "unknown") return "unknown";

  return null;
}

export function parseNameGenderResponse(
  raw: string,
  fallbackName: string,
): NameGenderDetection | null {
  const lines = raw
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return null;

  let translatedName = fallbackName.trim();
  let genderLine = lines[lines.length - 1] ?? "";

  if (lines.length >= 2) {
    translatedName = lines[0]
      .replace(/^["'`]+|["'`]+$/g, "")
      .trim();
    genderLine = lines[lines.length - 1] ?? genderLine;
  }

  const nameGender = parseGenderCategoryLine(genderLine);
  if (!nameGender || !translatedName) return null;

  return { translatedName, nameGender };
}

export async function detectSubscriberNameGender(
  subscriberName: string,
  organizationLanguageCode: string,
  agentLanguageCode: string,
): Promise<NameGenderDetection> {
  const prompt = buildNameGenderPrompt(
    subscriberName,
    organizationLanguageCode,
    agentLanguageCode,
  );

  console.log("[gemini-name-gender] prompt:\n", prompt);

  const raw = await generateWithGemini(prompt);
  const parsed = parseNameGenderResponse(raw, subscriberName);

  console.log("[gemini-name-gender] raw response:", raw);
  console.log("[gemini-name-gender] parsed:", parsed ?? "invalid");

  if (!parsed) {
    throw new Error(`Invalid name-gender response: ${raw.slice(0, 80)}`);
  }

  return parsed;
}

export function formatNameGenderDisplayLabel(
  translatedName: string,
  nameGender: NameGenderResult,
): string {
  return `${translatedName} (${nameGender})`;
}
