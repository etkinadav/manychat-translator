import { languageLabel } from "../constants/languages";
import { generateWithGemini } from "./gemini.service";

export const NAME_GENDER_VALUES = [
  "male",
  "female",
  "male or female",
  "unknown",
] as const;

export type NameGenderResult = (typeof NAME_GENDER_VALUES)[number];

export function buildNameGenderPrompt(
  subscriberName: string,
  organizationLanguageCode: string,
): string {
  const langLabel = languageLabel(organizationLanguageCode);
  const name = subscriberName.trim();

  return `I want to know whether the name "${name}" is typically a man's name or a woman's name in ${langLabel} (${organizationLanguageCode}).

Return exactly ONE of these four answers (nothing else — no explanation):
male
female
male or female
unknown

Rules:
- male — clearly a man's name
- female — clearly a woman's name
- male or female — the name can belong to both genders
- unknown — not clear that this is a personal name, or gender cannot be determined`;
}

export function parseNameGenderResponse(raw: string): NameGenderResult | null {
  const firstLine = raw.trim().split(/\r?\n/)[0]?.trim().toLowerCase() ?? "";
  const normalized = firstLine.replace(/^["'`]+|["'`]+$/g, "").trim();

  if (normalized === "male or female") return "male or female";
  if (normalized === "male") return "male";
  if (normalized === "female") return "female";
  if (normalized === "unknown") return "unknown";

  return null;
}

export async function detectSubscriberNameGender(
  subscriberName: string,
  organizationLanguageCode: string,
): Promise<NameGenderResult> {
  const prompt = buildNameGenderPrompt(subscriberName, organizationLanguageCode);

  console.log("[gemini-name-gender] prompt:\n", prompt);

  const raw = await generateWithGemini(prompt);
  const parsed = parseNameGenderResponse(raw);

  console.log("[gemini-name-gender] raw response:", raw);
  console.log("[gemini-name-gender] parsed:", parsed ?? "invalid");

  if (!parsed) {
    throw new Error(`Invalid name-gender response: ${raw.slice(0, 80)}`);
  }

  return parsed;
}
