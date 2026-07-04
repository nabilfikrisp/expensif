import "dotenv/config";
import { z } from "zod";
import process from "process";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL must not be empty"),
  PORT: z.coerce.number().int().positive().default(3000),
});

type EnvConfig = z.infer<typeof envSchema>;

export class Env {
  NODE_ENV: string;
  DATABASE_URL: string;
  PORT: number;

  constructor() {
    try {
      const config = envSchema.parse(process.env);
      this.NODE_ENV = config.NODE_ENV;
      this.DATABASE_URL = config.DATABASE_URL;
      this.PORT = config.PORT;
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
      throw error;
    }
  }
}

export type { EnvConfig };
