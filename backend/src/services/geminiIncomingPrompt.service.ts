import { languageLabel } from "../constants/languages";
import type { OrganizationTermCategory } from "../types/organizationTerms";
import type { CustomerGender } from "./customerGender";
import { formatOrganizationTermsForPrompt } from "./formatOrganizationTermsForPrompt";
import { othersRolePossessive } from "./othersRole";
import type { GeminiOutgoingPromptPayload } from "./geminiOutgoingPrompt.service";

export interface GeminiIncomingPromptInput {
  messageText: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  organizationName: string;
  organizationContext: string;
  organizationTerms?: OrganizationTermCategory[];
  agentGender: "" | "male" | "female";
  customerGender: CustomerGender;
  othersRole: string;
}

function resolveAgentGender(gender: "" | "male" | "female"): "male" | "female" {
  return gender === "female" ? "female" : "male";
}

/**
 * Incoming customer message → agent language (reverse of outgoing).
 */
export function buildGeminiIncomingPrompt(
  input: GeminiIncomingPromptInput,
): GeminiOutgoingPromptPayload {
  const sourceLabel = languageLabel(input.sourceLanguageCode);
  const targetLabel = languageLabel(input.targetLanguageCode);
  const agentGender = resolveAgentGender(input.agentGender);
  const customerGender = input.customerGender;
  const othersRole = input.othersRole.trim() || "customer";
  const othersPoss = othersRolePossessive(othersRole);
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

  const prompt = `I am a ${agentGender} customer support agent at ${orgName}. A ${customerGender} ${othersRole} sent me a message in ${sourceLabel} (${input.sourceLanguageCode}). Translate it to ${targetLabel} (${input.targetLanguageCode}) so I can read and reply. Use correct grammar for the ${othersPoss} gender and apply the business terms below when relevant.${contextBlock}

Message from the ${othersRole}:
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
      othersRole,
      messageCharCount: message.length,
    },
  };
}

export function logGeminiIncomingPromptDetails(
  payload: GeminiOutgoingPromptPayload,
): void {
  const divider = "=".repeat(72);
  console.log(`\n${divider}`);
  console.log("[gemini-incoming] sending prompt to Gemini (Vertex AI)");
  console.log(divider);
  console.log(
    "[gemini-incoming] metadata:",
    JSON.stringify(payload.metadata, null, 2),
  );
  console.log(`${divider}\nPROMPT:\n${divider}`);
  console.log(payload.prompt);
  console.log(`${divider}\n[gemini-incoming] END PROMPT\n`);
}
