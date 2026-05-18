import { languageLabel } from "../constants/languages";
import type { OrganizationTermCategory } from "../types/organizationTerms";
import type { CustomerGender } from "./customerGender";
import { formatOrganizationTermsForPrompt } from "./formatOrganizationTermsForPrompt";

export interface GeminiOutgoingPromptInput {
  messageText: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  organizationName: string;
  organizationContext: string;
  organizationTerms?: OrganizationTermCategory[];
  agentGender: "" | "male" | "female";
  customerGender: CustomerGender;
}

export interface GeminiOutgoingPromptPayload {
  /** Full text that will be sent to Gemini (single user message for now). */
  prompt: string;
  metadata: {
    sourceLanguageCode: string;
    targetLanguageCode: string;
    organizationName: string;
    agentGender: string;
    customerGender: string;
    messageCharCount: number;
  };
}

function resolveAgentGender(gender: "" | "male" | "female"): "male" | "female" {
  return gender === "female" ? "female" : "male";
}

/**
 * Builds the complete Gemini request body text for outgoing agent messages.
 * Gemini should return only the translated message — no preamble.
 */
export function buildGeminiOutgoingPrompt(
  input: GeminiOutgoingPromptInput,
): GeminiOutgoingPromptPayload {
  const sourceLabel = languageLabel(input.sourceLanguageCode);
  const targetLabel = languageLabel(input.targetLanguageCode);
  const agentGender = resolveAgentGender(input.agentGender);
  const customerGender = input.customerGender;
  const orgContext = input.organizationContext.trim();
  const orgName = input.organizationName.trim() || "the company";
  const message = input.messageText.trim();

  const termsLine = formatOrganizationTermsForPrompt(
    input.organizationTerms ?? [],
  );
  const contextLines: string[] = [];
  if (orgContext) contextLines.push(`Company context: ${orgContext}`);
  if (termsLine) contextLines.push(termsLine);
  const contextBlock =
    contextLines.length > 0 ? `\n${contextLines.join("\n")}` : "";

  const prompt = `I am a ${agentGender} customer support agent at ${orgName}. I am writing to a ${customerGender} customer. Translate my reply from ${sourceLabel} (${input.sourceLanguageCode}) to ${targetLabel} (${input.targetLanguageCode}). Use correct grammar for the customer's gender and a natural everyday conversational tone that sounds fluent and human, while staying professional and avoiding overly formal, literary, or exaggerated wording.${contextBlock}

Message to translate:
${message}

=== OUTPUT RULES ===
- Return ONLY the translated message text.
- Do not add explanations, quotes, labels, or markdown.
- Do not include phrases like "Here is the translation" or repeat the instructions.`;

  return {
    prompt,
    metadata: {
      sourceLanguageCode: input.sourceLanguageCode,
      targetLanguageCode: input.targetLanguageCode,
      organizationName: orgName,
      agentGender,
      customerGender,
      messageCharCount: message.length,
    },
  };
}

export function isGeminiOutgoingDryRunEnabled(): boolean {
  const flag = process.env.GEMINI_OUTGOING_DRY_RUN?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}

/** Metadata + full prompt body (shared by live and dry-run logs). */
function logGeminiOutgoingPromptBody(payload: GeminiOutgoingPromptPayload): void {
  const divider = "=".repeat(72);
  console.log("[gemini-outgoing] metadata:", JSON.stringify(payload.metadata, null, 2));
  console.log(`${divider}\nPROMPT:\n${divider}`);
  console.log(payload.prompt);
}

/**
 * Full prompt log before a live Gemini call — same layout as the original dry-run log.
 */
export function logGeminiOutgoingPromptDetails(
  payload: GeminiOutgoingPromptPayload,
): void {
  const divider = "=".repeat(72);
  console.log(`\n${divider}`);
  console.log("[gemini-outgoing] sending prompt to Gemini (Vertex AI)");
  console.log(divider);
  logGeminiOutgoingPromptBody(payload);
  console.log(`${divider}\n[gemini-outgoing] END PROMPT\n`);
}

export function logGeminiOutgoingDryRun(payload: GeminiOutgoingPromptPayload): void {
  const divider = "=".repeat(72);
  console.log(`\n${divider}`);
  console.log("[gemini-outgoing] DRY RUN — request NOT sent to Gemini API");
  console.log(divider);
  logGeminiOutgoingPromptBody(payload);
  console.log(`${divider}\n[gemini-outgoing] END DRY RUN\n`);
}
