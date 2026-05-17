import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import validator from "validator";
import type { IUser } from "../models/user";
import { User } from "../models/user";

function normalizeLoginId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function buildAuthResponse(user: IUser) {
  const jwtKey = process.env.JWT_KEY;
  if (!jwtKey) {
    throw new Error("JWT_KEY is not configured");
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

  return {
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
  };
}

export async function userLogin(req: Request, res: Response): Promise<void> {
  const username = normalizeLoginId(req.body.username ?? req.body.email);
  const password = String(req.body.password ?? "");

  if (!username || !password) {
    res.status(400).json({ message: "Auth_faild-Missing_credentials" });
    return;
  }

  if (!process.env.JWT_KEY) {
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

    res.status(200).json(buildAuthResponse(user));
  } catch (err) {
    console.error("[auth] login error:", err);
    res.status(401).json({ message: "Auth_faild-Invalid_auth_credentials" });
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const email = normalizeLoginId(req.body.email);
  const password = String(req.body.password ?? "");
  const confirmPassword = String(
    req.body.confirmPassword ?? req.body.passwordConfirm ?? "",
  );

  if (!email) {
    res.status(400).json({ message: "Email is required" });
    return;
  }
  if (!validator.isEmail(email, { require_tld: false })) {
    res.status(400).json({ message: "Invalid email address" });
    return;
  }
  if (!password) {
    res.status(400).json({ message: "Password is required" });
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ message: "Passwords do not match" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "Password must be at least 6 characters" });
    return;
  }

  if (!process.env.JWT_KEY) {
    res.status(500).json({ message: "JWT_KEY is not configured" });
    return;
  }

  try {
    const existing = await User.findOne({
      $or: [{ email }, { username: email }],
    });
    if (existing) {
      res.status(409).json({ message: "An account with this email already exists" });
      return;
    }

    const localPart = email.split("@")[0] ?? "user";
    const user = new User({
      email,
      username: email,
      password,
      provider: "local",
      roles: ["guest", "user"],
      firstName: localPart,
      displayName: localPart,
      language: "en",
    });

    await user.save();
    res.status(201).json(buildAuthResponse(user));
  } catch (err) {
    console.error("[auth] signup error:", err);
    res.status(500).json({ message: "Create_user_failed" });
  }
}
