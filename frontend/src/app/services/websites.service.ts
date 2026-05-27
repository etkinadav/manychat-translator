import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type { WebsiteListItem } from "../models/website.model";

@Injectable({ providedIn: "root" })
export class WebsitesService {
  constructor(private http: HttpClient) {}

  list(): Observable<{ websites: WebsiteListItem[] }> {
    return this.http.get<{ websites: WebsiteListItem[] }>("/api/websites");
  }

  updateOthersRole(
    id: string,
    othersRole: string,
  ): Observable<{ website: WebsiteListItem }> {
    return this.http.patch<{ website: WebsiteListItem }>(`/api/websites/${id}`, {
      othersRole,
    });
  }
}
