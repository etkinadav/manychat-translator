import type { IUser } from "../models/user";
import type { IOrganization } from "../models/organization";
import { organizationDisplayName } from "../controllers/organization.helpers";
import { resolveLanguagePairFromProfile } from "./translateLanguagePair";
import {
  buildGeminiOutgoingPrompt,
  isGeminiOutgoingDryRunEnabled,
  logGeminiOutgoingDryRun,
  type GeminiOutgoingPromptPayload,
} from "./geminiOutgoingPrompt.service";

export interface GeminiOutgoingDryRunResult {
  dryRun: true;
  translations: string[];
  dryRunNote: string;
  promptPreview: GeminiOutgoingPromptPayload;
}

/**
 * Phase 1: build and log the Gemini prompt; do not call Gemini yet.
 * Returns original text unchanged with dryRun flag for the client.
 */
export function runGeminiOutgoingDryRun(
  user: IUser,
  org: IOrganization,
  messageText: string,
): GeminiOutgoingDryRunResult {
  const { source, target } = resolveLanguagePairFromProfile({
    userLanguage: user.language || "en",
    orgLanguage: org.language,
    outgoing: true,
  });

  const payload = buildGeminiOutgoingPrompt({
    messageText,
    sourceLanguageCode: source,
    targetLanguageCode: target,
    organizationName: organizationDisplayName(org),
    organizationContext: org.translationContext ?? "",
    agentGender: (user.gender || "") as "" | "male" | "female",
  });

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
