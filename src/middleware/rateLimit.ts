import type { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = ({ windowMs, max, keyPrefix }: RateLimitOptions) => {
  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${keyPrefix}:${request.ip}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > max) {
      response.status(429).json({
        error: {
          message: "Too many requests. Please wait a moment and try again."
        }
      });
      return;
    }

    next();
  };
};
