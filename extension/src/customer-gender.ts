/** Customer gender for outgoing Gemini prompts (not the agent). */

export type CustomerGender = "male" | "female";

export type NameGenderCategory =
  | "male"
  | "female"
  | "male or female"
  | "unknown";

/** Radio name on composer toolbar gender selector (must match outgoing.ts). */
export const CUSTOMER_GENDER_INPUT_NAME = "data-mc-customer-gender";

const STORAGE_KEY = "mct-customer-gender";

export async function readCustomerGender(): Promise<CustomerGender> {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  return data[STORAGE_KEY] === "female" ? "female" : "male";
}

export async function writeCustomerGender(gender: CustomerGender): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: gender });
}

/**
 * "female" contains "male" — strip female tokens before testing for male.
 * Update toolbar only when exactly one gender is present in the text.
 */
export function inferClearCustomerGenderFromText(
  text: string,
): CustomerGender | null {
  const lower = text.toLowerCase();
  const hasFemale = lower.includes("female");
  const withoutFemale = lower.replace(/female/g, "");
  const hasMale = withoutFemale.includes("male");

  if (hasFemale && hasMale) return null;
  if (hasFemale) return "female";
  if (hasMale) return "male";
  return null;
}

export function inferClearCustomerGenderFromCategory(
  category: NameGenderCategory,
): CustomerGender | null {
  if (category === "male") return "male";
  if (category === "female") return "female";
  return null;
}

/** Persist and sync all Male/Female radios on outgoing toolbars. */
export async function applyCustomerGenderOnPage(
  gender: CustomerGender,
): Promise<void> {
  await writeCustomerGender(gender);
  for (const input of document.querySelectorAll<HTMLInputElement>(
    `input[name="${CUSTOMER_GENDER_INPUT_NAME}"]`,
  )) {
    input.checked = input.value === gender;
  }
}
