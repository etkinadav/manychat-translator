import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { AuthService } from "../../auth/auth.service";

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
  username = "";
  password = "";
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

  onSubmit(): void {
    this.errorMessage = "";
    this.isSubmitting = true;

    this.authService.login(this.username.trim(), this.password).subscribe({
      next: () => {
        this.isSubmitting = false;
        void this.router.navigate(["/config"]);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting = false;
        const body = err.error as { message?: string } | undefined;
        this.errorMessage = body?.message ?? err.message ?? "Login failed";
      },
    });
  }
}
