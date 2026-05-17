/**
 * Vertex AI Gemini — outgoing translation only.
 * Receives the final prompt string; does not build instructions.
 *
 * Auth: Application Default Credentials (gcloud auth application-default login).
 */

import { VertexAI } from "@google-cloud/vertexai";

const MODEL_NAME = "gemini-2.5-flash";

function projectId(): string {
  const id = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (!id || id === "your-gcp-project-id") {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT is missing or invalid. Set it in backend/.env.",
    );
  }
  return id;
}

function locationId(): string {
  return process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1";
}

let vertexAI: VertexAI | null = null;
let generativeModel: ReturnType<VertexAI["getGenerativeModel"]> | null = null;

function getGenerativeModel(): ReturnType<VertexAI["getGenerativeModel"]> {
  if (!generativeModel) {
    const project = projectId();
    const location = locationId();
    vertexAI = new VertexAI({ project, location });
    generativeModel = vertexAI.getGenerativeModel({ model: MODEL_NAME });
  }
  return generativeModel;
}

function extractResponseText(
  parts: { text?: string }[] | undefined,
): string {
  if (!parts?.length) {
    throw new Error("Gemini response has no content parts");
  }
  const text = parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new Error("Gemini response text is empty");
  }
  return text;
}

/**
 * Send a pre-built prompt to Gemini and return generated text only.
 */
export async function generateWithGemini(prompt: string): Promise<string> {
  const project = projectId();
  const location = locationId();
  const model = getGenerativeModel();
  const promptLength = prompt.length;

  console.log("[gemini] request started", {
    model: MODEL_NAME,
    project,
    location,
    promptLength,
  });

  const started = Date.now();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const durationMs = Date.now() - started;
  const candidate = result.response?.candidates?.[0];
  const translatedText = extractResponseText(candidate?.content?.parts);

  console.log("[gemini] response received", {
    durationMs,
    textLength: translatedText.length,
  });
  console.log("[gemini] translated text:", translatedText);

  return translatedText;
}
