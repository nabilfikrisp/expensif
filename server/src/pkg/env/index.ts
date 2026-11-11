import "dotenv/config";
import { z } from "zod";
import process from "process";

import { PROXY_KINDS } from "@/shared/proxy-ip";

const originSchema = z.url().refine((value) => {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && url.origin === value;
}, "Must be an HTTP(S) origin without a path, trailing slash, credentials, query, or fragment");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DEPLOY_PROXY: z.enum(PROXY_KINDS).default("none"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL must not be empty"),
    PORT: z.coerce.number().int().positive().default(3000),
    API_ORIGIN: originSchema.default("http://localhost:3000"),
    FRONTEND_ORIGIN: originSchema.default("http://localhost:5173"),
    TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN must not be empty"),
    OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY must not be empty"),
    OPENROUTER_MODEL: z.string().optional().default("openrouter/free"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be valid and not empty"),
    ACCESS_TOKEN_EXPIRES_IN_MINUTES: z.string().default("5m"),
    SESSION_IDLE_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(2 * 60 * 60),
    SESSION_ABSOLUTE_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(24 * 60 * 60),
    API_KEY_SECRET: z.string().min(32, "API_KEY_SECRET must be valid and not empty"),
    API_KEY_REDEEM_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      for (const field of ["API_ORIGIN", "FRONTEND_ORIGIN"] as const) {
        if (!env[field].startsWith("https://")) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Production origins must use HTTPS",
          });
        }
      }
    }
  });

export type EnvSchema = z.infer<typeof envSchema>;

export function initEnv(): EnvSchema {
  try {
    const config = envSchema.parse(process.env);
    return config;
  } catch (error: unknown) {
    return handleError(error);
  }
}

function handleError(error: unknown): never {
  if (error instanceof z.ZodError) {
    console.error("Environment validation failed:");
    error.issues.forEach((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      console.error(` - ${path}: ${issue.message}`);
    });
  } else {
    console.error("Failed to parse environment variables:", error);
  }
  // eslint-disable-next-line n/no-process-exit
  process.exit(1);
}
