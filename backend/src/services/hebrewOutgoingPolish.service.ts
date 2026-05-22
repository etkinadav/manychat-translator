import type { CustomerGender } from "./customerGender";

type AgentGender = "male" | "female";

/** Singular informal addressee (שלכם → שלך). */
function polishCustomerSingular(
  text: string,
  customerGender: CustomerGender,
): string {
  if (customerGender === "female") {
    return text
      .replace(/שלכן/g, "שלך")
      .replace(/אליכן/g, "אליך")
      .replace(/אתכן/g, "אותך")
      .replace(/לכן(?=\s|[?.!,]|$)/gu, "לך")
      .replace(/בכן(?=\s|[?.!,]|$)/gu, "בך");
  }
  return text
    .replace(/שלכם/g, "שלך")
    .replace(/אליכם/g, "אליך")
    .replace(/אתכם/g, "אותך")
    .replace(/לכם(?=\s|[?.!,]|$)/gu, "לך")
    .replace(/בכם(?=\s|[?.!,]|$)/gu, "בך");
}

/** Agent first-person gender (נציגה, יכולה) when Google defaults to masculine. */
function polishAgentGender(text: string, agentGender: AgentGender): string {
  if (agentGender === "female") {
    return text
      .replace(/הנציג(?=[\s,.?!:]|$)/gu, "הנציגה")
      .replace(/אני יכול(?=[\s,.?!]|$)/gu, "אני יכולה")
      .replace(/איך אני יכול(?=[\s,.?!]|$)/gu, "איך אני יכולה")
      .replace(/אני מבין(?=[\s,.?!]|$)/gu, "אני מבינה")
      .replace(/יכול לעזור/g, "יכולה לעזור")
      .replace(/אשמח לעזור/g, "אשמח לעזור");
  }
  return text
    .replace(/הנציגה(?=[\s,.?!:]|$)/gu, "הנציג")
    .replace(/אני יכולה(?=[\s,.?!]|$)/gu, "אני יכול")
    .replace(/איך אני יכולה(?=[\s,.?!]|$)/gu, "איך אני יכול")
    .replace(/אני מבינה(?=[\s,.?!]|$)/gu, "אני מבין")
    .replace(/יכולה לעזור/g, "יכול לעזור");
}

/**
 * Post-process Hebrew Google outgoing: singular customer + agent gender forms.
 */
export function polishHebrewOutgoingTranslation(
  text: string,
  targetLanguageCode: string,
  customerGender: CustomerGender,
  agentGender: AgentGender,
): string {
  if (targetLanguageCode.trim().toLowerCase() !== "he") return text;
  if (!/[\u0590-\u05FF]/.test(text)) return text;

  const afterCustomer = polishCustomerSingular(text, customerGender);
  const result = polishAgentGender(afterCustomer, agentGender);

  if (result !== text) {
    console.log(
      `[polish] Hebrew outgoing | agent=${agentGender} customer=${customerGender} | before=${JSON.stringify(text.slice(0, 80))} | after=${JSON.stringify(result.slice(0, 80))}`,
    );
  }

  return result;
}
