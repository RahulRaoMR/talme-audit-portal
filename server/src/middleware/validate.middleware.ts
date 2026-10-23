import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { HttpError } from "../utils/httpError.js";

type RequestInputSource = "body" | "params" | "query";

export function validate(schema: ZodSchema, source: RequestInputSource = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const message = result.error.errors.map((issue) => issue.message).join(", ");
      next(new HttpError(400, message));
      return;
    }

    req[source] = result.data;
    next();
  };
}

