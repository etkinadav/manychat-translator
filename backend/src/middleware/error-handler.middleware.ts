import type { NextFunction, Request, Response } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  console.error("[app] unhandled error:", err);
  const status =
    err.message.startsWith("Origin not allowed by CORS") ? 403 : 500;
  res.status(status).json({
    error: err.message || "Internal server error",
  });
}
