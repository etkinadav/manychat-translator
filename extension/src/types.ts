export interface CachedOrganization {
  id: string;
  name: string;
  language: string;
  translationContext: string;
}

export interface ExtensionSession {
  email: string;
  language: string;
  gender: "" | "male" | "female";
  organization: CachedOrganization | null;
}

export interface StoredAuth {
  token: string;
  expiration: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  email: string;
  userName: string;
}
