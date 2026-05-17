import { Router } from "express";
import * as TranslateController from "../controllers/translate.controller";
import { checkAuth } from "../middleware/check-auth";
import { asyncHandler } from "../middleware/async-handler";

const router = Router();

router.post("/", checkAuth, asyncHandler(TranslateController.translateBatch));

export default router;
