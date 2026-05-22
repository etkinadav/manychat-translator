import { Router } from "express";
import { listWebsites } from "../controllers/website.controller";
import { checkAuth } from "../middleware/check-auth";
import { asyncHandler } from "../middleware/async-handler";

const router = Router();

router.get("/", checkAuth, asyncHandler(listWebsites));

export default router;
