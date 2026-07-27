import "dotenv/config";
import { z } from "zod";
import process from "process";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL must not be empty"),
  PORT: z.coerce.number().int().positive().default(3000),
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN must not be empty"),
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY must not be empty"),
  OPENROUTER_MODEL: z.string().optional().default("openrouter/free"),
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
