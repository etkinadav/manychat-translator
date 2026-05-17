import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userData?: {
    email: string;
    userId: string;
  };
}

export function checkAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res
        .status(401)
        .json({ message: "Check_auth-Auth-Faild-token-incorrect" });
      return;
    }
    const token = authHeader.split(" ")[1];
    const jwtKey = process.env.JWT_KEY;
    if (!jwtKey) {
      res.status(500).json({ message: "JWT_KEY is not configured" });
      return;
    }
    const decoded = jwt.verify(token, jwtKey) as {
      email: string;
      userId: string;
    };
    req.userData = {
      email: decoded.email,
      userId: decoded.userId,
    };
    next();
  } catch {
    res.status(401).json({ message: "Check_auth-Auth-Faild-token-incorrect" });
  }
}
