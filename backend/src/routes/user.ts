import { Router } from "express";
import * as UserController from "../controllers/user.controller";
import * as ProfileController from "../controllers/profile.controller";
import { checkAuth } from "../middleware/check-auth";
import { asyncHandler } from "../middleware/async-handler";

const router = Router();

router.post("/signup", asyncHandler(UserController.createUser));
router.post("/login", asyncHandler(UserController.userLogin));

router.get("/profile", checkAuth, asyncHandler(ProfileController.getProfile));
router.patch("/profile", checkAuth, asyncHandler(ProfileController.updateProfile));
router.post(
  "/organization/disconnect",
  checkAuth,
  asyncHandler(ProfileController.disconnectOrganization),
);

export default router;
