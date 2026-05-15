import { Router, type Request, type Response } from "express";
import type {
  ErrorResponse,
  TranslateRequest,
  TranslateResponse,
} from "../types";
import { translateTexts } from "../services/googleTranslate.service";

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

  const targetLanguage =
    typeof body?.targetLanguage === "string" && body.targetLanguage.trim()
      ? body.targetLanguage.trim()
      : "en";

  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  console.log(
    `[translate] request received | targetLanguage=${targetLanguage} | count=${texts.length} | chars=${totalChars} | first=${JSON.stringify(
      texts[0] ?? "",
    )}`,
  );

  try {
    const translations = await translateTexts(texts, targetLanguage);
    console.log(`[translate] response sent  | count=${translations.length}`);
    return res.json({ translations });
  } catch (err) {
    // Defensive: `translateTexts` already swallows internal errors and
    // returns originals, so reaching here means something truly unexpected
    // happened. Still degrade gracefully: return originals + 200 so the
    // extension keeps rendering instead of showing "translation failed".
    console.error("[translate] unexpected error — returning originals:", err);
    return res.json({ translations: texts });
  }
});

export default router;
