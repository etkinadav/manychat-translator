import { languageLabel } from "../constants/languages";
import { formatOrganizationTermsForPrompt } from "./formatOrganizationTermsForPrompt";
import { generateWithGemini } from "./gemini.service";

export interface ConversationSummaryInput {
  transcript: string;
  organizationName: string;
  organizationContext: string;
  organizationTerms: unknown;
  organizationLanguageCode: string;
  agentLanguageCode: string;
  customerLanguageCode: string;
}

export function buildConversationSummaryPrompt(
  input: ConversationSummaryInput,
): string {
  const orgName = input.organizationName.trim() || "the company";
  const orgContext = input.organizationContext.trim();
  const orgLang = input.organizationLanguageCode.trim() || "he";
  const orgLabel = languageLabel(orgLang);
  const termsLine = formatOrganizationTermsForPrompt(
    input.organizationTerms ?? [],
  );
  const agentLabel = languageLabel(input.agentLanguageCode);
  const customerLabel = languageLabel(input.customerLanguageCode);

  const contextLines: string[] = [];
  if (orgContext) contextLines.push(`Company context: ${orgContext}`);
  if (termsLine) contextLines.push(termsLine);
  const contextBlock =
    contextLines.length > 0 ? `\n${contextLines.join("\n")}\n` : "\n";

  return `You are helping a customer support team at ${orgName}. Below is a chronological chat transcript (customer messages in ${customerLabel}, agent-side text in ${agentLabel}).${contextBlock}
Transcript (oldest to newest):
${input.transcript.trim()}

Write a concise summary for the support agent.

=== REQUIRED OUTPUT FORMAT ===
SUMMARY:
<Exactly 3 sentences in ${orgLabel} (${orgLang}) only: (1) what the customer wanted, (2) what solution or outcome was reached, (3) current status or next step if any.>

AGENT INVOLVED:
<yes or no — was a human support agent actively involved in this conversation?>

PHONE CONTACT:
<yes or no — does the transcript indicate the agent contacted the customer by phone?>

=== OUTPUT RULES ===
- The SUMMARY section must be written entirely in ${orgLabel} (${orgLang}).
- Use the exact English labels SUMMARY:, AGENT INVOLVED:, PHONE CONTACT: as shown (do not translate these labels).
- Under AGENT INVOLVED and PHONE CONTACT write only "yes" or "no" (lowercase English).
- Do not add other sections, markdown, or extra text.`;
}

function extractSection(raw: string, label: string): string {
  const pattern = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z ]+:|$)`,
    "i",
  );
  const match = raw.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function parseYesNo(value: string): "yes" | "no" | null {
  const v = value.trim().toLowerCase().replace(/[.!]/g, "");
  if (v === "yes" || v === "no") return v;
  if (/\byes\b/.test(v) && !/\bno\b/.test(v)) return "yes";
  if (/\bno\b/.test(v) && !/\byes\b/.test(v)) return "no";
  return null;
}

/** Normalize Gemini output to a fixed layout with English yes/no lines at the end. */
export function formatConversationSummaryResponse(raw: string): string {
  const summaryBody = extractSection(raw, "SUMMARY");
  const agentRaw = extractSection(raw, "AGENT INVOLVED");
  const phoneRaw = extractSection(raw, "PHONE CONTACT");

  const agentInvolved = parseYesNo(agentRaw) ?? "no";
  const phoneContact = parseYesNo(phoneRaw) ?? "no";

  const summaryText =
    summaryBody ||
    raw
      .replace(/AGENT INVOLVED:[\s\S]*/i, "")
      .replace(/PHONE CONTACT:[\s\S]*/i, "")
      .replace(/^SUMMARY:\s*/i, "")
      .trim();

  return `${summaryText}\n\nAGENT INVOLVED: ${agentInvolved}\nPHONE CONTACT: ${phoneContact}`;
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
