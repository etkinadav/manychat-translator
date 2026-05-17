import { Router } from "express";
import { userLogin } from "../controllers/user.controller";
import { checkAuth, type AuthRequest } from "../middleware/check-auth";

const router = Router();

router.post("/login", (req, res) => {
  void userLogin(req, res);
});

router.get("/me", checkAuth, (req: AuthRequest, res) => {
  res.status(200).json({
    email: req.userData?.email,
    userId: req.userData?.userId,
  });
});

export default router;
