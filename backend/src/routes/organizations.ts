import { Router } from "express";
import * as OrganizationController from "../controllers/organization.controller";
import { checkAuth } from "../middleware/check-auth";
import { asyncHandler } from "../middleware/async-handler";

const router = Router();

router.get("/", checkAuth, asyncHandler(OrganizationController.listOrganizations));
router.post("/", checkAuth, asyncHandler(OrganizationController.createOrganization));
router.post(
  "/connect",
  checkAuth,
  asyncHandler(OrganizationController.connectOrganization),
);
router.get("/:id", checkAuth, asyncHandler(OrganizationController.getOrganization));
router.patch(
  "/:id",
  checkAuth,
  asyncHandler(OrganizationController.updateOrganization),
);

export default router;
