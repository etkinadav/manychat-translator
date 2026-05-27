/** Label for the non-agent party in Gemini prompts (e.g. customer, subscriber). */

export const DEFAULT_OTHERS_ROLE = "customer";

export function normalizeOthersRole(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return DEFAULT_OTHERS_ROLE;
  return trimmed.slice(0, 48);
}

/** English possessive for prompt text: "customer" → "customer's". */
export function othersRolePossessive(role: string): string {
  const r = normalizeOthersRole(role);
  if (r.endsWith("s")) return `${r}'`;
  return `${r}'s`;
}
