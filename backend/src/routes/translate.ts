import { Router, type Request, type Response } from "express";
import type {
  ErrorResponse,
  TranslateRequest,
  TranslateResponse,
} from "../types";

const router = Router();

/**
 * POST /api/translate
 *
 * Stage-1 behavior: echo each input back with `from back: ` prepended.
 *
 * Stage-2 (future): this is where we'll plug in Google Translate or an
 * LLM call. The function signature, request shape, and response shape are
 * already final — only the inner mapping changes.
 */
router.post<
  "/",
  Record<string, never>,
  TranslateResponse | ErrorResponse,
  TranslateRequest
>("/", (req: Request, res: Response) => {
  const body = req.body as TranslateRequest | undefined;
  const texts = body?.texts;

  if (!Array.isArray(texts)) {
    console.warn("[translate] rejected: body.texts is not an array");
    return res.status(400).json({
      error: "Request body must be { texts: string[] }.",
    });
  }
  if (texts.some((t) => typeof t !== "string")) {
    console.warn("[translate] rejected: body.texts contains non-string entries");
    return res.status(400).json({
      error: "Every entry in `texts` must be a string.",
    });
  }

  console.log(
    `[translate] request received | count=${texts.length} | first=${JSON.stringify(
      texts[0] ?? "",
    )}`,
  );

  // ─── FUTURE TRANSLATION HOOK ────────────────────────────────────────────
  // Replace this map with a call to Google Translate / OpenAI / etc.
  // The rest of the pipeline (validation, logging, CORS, error handling)
  // can stay exactly as it is.
  const translations = texts.map((t) => `from back: ${t}`);
  // ────────────────────────────────────────────────────────────────────────

  const payload: TranslateResponse = { translations };
  console.log(`[translate] response sent  | count=${translations.length}`);
  return res.json(payload);
});

export default router;
