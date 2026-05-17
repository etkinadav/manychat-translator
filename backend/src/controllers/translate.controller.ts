import type { Request, Response } from "express";
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
import { cleanOutgoingTranslation } from "../services/outgoingPromptCleanup.service";
import { resolveLanguagePair } from "../services/translateLanguagePair";

/**
 * POST /api/translate
 *
 * Translates an array of strings in one batched Google call per HTTP request.
 */
export async function translateBatch(
  req: Request,
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

  const { source: sourceLanguage, target: targetLanguage } = resolveLanguagePair({
    outgoing: body?.outgoing === true,
    sourceLanguage:
      typeof body?.sourceLanguage === "string" ? body.sourceLanguage : undefined,
    targetLanguage:
      typeof body?.targetLanguage === "string" ? body.targetLanguage : undefined,
  });

  const stripInstructionPrefix = body?.stripInstructionPrefix === true;

  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  console.log(
    `[translate] request received | outgoing=${body?.outgoing === true} | ${sourceLanguage} -> ${targetLanguage} | stripInstructionPrefix=${stripInstructionPrefix} | count=${texts.length} | chars=${totalChars} | first=${JSON.stringify(
      texts[0] ?? "",
    )}`,
  );

  try {
    let translations = await translateTexts(
      texts,
      targetLanguage,
      sourceLanguage,
    );
    if (stripInstructionPrefix) {
      translations = translations.map((raw) => cleanOutgoingTranslation(raw));
      console.log(
        `[translate] prompt cleaning applied to ${translations.length} result(s)`,
      );
    }
    console.log(`[translate] response sent  | count=${translations.length}`);
    res.json({ translations });
  } catch (err) {
    if (isTranslationFatalError(err)) {
      console.error("[translate] Google Translate failed:", err);
      const message = isTranslationConfigError(err)
        ? "Google Translate project misconfigured. Set GOOGLE_CLOUD_PROJECT in backend/.env to your real GCP project ID (not your-gcp-project-id)."
        : "Google Translate authentication failed. Run: gcloud auth application-default login";
      res.status(503).json({ error: message });
      return;
    }
    console.error("[translate] unexpected error — returning originals:", err);
    res.json({ translations: texts });
  }
}
