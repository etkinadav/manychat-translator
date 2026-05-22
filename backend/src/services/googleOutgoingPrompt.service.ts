import { languageLabel } from "../constants/languages";
import type { CustomerGender } from "./customerGender";

function resolveAgentGender(
  gender: "" | "male" | "female",
): "male" | "female" {
  return gender === "female" ? "female" : "male";
}

/**
 * Google outgoing — English-only instructions, colon before the user message.
 *
 * Hebrew hints inside the prompt get translated and echoed in the output.
 * `cleanOutgoingTranslation` strips the instruction block after translation.
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

  return `Translate to ${targetLabel}. I am a ${agent} agent writing to a ${customer} customer: ${body}`;
}
