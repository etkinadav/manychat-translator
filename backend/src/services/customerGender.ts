export type CustomerGender = "male" | "female";

export function parseCustomerGender(value: unknown): CustomerGender {
  return value === "female" ? "female" : "male";
}
