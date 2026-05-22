import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type {
  OrganizationDetails,
  OrganizationSummary,
  OrganizationTermCategory,
} from "../models/organization.model";
import type { UserProfile } from "../models/user-profile.model";

@Injectable({ providedIn: "root" })
export class OrganizationsService {
  constructor(private http: HttpClient) {}

  list(): Observable<{ organizations: OrganizationSummary[] }> {
    return this.http.get<{ organizations: OrganizationSummary[] }>(
      "/api/organizations",
    );
  }

  get(id: string): Observable<{ organization: OrganizationDetails }> {
    return this.http.get<{ organization: OrganizationDetails }>(
      `/api/organizations/${encodeURIComponent(id)}`,
    );
  }

  create(payload: {
    name: string;
    language: string;
    translationContext: string;
    terms: OrganizationTermCategory[];
    websites: string[];
    password: string;
  }): Observable<{ organization: OrganizationDetails }> {
    return this.http.post<{ organization: OrganizationDetails }>(
      "/api/organizations",
      payload,
    );
  }

  update(
    id: string,
    payload: {
      name: string;
      language: string;
      translationContext: string;
      terms: OrganizationTermCategory[];
      websites: string[];
      password?: string;
    },
  ): Observable<{ organization: OrganizationDetails }> {
    return this.http.patch<{ organization: OrganizationDetails }>(
      `/api/organizations/${encodeURIComponent(id)}`,
      payload,
    );
  }

  connect(
    organizationId: string,
    password: string,
  ): Observable<UserProfile> {
    return this.http.post<UserProfile>("/api/organizations/connect", {
      organizationId,
      password,
    });
  }
}
