import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type { UserProfile } from "../models/user-profile.model";

@Injectable({ providedIn: "root" })
export class ProfileService {
  constructor(private http: HttpClient) {}

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>("/api/user/profile");
  }

  updateProfile(patch: {
    language?: string;
    gender?: string;
  }): Observable<UserProfile> {
    return this.http.patch<UserProfile>("/api/user/profile", patch);
  }

  disconnectOrganization(): Observable<UserProfile> {
    return this.http.post<UserProfile>("/api/user/organization/disconnect", {});
  }
}
