export type CustomerGender = "male" | "female";

export function parseCustomerGender(value: unknown): CustomerGender {
  return value === "female" ? "female" : "male";
}

export function parseAgentGender(
  value: unknown,
  fallback: "" | "male" | "female" = "male",
): "male" | "female" {
  if (value === "female" || value === "male") return value;
  if (fallback === "female" || fallback === "male") return fallback;
  return "male";
}
