import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user";

function normalizeLoginId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export async function userLogin(req: Request, res: Response): Promise<void> {
  const username = normalizeLoginId(req.body.username ?? req.body.email);
  const password = String(req.body.password ?? "");

  if (!username || !password) {
    res.status(400).json({ message: "Auth_faild-Missing_credentials" });
    return;
  }

  const jwtKey = process.env.JWT_KEY;
  if (!jwtKey) {
    res.status(500).json({ message: "JWT_KEY is not configured" });
    return;
  }

  try {
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });

    if (!user) {
      res.status(401).json({ message: "Auth_faild-Email_dosnt_exist" });
      return;
    }

    const hashedIncomingPassword = user.hashPassword(password);
    const passwordOk =
      hashedIncomingPassword.toString() === user.password.toString();

    if (!passwordOk) {
      res.status(401).json({ message: "Auth_faild-Wrong_password" });
      return;
    }

    const token = jwt.sign(
      {
        email: user.email,
        userId: user._id,
        roles: user.roles,
      },
      jwtKey,
      { expiresIn: "24h" },
    );

    res.status(200).json({
      token,
      expiresIn: 86400,
      userId: user._id,
      home_printingServices_list: user.home_printingServices_list,
      home_branches_list: user.home_branches_list,
      provider: user.provider,
      language: user.language,
      roles: user.roles,
      userName: user.username,
      email: user.email,
    });
  } catch (err) {
    console.error("[auth] login error:", err);
    res.status(401).json({ message: "Auth_faild-Invalid_auth_credentials" });
  }
}
