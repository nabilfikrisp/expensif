import pino from "pino";
import type { EnvSchema } from "@/pkg/env";

export type Logger = pino.Logger;

const LOG_LEVELS: Record<string, string> = {
  development: "debug",
  test: "silent",
  production: "info",
};

export function initLogger(env: EnvSchema): Logger {
  return pino({
    level: LOG_LEVELS[env.NODE_ENV] ?? "info",
  });
}
