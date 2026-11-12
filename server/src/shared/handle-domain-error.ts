import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { ApiKeyError } from "@/modules/api-key/error";
import { AuthError } from "@/modules/auth/error";
import { LinkedAccountError } from "@/modules/linked-account/error";
import { UserError } from "@/modules/user/error";

export const handleDomainError: ErrorHandler = (error, c) => {
  if (
    error instanceof ApiKeyError ||
    error instanceof AuthError ||
    error instanceof LinkedAccountError ||
    error instanceof UserError
  ) {
    return c.json(
      {
        success: false,
        message: error.message,
        error: error.code,
      },
      error.statusCode as ContentfulStatusCode
    );
  }

  throw error;
};
