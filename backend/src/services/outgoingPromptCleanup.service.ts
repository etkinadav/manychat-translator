/**
 * Strips translated instruction headers from outgoing composer responses.
 *
 * The extension sends prompts like:
 *   "Translate to Hebrew. The speaker is female:\nI understand"
 *
 * Google often echoes the instruction in Hebrew before the real message:
 *   "תרגם לעברית. הדוברת היא אישה:\nאני מבינה"
 *
 * This module returns only the user-facing sentence(s).
 */

/** Lines that are instruction/meta, not the message body. */
const INSTRUCTION_LINE_PATTERNS: RegExp[] = [
  /^translate\s+to\s+hebrew/i,
  /^תרגם\s+לעברית/i,
  /the\s+speaker\s+is\s+(female|male|a\s+woman|a\s+man)/i,
  /speaker\s+is\s+(female|male)/i,
  /^הדוברת\s+היא\s+אישה/i,
  /^הדובר\s+הוא\s+גבר/i,
  /^הדובר(ת)?\s+היא?\s+/i,
  /^תרגם\s+/i,
  /^[-─—\s]+$/,
];

function isInstructionLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  return INSTRUCTION_LINE_PATTERNS.some((p) => p.test(t));
}

function looksLikeInstructionPrefix(segment: string): boolean {
  return /translate|תרגם|speaker|דובר/i.test(segment);
}

/**
 * Remove translated instruction prefixes from a single Google response string.
 * Falls back to the raw string if nothing usable remains.
 */
export function cleanOutgoingTranslation(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // Multi-line: keep only non-instruction lines.
  if (/\r?\n/.test(trimmed)) {
    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const kept = lines.filter((l) => !isInstructionLine(l));
    if (kept.length > 0) {
      const result = kept.join("\n").trim();
      console.log(
        `[cleanup] prompt cleaning applied (multiline) | result=${JSON.stringify(result.slice(0, 80))}`,
      );
      return result;
    }
  }

  // Single line: "instruction: message" — take part after last colon when
  // the prefix looks like an instruction block.
  const colonParts = trimmed.split(/:\s*/);
  if (colonParts.length >= 2) {
    const prefix = colonParts.slice(0, -1).join(":").trim();
    const message = colonParts[colonParts.length - 1]!.trim();
    if (message && looksLikeInstructionPrefix(prefix)) {
      console.log(
        `[cleanup] prompt cleaning applied (colon) | result=${JSON.stringify(message.slice(0, 80))}`,
      );
      return message;
    }
  }

  // Whole string is one instruction line — cannot clean safely.
  if (isInstructionLine(trimmed)) {
    console.warn(
      "[cleanup] could not isolate message — using raw translation",
    );
    return trimmed;
  }

  console.log(
    `[cleanup] no instruction prefix detected — using raw | result=${JSON.stringify(trimmed.slice(0, 80))}`,
  );
  return trimmed;
}
