import type { IUser } from "../models/user";
import type { IOrganization } from "../models/organization";
import { organizationDisplayName } from "../controllers/organization.helpers";
import { resolveLanguagePairFromProfile } from "./translateLanguagePair";
import { translateTexts } from "./googleTranslate.service";
import { generateWithGemini } from "./gemini.service";
import type { CustomerGender } from "./customerGender";
import {
  buildGeminiIncomingPrompt,
  logGeminiIncomingPromptDetails,
} from "./geminiIncomingPrompt.service";

export interface GeminiIncomingTranslateResult {
  translations: string[];
  geminiPrompt: string;
}

export async function runGeminiIncomingTranslate(
  user: IUser,
  org: IOrganization,
  messageText: string,
  customerGender: CustomerGender,
  othersRole: string,
): Promise<GeminiIncomingTranslateResult> {
  const { source, target } = resolveLanguagePairFromProfile({
    userLanguage: user.language || "en",
    orgLanguage: org.language,
    outgoing: false,
  });

  const payload = buildGeminiIncomingPrompt({
    messageText,
    sourceLanguageCode: source,
    targetLanguageCode: target,
    organizationName: organizationDisplayName(org),
    organizationContext: org.translationContext ?? "",
    organizationTerms: Array.isArray(org.terms) ? org.terms : [],
    agentGender: (user.gender || "") as "" | "male" | "female",
    customerGender,
    othersRole,
  });

  logGeminiIncomingPromptDetails(payload);

  try {
    const translatedText = await generateWithGemini(payload.prompt);
    return { translations: [translatedText], geminiPrompt: payload.prompt };
  } catch (err) {
    console.error(
      "[gemini-incoming] Gemini failed — falling back to Google Translate:",
      err instanceof Error ? err.message : err,
    );

    const fallback = await translateTexts([messageText], target, source);
    const translated = fallback[0] ?? messageText;
    console.log(
      `[gemini-incoming] Google Translate fallback | ${source} -> ${target} | chars=${messageText.length}`,
    );
    return { translations: [translated], geminiPrompt: payload.prompt };
  }
}
