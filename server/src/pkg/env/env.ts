import "dotenv/config";
import { z } from "zod";
import process from "process";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL must not be empty"),
  PORT: z.coerce.number().int().positive().default(3000),
});

type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Environment validation failed:");
    error.issues.forEach((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      console.error(`  ${path}: ${issue.message}`);
    });
  } else {
    console.error("❌ Failed to parse environment variables:", error);
  }
  process.exit(1);
}

export { env };
export type { Env };
