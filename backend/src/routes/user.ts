import { Router } from "express";
import { userLogin } from "../controllers/user.controller";
import {
  disconnectOrganization,
  getProfile,
  updateProfile,
} from "../controllers/profile.controller";
import { checkAuth } from "../middleware/check-auth";

const router = Router();

router.post("/login", (req, res) => {
  void userLogin(req, res);
});

router.get("/profile", checkAuth, (req, res) => {
  void getProfile(req, res);
});

router.patch("/profile", checkAuth, (req, res) => {
  void updateProfile(req, res);
});

router.post("/organization/disconnect", checkAuth, (req, res) => {
  void disconnectOrganization(req, res);
});

export default router;
