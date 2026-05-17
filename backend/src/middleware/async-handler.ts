import type { NextFunction, Request, Response, RequestHandler } from "express";

type AsyncRequestHandler<T extends Request = Request> = (
  req: T,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export function asyncHandler<T extends Request = Request>(
  fn: AsyncRequestHandler<T>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req as T, res, next).catch(next);
  };
}
