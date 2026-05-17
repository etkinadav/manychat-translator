import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { LANGUAGE_OPTIONS } from "../../constants/languages";
import { OrganizationsService } from "../../services/organizations.service";

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

  language = "en";
  translationContext = "";
  password = "";

  errorMessage = "";
  statusMessage = "";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private organizationsService: OrganizationsService,
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

  onSubmit(): void {
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

    if (this.isEdit) {
      this.organizationsService
        .update(this.editId, {
          language: this.language,
          translationContext: this.translationContext.trim(),
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
      .create({
        language: this.language,
        translationContext: this.translationContext.trim(),
        password: this.password,
      })
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

  private loadForm(): void {
    if (!this.isEdit) {
      this.language = "en";
      this.translationContext = "";
      this.password = "";
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.organizationsService.get(this.editId).subscribe({
      next: (data) => {
        this.language = data.organization.language;
        this.translationContext = data.organization.translationContext;
        this.password = "";
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        this.errorMessage = this.httpErrorMessage(err, "Failed to load form");
      },
    });
  }

  private httpErrorMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string; error?: string } | undefined;
    return body?.message ?? body?.error ?? err.message ?? fallback;
  }
}
