import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { LANGUAGE_OPTIONS } from "../../constants/languages";
import { AuthService } from "../../auth/auth.service";
import { ProfileService } from "../../services/profile.service";
import { OrganizationsService } from "../../services/organizations.service";
import { ExtensionSyncService } from "../../services/extension-sync.service";
import type { OrganizationSummary } from "../../models/organization.model";
import type { UserProfile } from "../../models/user-profile.model";

type PickerStep = "hidden" | "list" | "password";

@Component({
  selector: "app-config",
  templateUrl: "./config.component.html",
  styleUrls: ["./config.component.scss"],
  host: {
    class: "fill-screen fill-screen--top",
    dir: "ltr",
    lang: "en",
  },
})
export class ConfigComponent implements OnInit {
  readonly languageOptions = LANGUAGE_OPTIONS;

  profile: UserProfile | null = null;
  pickerStep: PickerStep = "hidden";
  orgList: OrganizationSummary[] = [];
  selectedOrgId = "";
  errorMessage = "";
  statusMessage = "";
  isLoading = true;

  profileLanguage = "en";
  profileGender: "" | "male" | "female" = "";
  connectPassword = "";
  extensionLinkMessage = "";
  extensionId = "";

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private organizationsService: OrganizationsService,
    private extensionSyncService: ExtensionSyncService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.extensionId = this.extensionSyncService.getExtensionId();
    this.loadProfile();
  }

  linkExtension(): void {
    this.extensionSyncService.saveExtensionId(this.extensionId);
    void this.extensionSyncService
      .syncAuthToExtension(this.extensionId)
      .then((result) => {
        this.extensionLinkMessage = result.message;
        if (result.ok) {
          this.statusMessage = result.message;
          this.errorMessage = "";
        } else {
          this.errorMessage = "";
        }
      });
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(["/"]);
  }

  goToOrganizationForm(editId?: string): void {
    if (editId) {
      void this.router.navigate(["/config/organization"], {
        queryParams: { edit: editId },
      });
    } else {
      void this.router.navigate(["/config/organization"]);
    }
  }

  clearMessages(): void {
    this.errorMessage = "";
    this.statusMessage = "";
  }

  loadProfile(): void {
    this.isLoading = true;
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.profileLanguage = profile.language || "en";
        this.profileGender = profile.gender || "";
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        this.errorMessage = this.httpErrorMessage(err, "Failed to load profile");
      },
    });
  }

  saveProfile(): void {
    if (!this.profile) return;
    this.clearMessages();
    this.profileService
      .updateProfile({
        language: this.profileLanguage,
        gender: this.profileGender,
      })
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.statusMessage = "Profile saved.";
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage = this.httpErrorMessage(err, "Failed to save profile");
        },
      });
  }

  openPicker(): void {
    this.clearMessages();
    this.organizationsService.list().subscribe({
      next: (data) => {
        this.orgList = data.organizations;
        this.pickerStep = "list";
        this.selectedOrgId = "";
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage = this.httpErrorMessage(
          err,
          "Failed to load organizations",
        );
      },
    });
  }

  cancelPicker(): void {
    this.pickerStep = "hidden";
    this.connectPassword = "";
  }

  pickerContinue(): void {
    if (!this.selectedOrgId) {
      this.errorMessage = "Select an organization first.";
      return;
    }
    this.clearMessages();
    this.pickerStep = "password";
  }

  pickerBack(): void {
    this.pickerStep = "list";
    this.connectPassword = "";
  }

  get selectedOrg(): OrganizationSummary | undefined {
    return this.orgList.find((o) => o.id === this.selectedOrgId);
  }

  connectOrganization(): void {
    if (!this.selectedOrgId || !this.connectPassword) {
      this.errorMessage = "Enter the organization password.";
      return;
    }
    this.clearMessages();
    this.organizationsService
      .connect(this.selectedOrgId, this.connectPassword)
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.pickerStep = "hidden";
          this.connectPassword = "";
          this.statusMessage = "Connected to organization.";
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage = this.httpErrorMessage(
            err,
            "Failed to connect organization",
          );
        },
      });
  }

  disconnectOrganization(): void {
    this.clearMessages();
    this.profileService.disconnectOrganization().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.statusMessage = "Disconnected from organization.";
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage = this.httpErrorMessage(err, "Failed to disconnect");
      },
    });
  }

  private httpErrorMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string; error?: string } | undefined;
    return body?.message ?? body?.error ?? err.message ?? fallback;
  }
}
