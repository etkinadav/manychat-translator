const AUTH_STORAGE_KEY = "mct-auth";

export interface LoginResponse {
  token: string;
  expiresIn: number;
  userId: string;
  userName: string;
  email: string;
  roles: string[];
}

interface StoredAuth {
  token: string;
  expiration: string;
  userId: string;
  userName: string;
  email: string;
}

export function isAuthenticated(): boolean {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw) as StoredAuth;
    if (!data.token || !data.expiration) return false;
    return new Date(data.expiration) > new Date();
  } catch {
    return false;
  }
}

export function getToken(): string | null {
  if (!isAuthenticated()) return null;
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  return (JSON.parse(raw) as StoredAuth).token;
}

export function saveAuth(response: LoginResponse): void {
  const expiration = new Date(Date.now() + response.expiresIn * 1000);
  const payload: StoredAuth = {
    token: response.token,
    expiration: expiration.toISOString(),
    userId: response.userId,
    userName: response.userName,
    email: response.email,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch("/api/user/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const body = (await res.json()) as LoginResponse & { message?: string };
  if (!res.ok) {
    throw new Error(body.message ?? "Login failed");
  }
  saveAuth(body);
  return body;
}

export function logout(): void {
  clearAuth();
}
