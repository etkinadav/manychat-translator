/**
 * One-off: create a sample organization (password is hashed on save).
 *
 * Usage (from backend/):
 *   npx ts-node --transpile-only scripts/seed-organization.ts
 */
import "dotenv/config";
import { connectMongo } from "../src/db/mongoose";
import { Organization } from "../src/models/organization";

async function main(): Promise<void> {
  await connectMongo();

  const language = process.env.SEED_ORG_LANGUAGE?.trim() || "he";
  const password = process.env.SEED_ORG_PASSWORD?.trim() || "org-demo-password";
  const translationContext =
    process.env.SEED_ORG_CONTEXT?.trim() ||
    "Formal customer support tone. Keep replies concise.";

  const org = new Organization({
    language,
    translationContext,
    password,
  });
  await org.save();

  console.log("[seed] organization created:", {
    id: org._id,
    language: org.language,
    passwordHint: password,
  });
  process.exit(0);
}

void main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
