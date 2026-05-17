import { Router, type Request, type Response } from "express";
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

const router = Router();

/**
 * POST /api/translate
 *
 * Translates an array of Hebrew (or any source-language) strings into
 * English using Google Translate v3. ONE batched Google call per HTTP
 * request, regardless of how many texts are in the batch.
 *
 * Response contract:
 *   - `translations` is always the same length as `texts`, same order.
 *   - On Google failure, `translations[i]` falls back to `texts[i]` and
 *     we still return 200 (the extension keeps rendering originals).
 *   - We only return 4xx for malformed *requests*, not translation errors.
 */
router.post<
  "/",
  Record<string, never>,
  TranslateResponse | ErrorResponse,
  TranslateRequest
>("/", async (req: Request, res: Response) => {
  const body = req.body as TranslateRequest | undefined;
  const texts = body?.texts;

  if (!Array.isArray(texts)) {
    console.warn("[translate] rejected: body.texts is not an array");
    return res
      .status(400)
      .json({ error: "Request body must be { texts: string[] }." });
  }
  if (texts.some((t) => typeof t !== "string")) {
    console.warn("[translate] rejected: body.texts contains non-string entries");
    return res
      .status(400)
      .json({ error: "Every entry in `texts` must be a string." });
  }

  const defaultTarget =
    process.env.TRANSLATE_TARGET_LANGUAGE?.trim() || "en";
  const targetLanguage =
    typeof body?.targetLanguage === "string" && body.targetLanguage.trim()
      ? body.targetLanguage.trim()
      : defaultTarget;

  const defaultSource = process.env.TRANSLATE_SOURCE_LANGUAGE?.trim();
  const sourceLanguage =
    typeof body?.sourceLanguage === "string" && body.sourceLanguage.trim()
      ? body.sourceLanguage.trim()
      : defaultSource || undefined;

  const stripInstructionPrefix = body?.stripInstructionPrefix === true;

  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  console.log(
    `[translate] request received | sourceLanguage=${sourceLanguage ?? "auto"} | targetLanguage=${targetLanguage} | stripInstructionPrefix=${stripInstructionPrefix} | count=${texts.length} | chars=${totalChars} | first=${JSON.stringify(
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
    return res.json({ translations });
  } catch (err) {
    if (isTranslationFatalError(err)) {
      console.error("[translate] Google Translate failed:", err);
      const message = isTranslationConfigError(err)
        ? "Google Translate project misconfigured. Set GOOGLE_CLOUD_PROJECT in backend/.env to your real GCP project ID (not your-gcp-project-id)."
        : "Google Translate authentication failed. Run: gcloud auth application-default login";
      return res.status(503).json({ error: message });
    }
    console.error("[translate] unexpected error — returning originals:", err);
    return res.json({ translations: texts });
  }
});

export default router;
