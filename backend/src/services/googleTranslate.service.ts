/**
 * Google Translate v3 integration — batched translate to a target language.
 *
 * Auth:
 *   Uses Application Default Credentials (ADC). Locally this means the
 *   developer has run `gcloud auth application-default login` once. In
 *   production this means a workload identity / metadata-server token.
 *   We never accept API keys or service-account JSON paths here.
 *
 * Project ID:
 *   Resolved ONCE at module init via `process.env.GOOGLE_CLOUD_PROJECT`
 *   if present, otherwise via `translationClient.getProjectId()` (which
 *   hits the metadata server). Cached in module scope so it does NOT run
 *   on every request — calling `getProjectId()` per request previously
 *   caused severe latency.
 *
 * Batching:
 *   One `translateText` call per backend request, with `contents` being
 *   the full array of source texts. Order is preserved.
 */

import { v3 } from "@google-cloud/translate";

const { TranslationServiceClient } = v3;

const DEFAULT_TARGET_LANGUAGE = "en";
const LOCATION = "global";

const translationClient = new TranslationServiceClient();

let cachedProjectId: string | null = null;
let cachedParent: string | null = null;
let projectIdSource: "env" | "adc" | null = null;
let projectIdReadyPromise: Promise<void> | null = null;

/**
 * Resolve the project ID once. Returns the same promise on repeated calls
 * so concurrent boot requests share a single resolution. Logs the source
 * (env vs ADC) and the resolved ID exactly once.
 */
export function ensureProjectIdResolved(): Promise<void> {
  if (cachedProjectId && cachedParent) return Promise.resolve();
  if (projectIdReadyPromise) return projectIdReadyPromise;

  projectIdReadyPromise = (async () => {
    const fromEnv = process.env.GOOGLE_CLOUD_PROJECT?.trim();
    if (fromEnv) {
      cachedProjectId = fromEnv;
      projectIdSource = "env";
      console.log(`[gtranslate] projectId source: env`);
    } else {
      console.log(
        `[gtranslate] projectId source: ADC (resolving via metadata)…`,
      );
      cachedProjectId = await translationClient.getProjectId();
      projectIdSource = "adc";
    }
    cachedParent = `projects/${cachedProjectId}/locations/${LOCATION}`;
    console.log(
      `[gtranslate] projectId resolved once: ${cachedProjectId} (parent=${cachedParent})`,
    );
  })().catch((err) => {
    projectIdReadyPromise = null;
    console.error("[gtranslate] failed to resolve projectId:", err);
    throw err;
  });

  return projectIdReadyPromise;
}

/**
 * Translate a batch of strings into `targetLanguageCode` (default `"en"`).
 *
 * Contract:
 *   - Returns an array the SAME LENGTH as `texts`, in the same order.
 *   - If Google returns fewer items than we asked for, missing slots are
 *     filled with the original text (never undefined).
 *   - On any thrown error we log it and fall back to returning the
 *     originals, so the extension keeps rendering (silently un-translated)
 *     rather than blanking out.
 */
export async function translateTexts(
  texts: string[],
  targetLanguageCode: string = DEFAULT_TARGET_LANGUAGE,
): Promise<string[]> {
  if (texts.length === 0) return [];

  try {
    await ensureProjectIdResolved();
  } catch (err) {
    console.error(
      "[gtranslate] cannot resolve projectId — falling back to originals:",
      err instanceof Error ? err.message : err,
    );
    return [...texts];
  }
  if (!cachedParent) {
    console.error("[gtranslate] parent missing after resolve — aborting");
    return [...texts];
  }

  const target = targetLanguageCode.trim() || DEFAULT_TARGET_LANGUAGE;
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  console.log(
    `[gtranslate] translate -> ${target} | texts=${texts.length} | chars=${totalChars} | projectIdSource=${projectIdSource}`,
  );

  const started = Date.now();
  try {
    const [response] = await translationClient.translateText({
      parent: cachedParent,
      contents: texts,
      mimeType: "text/plain",
      targetLanguageCode: target,
    });

    const durationMs = Date.now() - started;
    const items = response.translations ?? [];
    console.log(
      `[gtranslate] response | duration=${durationMs}ms | translations=${items.length}`,
    );

    return texts.map((original, i) => {
      const translated = items[i]?.translatedText;
      if (typeof translated === "string" && translated.length > 0) {
        return translated;
      }
      return original;
    });
  } catch (err) {
    const durationMs = Date.now() - started;
    console.error(
      `[gtranslate] translateText failed after ${durationMs}ms — falling back to originals:`,
      err,
    );
    return [...texts];
  }
}
