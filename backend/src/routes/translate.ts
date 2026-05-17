import { Router } from "express";
import * as TranslateController from "../controllers/translate.controller";
import { asyncHandler } from "../middleware/async-handler";

const router = Router();

router.post("/", asyncHandler(TranslateController.translateBatch));

export default router;
