/**
 * Strips translated instruction headers from outgoing Google Translate responses.
 */

/** Full-line instruction lines (multiline responses). */
const INSTRUCTION_LINE_PATTERNS: RegExp[] = [
  /^translate\s+to\s+/i,
  /^תרגם\s+ל/i,
  /the\s+speaker\s+is\s+(female|male|a\s+woman|a\s+man)/i,
  /speaker\s+is\s+(female|male)/i,
  /the\s+customer\s+is\s+(female|male|a\s+woman|a\s+man)/i,
  /customer\s+is\s+(female|male)/i,
  /writing a reply to a (female|male) customer/i,
  /i am a (female|male) customer support agent/i,
  /i am a (female|male) agent writing/i,
  /the writer is a (female|male) agent/i,
  /use feminine first person/i,
  /use masculine first person/i,
  /the reader is one (female|male) customer/i,
  /^message:/i,
  /one person speaking to one person/i,
  /use singular informal you/i,
  /i am writing a reply to a (female|male) customer/i,
  /use (feminine|masculine) grammar when addressing/i,
  /use correct grammar for the (female|male) customer/i,
  /use correct grammar for a (female|male) agent/i,
  /when the agent uses first person/i,
  /when the agent speaks in first person/i,
  /in hebrew:/i,
  /feminine forms when addressing/i,
  /masculine forms when addressing/i,
  /^צורות\s+(זכר|נקבה)\s+בפנייה/i,
  /פנייה בלשון/i,
  /\(לקוח[^)]*\)/,
  /^הדוברת\s+היא\s+אישה/i,
  /^הדובר\s+הוא\s+גבר/i,
  /^הדובר(ת)?\s+היא?\s+/i,
  /^הלקוח\s+הוא\s+גבר/i,
  /^הלקוחה\s+היא\s+אישה/i,
  /^הלקוח(ה)?\s+/i,
  /^תרגם\s+/i,
  /^[-─—\s]+$/,
];

/**
 * Instruction blocks Google merges onto one line before the real message.
 * Stripped repeatedly from the start of the string.
 */
const MERGED_INSTRUCTION_PREFIX_PATTERNS: RegExp[] = [
  /^צורות\s+(זכר|נקבה)\s+בפנייה[^.]*\.\s*/u,
  /^תרגם\s+לעברית[^.]*\.\s*/u,
  /^אני\s+כותב(?:ת)?\s+תשובה\s+ללקוח[^.]*\.\s*/u,
  /^אני\s+נציג(?:ה)?\s+[^.]*כותב(?:ת)?\s+ללקוח[^.]*\.\s*/u,
  /^השתמש(?:י)?\s+ב[^.]*דקדוק[^.]*\.\s*/u,
  /^translate\s+to\s+[^.]+?\.\s*/i,
  /^אני\s+כותב(?:ת)?\s+תשובה\s+ללקוח(?:ה)?\s+[^.]*\.\s*/u,
  /^i am writing a reply to a (female|male) customer[^.]*\.\s*/i,
  /^use (feminine|masculine) grammar when addressing[^.]*\.\s*/i,
  /^in hebrew:[^.]*\.\s*/i,
  /^אני\s+(?:נציג|נציגה)\s+[^.]*\.\s*/u,
];

function isInstructionLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  return INSTRUCTION_LINE_PATTERNS.some((p) => p.test(t));
}

function looksLikeInstructionPrefix(segment: string): boolean {
  return /translate|תרגם|speaker|דובר|customer|לקוח|agent|נציג|grammar|דקדוק|צורות|פנייה/i.test(
    segment,
  );
}

function stripMergedInstructionPrefixes(text: string): string {
  let result = text.trim();
  for (let i = 0; i < 8; i++) {
    let changed = false;
    for (const pattern of MERGED_INSTRUCTION_PREFIX_PATTERNS) {
      const next = result.replace(pattern, "");
      if (next !== result) {
        result = next.trim();
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return result;
}

/**
 * Remove translated instruction prefixes from a single Google response string.
 * Falls back to the raw string if nothing usable remains.
 */
export function cleanOutgoingTranslation(raw: string): string {
  let working = raw.trim();
  if (!working) return working;

  const afterMerge = stripMergedInstructionPrefixes(working);
  if (afterMerge !== working) {
    console.log(
      `[cleanup] merged-prefix strip | result=${JSON.stringify(afterMerge.slice(0, 80))}`,
    );
    working = afterMerge;
  }

  if (/\r?\n/.test(working)) {
    const lines = working
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const kept = lines.filter((l) => !isInstructionLine(l));
    if (kept.length > 0) {
      const result = kept.join("\n").trim();
      console.log(
        `[cleanup] multiline | result=${JSON.stringify(result.slice(0, 80))}`,
      );
      return result;
    }
  }

  const colonIdx = working.lastIndexOf(":");
  if (colonIdx >= 0) {
    const prefix = working.slice(0, colonIdx).trim();
    const message = working.slice(colonIdx + 1).trim();
    if (message && looksLikeInstructionPrefix(prefix)) {
      console.log(
        `[cleanup] colon | result=${JSON.stringify(message.slice(0, 80))}`,
      );
      return message;
    }
  }

  if (isInstructionLine(working)) {
    console.warn(
      "[cleanup] could not isolate message — using raw translation",
    );
    return working;
  }

  console.log(
    `[cleanup] no prefix detected | result=${JSON.stringify(working.slice(0, 80))}`,
  );
  return working;
}

