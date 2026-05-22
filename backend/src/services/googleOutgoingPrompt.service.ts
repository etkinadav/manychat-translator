import { languageLabel } from "../constants/languages";
import type { CustomerGender } from "./customerGender";

function resolveAgentGender(
  gender: "" | "male" | "female",
): "male" | "female" {
  return gender === "female" ? "female" : "male";
}

/**
 * Google outgoing — English-only instructions, colon before the user message.
 */
export function buildGoogleOutgoingPrompt(
  messageText: string,
  targetLanguageCode: string,
  agentGender: "" | "male" | "female",
  customerGender: CustomerGender,
): string {
  const targetLabel = languageLabel(targetLanguageCode);
  const agent = resolveAgentGender(agentGender);
  const customer = customerGender;
  const body = messageText.trim();

  const agentClause =
    agent === "female"
      ? "The writer is a female agent. Use feminine first person in Hebrew (e.g. representative as female, can-help as female)."
      : "The writer is a male agent. Use masculine first person in Hebrew.";

  const customerClause =
    customer === "female"
      ? "The reader is one female customer. Use singular informal your, not plural."
      : "The reader is one male customer. Use singular informal your, not plural.";

  return `Translate to ${targetLabel}. ${agentClause} ${customerClause} Message: ${body}`;
}
