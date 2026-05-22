import type { Response } from "express";
import type { AuthRequest } from "../middleware/check-auth";
import type {
  ErrorResponse,
  TranslateRequest,
  TranslateResponse,
} from "../types";
import {
  isTranslationConfigError,
  isTranslationFatalError,
  translateTexts,
} from "../services/googleTranslate.service";
import { parseCustomerGender } from "../services/customerGender";
import { isGeminiOutgoingDryRunEnabled } from "../services/geminiOutgoingPrompt.service";
import { runGeminiIncomingTranslate } from "../services/geminiIncomingTranslate.service";
import {
  runGeminiOutgoingDryRun,
  runGeminiOutgoingTranslate,
} from "../services/geminiOutgoingTranslate.service";
import { summarizeConversation } from "../services/geminiConversationSummary.service";
import { detectSubscriberNameGender } from "../services/geminiNameGender.service";
import { cleanOutgoingTranslation } from "../services/outgoingPromptCleanup.service";
import { organizationDisplayName } from "./organization.helpers";
import { resolveLanguagePairFromProfile } from "../services/translateLanguagePair";
import { resolveTranslateOrganizationContext } from "./translateOrganizationContext";

/**
 * POST /api/translate — requires JWT; languages from user + organization.
 * Incoming chat batch → Google Translate; per-message AI → Gemini (incomingGemini).
 * Outgoing composer → Vertex AI Gemini (optional dry-run via GEMINI_OUTGOING_DRY_RUN=true).
 */
export async function translateBatch(
  req: AuthRequest,
  res: Response<TranslateResponse | ErrorResponse>,
): Promise<void> {
  const body = req.body as TranslateRequest | undefined;

  if (body?.nameGender === true) {
    const subscriberName = String(
      body.subscriberName ?? body.texts?.[0] ?? "",
    ).trim();
    if (!subscriberName) {
      res.status(400).json({ error: "subscriberName is required." });
      return;
    }

    try {
      const ctx = await resolveTranslateOrganizationContext(req, res);
      if (!ctx) return;

      const { user, org } = ctx;
      console.log(
        `[translate] name-gender | user=${String(user._id)} org=${String(org._id)} | lang=${org.language} | name=${subscriberName}`,
      );

      const agentLanguage = String(
        body.agentLanguage ?? user.language ?? org.language,
      ).trim();

      const { translatedName, nameGender } = await detectSubscriberNameGender(
        subscriberName,
        org.language,
        agentLanguage || "en",
      );
      res.status(200).json({ translations: [], nameGender, translatedName });
    } catch (err) {
      console.error("[translate] name-gender failed:", err);
      res.status(503).json({
        error:
          err instanceof Error ? err.message : "Name gender detection failed",
      });
    }
    return;
  }

  if (body?.conversationSummary === true) {
    const transcript = String(body.conversationTranscript ?? "").trim();
    if (!transcript) {
      res.status(400).json({ error: "conversationTranscript is required." });
      return;
    }

    try {
      const ctx = await resolveTranslateOrganizationContext(req, res);
      if (!ctx) return;

      const { user, org } = ctx;
      const { source: customerLang, target: agentLang } =
        resolveLanguagePairFromProfile({
          userLanguage: user.language || "en",
          orgLanguage: org.language,
          outgoing: false,
        });

      console.log(
        `[translate] conversation-summary | user=${String(user._id)} org=${String(org._id)} | chars=${transcript.length}`,
      );

      const summary = await summarizeConversation({
        transcript,
        organizationName: organizationDisplayName(org),
        organizationContext: org.translationContext ?? "",
        organizationTerms: Array.isArray(org.terms) ? org.terms : [],
        agentLanguageCode: agentLang,
        customerLanguageCode: customerLang,
      });

      res.status(200).json({ translations: [], conversationSummary: summary });
    } catch (err) {
      console.error("[translate] conversation-summary failed:", err);
      res.status(503).json({
        error:
          err instanceof Error ? err.message : "Conversation summary failed",
      });
    }
    return;
  }

  const texts = body?.texts;

  if (!Array.isArray(texts)) {
    console.warn("[translate] rejected: body.texts is not an array");
    res
      .status(400)
      .json({ error: "Request body must be { texts: string[] }." });
    return;
  }
  if (texts.some((t) => typeof t !== "string")) {
    console.warn("[translate] rejected: body.texts contains non-string entries");
    res
      .status(400)
      .json({ error: "Every entry in `texts` must be a string." });
    return;
  }

  try {
    const ctx = await resolveTranslateOrganizationContext(req, res);
    if (!ctx) return;
    const { user, org } = ctx;

    if (body?.outgoingGoogle === true || body?.outgoing === true) {
      if (texts.length !== 1) {
        res.status(400).json({
          error: "Outgoing translation supports exactly one message at a time.",
        });
        return;
      }

      const messageText = texts[0] ?? "";
      if (!messageText.trim()) {
        res.status(400).json({ error: "Message text is empty." });
        return;
      }

      if (body.outgoingGoogle === true) {
        const { source: sourceLanguage, target: targetLanguage } =
          resolveLanguagePairFromProfile({
            userLanguage: user.language || "en",
            orgLanguage: org.language,
            outgoing: true,
          });

        console.log(
          `[translate] outgoing-google | user=${String(user._id)} org=${String(org._id)} | ${sourceLanguage} -> ${targetLanguage} | chars=${messageText.length}`,
        );

        const raw = await translateTexts(
          [messageText],
          targetLanguage,
          sourceLanguage,
        );
        const translated = cleanOutgoingTranslation(raw[0] ?? messageText);
        res.status(200).json({ translations: [translated] });
        return;
      }

      const customerGender = parseCustomerGender(body?.customerGender);

      if (isGeminiOutgoingDryRunEnabled()) {
        const dryRunResult = runGeminiOutgoingDryRun(
          user,
          org,
          messageText,
          customerGender,
        );
        res.status(200).json({
          translations: dryRunResult.translations,
          dryRun: true,
          dryRunNote: dryRunResult.dryRunNote,
          geminiPrompt: dryRunResult.promptPreview.prompt,
        });
        return;
      }

      console.log(
        `[translate] outgoing | user=${String(user._id)} org=${String(org._id)} | Gemini | customer=${customerGender} | chars=${messageText.length}`,
      );

      const geminiResult = await runGeminiOutgoingTranslate(
        user,
        org,
        messageText,
        customerGender,
      );
      res.status(200).json({
        translations: geminiResult.translations,
        geminiPrompt: geminiResult.geminiPrompt,
      });
      return;
    }

    if (body?.incomingGemini === true) {
      if (texts.length !== 1) {
        res.status(400).json({
          error: "Incoming Gemini translation supports exactly one message at a time.",
        });
        return;
      }

      const messageText = texts[0] ?? "";
      if (!messageText.trim()) {
        res.status(400).json({ error: "Message text is empty." });
        return;
      }

      const customerGender = parseCustomerGender(body?.customerGender);
      console.log(
        `[translate] incoming-gemini | user=${String(user._id)} org=${String(org._id)} | customer=${customerGender} | chars=${messageText.length}`,
      );

      const geminiResult = await runGeminiIncomingTranslate(
        user,
        org,
        messageText,
        customerGender,
      );
      res.status(200).json({
        translations: geminiResult.translations,
        geminiPrompt: geminiResult.geminiPrompt,
      });
      return;
    }

    const { source: sourceLanguage, target: targetLanguage } =
      resolveLanguagePairFromProfile({
        userLanguage: user.language || "en",
        orgLanguage: org.language,
        outgoing: false,
      });

    const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
    console.log(
      `[translate] incoming | user=${String(user._id)} org=${String(org._id)} | Google | ${sourceLanguage} -> ${targetLanguage} | count=${texts.length} | chars=${totalChars}`,
    );

    const translations = await translateTexts(
      texts,
      targetLanguage,
      sourceLanguage,
    );
    res.json({ translations });
  } catch (err) {
    if (isTranslationFatalError(err)) {
      console.error("[translate] Google Translate failed:", err);
      const message = isTranslationConfigError(err)
        ? "Google Translate project misconfigured. Set GOOGLE_CLOUD_PROJECT in backend/.env."
        : "Google Translate authentication failed. Run: gcloud auth application-default login";
      res.status(503).json({ error: message });
      return;
    }
    console.error("[translate] unexpected error — returning originals:", err);
    res.json({ translations: texts });
  }
}
