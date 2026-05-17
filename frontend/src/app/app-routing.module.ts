import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "./auth/auth.guard";
import { ConfigComponent } from "./other-pages/config/config.component";
import { LoginComponent } from "./other-pages/login/login.component";
import { OrganizationFormComponent } from "./other-pages/organization-form/organization-form.component";

const routes: Routes = [
  { path: "", component: LoginComponent },
  {
    path: "config",
    component: ConfigComponent,
    canActivate: [AuthGuard],
  },
  {
    path: "config/organization",
    component: OrganizationFormComponent,
    canActivate: [AuthGuard],
  },
  { path: "**", redirectTo: "" },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
