import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AuthService } from "@/modules/auth/service";
import type { CookieJar } from "@/pkg/cookies";
import { rateLimit } from "@/pkg/http/rate-limit-middleware";
import { errorRespSchema, tokenRespSchema } from "@/shared/response.schema";

export const registerReqSchema = z
  .object({
    email: z.email().openapi({ example: "user@example.com" }),
    password: z.string().min(6).openapi({ example: "password123" }),
    name: z.string().min(1).openapi({ example: "John Doe" }),
  })
  .openapi("RegisterBody");

export const registerRespSchema = tokenRespSchema;

const registerRoute = createRoute({
  method: "post",
  path: "/register",
  request: { body: { content: { "application/json": { schema: registerReqSchema } } } },
  middleware: [
    rateLimit({
      limit: 50,
    }),
  ],
  responses: {
    201: {
      content: { "application/json": { schema: registerRespSchema } },
      description: "User registered",
    },
    400: {
      content: { "application/json": { schema: errorRespSchema } },
      description: "Validation error",
    },
    409: {
      content: { "application/json": { schema: errorRespSchema } },
      description: "Email already registered",
    },
  },
});

export function initRegisterRoute(authService: AuthService, cookieJar: CookieJar) {
  const app = new OpenAPIHono();

  app.openapi(registerRoute, async (c) => {
    const { email, password, name } = c.req.valid("json");
    const result = await authService.register(email, password, name);
    cookieJar.setRefreshCookie(c, result.refreshToken);
    cookieJar.setCsrfCookie(c, result.csrfToken);
    return c.json(
      { success: true, message: "success", data: { accessToken: result.accessToken } },
      201
    );
  });

  return app;
}
