import { languageLabel } from "../constants/languages";

export interface GeminiOutgoingPromptInput {
  messageText: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  organizationName: string;
  organizationContext: string;
  agentGender: "" | "male" | "female";
}

export interface GeminiOutgoingPromptPayload {
  /** Full text that will be sent to Gemini (single user message for now). */
  prompt: string;
  metadata: {
    sourceLanguageCode: string;
    targetLanguageCode: string;
    organizationName: string;
    agentGender: string;
    messageCharCount: number;
  };
}

function formatAgentGender(gender: "" | "male" | "female"): string {
  if (gender === "male") return "male";
  if (gender === "female") return "female";
  return "not specified (use neutral professional tone)";
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
  const genderText = formatAgentGender(input.agentGender);
  const orgContext = input.organizationContext.trim() || "(none provided)";
  const orgName = input.organizationName.trim() || "Organization";

  const prompt = `You are a professional translation assistant for a customer support agent who replies to customers via Manychat.

=== ORGANIZATION ===
Name: ${orgName}

Organization context (tone, terminology, domain, style guidelines):
${orgContext}

=== AGENT (the person writing the outgoing message) ===
- Writes in: ${sourceLabel} (language code: ${input.sourceLanguageCode})
- Gender (for grammatical tone in the target language): ${genderText}

=== TRANSLATION TASK ===
Translate the agent's outgoing reply from ${sourceLabel} (${input.sourceLanguageCode}) to ${targetLabel} (${input.targetLanguageCode}).
Apply the organization context above for tone, terminology, and style.
The translated text will be sent directly to a customer — it must read naturally in ${targetLabel}.

=== OUTPUT RULES ===
- Return ONLY the translated message text.
- Do not add explanations, quotes, labels, or markdown.
- Do not include phrases like "Here is the translation" or repeat the instructions.

=== MESSAGE TO TRANSLATE ===
${input.messageText.trim()}`;

  return {
    prompt,
    metadata: {
      sourceLanguageCode: input.sourceLanguageCode,
      targetLanguageCode: input.targetLanguageCode,
      organizationName: orgName,
      agentGender: genderText,
      messageCharCount: input.messageText.trim().length,
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
