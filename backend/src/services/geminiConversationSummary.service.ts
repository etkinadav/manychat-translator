import { languageLabel } from "../constants/languages";
import { formatOrganizationTermsForPrompt } from "./formatOrganizationTermsForPrompt";
import { generateWithGemini } from "./gemini.service";

export interface ConversationSummaryInput {
  transcript: string;
  organizationName: string;
  organizationContext: string;
  organizationTerms: unknown;
  agentLanguageCode: string;
  customerLanguageCode: string;
}

export function buildConversationSummaryPrompt(
  input: ConversationSummaryInput,
): string {
  const orgName = input.organizationName.trim() || "the company";
  const orgContext = input.organizationContext.trim();
  const agentLang = input.agentLanguageCode.trim() || "en";
  const agentLabel = languageLabel(agentLang);
  const customerLabel = languageLabel(input.customerLanguageCode);
  const termsLine = formatOrganizationTermsForPrompt(
    input.organizationTerms ?? [],
  );

  const contextLines: string[] = [];
  if (orgContext) contextLines.push(`Company context: ${orgContext}`);
  if (termsLine) contextLines.push(termsLine);
  const contextBlock =
    contextLines.length > 0 ? `\n${contextLines.join("\n")}\n` : "\n";

  return `You are helping a customer support agent at ${orgName}. Below is a chronological chat transcript (customer messages in ${customerLabel}, agent-side text in ${agentLabel}).${contextBlock}
Transcript (oldest to newest):
${input.transcript.trim()}

Write a concise conversation summary for the agent.

=== OUTPUT ===
Write exactly 3 short sentences in ${agentLabel} (${agentLang}) only:
1. What the customer wanted or asked about.
2. What solution or outcome was reached (if any).
3. Current status or next step (if any).

=== RULES ===
- Output only the 3 sentences — no headings, labels, bullet points, or extra text.
- Write entirely in ${agentLabel} (${agentLang}) so the agent can read it in their language.
- Do not include yes/no fields or metadata about agent involvement or phone contact.`;
}

/** Strip optional SUMMARY: label and trailing metadata if the model adds it anyway. */
export function formatConversationSummaryResponse(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^SUMMARY:\s*/i, "").trim();
  text = text
    .replace(/\n\s*AGENT INVOLVED:[\s\S]*/i, "")
    .replace(/\n\s*PHONE CONTACT:[\s\S]*/i, "")
    .trim();
  return text;
}

export async function summarizeConversation(
  input: ConversationSummaryInput,
): Promise<string> {
  const prompt = buildConversationSummaryPrompt(input);

  console.log("[gemini-conversation-summary] prompt length:", prompt.length);
  console.log("[gemini-conversation-summary] prompt:\n", prompt);

  const raw = await generateWithGemini(prompt);
  console.log("[gemini-conversation-summary] raw response:\n", raw);

  const formatted = formatConversationSummaryResponse(raw);
  console.log("[gemini-conversation-summary] formatted response:\n", formatted);

  return formatted;
}
