import { Router } from "express";
import {
  connectOrganization,
  createOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
} from "../controllers/organization.controller";
import { checkAuth } from "../middleware/check-auth";

const router = Router();

router.get("/", checkAuth, (req, res) => {
  void listOrganizations(req, res);
});

router.post("/", checkAuth, (req, res) => {
  void createOrganization(req, res);
});

router.post("/connect", checkAuth, (req, res) => {
  void connectOrganization(req, res);
});

router.get("/:id", checkAuth, (req, res) => {
  void getOrganization(req, res);
});

router.patch("/:id", checkAuth, (req, res) => {
  void updateOrganization(req, res);
});

export default router;
