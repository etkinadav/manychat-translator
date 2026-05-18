import type { Response } from "express";
import { User } from "../models/user";
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
import { resolveLanguagePairFromProfile } from "../services/translateLanguagePair";
import { resolveOrganizationField } from "./organization.helpers";

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
    const user = await User.findById(req.userData!.userId);
    if (!user) {
      res.status(404).json({ error: "User_not_found" });
      return;
    }

    const org = await resolveOrganizationField(user.organization);
    if (!org) {
      res.status(403).json({
        error:
          "No organization connected. Connect to an organization in Configuration first.",
      });
      return;
    }

    if (body?.outgoing === true) {
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
