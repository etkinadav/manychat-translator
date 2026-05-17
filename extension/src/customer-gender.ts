/** Customer gender for outgoing Gemini prompts (not the agent). */

export type CustomerGender = "male" | "female";

const STORAGE_KEY = "mct-customer-gender";

export async function readCustomerGender(): Promise<CustomerGender> {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  return data[STORAGE_KEY] === "female" ? "female" : "male";
}

export async function writeCustomerGender(gender: CustomerGender): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: gender });
}
