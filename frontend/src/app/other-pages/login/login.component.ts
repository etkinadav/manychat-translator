import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { AuthService } from "../../auth/auth.service";

type AuthMode = "login" | "signup";

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
  host: {
    class: "fill-screen",
    dir: "ltr",
    lang: "en",
  },
})
export class LoginComponent implements OnInit {
  mode: AuthMode = "login";

  username = "";
  password = "";

  signupEmail = "";
  signupPassword = "";
  signupPasswordConfirm = "";

  errorMessage = "";
  isSubmitting = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      void this.router.navigate(["/config"]);
    }
  }

  showLogin(): void {
    this.mode = "login";
    this.errorMessage = "";
  }

  showSignup(): void {
    this.mode = "signup";
    this.errorMessage = "";
  }

  onLoginSubmit(): void {
    this.errorMessage = "";
    this.isSubmitting = true;

    this.authService.login(this.username.trim(), this.password).subscribe({
      next: () => {
        this.isSubmitting = false;
        void this.router.navigate(["/config"]);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.errorMessage = this.httpErrorMessage(err, "Login failed");
      },
    });
  }

  onSignupSubmit(): void {
    this.errorMessage = "";

    if (this.signupPassword !== this.signupPasswordConfirm) {
      this.errorMessage = "Passwords do not match";
      return;
    }

    this.isSubmitting = true;

    this.authService
      .signup(
        this.signupEmail.trim(),
        this.signupPassword,
        this.signupPasswordConfirm,
      )
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          void this.router.navigate(["/config"]);
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting = false;
          this.errorMessage = this.httpErrorMessage(err, "Sign up failed");
        },
      });
  }

  private httpErrorMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string } | undefined;
    return body?.message ?? err.message ?? fallback;
  }
}
