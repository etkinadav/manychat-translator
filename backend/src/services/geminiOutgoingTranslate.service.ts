import type { IUser } from "../models/user";
import type { IOrganization } from "../models/organization";
import { organizationDisplayName } from "../controllers/organization.helpers";
import { resolveLanguagePairFromProfile } from "./translateLanguagePair";
import { translateTexts } from "./googleTranslate.service";
import { generateWithGemini } from "./gemini.service";
import {
  buildGeminiOutgoingPrompt,
  isGeminiOutgoingDryRunEnabled,
  logGeminiOutgoingDryRun,
  logGeminiOutgoingPromptDetails,
  type GeminiOutgoingPromptPayload,
} from "./geminiOutgoingPrompt.service";

export interface GeminiOutgoingDryRunResult {
  dryRun: true;
  translations: string[];
  dryRunNote: string;
  promptPreview: GeminiOutgoingPromptPayload;
}

export interface GeminiOutgoingTranslateResult {
  translations: string[];
}

function buildOutgoingGeminiPayload(
  user: IUser,
  org: IOrganization,
  messageText: string,
): GeminiOutgoingPromptPayload {
  const { source, target } = resolveLanguagePairFromProfile({
    userLanguage: user.language || "en",
    orgLanguage: org.language,
    outgoing: true,
  });

  return buildGeminiOutgoingPrompt({
    messageText,
    sourceLanguageCode: source,
    targetLanguageCode: target,
    organizationName: organizationDisplayName(org),
    organizationContext: org.translationContext ?? "",
    agentGender: (user.gender || "") as "" | "male" | "female",
  });
}

/**
 * Phase 1 dry-run: build and log the Gemini prompt; do not call Gemini.
 */
export function runGeminiOutgoingDryRun(
  user: IUser,
  org: IOrganization,
  messageText: string,
): GeminiOutgoingDryRunResult {
  const payload = buildOutgoingGeminiPayload(user, org, messageText);

  if (isGeminiOutgoingDryRunEnabled()) {
    logGeminiOutgoingDryRun(payload);
  }

  return {
    dryRun: true,
    translations: [messageText],
    dryRunNote:
      "Gemini dry-run: full prompt logged in backend terminal. Textarea unchanged.",
    promptPreview: payload,
  };
}

/**
 * Outgoing path: log the same prompt, call Vertex AI Gemini, fallback to Google Translate.
 */
export async function runGeminiOutgoingTranslate(
  user: IUser,
  org: IOrganization,
  messageText: string,
): Promise<GeminiOutgoingTranslateResult> {
  const payload = buildOutgoingGeminiPayload(user, org, messageText);
  const { source, target } = resolveLanguagePairFromProfile({
    userLanguage: user.language || "en",
    orgLanguage: org.language,
    outgoing: true,
  });

  logGeminiOutgoingPromptDetails(payload);

  try {
    const translatedText = await generateWithGemini(payload.prompt);
    return { translations: [translatedText] };
  } catch (err) {
    console.error(
      "[gemini-outgoing] Gemini failed — falling back to Google Translate:",
      err instanceof Error ? err.message : err,
    );

    const fallback = await translateTexts([messageText], target, source);
    const translated = fallback[0] ?? messageText;
    console.log(
      `[gemini-outgoing] Google Translate fallback | ${source} -> ${target} | chars=${messageText.length}`,
    );
    return { translations: [translated] };
  }
}
