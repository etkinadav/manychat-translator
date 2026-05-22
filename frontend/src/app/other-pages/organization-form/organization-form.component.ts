import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { LANGUAGE_OPTIONS } from "../../constants/languages";
import type {
  OrganizationTerm,
  OrganizationTermCategory,
  OrganizationTermInterpretation,
} from "../../models/organization.model";
import type { WebsiteListItem } from "../../models/website.model";
import { OrganizationsService } from "../../services/organizations.service";
import { WebsitesService } from "../../services/websites.service";

@Component({
  selector: "app-organization-form",
  templateUrl: "./organization-form.component.html",
  styleUrls: ["./organization-form.component.scss"],
  host: {
    class: "fill-screen fill-screen--top",
    dir: "ltr",
    lang: "en",
  },
})
export class OrganizationFormComponent implements OnInit {
  readonly languageOptions = LANGUAGE_OPTIONS;

  editId = "";
  isEdit = false;
  isLoading = true;

  name = "";
  language = "en";
  translationContext = "";
  password = "";
  terms: OrganizationTermCategory[] = [];
  availableWebsites: WebsiteListItem[] = [];
  selectedWebsiteIds: string[] = [];

  errorMessage = "";
  statusMessage = "";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private organizationsService: OrganizationsService,
    private websitesService: WebsitesService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.editId = (params["edit"] ?? "").trim();
      this.isEdit = this.editId.length > 0;
      this.loadForm();
    });
  }

  back(): void {
    void this.router.navigate(["/config"]);
  }

  addCategory(): void {
    this.terms.push({ name: "", terms: [] });
  }

  removeCategory(index: number): void {
    this.terms.splice(index, 1);
  }

  addTerm(categoryIndex: number): void {
    const category = this.terms[categoryIndex];
    if (!category) return;
    category.terms.push({
      name: "",
      description: "",
      interpretations: [{ text: "" }],
    });
  }

  removeTerm(categoryIndex: number, termIndex: number): void {
    this.terms[categoryIndex]?.terms.splice(termIndex, 1);
  }

  addInterpretation(categoryIndex: number, termIndex: number): void {
    const term = this.terms[categoryIndex]?.terms[termIndex];
    if (!term) return;
    term.interpretations.push({ text: "" });
  }

  removeInterpretation(
    categoryIndex: number,
    termIndex: number,
    interpretationIndex: number,
  ): void {
    const term = this.terms[categoryIndex]?.terms[termIndex];
    if (!term) return;
    term.interpretations.splice(interpretationIndex, 1);
  }

  trackByIndex(index: number): number {
    return index;
  }

  isWebsiteSelected(id: string): boolean {
    return this.selectedWebsiteIds.includes(id);
  }

  toggleWebsite(id: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedWebsiteIds.includes(id)) {
        this.selectedWebsiteIds = [...this.selectedWebsiteIds, id];
      }
      return;
    }
    this.selectedWebsiteIds = this.selectedWebsiteIds.filter((w) => w !== id);
  }

  onSubmit(): void {
    if (!this.name.trim()) {
      this.errorMessage = "Organization name is required.";
      this.statusMessage = "";
      return;
    }
    if (!this.translationContext.trim()) {
      this.errorMessage = "Translation context is required.";
      this.statusMessage = "";
      return;
    }
    if (!this.isEdit && !this.password) {
      this.errorMessage = "Password is required for a new organization.";
      this.statusMessage = "";
      return;
    }

    this.errorMessage = "";
    const payload = {
      name: this.name.trim(),
      language: this.language,
      translationContext: this.translationContext.trim(),
      terms: this.serializeTerms(),
      websites: [...this.selectedWebsiteIds],
    };

    if (this.isEdit) {
      this.organizationsService
        .update(this.editId, {
          ...payload,
          ...(this.password ? { password: this.password } : {}),
        })
        .subscribe({
          next: () => {
            this.statusMessage = "Organization updated.";
          },
          error: (err: HttpErrorResponse) => {
            this.errorMessage = this.httpErrorMessage(err, "Save failed");
          },
        });
      return;
    }

    this.organizationsService
      .create({ ...payload, password: this.password })
      .subscribe({
        next: () => {
          this.statusMessage = "Organization created.";
          setTimeout(() => this.back(), 600);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage = this.httpErrorMessage(err, "Save failed");
        },
      });
  }

  private serializeTerms(): OrganizationTermCategory[] {
    return this.terms
      .map((category) => ({
        name: category.name.trim(),
        terms: category.terms
          .map((term) => this.serializeTerm(term))
          .filter((term) => term.name.length > 0),
      }))
      .filter((category) => category.name.length > 0);
  }

  private serializeTerm(term: OrganizationTerm): OrganizationTerm {
    return {
      name: term.name.trim(),
      description: term.description.trim(),
      interpretations: term.interpretations
        .map((item) => ({ text: item.text.trim() }))
        .filter((item) => item.text.length > 0),
    };
  }

  private loadForm(): void {
    this.isLoading = true;
    this.websitesService.list().subscribe({
      next: ({ websites }) => {
        this.availableWebsites = websites;
        if (!this.isEdit) {
          this.name = "";
          this.language = "en";
          this.translationContext = "";
          this.password = "";
          this.terms = [];
          const manychat = websites.find((w) => w.slug === "manychat");
          this.selectedWebsiteIds = manychat ? [manychat.id] : [];
          this.isLoading = false;
          return;
        }

        this.organizationsService.get(this.editId).subscribe({
          next: (data) => {
            this.name = data.organization.name;
            this.language = data.organization.language;
            this.translationContext = data.organization.translationContext;
            this.password = "";
            this.terms = this.cloneTerms(data.organization.terms ?? []);
            this.selectedWebsiteIds = [...(data.organization.websiteIds ?? [])];
            this.isLoading = false;
          },
          error: (err: HttpErrorResponse) => {
            this.isLoading = false;
            this.errorMessage = this.httpErrorMessage(err, "Failed to load form");
          },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        this.errorMessage = this.httpErrorMessage(err, "Failed to load websites");
      },
    });
  }

  private cloneTerms(
    raw: OrganizationTermCategory[],
  ): OrganizationTermCategory[] {
    return raw.map((category) => ({
      name: category.name ?? "",
      terms: (category.terms ?? []).map((term) => ({
        name: term.name ?? "",
        description: term.description ?? "",
        interpretations: this.cloneInterpretations(term.interpretations),
      })),
    }));
  }

  private cloneInterpretations(
    raw: OrganizationTermInterpretation[] | undefined,
  ): OrganizationTermInterpretation[] {
    const items = (raw ?? []).map((item) => ({ text: item.text ?? "" }));
    return items.length > 0 ? items : [{ text: "" }];
  }

  private httpErrorMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string; error?: string } | undefined;
    return body?.message ?? body?.error ?? err.message ?? fallback;
  }
}
