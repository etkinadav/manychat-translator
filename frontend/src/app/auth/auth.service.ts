import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";

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

@Injectable({ providedIn: "root" })
export class AuthService {
  constructor(private http: HttpClient) {}

  isAuthenticated(): boolean {
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

  getToken(): string | null {
    if (!this.isAuthenticated()) return null;
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as StoredAuth).token;
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>("/api/user/login", { username, password })
      .pipe(tap((response) => this.saveAuth(response)));
  }

  logout(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  private saveAuth(response: LoginResponse): void {
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
}
